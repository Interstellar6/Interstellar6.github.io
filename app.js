(function () {
  const seed = window.RELUMEOW_DATA || {};
  const site = seed.site || {};
  const project = seed.project || null;
  let docs = Array.isArray(seed.docs) ? seed.docs : [];
  const projects = Array.isArray(seed.projects) ? seed.projects : (project ? [projectSummary(project, docs)] : []);
  let tree = Array.isArray(seed.tree) ? seed.tree : [];
  const configuredApiUrl = String(site.access_api_url || "").trim();
  const API_URL = (configuredApiUrl === "same-origin"
    ? window.location.origin
    : (configuredApiUrl || site.api_url || window.location.origin)
  ).replace(/\/+$/, "");
  const ACCESS_KEY = "relumeow-access-v1";
  const THEME_KEY = "relumeow-theme-v1";
  const DIRECTORY_KEY = "relumeow-directory-expanded-v1";
  const DISCUSSION_KEY = "relumeow-discussion-v1";
  const LAYOUT_KEY = "relumeow-layout-v1";

  let activeDocId = "";
  let activeQuery = "";
  let accessState = { checked: false, allowed: false, reason: "" };
  let protectedDataLoaded = !seed.protected;
  let pendingLoginRoute = "";
  let expandedDirs = new Set([""]);
  let activeSelection = null;
  let expandedDirsLoadedFor = "";
  let activeDiscussion = { comments: [], annotations: [] };
  let editMode = false;
  let renderedDoc = null;
  let docOverrides = {};

  const $ = (id) => document.getElementById(id);
  const els = {
    directoryTree: $("directoryTree"),
    routeLabel: $("routeLabel"),
    pageTitle: $("pageTitle"),
    searchInput: $("searchInput"),
    homeView: $("homeView"),
    projectView: $("projectView"),
    loginView: $("loginView"),
    adminView: $("adminView"),
    documentPanel: $("documentPanel"),
    accountButton: $("accountButton"),
    accountAvatar: $("accountAvatar"),
    accountLabel: $("accountLabel"),
    accountPopover: $("accountPopover"),
    themeToggle: $("themeToggle"),
    themeLabel: $("themeLabel"),
    railToggle: $("railToggle"),
    railResizer: $("railResizer"),
  };

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const stripMarkdown = (value) => String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_\-|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const slugify = (value) => {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_/\\]+/g, "-")
      .replace(/[^\w\u4e00-\u9fff.-]+/g, "")
      .replace(/^-+|-+$/g, "");
    return slug || "section";
  };

  function currentPath() {
    const path = window.location.pathname.replace(/\/+$/, "/");
    if (path === "/") return "/home/";
    return path;
  }

  function projectSummary(item, projectDocs) {
    return {
      slug: item.slug,
      route: item.route,
      title: item.title,
      brand: item.brand || item.title,
      mark: item.mark || String(item.title || "P").slice(0, 3),
      subtitle: item.subtitle || "",
      description: item.description || "",
      access: item.access || {},
      doc_count: item.doc_count ?? projectDocs.length,
      overview_id: item.overview_id || projectDocs.find((doc) => doc.is_overview && !doc.directory)?.id || projectDocs[0]?.id || "",
      updated: item.updated || projectDocs.reduce((max, doc) => String(doc.updated || "") > max ? doc.updated : max, ""),
    };
  }

  function storedAccess(realm) {
    try {
      const all = JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
      return all[realm] || null;
    } catch (_error) {
      return null;
    }
  }

  function saveAccess(realm, token, expiresAt) {
    try {
      const all = JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
      all[realm] = { token, expiresAt };
      localStorage.setItem(ACCESS_KEY, JSON.stringify(all));
    } catch (_error) {
      // Access can still work for the current response; persistence is best-effort.
    }
  }

  function accessEntries() {
    return projects
      .map((item) => {
        const realm = item.access?.realm || item.slug;
        const stored = storedAccess(realm);
        return stored?.token ? { project: item, realm, ...stored } : null;
      })
      .filter(Boolean);
  }

  function primaryAccessEntry() {
    if (project) {
      const realm = project.access?.realm || project.slug;
      const stored = storedAccess(realm);
      if (stored?.token) return { project, realm, ...stored };
      return null;
    }
    return accessEntries()[0] || null;
  }

  function clearAccess(realm) {
    try {
      const all = JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
      if (realm) delete all[realm];
      else Object.keys(all).forEach((key) => delete all[key]);
      localStorage.setItem(ACCESS_KEY, JSON.stringify(all));
    } catch (_error) {
      localStorage.removeItem(ACCESS_KEY);
    }
  }

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // Local persistence is best-effort; the UI still works for this session.
    }
  }

  function storageScope() {
    return project?.slug || "home";
  }

  function discussionKey(docId = activeDocId) {
    return `${storageScope()}::${docId || "none"}`;
  }

  function loadDiscussions(docId = activeDocId) {
    const all = loadJson(DISCUSSION_KEY, {});
    const entry = all[discussionKey(docId)] || {};
    return {
      comments: Array.isArray(entry.comments) ? entry.comments : [],
      annotations: Array.isArray(entry.annotations) ? entry.annotations : [],
    };
  }

  function saveDiscussions(docId, entry) {
    const all = loadJson(DISCUSSION_KEY, {});
    all[discussionKey(docId)] = {
      comments: Array.isArray(entry.comments) ? entry.comments : [],
      annotations: Array.isArray(entry.annotations) ? entry.annotations : [],
    };
    saveJson(DISCUSSION_KEY, all);
  }

  async function loadRemoteDiscussions(docId) {
    if (!project || !docId) return loadDiscussions(docId);
    try {
      const realm = project.access?.realm || project.slug;
      const headers = authHeadersForRealm(realm);
      const res = await fetch(`${API_URL}/api/discussions/${encodeURIComponent(realm)}/${encodeURIComponent(docId)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "discussion unavailable");
      if (data.persisted === false) return loadDiscussions(docId);
      const entry = {
        comments: Array.isArray(data.comments) ? data.comments : [],
        annotations: Array.isArray(data.annotations) ? data.annotations : [],
      };
      saveDiscussions(docId, entry);
      return entry;
    } catch (_error) {
      return loadDiscussions(docId);
    }
  }

  async function postRemoteDiscussion(docId, kind, payload) {
    if (!project || !docId) throw new Error("missing project");
    const realm = project.access?.realm || project.slug;
    const res = await fetch(`${API_URL}/api/discussions/${encodeURIComponent(realm)}/${encodeURIComponent(docId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeadersForRealm(realm) },
      body: JSON.stringify({ kind, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "discussion save failed");
    if (data.persisted === false) throw new Error("shared discussion storage is not configured");
    return {
      comments: Array.isArray(data.comments) ? data.comments : [],
      annotations: Array.isArray(data.annotations) ? data.annotations : [],
    };
  }

  function authHeadersForRealm(realm) {
    const stored = storedAccess(realm);
    return stored?.token ? { Authorization: `Bearer ${stored.token}` } : {};
  }

  function initLayoutControls() {
    const saved = loadJson(LAYOUT_KEY, {});
    const width = Number(saved.railWidth || 292);
    setRailWidth(width);
    setRailCollapsed(Boolean(saved.railCollapsed), { persist: false });
  }

  function setRailWidth(width) {
    const next = Math.max(220, Math.min(520, Number(width) || 292));
    document.documentElement.style.setProperty("--rail-width", `${next}px`);
  }

  function setRailCollapsed(collapsed, options = {}) {
    document.body.classList.toggle("rail-collapsed", Boolean(collapsed));
    els.railToggle?.setAttribute("aria-pressed", collapsed ? "true" : "false");
    els.railToggle?.setAttribute("aria-label", collapsed ? "展开目录" : "隐藏目录");
    if (options.persist !== false) {
      const saved = loadJson(LAYOUT_KEY, {});
      saved.railCollapsed = Boolean(collapsed);
      const currentWidth = getComputedStyle(document.documentElement).getPropertyValue("--rail-width");
      saved.railWidth = Number.parseInt(currentWidth, 10) || saved.railWidth || 292;
      saveJson(LAYOUT_KEY, saved);
    }
  }

  function toggleRail() {
    setRailCollapsed(!document.body.classList.contains("rail-collapsed"));
  }

  function initRailResize() {
    const resizer = els.railResizer;
    if (!resizer) return;
    let startX = 0;
    let startWidth = 292;
    const finish = () => {
      document.body.classList.remove("rail-resizing");
      const saved = loadJson(LAYOUT_KEY, {});
      saved.railWidth = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--rail-width"), 10) || 292;
      saveJson(LAYOUT_KEY, saved);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    const move = (event) => {
      setRailWidth(startWidth + event.clientX - startX);
    };
    resizer.addEventListener("pointerdown", (event) => {
      if (document.body.classList.contains("rail-collapsed")) return;
      startX = event.clientX;
      startWidth = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--rail-width"), 10) || 292;
      document.body.classList.add("rail-resizing");
      resizer.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
    });
    resizer.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const current = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--rail-width"), 10) || 292;
      setRailWidth(current + (event.key === "ArrowRight" ? 16 : -16));
      const saved = loadJson(LAYOUT_KEY, {});
      saved.railWidth = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--rail-width"), 10) || current;
      saveJson(LAYOUT_KEY, saved);
      event.preventDefault();
    });
  }

  function initTheme() {
    const saved = (() => {
      try { return localStorage.getItem(THEME_KEY); } catch (_error) { return ""; }
    })();
    setTheme(saved === "light" ? "light" : "dark", { persist: false });
  }

  function setTheme(theme, options = {}) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    if (options.persist !== false) {
      try { localStorage.setItem(THEME_KEY, next); } catch (_error) { /* ignore */ }
    }
    if (els.themeLabel) els.themeLabel.textContent = next === "dark" ? "白天" : "夜间";
    if (els.themeToggle) {
      els.themeToggle.setAttribute("aria-label", next === "dark" ? "切换白天模式" : "切换暗黑模式");
      els.themeToggle.dataset.theme = next;
    }
  }

  function toggleTheme() {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  }

  function loadExpandedDirs() {
    const all = loadJson(DIRECTORY_KEY, {});
    const saved = all[storageScope()];
    expandedDirs = new Set(Array.isArray(saved) ? saved : [""]);
    expandedDirs.add("");
  }

  function saveExpandedDirs() {
    const all = loadJson(DIRECTORY_KEY, {});
    all[storageScope()] = Array.from(expandedDirs);
    saveJson(DIRECTORY_KEY, all);
  }

  async function verifyAccess() {
    if (!project || project.access?.mode === "public") {
      accessState = { checked: true, allowed: true, reason: "public" };
      return accessState;
    }
    const realm = project.access?.realm || project.slug;
    const stored = storedAccess(realm);
    if (!stored?.token) {
      accessState = { checked: true, allowed: false, reason: "missing-token" };
      return accessState;
    }
    try {
      const res = await fetch(`${API_URL}/api/access/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realm, token: stored.token }),
      });
      const data = await res.json().catch(() => ({}));
      accessState = { checked: true, allowed: Boolean(res.ok && data.ok), reason: data.error || "" };
      if (!accessState.allowed && res.status === 401) clearAccess(realm);
    } catch (error) {
      accessState = { checked: true, allowed: false, reason: error.message || "verify failed" };
    }
    return accessState;
  }

  async function loadProtectedProjectData() {
    if (!project || !seed.protected || protectedDataLoaded) return;
    const realm = project.access?.realm || project.slug;
    const stored = storedAccess(realm);
    if (!stored?.token) throw new Error("missing access token");
    const res = await fetch(`${API_URL}/api/projects/${encodeURIComponent(realm)}/data`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const error = new Error(data.error || "项目文档加载失败");
      error.status = res.status;
      error.realm = realm;
      throw error;
    }
    docs = Array.isArray(data.docs) ? data.docs : [];
    tree = Array.isArray(data.tree) ? data.tree : [];
    protectedDataLoaded = true;
  }

  async function loadProjectOverlays() {
    if (!project) return;
    const realm = project.access?.realm || project.slug;
    try {
      const res = await fetch(`${API_URL}/api/overlays/${encodeURIComponent(realm)}`, {
        headers: authHeadersForRealm(realm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "overlay unavailable");
      docOverrides = data.docs && typeof data.docs === "object" ? data.docs : {};
    } catch (_error) {
      docOverrides = {};
    }
  }

  async function saveDocOverride(docId, body) {
    if (!project || !docId) throw new Error("missing project");
    const realm = project.access?.realm || project.slug;
    const res = await fetch(`${API_URL}/api/overlays/${encodeURIComponent(realm)}/${encodeURIComponent(docId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeadersForRealm(realm) },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "保存失败");
    docOverrides[docId] = { body: data.body || body, updatedAt: data.updatedAt || new Date().toISOString() };
    return docOverrides[docId];
  }

  async function uploadDocImage(docId, file) {
    if (!project || !docId || !file) throw new Error("missing file");
    const realm = project.access?.realm || project.slug;
    const form = new FormData();
    form.set("file", file);
    const res = await fetch(`${API_URL}/api/uploads/${encodeURIComponent(realm)}/${encodeURIComponent(docId)}`, {
      method: "POST",
      headers: authHeadersForRealm(realm),
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.url) throw new Error(data.error || "上传失败");
    return data;
  }

  async function submitPasscode(realm, passcode, stayRoute) {
    const res = await fetch(`${API_URL}/api/access/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ realm, passcode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.token) throw new Error(data.error || "口令验证失败");
    saveAccess(realm, data.token, data.expires_at || "");
    if (stayRoute) window.location.href = stayRoute;
    else window.location.reload();
  }

  function setVisible(view) {
    document.body.dataset.view = view;
    els.homeView.hidden = view !== "home";
    els.projectView.hidden = view !== "project";
    els.loginView.hidden = view !== "login";
    els.adminView.hidden = view !== "admin";
  }

  function renderDirectoryTree() {
    ensureExpandedScope();
    if (!project || !tree.length) {
      els.directoryTree.innerHTML = `
        <a class="home-rail-link" href="/home/">
          <span>⌂</span>
          <strong>Home</strong>
        </a>
        <span class="muted-note">项目入口集中在 Home。</span>
      `;
      return;
    }
    els.directoryTree.innerHTML = `
      <a class="home-rail-link" href="/home/">
        <span>⌂</span>
        <strong>Home</strong>
      </a>
      ${tree.map((node) => renderTreeNode(node, 0)).join("")}
    `;
    els.directoryTree.querySelectorAll("[data-doc-id], [data-dir-path]").forEach((button) => {
      button.addEventListener("click", () => {
        const dirPath = button.dataset.dirPath;
        if (dirPath != null) {
          if (expandedDirs.has(dirPath) && dirPath !== "") expandedDirs.delete(dirPath);
          else expandedDirs.add(dirPath);
          saveExpandedDirs();
        }
        if (button.dataset.docId) showDoc(button.dataset.docId || "", { keepDirectoryState: dirPath != null });
        else renderDirectoryTree();
      });
    });
  }

  function renderTreeNode(node, depth) {
    if (node.type === "doc") {
      return `<button class="tree-doc ${activeDocId === node.id ? "active" : ""}" data-doc-id="${escapeHtml(node.id)}" style="--depth:${depth}" type="button">
        <span class="tree-file-icon" aria-hidden="true"></span><span>${escapeHtml(node.title)}</span>
      </button>`;
    }
    const overviewId = node.overview_id || "";
    const children = (node.children || []).map((child) => renderTreeNode(child, depth + 1)).join("");
    const isExpanded = expandedDirs.has(node.path || "");
    return `<div class="tree-group ${isExpanded ? "expanded" : "collapsed"}" style="--depth:${depth}" data-tree-path="${escapeHtml(node.path || "")}">
      <button class="tree-directory ${activeDocId === overviewId ? "active" : ""}" data-dir-path="${escapeHtml(node.path || "")}" ${overviewId ? `data-doc-id="${escapeHtml(overviewId)}"` : ""} type="button" aria-expanded="${isExpanded ? "true" : "false"}">
        <span class="tree-caret" aria-hidden="true"></span><span>${escapeHtml(node.title)}</span>
      </button>
      <div class="tree-children">${children}</div>
    </div>`;
  }

  function ensureExpandedScope() {
    const scope = storageScope();
    if (expandedDirsLoadedFor === scope) return;
    loadExpandedDirs();
    expandedDirsLoadedFor = scope;
  }

  function expandDocAncestors(doc) {
    const directory = String(doc?.directory || "");
    expandedDirs.add("");
    if (!directory) return;
    const parts = directory.split("/");
    for (let index = 1; index <= parts.length; index += 1) {
      expandedDirs.add(parts.slice(0, index).join("/"));
    }
    saveExpandedDirs();
  }

  function renderAccount() {
    const entry = primaryAccessEntry();
    const signedIn = Boolean(entry);
    els.accountAvatar.textContent = signedIn ? (entry.project.mark || "管") : "访";
    els.accountLabel.textContent = signedIn ? "已登录" : "访客";
    els.accountButton.classList.toggle("signed-in", signedIn);
    if (!els.accountPopover.hidden) renderAccountPopover();
  }

  function openAccountPopover(route = "") {
    pendingLoginRoute = route || pendingLoginRoute;
    els.accountPopover.hidden = false;
    els.accountButton.setAttribute("aria-expanded", "true");
    renderAccountPopover();
  }

  function closeAccountPopover() {
    els.accountPopover.hidden = true;
    els.accountButton.setAttribute("aria-expanded", "false");
  }

  function renderAccountPopover() {
    const entries = accessEntries();
    if (!entries.length || (project && !primaryAccessEntry())) {
      renderAccountLogin();
      return;
    }
    renderAdminPopover(entries);
  }

  function renderAccountLogin() {
    const preferredRealm = project?.access?.realm || project?.slug || "";
    const projectOptions = projects.map((item) => {
      const realm = item.access?.realm || item.slug;
      const selected = realm === preferredRealm ? " selected" : "";
      return `<option value="${escapeHtml(realm)}" data-route="${escapeHtml(item.route)}"${selected}>${escapeHtml(item.title)}</option>`;
    }).join("");
    els.accountPopover.innerHTML = `
      <form class="account-login" id="accountLoginForm">
        <h2>访客登录</h2>
        <p>输入项目口令以浏览受保护的项目空间。口令只发送到后台验证。</p>
        <label>
          <span>项目空间</span>
          <select name="realm">${projectOptions}</select>
        </label>
        <label>
          <span>口令</span>
          <input name="passcode" type="password" autocomplete="current-password" placeholder="Enter project passcode" required />
        </label>
        <button type="submit">进入项目</button>
        <p class="form-status" id="accountLoginStatus"></p>
      </form>
    `;
    bindAccountLoginForm();
  }

  function renderAdminPopover(entries) {
    const active = primaryAccessEntry() || entries[0];
    els.accountPopover.innerHTML = `
      <section class="admin-card compact">
        <div class="admin-head">
          <span class="account-avatar signed-in">${escapeHtml(active.project.mark || "管")}</span>
          <span>
            <strong>${escapeHtml(active.project.title)}</strong>
            <em>管理员会话已验证</em>
          </span>
        </div>
        <p>管理端属于中央站点公共能力：项目接入走 projects.yaml，访问控制走后台 Worker secrets，部署走中心仓库构建产物。</p>
        <div class="admin-actions">
          <a class="open-button" href="${escapeHtml(active.project.route)}">打开项目</a>
          <a class="ghost-button" href="${escapeHtml(API_URL)}/api/health">API health</a>
          <button class="ghost-button" id="logoutButton" type="button">退出全部</button>
        </div>
      </section>
    `;
    $("logoutButton")?.addEventListener("click", () => {
      clearAccess();
      closeAccountPopover();
      renderAccount();
      if (project) window.location.reload();
    });
  }

  function bindAccountLoginForm() {
    const form = $("accountLoginForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = $("accountLoginStatus");
      const data = new FormData(form);
      const realm = String(data.get("realm") || "");
      const passcode = String(data.get("passcode") || "");
      const option = Array.from(form.elements.realm.options).find((item) => item.value === realm);
      const target = pendingLoginRoute || option?.dataset.route || "/home/";
      status.textContent = "验证中...";
      try {
        await submitPasscode(realm, passcode, target);
      } catch (error) {
        status.textContent = error.message || "验证失败";
      }
    });
  }

  function renderHome() {
    setVisible("home");
    els.routeLabel.textContent = "relumeow.top";
    els.pageTitle.textContent = "Project spaces";
    const projectTone = (item) => item.slug.includes("challenge") ? "agent" : "mesh";
    const intakeItems = [
      ["new", "新建项目", "初始化项目空间"],
      ["import", "导入项目", "接入仓库文档源"],
      ["access", "权限管理", "维护访问策略"],
      ["overview", "全局概览", "检查发布状态"],
    ];
    els.homeView.innerHTML = `
      <section class="home-command">
        <div class="home-line-art" aria-hidden="true">
          <svg viewBox="0 0 420 160">
            <path d="M22 118 H398" />
            <path d="M84 118 V68 H132 V118" />
            <path d="M154 118 V48 H186 V118" />
            <path d="M210 118 V32 H340 V118" />
            <path d="M244 62 H314 M244 82 H294 M244 102 H326" />
            <path d="M72 118 C92 86 112 86 132 118" />
            <path d="M306 118 L344 76 L382 118 M344 76 V42" />
            <circle cx="344" cy="42" r="8" />
            <circle cx="306" cy="118" r="6" />
            <circle cx="382" cy="118" r="6" />
          </svg>
        </div>
        <div class="home-summary">
          <h2>relumeow.top</h2>
          <div class="home-status-line">
            <span>${projects.length} 个项目</span>
            <span>统一文档聚合</span>
            <span>权限受保护</span>
          </div>
          <p>项目知识留在各自仓库，relumeow.top 负责入口、权限、主题和发布。</p>
        </div>
      </section>
      <section class="home-project-list" aria-label="项目入口">
        ${projects.map((item) => `
          <article class="home-project home-project--${projectTone(item)}">
            <span class="project-mark large">${escapeHtml(item.mark || item.title.slice(0, 2))}</span>
            <div class="home-project-copy">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.description || "")}</p>
            </div>
            <span class="home-project-status">${item.access?.mode === "passcode" ? "需口令" : "公开"}</span>
            <a class="open-button" href="${escapeHtml(item.route)}">进入</a>
          </article>
        `).join("")}
      </section>
      <section class="intake-strip" aria-label="项目入库">
        ${intakeItems.map(([kind, title, detail]) => `
          <button class="intake-item intake-item--${kind}" type="button">
            <span class="intake-icon" aria-hidden="true"></span>
            <span>
              <strong>${escapeHtml(title)}</strong>
              <em>${escapeHtml(detail)}</em>
            </span>
          </button>
        `).join("")}
      </section>
    `;
    renderAccount();
  }

  function renderLogin(route = "") {
    pendingLoginRoute = route || "";
    setVisible("home");
    renderHome();
    openAccountPopover(route);
  }

  function renderAdmin() {
    setVisible("home");
    renderHome();
    openAccountPopover();
  }

  function renderProjectLocked() {
    setVisible("project");
    els.routeLabel.textContent = project.title;
    els.pageTitle.textContent = project.title;
    els.documentPanel.innerHTML = `
      <section class="locked-panel">
        <div class="lock-symbol">⌕</div>
        <h2>${escapeHtml(project.title)} requires access</h2>
        <p>这个项目空间受后台访问控制保护。请输入正确口令后继续浏览。</p>
        <button class="open-button" id="lockedLoginButton" type="button">访客登录</button>
      </section>
    `;
    $("lockedLoginButton")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openAccountPopover(project.route);
    });
    renderAccount();
  }

  function renderProject() {
    setVisible("project");
    els.routeLabel.textContent = project.title;
    els.pageTitle.textContent = project.title;
    const hashDoc = location.hash.match(/^#\/doc\/(.+)$/)?.[1];
    const overview = docs.find((doc) => doc.is_overview && !doc.directory) || docs[0];
    showDoc(hashDoc ? decodeURIComponent(hashDoc) : overview?.id || "", { skipHash: true });
    renderAccount();
  }

  function showDoc(id, options = {}) {
    const query = activeQuery.trim().toLowerCase();
    let doc = docs.find((item) => item.id === id) || docs[0];
    if (query) {
      const hit = docs.find((item) => [item.title, item.summary, item.category, (item.tags || []).join(" "), stripMarkdown(item.body)].join(" ").toLowerCase().includes(query));
      if (hit) doc = hit;
    }
    if (!doc) return;
    activeDocId = doc.id;
    renderedDoc = doc;
    if (!options.keepDirectoryState) expandDocAncestors(doc);
    if (!options.skipHash) history.replaceState(null, "", `${project.route}#/doc/${encodeURIComponent(doc.id)}`);
    const effectiveBody = docOverrides[doc.id]?.body || doc.body || "";
    const isEditing = editMode && canEditProject();
    els.documentPanel.innerHTML = `
      <div class="doc-meta">
        <span>${escapeHtml(doc.category)}</span>
        <span>${escapeHtml(doc.updated)}</span>
        <span>${doc.reading_minutes || 1} min read</span>
        <span>${escapeHtml(doc.project_path || "")}</span>
        ${docOverrides[doc.id]?.updatedAt ? `<span>后台已更新 ${escapeHtml(docOverrides[doc.id].updatedAt)}</span>` : ""}
      </div>
      ${renderDocTools(doc, effectiveBody, isEditing)}
      ${isEditing ? renderDocEditor(effectiveBody) : `<div class="doc-body">${renderMarkdown(effectiveBody)}</div>`}
      ${renderDiscussionPanel({ comments: [], annotations: [] })}
    `;
    hydrateProtectedImages(els.documentPanel);
    bindDocTools(doc);
    bindDiscussionPanel(doc);
    if (!isEditing) bindSelectionAnnotations(doc);
    loadRemoteDiscussions(doc.id).then((entry) => {
      if (activeDocId !== doc.id) return;
      activeDiscussion = entry;
      saveDiscussions(doc.id, entry);
      refreshDiscussionPanel(entry);
    });
    renderDirectoryTree();
  }

  function canEditProject() {
    if (!project) return false;
    const realm = project.access?.realm || project.slug;
    return primaryAccessEntry()?.realm === realm;
  }

  function renderDocTools(doc, body, isEditing) {
    if (!canEditProject()) return "";
    return `
      <div class="doc-tools">
        <span>${docOverrides[doc.id] ? "正在使用后台覆盖版本" : "正文来自项目仓库"}</span>
        <div>
          ${isEditing ? "" : `<button class="ghost-button" id="editDocButton" type="button">编辑正文</button>`}
        </div>
      </div>
    `;
  }

  function renderDocEditor(body) {
    return `
      <section class="doc-editor-panel">
        <div class="editor-toolbar">
          <label class="ghost-button">
            上传图片
            <input id="docImageUpload" type="file" accept="image/*" hidden />
          </label>
          <span id="docEditorStatus"></span>
        </div>
        <textarea id="docBodyEditor" spellcheck="false">${escapeHtml(body)}</textarea>
        <div class="editor-actions">
          <button class="ghost-button" id="cancelEditDoc" type="button">取消</button>
          <button class="open-button" id="saveEditDoc" type="button">保存正文</button>
        </div>
      </section>
    `;
  }

  function bindDocTools(doc) {
    $("editDocButton")?.addEventListener("click", () => {
      editMode = true;
      showDoc(doc.id, { skipHash: true });
    });
    $("cancelEditDoc")?.addEventListener("click", () => {
      editMode = false;
      showDoc(doc.id, { skipHash: true });
    });
    $("saveEditDoc")?.addEventListener("click", async () => {
      const editor = $("docBodyEditor");
      const status = $("docEditorStatus");
      if (!editor) return;
      status.textContent = "保存中...";
      try {
        await saveDocOverride(doc.id, editor.value);
        editMode = false;
        status.textContent = "已保存";
        showDoc(doc.id, { skipHash: true });
      } catch (error) {
        status.textContent = error.message || "保存失败";
      }
    });
    $("docImageUpload")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      const editor = $("docBodyEditor");
      const status = $("docEditorStatus");
      if (!file || !editor) return;
      status.textContent = "上传中...";
      try {
        const uploaded = await uploadDocImage(doc.id, file);
        insertAtCursor(editor, `![${uploaded.name || file.name}](${uploaded.url})`);
        status.textContent = "图片已插入";
      } catch (error) {
        status.textContent = error.message || "上传失败";
      } finally {
        event.target.value = "";
      }
    });
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const needsBefore = before && !before.endsWith("\n") ? "\n\n" : "";
    const needsAfter = after && !after.startsWith("\n") ? "\n\n" : "";
    textarea.value = `${before}${needsBefore}${text}${needsAfter}${after}`;
    const cursor = before.length + needsBefore.length + text.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  }

  function renderDiscussionPanel(entry) {
    return `
      <section class="doc-discussion" aria-label="文档评论与批注">
        <div class="discussion-head">
          <span class="discussion-kicker">Discussion</span>
          <h2>评论与批注</h2>
          <p>评论显示在文档底部；选中文档正文可以添加公开批注。</p>
        </div>
        <div class="annotation-list" id="annotationList">
          ${renderAnnotations(entry.annotations)}
        </div>
        <form class="comment-form" id="commentForm">
          <label>
            <span>添加评论</span>
            <textarea name="comment" rows="3" placeholder="写下这篇文档需要补充、修正或继续验证的点"></textarea>
          </label>
          <button type="submit">发布评论</button>
        </form>
        <div class="comment-list" id="commentList">
          ${renderComments(entry.comments)}
        </div>
      </section>
      <aside class="annotation-popover" id="annotationPopover" hidden>
        <strong>添加批注</strong>
        <p id="annotationQuote"></p>
        <textarea id="annotationText" rows="3" placeholder="写一句批注"></textarea>
        <div class="annotation-actions">
          <button class="ghost-button" id="annotationCancel" type="button">取消</button>
          <button class="open-button" id="annotationSave" type="button">保存</button>
        </div>
      </aside>
    `;
  }

  function refreshDiscussionPanel(entry = activeDiscussion) {
    const annotations = $("annotationList");
    const comments = $("commentList");
    if (annotations) annotations.innerHTML = renderAnnotations(entry.annotations || []);
    if (comments) comments.innerHTML = renderComments(entry.comments || []);
  }

  function renderComments(comments) {
    if (!comments.length) return `<p class="discussion-empty">还没有评论。</p>`;
    return comments.map((comment) => `
      <article class="discussion-item" data-comment-id="${escapeHtml(comment.id || "")}">
        <div>
          <strong>${escapeHtml(comment.author || "访客")}</strong>
          <time>${escapeHtml(comment.createdAt || "")}</time>
        </div>
        <p>${escapeHtml(comment.text || "")}</p>
        <button class="reply-button" type="button" data-reply-id="${escapeHtml(comment.id || "")}">回复</button>
        <div class="reply-list">
          ${renderReplies(comment.replies || [])}
        </div>
      </article>
    `).join("");
  }

  function renderReplies(replies) {
    if (!Array.isArray(replies) || !replies.length) return "";
    return replies.map((reply) => `
      <article class="reply-item">
        <strong>${escapeHtml(reply.author || "访客")}</strong>
        <time>${escapeHtml(reply.createdAt || "")}</time>
        <p>${escapeHtml(reply.text || "")}</p>
      </article>
    `).join("");
  }

  function renderAnnotations(annotations) {
    if (!annotations.length) return `<p class="discussion-empty">选中正文即可添加批注。</p>`;
    return annotations.map((item) => `
      <article class="discussion-item annotation-item">
        <blockquote>${escapeHtml(item.quote || "")}</blockquote>
        <p>${escapeHtml(item.text || "")}</p>
        <time>${escapeHtml(item.createdAt || "")}</time>
      </article>
    `).join("");
  }

  function bindDiscussionPanel(doc) {
    const form = $("commentForm");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const textarea = form.elements.comment;
      const text = String(textarea.value || "").trim();
      if (!text) return;
      const entry = loadDiscussions(doc.id);
      const comment = {
        id: `c-${Date.now()}`,
        author: "访客",
        text,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      };
      entry.comments.unshift(comment);
      activeDiscussion = entry;
      saveDiscussions(doc.id, entry);
      textarea.value = "";
      refreshDiscussionPanel(entry);
      try {
        const remote = await postRemoteDiscussion(doc.id, "comment", comment);
        activeDiscussion = remote;
        saveDiscussions(doc.id, remote);
        refreshDiscussionPanel(remote);
      } catch (_error) {
        // The local copy remains visible when the optional shared backend is unavailable.
      }
    });
    $("commentList")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-reply-id]");
      if (!button) return;
      const commentId = button.dataset.replyId || "";
      const text = window.prompt("回复评论");
      if (!text || !text.trim()) return;
      const reply = {
        id: `r-${Date.now()}`,
        author: "访客",
        text: text.trim(),
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        parentId: commentId,
      };
      const entry = loadDiscussions(doc.id);
      const target = entry.comments.find((item) => item.id === commentId);
      if (target) {
        target.replies = Array.isArray(target.replies) ? target.replies : [];
        target.replies.push(reply);
      }
      activeDiscussion = entry;
      saveDiscussions(doc.id, entry);
      refreshDiscussionPanel(entry);
      try {
        const remote = await postRemoteDiscussion(doc.id, "reply", reply);
        activeDiscussion = remote;
        saveDiscussions(doc.id, remote);
        refreshDiscussionPanel(remote);
      } catch (_error) {
        // Local reply remains visible if shared persistence is not configured.
      }
    });
  }

  function bindSelectionAnnotations(doc) {
    const body = els.documentPanel.querySelector(".doc-body");
    const popover = $("annotationPopover");
    const quote = $("annotationQuote");
    const input = $("annotationText");
    if (!body || !popover || !quote || !input) return;

    const hidePopover = () => {
      popover.hidden = true;
      activeSelection = null;
      input.value = "";
    };

    body.addEventListener("mouseup", () => {
      window.setTimeout(() => {
        const selection = window.getSelection();
        const selected = String(selection?.toString() || "").trim().replace(/\s+/g, " ");
        if (!selection || selected.length < 2 || !body.contains(selection.anchorNode) || !body.contains(selection.focusNode)) {
          return;
        }
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        activeSelection = selected.slice(0, 280);
        quote.textContent = activeSelection;
        popover.hidden = false;
        popover.style.left = `${Math.min(window.innerWidth - 330, Math.max(16, rect.left + window.scrollX))}px`;
        popover.style.top = `${Math.max(16, rect.bottom + window.scrollY + 10)}px`;
        input.focus();
      }, 0);
    });

    $("annotationCancel")?.addEventListener("click", hidePopover);
    $("annotationSave")?.addEventListener("click", async () => {
      const text = String(input.value || "").trim();
      if (!text || !activeSelection) return;
      const entry = loadDiscussions(doc.id);
      const annotation = {
        id: `a-${Date.now()}`,
        quote: activeSelection,
        text,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      };
      entry.annotations.unshift(annotation);
      activeDiscussion = entry;
      saveDiscussions(doc.id, entry);
      refreshDiscussionPanel(entry);
      window.getSelection()?.removeAllRanges();
      hidePopover();
      try {
        const remote = await postRemoteDiscussion(doc.id, "annotation", annotation);
        activeDiscussion = remote;
        saveDiscussions(doc.id, remote);
        refreshDiscussionPanel(remote);
      } catch (_error) {
        // Local annotation is retained if shared persistence is not configured.
      }
    });
  }

  async function hydrateProtectedImages(container) {
    if (!project || project.access?.mode !== "passcode") return;
    const realm = project.access?.realm || project.slug;
    const stored = storedAccess(realm);
    if (!stored?.token) return;
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(images.map(async (img) => {
      const rawSrc = img.dataset.protectedSrc || img.getAttribute("src") || "";
      const url = new URL(rawSrc, window.location.origin);
      if (!url.pathname.startsWith(`/api/projects/${realm}/assets/`) && !url.pathname.startsWith(`/api/content-assets/${realm}/`)) return;
      try {
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${stored.token}` },
        });
        if (!res.ok) throw new Error(`image ${res.status}`);
        const blob = await res.blob();
        const previous = img.dataset.objectUrl;
        if (previous) URL.revokeObjectURL(previous);
        const objectUrl = URL.createObjectURL(blob);
        img.dataset.objectUrl = objectUrl;
        img.src = objectUrl;
      } catch (_error) {
        img.classList.add("image-load-failed");
      }
    }));
  }

  function renderMarkdown(markdown) {
    const lines = preprocessMarkdown(markdown).split("\n");
    let html = "";
    let paragraph = [];
    let listStack = [];
    let inCode = false;
    let inMath = false;
    let codeLang = "";
    let codeLines = [];
    let mathLines = [];
    let table = [];
    const flushParagraph = () => {
      if (paragraph.length) {
        html += `<p>${inline(paragraph.join(" "))}</p>`;
        paragraph = [];
      }
    };
    const closeLists = (target = 0) => {
      while (listStack.length > target) html += `</${listStack.pop()}>`;
    };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.map((row) => row.trim()).filter(Boolean);
      if (rows.length >= 2 && /^\|?\s*:?-{3,}/.test(rows[1])) {
        const split = (row) => row.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
        html += "<table><thead><tr>" + split(rows[0]).map((cell) => `<th>${inline(cell)}</th>`).join("") + "</tr></thead><tbody>";
        rows.slice(2).forEach((row) => { html += "<tr>" + split(row).map((cell) => `<td>${inline(cell)}</td>`).join("") + "</tr>"; });
        html += "</tbody></table>";
      }
      table = [];
    };
    lines.forEach((line) => {
      if (line.startsWith("```")) {
        flushParagraph(); flushTable(); closeLists();
        if (inCode) {
          html += `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`;
          inCode = false; codeLang = ""; codeLines = [];
        } else {
          inCode = true; codeLang = line.replace(/^```/, "").trim(); codeLines = [];
        }
        return;
      }
      if (inCode) { codeLines.push(line); return; }
      if (line.trim() === "$$") {
        flushParagraph(); flushTable(); closeLists();
        if (inMath) {
          html += renderFormula(mathLines.join("\n"), true);
          inMath = false; mathLines = [];
        } else {
          inMath = true; mathLines = [];
        }
        return;
      }
      if (inMath) { mathLines.push(line); return; }
      if (/^\s*\|/.test(line)) { flushParagraph(); closeLists(); table.push(line); return; }
      flushTable();
      if (!line.trim()) { flushParagraph(); closeLists(); return; }
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph(); closeLists();
        const level = heading[1].length;
        const text = stripMarkdown(heading[2]);
        html += `<h${level} id="${slugify(text)}">${inline(heading[2])}</h${level}>`;
        return;
      }
      const unordered = /^(\s*)[-*]\s+(.+)$/.exec(line);
      const ordered = /^(\s*)\d+\.\s+(.+)$/.exec(line);
      if (unordered || ordered) {
        flushParagraph();
        const indent = Math.floor(((unordered || ordered)[1] || "").length / 2);
        const type = ordered ? "ol" : "ul";
        let body = ordered ? ordered[2] : unordered[2];
        const task = /^\[([ xX])\]\s+(.+)$/.exec(body);
        if (task) {
          body = `<label class="task-item"><input type="checkbox" ${task[1].toLowerCase() === "x" ? "checked" : ""}> <span>${inline(task[2])}</span></label>`;
        } else {
          body = inline(body);
        }
        while (listStack.length > indent + 1) html += `</${listStack.pop()}>`;
        while (listStack.length < indent + 1) { listStack.push(type); html += `<${type}>`; }
        html += `<li>${body}</li>`;
        return;
      }
      paragraph.push(line.trim());
    });
    if (inMath) html += renderFormula(mathLines.join("\n"), true);
    flushParagraph(); flushTable(); closeLists();
    return html;
  }

  function preprocessMarkdown(markdown) {
    return String(markdown || "")
      .replace(/\r\n/g, "\n")
      .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, label) => `![${label || target}](${target})`)
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_m, target, label) => `[${label}](${target})`)
      .replace(/\[\[([^\]]+)\]\]/g, (_m, target) => `[${target}](${target})`);
  }

  function inline(value) {
    let text = escapeHtml(value);
    text = text
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, rawSrc) => {
        const { url, title } = splitImageTarget(rawSrc);
        const protectedAttr = isProtectedAssetUrl(url) ? `data-protected-src="${escapeHtml(url)}"` : `src="${escapeHtml(url)}"`;
        const placeholder = isProtectedAssetUrl(url) ? ` src="${transparentPixel()}"` : "";
        return `<figure><img ${protectedAttr}${placeholder} alt="${escapeHtml(alt)}">${title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ""}</figure>`;
      })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
        const resolved = resolveMarkdownHref(href);
        const target = resolved.external ? "_blank" : "_self";
        return `<a href="${escapeHtml(resolved.href)}" target="${target}" rel="noreferrer">${label}</a>`;
      })
      .replace(/\$\$([^$]+)\$\$/g, (_m, tex) => renderFormula(tex, true))
      .replace(/\$([^$\n]+)\$/g, (_m, tex) => renderFormula(tex, false))
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return text;
  }

  function renderFormula(tex, displayMode) {
    const raw = String(tex || "").trim();
    if (!raw) return "";
    if (window.katex?.renderToString) {
      try {
        return window.katex.renderToString(raw, {
          displayMode,
          throwOnError: false,
          strict: "ignore",
        });
      } catch (_error) {
        // Fall through to escaped text.
      }
    }
    const className = displayMode ? "math-block" : "math-inline";
    return `<span class="${className}">${escapeHtml(raw)}</span>`;
  }

  function resolveMarkdownHref(href) {
    const raw = String(href || "").trim();
    if (/^(https?:|mailto:|tel:|data:|\/api\/|#)/i.test(raw)) {
      return { href: raw, external: /^https?:/i.test(raw) };
    }
    if (!project || !renderedDoc) return { href: raw, external: false };
    const [pathPart, hashPart = ""] = raw.split("#", 2);
    if (!pathPart.endsWith(".md") && !/^[^./][^:]*$/.test(pathPart)) return { href: raw, external: false };
    const baseDir = renderedDoc.directory || "";
    const rootNormalized = normalizeDocPath(pathPart);
    const normalized = normalizeDocPath(baseDir ? `${baseDir}/${pathPart}` : pathPart);
    const candidates = [
      rootNormalized,
      normalized,
      rootNormalized.endsWith(".md") ? rootNormalized : `${rootNormalized}.md`,
      normalized.endsWith("/README.md") ? normalized.replace(/README\.md$/, "overview.md") : "",
      normalized === "README.md" ? "README.md" : "",
      normalized.endsWith(".md") ? normalized : `${normalized}.md`,
    ].filter(Boolean);
    const target = docs.find((doc) => candidates.includes(doc.project_path));
    if (!target) return { href: raw, external: false };
    return {
      href: `${project.route}#/doc/${encodeURIComponent(target.id)}`,
      external: false,
    };
  }

  function normalizeDocPath(path) {
    const parts = [];
    String(path || "").split("/").forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") parts.pop();
      else parts.push(part);
    });
    return parts.join("/");
  }

  function splitImageTarget(raw) {
    const normalized = String(raw || "").replace(/&quot;/g, '"');
    const match = normalized.match(/^(\S+)(?:\s+"([^"]*)")?$/);
    return { url: match?.[1] || normalized, title: match?.[2] || "" };
  }

  function isProtectedAssetUrl(url) {
    try {
      const parsed = new URL(String(url || ""), window.location.origin);
      return parsed.pathname.startsWith("/api/projects/") || parsed.pathname.startsWith("/api/content-assets/");
    } catch (_error) {
      return false;
    }
  }

  function transparentPixel() {
    return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  }

  async function route() {
    ensureExpandedScope();
    renderDirectoryTree();
    renderAccount();
    const path = currentPath();
    if (path.startsWith("/login/")) {
      const next = new URLSearchParams(location.search).get("next") || "";
      renderLogin(next);
      return;
    }
    if (path.startsWith("/admin/")) {
      renderAdmin();
      return;
    }
    if (!project) {
      renderHome();
      return;
    }
    await verifyAccess();
    if (!accessState.allowed) renderProjectLocked();
    else {
      try {
        await loadProtectedProjectData();
        await loadProjectOverlays();
        renderProject();
      } catch (error) {
        const realm = project.access?.realm || project.slug;
        clearAccess(realm);
        accessState = { checked: true, allowed: false, reason: error.message || "load failed" };
        protectedDataLoaded = false;
        renderProjectLocked();
      }
    }
  }

  els.searchInput.addEventListener("input", () => {
    activeQuery = els.searchInput.value;
    if (project && accessState.allowed) renderProject();
  });
  els.themeToggle?.addEventListener("click", toggleTheme);
  els.railToggle?.addEventListener("click", toggleRail);
  window.addEventListener("hashchange", () => {
    if (project && accessState.allowed) renderProject();
  });
  els.accountButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (els.accountPopover.hidden) openAccountPopover();
    else closeAccountPopover();
  });
  document.addEventListener("click", (event) => {
    if (els.accountPopover.hidden) return;
    if (els.accountPopover.contains(event.target) || els.accountButton.contains(event.target)) return;
    closeAccountPopover();
  });

  initTheme();
  initLayoutControls();
  initRailResize();
  route().catch((error) => {
    if (project) {
      const realm = project.access?.realm || project.slug;
      clearAccess(realm);
      accessState = { checked: true, allowed: false, reason: error.message || "load failed" };
      renderProjectLocked();
      return;
    }
    els.homeView.innerHTML = `<div class="empty-state">加载失败：${escapeHtml(error.message || error)}</div>`;
  });
})();
