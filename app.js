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
  const ADMIN_REALM = "__admin__";
  const THEME_KEY = "relumeow-theme-v1";
  const DIRECTORY_KEY = "relumeow-directory-expanded-v1";
  const DIRECTORY_MODE_KEY = "relumeow-directory-mode-v1";
  const DISCUSSION_KEY = "relumeow-discussion-v1";
  const LAYOUT_KEY = "relumeow-layout-v1";
  const PREVIEW_MODE = new URLSearchParams(window.location.search).get("preview") === "1";

  let activeDocId = "";
  let activeQuery = "";
  let accessState = { checked: false, allowed: false, reason: "" };
  let protectedDataLoaded = !seed.protected;
  let pendingLoginRoute = "";
  let expandedDirs = new Set([""]);
  let activeSelection = null;
  let expandedDirsLoadedFor = "";
  let directoryMode = "content";
  let activeDiscussion = { comments: [], annotations: [] };
  let editMode = false;
  let renderedDoc = null;
  let docOverrides = {};
  let outlineObserver = null;
  const searchFieldCache = new Map();

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
    projectDemoLink: $("projectDemoLink"),
    railToggle: $("railToggle"),
    railResizer: $("railResizer"),
    directoryContentMode: $("directoryContentMode"),
    directoryDateMode: $("directoryDateMode"),
    tocToggle: $("tocToggle"),
    tocEdgeToggle: $("tocEdgeToggle"),
    tocResizer: $("tocResizer"),
    outlineTree: $("outlineTree"),
  };
  if (PREVIEW_MODE) document.body.classList.add("preview-mode");

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

  function normalizedRole(role) {
    return role === "admin" ? "admin" : "visitor";
  }

  function saveAccess(realm, token, expiresAt, role = "visitor", username = "") {
    try {
      const all = JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
      all[realm] = { token, expiresAt, role: normalizedRole(role), username };
      localStorage.setItem(ACCESS_KEY, JSON.stringify(all));
    } catch (_error) {
      // Access can still work for the current response; persistence is best-effort.
    }
  }

  function adminEntry() {
    const stored = storedAccess(ADMIN_REALM);
    if (!stored?.token) return null;
    return {
      project: project || projects[0] || { slug: "admin", title: "relumeow.top", mark: "管", route: "/home/" },
      realm: ADMIN_REALM,
      token: stored.token,
      expiresAt: stored.expiresAt,
      role: "admin",
      username: stored.username || "relumeow",
    };
  }

  function accessEntries() {
    const admin = adminEntry();
    const entries = projects
      .map((item) => {
        const realm = item.access?.realm || item.slug;
        const stored = storedAccess(realm);
        return stored?.token ? { project: item, realm, ...stored, role: normalizedRole(stored.role) } : null;
      })
      .filter(Boolean);
    return admin ? [admin, ...entries] : entries;
  }

  function primaryAccessEntry() {
    const admin = adminEntry();
    if (admin) return admin;
    if (project) {
      const realm = project.access?.realm || project.slug;
      const stored = storedAccess(realm);
      if (stored?.token) return { project, realm, ...stored, role: normalizedRole(stored.role) };
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

  function directoryStorageScope() {
    return `${storageScope()}::${directoryMode}`;
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
    const admin = adminEntry();
    if (admin?.token) return { Authorization: `Bearer ${admin.token}` };
    const stored = storedAccess(realm);
    return stored?.token ? { Authorization: `Bearer ${stored.token}` } : {};
  }

  function initLayoutControls() {
    const saved = loadJson(LAYOUT_KEY, {});
    const width = Number(saved.railWidth || 292);
    const tocWidth = Number(saved.tocWidth || 236);
    const compact = isCompactLayout();
    setRailWidth(width);
    setTocWidth(tocWidth);
    setRailCollapsed(compact ? true : Boolean(saved.railCollapsed), { persist: false });
    setTocCollapsed(compact ? true : Boolean(saved.tocCollapsed), { persist: false });
  }

  function isCompactLayout() {
    return Boolean(window.matchMedia?.("(max-width: 1080px)")?.matches);
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
    const expanding = document.body.classList.contains("rail-collapsed");
    if (expanding && isCompactLayout()) setTocCollapsed(true, { persist: false });
    setRailCollapsed(!expanding);
  }

  function setTocWidth(width) {
    const next = Math.max(190, Math.min(380, Number(width) || 236));
    document.documentElement.style.setProperty("--toc-width", `${next}px`);
  }

  function setTocCollapsed(collapsed, options = {}) {
    document.body.classList.toggle("toc-collapsed", Boolean(collapsed));
    els.tocToggle?.setAttribute("aria-pressed", collapsed ? "true" : "false");
    els.tocToggle?.setAttribute("aria-label", collapsed ? "展开标题导航" : "隐藏标题导航");
    els.tocEdgeToggle?.setAttribute("aria-pressed", collapsed ? "true" : "false");
    els.tocEdgeToggle?.setAttribute("aria-label", collapsed ? "展开标题导航" : "隐藏标题导航");
    if (options.persist !== false) {
      const saved = loadJson(LAYOUT_KEY, {});
      saved.tocCollapsed = Boolean(collapsed);
      const currentWidth = getComputedStyle(document.documentElement).getPropertyValue("--toc-width");
      saved.tocWidth = Number.parseInt(currentWidth, 10) || saved.tocWidth || 236;
      saveJson(LAYOUT_KEY, saved);
    }
  }

  function toggleToc() {
    const expanding = document.body.classList.contains("toc-collapsed");
    if (expanding && isCompactLayout()) setRailCollapsed(true, { persist: false });
    setTocCollapsed(!expanding);
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

  function initTocResize() {
    const resizer = els.tocResizer;
    if (!resizer) return;
    let startX = 0;
    let startWidth = 236;
    const finish = () => {
      document.body.classList.remove("toc-resizing");
      const saved = loadJson(LAYOUT_KEY, {});
      saved.tocWidth = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--toc-width"), 10) || 236;
      saveJson(LAYOUT_KEY, saved);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    const move = (event) => {
      setTocWidth(startWidth - (event.clientX - startX));
    };
    resizer.addEventListener("pointerdown", (event) => {
      if (document.body.classList.contains("toc-collapsed")) return;
      startX = event.clientX;
      startWidth = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--toc-width"), 10) || 236;
      document.body.classList.add("toc-resizing");
      resizer.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
    });
    resizer.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const current = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--toc-width"), 10) || 236;
      setTocWidth(current + (event.key === "ArrowLeft" ? 16 : -16));
      const saved = loadJson(LAYOUT_KEY, {});
      saved.tocWidth = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--toc-width"), 10) || current;
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

  function initDirectoryMode() {
    const saved = loadJson(DIRECTORY_MODE_KEY, {});
    directoryMode = saved[storageScope()] === "date" ? "date" : "content";
    syncDirectoryModeControls();
  }

  function loadExpandedDirs() {
    const all = loadJson(DIRECTORY_KEY, {});
    const saved = all[directoryStorageScope()] || (directoryMode === "content" ? all[storageScope()] : null);
    expandedDirs = new Set(Array.isArray(saved) ? saved : [""]);
    expandedDirs.add("");
  }

  function saveExpandedDirs() {
    const all = loadJson(DIRECTORY_KEY, {});
    all[directoryStorageScope()] = Array.from(expandedDirs);
    saveJson(DIRECTORY_KEY, all);
  }

  async function verifyAccess() {
    if (!project || project.access?.mode === "public") {
      accessState = { checked: true, allowed: true, reason: "public" };
      return accessState;
    }
    const realm = project.access?.realm || project.slug;
    const admin = adminEntry();
    if (admin?.token) {
      try {
        const res = await fetch(`${API_URL}/api/access/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ realm, token: admin.token }),
        });
        const data = await res.json().catch(() => ({}));
        accessState = { checked: true, allowed: Boolean(res.ok && data.ok && data.role === "admin"), reason: data.error || "" };
        if (!accessState.allowed && res.status === 401) clearAccess(ADMIN_REALM);
        return accessState;
      } catch (error) {
        accessState = { checked: true, allowed: false, reason: error.message || "verify failed" };
        return accessState;
      }
    }
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
      if (accessState.allowed && data.role && stored.token) saveAccess(realm, stored.token, stored.expiresAt, data.role);
    } catch (error) {
      accessState = { checked: true, allowed: false, reason: error.message || "verify failed" };
    }
    return accessState;
  }

  async function loadProtectedProjectData() {
    if (!project || !seed.protected || protectedDataLoaded) return;
    const realm = project.access?.realm || project.slug;
    const stored = storedAccess(realm);
    if (!stored?.token && !adminEntry()?.token) throw new Error("missing access token");
    const res = await fetch(`${API_URL}/api/projects/${encodeURIComponent(realm)}/data`, {
      headers: authHeadersForRealm(realm),
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
      searchFieldCache.clear();
    } catch (_error) {
      docOverrides = {};
      searchFieldCache.clear();
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
    searchFieldCache.clear();
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

  async function submitPasscode(realm, passcode, stayRoute, role = "visitor", username = "") {
    const isAdmin = normalizedRole(role) === "admin";
    const res = await fetch(`${API_URL}/api/access/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isAdmin
        ? { role: "admin", username, password: passcode }
        : { realm, passcode, role: "visitor" }
      ),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.token) throw new Error(data.error || "口令验证失败");
    if (isAdmin) saveAccess(ADMIN_REALM, data.token, data.expires_at || "", "admin", data.username || username);
    else saveAccess(realm, data.token, data.expires_at || "", data.role || role);
    if (stayRoute) window.location.href = stayRoute;
    else window.location.reload();
  }

  function setVisible(view) {
    document.body.dataset.view = view;
    els.homeView.hidden = view !== "home";
    els.projectView.hidden = view !== "project";
    els.loginView.hidden = view !== "login";
    els.adminView.hidden = view !== "admin";
    if (els.projectDemoLink) {
      const showDemoLink = view === "project" && project?.slug === "video2mesh" && accessState.allowed;
      els.projectDemoLink.hidden = !showDemoLink;
    }
  }

  function renderDirectoryTree() {
    ensureExpandedScope();
    syncDirectoryModeControls();
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
      ${renderDirectoryNodes().map((node) => renderTreeNode(node, 0)).join("")}
    `;
    els.directoryTree.querySelectorAll("[data-doc-id], [data-dir-path]").forEach((button) => {
      button.addEventListener("click", () => {
        const dirPath = button.dataset.dirPath;
        if (dirPath != null) {
          if (expandedDirs.has(dirPath) && dirPath !== "") expandedDirs.delete(dirPath);
          else expandedDirs.add(dirPath);
          saveExpandedDirs();
        }
        if (button.dataset.docId) {
          clearSearchInput();
          showDoc(button.dataset.docId || "", { keepDirectoryState: dirPath != null, allowQueryOverride: false });
        } else renderDirectoryTree();
      });
    });
  }

  function renderDirectoryNodes() {
    return directoryMode === "date" ? buildDateTree() : tree;
  }

  function buildDateTree() {
    const byDate = new Map();
    docs.forEach((doc) => {
      const date = normalizeDocDate(doc.updated);
      if (!date) return;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(doc);
    });
    const nodes = Array.from(byDate.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, items]) => ({
        type: "dir",
        title: formatDirectoryDate(date, items.length),
        path: `date/${date}`,
        children: items
          .slice()
          .sort((left, right) => {
            const updated = String(right.updated || "").localeCompare(String(left.updated || ""));
            if (updated) return updated;
            return String(left.title || "").localeCompare(String(right.title || ""), "zh-Hans-CN");
          })
          .map((doc) => ({
            type: "doc",
            id: doc.id,
            title: doc.title,
          })),
      }));
    if (!nodes.length) return [];
    if (expandedDirs.size <= 1) expandedDirs.add(nodes[0].path);
    const activeDoc = docs.find((doc) => doc.id === activeDocId);
    const activeDatePath = activeDoc ? `date/${normalizeDocDate(activeDoc.updated)}` : "";
    if (activeDatePath) expandedDirs.add(activeDatePath);
    return nodes;
  }

  function normalizeDocDate(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/);
    if (!match) return "";
    const [year, month, day] = match[0].split(/[-/.]/).map((part) => part.padStart(2, "0"));
    return `${year}-${month}-${day}`;
  }

  function formatDirectoryDate(date, count) {
    return `${date} · ${count} 篇`;
  }

  function syncDirectoryModeControls() {
    els.directoryContentMode?.setAttribute("aria-pressed", directoryMode === "content" ? "true" : "false");
    els.directoryDateMode?.setAttribute("aria-pressed", directoryMode === "date" ? "true" : "false");
  }

  function setDirectoryMode(mode) {
    const next = mode === "date" ? "date" : "content";
    if (next === directoryMode) return;
    saveExpandedDirs();
    directoryMode = next;
    expandedDirsLoadedFor = "";
    ensureExpandedScope();
    if (directoryMode === "date") buildDateTree();
    const saved = loadJson(DIRECTORY_MODE_KEY, {});
    saved[storageScope()] = directoryMode;
    saveJson(DIRECTORY_MODE_KEY, saved);
    renderDirectoryTree();
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
    const scope = directoryStorageScope();
    if (expandedDirsLoadedFor === scope) return;
    loadExpandedDirs();
    expandedDirsLoadedFor = scope;
  }

  function expandDocAncestors(doc) {
    if (directoryMode === "date") {
      const date = normalizeDocDate(doc?.updated);
      expandedDirs.add("");
      if (date) expandedDirs.add(`date/${date}`);
      saveExpandedDirs();
      return;
    }
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
    els.accountAvatar.textContent = signedIn ? (entry.role === "admin" ? "管" : (entry.project.mark || "访")) : "访";
    els.accountLabel.textContent = signedIn ? (entry.role === "admin" ? `管理员 ${entry.username || "relumeow"}` : "访客已登录") : "访客";
    els.accountButton.classList.toggle("signed-in", signedIn);
    els.accountButton.classList.toggle("admin-session", signedIn && entry.role === "admin");
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
        <input name="role" type="hidden" value="visitor" />
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
    const roleLabel = active.role === "admin" ? "管理员会话已验证" : "访客会话已验证";
    const canElevate = active.role !== "admin";
    const activeTitle = active.role === "admin" ? `管理员 ${active.username || "relumeow"}` : active.project.title;
    els.accountPopover.innerHTML = `
      <section class="admin-card compact">
        <div class="admin-head">
          <span class="account-avatar signed-in">${active.role === "admin" ? "管" : escapeHtml(active.project.mark || "管")}</span>
          <span>
            <strong>${escapeHtml(activeTitle)}</strong>
            <em>${escapeHtml(roleLabel)}</em>
          </span>
        </div>
        <p>${active.role === "admin"
          ? "管理员可在线编辑正文、上传图片、回复评论；修改会写入后台覆盖层，不直接改项目仓库。"
          : "访客可浏览文档、发布评论、回复评论，并对选中的正文添加公开批注。"
        }</p>
        <div class="admin-actions">
          <a class="open-button" href="${escapeHtml(active.project.route)}">打开项目</a>
          ${canElevate ? `<button class="ghost-button" id="adminLoginButton" type="button">管理员登录</button>` : `<a class="ghost-button" href="/admin/">管理面板</a>`}
          <a class="ghost-button" href="${escapeHtml(API_URL)}/api/health">API health</a>
          <button class="ghost-button" id="logoutButton" type="button">退出全部</button>
        </div>
      </section>
    `;
    $("adminLoginButton")?.addEventListener("click", () => renderAccountLoginForAdmin(active));
    $("logoutButton")?.addEventListener("click", () => {
      clearAccess();
      closeAccountPopover();
      renderAccount();
      if (project) window.location.reload();
    });
  }

  function renderAccountLoginForAdmin(active) {
    const targetProject = active?.project || project || projects[0];
    pendingLoginRoute = targetProject?.route || pendingLoginRoute || "/home/";
    els.accountPopover.innerHTML = `
      <form class="account-login" id="accountLoginForm">
        <h2>管理员登录</h2>
        <p>管理员账号全站唯一，登录后可管理所有项目空间。</p>
        <input name="realm" type="hidden" value="${escapeHtml(targetProject?.access?.realm || targetProject?.slug || "")}" />
        <input name="role" type="hidden" value="admin" />
        <label>
          <span>管理员账号</span>
          <input name="username" value="relumeow" autocomplete="username" required />
        </label>
        <label>
          <span>管理员密码</span>
          <input name="passcode" type="password" autocomplete="current-password" placeholder="Enter admin password" required />
        </label>
        <button type="submit">进入管理</button>
        <p class="form-status" id="accountLoginStatus"></p>
      </form>
    `;
    bindAccountLoginForm();
  }

  function bindAccountLoginForm() {
    const form = $("accountLoginForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = $("accountLoginStatus");
      const data = new FormData(form);
      const realm = String(data.get("realm") || "");
      const role = normalizedRole(String(data.get("role") || "visitor"));
      const username = String(data.get("username") || "");
      const passcode = String(data.get("passcode") || "");
      const realmField = form.elements.realm;
      const option = realmField?.options ? Array.from(realmField.options).find((item) => item.value === realm) : null;
      const target = pendingLoginRoute || option?.dataset.route || "/home/";
      status.textContent = "验证中...";
      try {
        await submitPasscode(realm, passcode, target, role, username);
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
    pendingLoginRoute = project?.route || pendingLoginRoute || "/home/";
    els.accountPopover.hidden = false;
    els.accountButton.setAttribute("aria-expanded", "true");
    if (adminEntry()) renderAccountPopover();
    else renderAccountLoginForAdmin(primaryAccessEntry() || { project: project || projects[0] });
  }

  function renderProjectLocked() {
    setVisible("project");
    els.routeLabel.textContent = project.title;
    els.pageTitle.textContent = project.title;
    renderOutline(null, { message: "解锁后显示当前文档标题。" });
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
    if (activeQuery.trim()) {
      renderSearchResults(activeQuery);
      renderAccount();
      return;
    }
    const hashDoc = location.hash.match(/^#\/doc\/(.+)$/)?.[1];
    const overview = docs.find((doc) => doc.is_overview && !doc.directory) || docs[0];
    showDoc(hashDoc ? decodeURIComponent(hashDoc) : overview?.id || "", { skipHash: true, allowQueryOverride: !hashDoc });
    renderAccount();
  }

  function showDoc(id, options = {}) {
    const query = activeQuery.trim().toLowerCase();
    let doc = docs.find((item) => item.id === id) || docs[0];
    if (query && options.allowQueryOverride !== false) {
      const hit = searchDocs(query)[0]?.doc;
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
    if (!isEditing) bindTaskCheckboxes(doc, effectiveBody);
    bindDiscussionPanel(doc);
    if (!isEditing) bindSelectionAnnotations(doc);
    if (!isEditing) bindDocLinkPreviews();
    renderOutline(doc, { editing: isEditing });
    loadRemoteDiscussions(doc.id).then((entry) => {
      if (activeDocId !== doc.id) return;
      activeDiscussion = entry;
      saveDiscussions(doc.id, entry);
      refreshDiscussionPanel(entry);
    });
    renderDirectoryTree();
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_/\\|.,:;()[\]{}"'`~!?@#$%^&*=+<>-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactSearchText(value) {
    return normalizeSearchText(value).replace(/\s+/g, "");
  }

  function searchTokens(rawQuery) {
    return normalizeSearchText(rawQuery).split(/\s+/).filter(Boolean);
  }

  function docSearchText(doc) {
    return [
      doc.title,
      doc.summary,
      doc.category,
      doc.project_path,
      (doc.tags || []).join(" "),
      stripMarkdown(doc.body),
    ].join(" ");
  }

  function searchFields(doc) {
    const cacheKey = `${doc.id || ""}::${doc.updated || ""}::${Boolean(docOverrides[doc.id]?.body)}`;
    if (searchFieldCache.has(cacheKey)) return searchFieldCache.get(cacheKey);
    const title = normalizeSearchText(doc.title);
    const summary = normalizeSearchText(doc.summary);
    const category = normalizeSearchText(doc.category);
    const path = normalizeSearchText(doc.project_path);
    const tags = normalizeSearchText((doc.tags || []).join(" "));
    const bodySource = docOverrides[doc.id]?.body || doc.body;
    const body = normalizeSearchText(stripMarkdown(bodySource));
    const compact = {
      title: compactSearchText(doc.title),
      summary: compactSearchText(doc.summary),
      category: compactSearchText(doc.category),
      path: compactSearchText(doc.project_path),
      tags: compactSearchText((doc.tags || []).join(" ")),
      body: compactSearchText(stripMarkdown(bodySource)),
    };
    const terms = new Set([title, summary, category, path, tags].join(" ").split(/\s+/).filter((term) => term.length >= 3));
    const fields = { title, summary, category, path, tags, body, compact, terms: Array.from(terms) };
    searchFieldCache.set(cacheKey, fields);
    return fields;
  }

  function boundedEditDistance(a, b, maxDistance) {
    if (!a || !b) return maxDistance + 1;
    if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
    const prev = Array.from({ length: b.length + 1 }, (_item, index) => index);
    const curr = Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i += 1) {
      curr[0] = i;
      let rowMin = curr[0];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        rowMin = Math.min(rowMin, curr[j]);
      }
      if (rowMin > maxDistance) return maxDistance + 1;
      for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
    }
    return prev[b.length];
  }

  function editDistanceLimit(length) {
    if (length < 4) return 0;
    if (length <= 5) return 1;
    if (length <= 9) return 2;
    return 3;
  }

  function subsequenceScore(needle, haystack, baseScore) {
    if (needle.length < 3 || !haystack) return 0;
    let cursor = 0;
    let first = -1;
    let last = -1;
    for (const char of needle) {
      const hit = haystack.indexOf(char, cursor);
      if (hit === -1) return 0;
      if (first === -1) first = hit;
      last = hit;
      cursor = hit + 1;
    }
    const span = Math.max(1, last - first + 1);
    const looseness = Math.max(0, span - needle.length);
    return Math.max(1, baseScore - Math.min(36, looseness * 3));
  }

  function tokenScore(token, fields) {
    if (!token) return 0;
    const compactToken = compactSearchText(token);
    const directChecks = [
      [fields.title, 180], [fields.path, 90], [fields.tags, 76], [fields.category, 70], [fields.summary, 52], [fields.body, 18],
      [fields.compact.title, 170], [fields.compact.path, 88], [fields.compact.tags, 72], [fields.compact.category, 66], [fields.compact.summary, 48], [fields.compact.body, 14],
    ];
    let score = 0;
    directChecks.forEach(([field, weight]) => {
      if (field && field.includes(token)) score = Math.max(score, weight);
      if (compactToken && field && field.includes(compactToken)) score = Math.max(score, Math.max(1, weight - 4));
    });
    const limit = editDistanceLimit(compactToken.length);
    if (limit > 0) {
      fields.terms.forEach((term) => {
        const compactTerm = compactSearchText(term);
        const distance = boundedEditDistance(compactToken, compactTerm, limit);
        if (distance <= limit) score = Math.max(score, 116 - distance * 24);
      });
    }
    score = Math.max(
      score,
      subsequenceScore(compactToken, fields.compact.title, 82),
      subsequenceScore(compactToken, fields.compact.path, 48),
      subsequenceScore(compactToken, fields.compact.tags, 42),
      subsequenceScore(compactToken, fields.compact.category, 38),
      subsequenceScore(compactToken, fields.compact.summary, 30),
    );
    return score;
  }

  function searchDocs(rawQuery) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return [];
    const compactQuery = compactSearchText(query);
    const tokens = searchTokens(query);
    return docs
      .map((doc) => {
        const fields = searchFields(doc);
        const wholeScore = tokenScore(query, fields);
        const compactWholeScore = compactQuery === query ? 0 : tokenScore(compactQuery, fields);
        const tokenScores = tokens.map((token) => tokenScore(token, fields));
        const fuzzyMatched = tokenScores.length ? tokenScores.every(Boolean) : false;
        const matched = wholeScore || compactWholeScore || fuzzyMatched;
        if (!matched) return null;
        const titleBoost = fields.compact.title === compactQuery ? 240 : fields.compact.title.includes(compactQuery) ? 150 : 0;
        const score = titleBoost + wholeScore + compactWholeScore + tokenScores.reduce((total, item) => total + item, 0);
        return { doc, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || String(a.doc.title).localeCompare(String(b.doc.title), "zh-CN"))
      .slice(0, 24);
  }

  function searchSnippet(doc, rawQuery) {
    const query = normalizeSearchText(rawQuery);
    const tokens = searchTokens(query);
    const source = stripMarkdown(doc.body) || doc.summary || "";
    const lower = normalizeSearchText(source);
    const hit = [query, ...tokens].find((token) => token && lower.includes(token));
    if (!hit) return doc.summary || source.slice(0, 150);
    const index = lower.indexOf(hit);
    const start = Math.max(0, index - 58);
    const end = Math.min(source.length, index + hit.length + 110);
    return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
  }

  function renderSearchResults(rawQuery) {
    const query = String(rawQuery || "").trim();
    const results = searchDocs(query);
    activeDocId = "";
    renderedDoc = null;
    if (outlineObserver) {
      outlineObserver.disconnect();
      outlineObserver = null;
    }
    renderOutline(null, { message: "搜索结果不生成标题目录。" });
    els.documentPanel.innerHTML = `
      <section class="search-results-panel">
        <div class="search-results-head">
          <span>Search</span>
          <h1>搜索文档</h1>
          <p>${results.length ? `找到 ${results.length} 篇匹配 “${escapeHtml(query)}” 的文档。` : `没有找到匹配 “${escapeHtml(query)}” 的文档。`}</p>
        </div>
        ${results.length ? `
          <div class="search-result-list">
            ${results.map(({ doc }) => `
              <button class="search-result-card" type="button" data-doc-id="${escapeHtml(doc.id)}">
                <span class="search-result-meta">
                  <span>${escapeHtml(doc.category || "文档")}</span>
                  <span>${escapeHtml(doc.updated || "")}</span>
                  <span>${escapeHtml(doc.project_path || "")}</span>
                </span>
                <strong>${escapeHtml(doc.title)}</strong>
                <em>${escapeHtml(doc.summary || "")}</em>
                <p>${escapeHtml(searchSnippet(doc, query))}</p>
              </button>
            `).join("")}
          </div>
        ` : `
          <div class="empty-state">换一个关键词试试，可以搜索标题、目录、标签、摘要和正文内容。</div>
        `}
      </section>
    `;
    els.documentPanel.querySelectorAll("[data-doc-id]").forEach((button) => {
      button.addEventListener("click", () => {
        openSearchResult(button.dataset.docId || "");
      });
    });
    renderDirectoryTree();
  }

  function clearSearchInput() {
    activeQuery = "";
    if (els.searchInput) els.searchInput.value = "";
  }

  function openSearchResult(docId) {
    clearSearchInput();
    showDoc(docId || "", { allowQueryOverride: false });
  }

  function canEditProject() {
    if (!project) return false;
    const entry = primaryAccessEntry();
    return entry?.role === "admin";
  }

  function currentAuthorName() {
    const entry = primaryAccessEntry();
    if (entry?.role === "admin") return `管理员 ${entry.username || "relumeow"}`;
    return "访客";
  }

  function renderDocTools(doc, body, isEditing) {
    if (!canEditProject()) return "";
    return `
      <div class="doc-tools">
        <span id="docToolStatus">${docOverrides[doc.id] ? "正在使用后台覆盖版本" : "正文来自项目仓库"}</span>
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

  function bindTaskCheckboxes(doc, body) {
    const checkboxes = Array.from(els.documentPanel.querySelectorAll(".doc-body input[data-task-index]"));
    if (!checkboxes.length) return;
    const editable = canEditProject();
    checkboxes.forEach((box) => {
      if (!editable) {
        box.disabled = true;
        return;
      }
      box.addEventListener("change", async () => {
        const index = Number(box.dataset.taskIndex || "-1");
        const checked = box.checked;
        const status = $("docToolStatus");
        const nextBody = updateTaskMarker(body, index, checked);
        if (!nextBody || nextBody === body) return;
        box.disabled = true;
        if (status) status.textContent = "正在保存任务状态...";
        try {
          await saveDocOverride(doc.id, nextBody);
          if (status) status.textContent = "任务状态已保存到后台";
          showDoc(doc.id, { skipHash: true, keepDirectoryState: true });
        } catch (error) {
          box.checked = !checked;
          box.disabled = false;
          if (status) status.textContent = error.message || "任务状态保存失败";
        }
      });
    });
  }

  function updateTaskMarker(markdown, taskIndex, checked) {
    let seen = -1;
    return String(markdown || "").replace(/^(\s*(?:[-*]|\d+\.)\s+\[)([ xX])(\]\s+)/gm, (match, before, _flag, after) => {
      seen += 1;
      if (seen !== taskIndex) return match;
      return `${before}${checked ? "x" : " "}${after}`;
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
        author: currentAuthorName(),
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
        author: currentAuthorName(),
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
        author: currentAuthorName(),
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

  function bindDocLinkPreviews() {
    if (PREVIEW_MODE) return;
    const body = els.documentPanel.querySelector(".doc-body");
    if (!body) return;
    let preview = null;
    let hideTimer = null;
    let activeAnchor = null;
    const removePreview = () => {
      window.clearTimeout(hideTimer);
      preview?.remove();
      preview = null;
      activeAnchor = null;
    };
    const scheduleHide = () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(removePreview, 120);
    };
    const showPreview = (anchor) => {
      const doc = anchor.dataset.docPreview ? docs.find((item) => item.id === anchor.dataset.docPreview) : null;
      const previewUrl = anchor.dataset.previewUrl || previewUrlForHref(anchor.getAttribute("href") || "");
      if (!doc && !previewUrl) return;
      window.clearTimeout(hideTimer);
      if (preview && activeAnchor === anchor) {
        positionLinkPreview(anchor, preview);
        return;
      }
      activeAnchor = anchor;
      preview?.remove();
      preview = document.createElement("aside");
      preview.className = "link-preview-card";
      preview.innerHTML = renderLinkPreview(doc, previewUrl, anchor.textContent || anchor.getAttribute("href") || "");
      document.body.appendChild(preview);
      preview.addEventListener("mouseenter", () => window.clearTimeout(hideTimer));
      preview.addEventListener("mouseleave", scheduleHide);
      positionLinkPreview(anchor, preview);
      hydrateProtectedImages(preview);
    };
    const previewAnchor = (target) => target?.closest?.("a[data-doc-preview], a[data-site-preview]");
    const showFromEvent = (event) => {
      const anchor = previewAnchor(event.target);
      if (anchor && body.contains(anchor)) showPreview(anchor);
    };
    body.addEventListener("mouseover", showFromEvent);
    body.addEventListener("mousemove", showFromEvent);
    body.addEventListener("pointerover", showFromEvent);
    body.addEventListener("focusin", (event) => {
      const anchor = previewAnchor(event.target);
      if (anchor && body.contains(anchor)) showPreview(anchor);
    });
    const hideFromEvent = (event) => {
      const anchor = previewAnchor(event.target);
      if (!anchor) return;
      const next = event.relatedTarget;
      if (next && (anchor.contains(next) || preview?.contains(next))) return;
      scheduleHide();
    };
    body.addEventListener("mouseout", hideFromEvent);
    body.addEventListener("pointerout", hideFromEvent);
    body.addEventListener("focusout", scheduleHide);
    window.addEventListener("scroll", removePreview, { passive: true });
    window.addEventListener("resize", removePreview, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") removePreview();
    });
  }

  function renderLinkPreview(doc, previewUrl, fallbackTitle = "") {
    const title = doc?.title || fallbackTitle || "站内页面";
    const summary = doc?.summary || stripMarkdown(doc?.body || "").slice(0, 140) || "打开站内页面查看完整内容。";
    const meta = doc?.updated || doc?.category || "站内链接";
    const cleanUrl = previewUrl ? readablePreviewUrl(previewUrl) : "";
    return `
      ${previewUrl ? `
        <div class="link-preview-browser" aria-hidden="true">
          <div class="link-preview-chrome">
            <span class="link-preview-dots"><i></i><i></i><i></i></span>
            <span class="link-preview-url">${escapeHtml(cleanUrl || previewUrl)}</span>
          </div>
          <div class="link-preview-viewport">
            <iframe class="link-preview-frame" src="${escapeHtml(previewUrl)}" title="${escapeHtml(title)} preview" tabindex="-1" loading="lazy"></iframe>
          </div>
        </div>
      ` : `<div class="link-preview-fallback">${escapeHtml(project?.mark || "DOC")}</div>`}
      <div class="link-preview-body">
        <span>${escapeHtml(meta)}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(summary)}</p>
      </div>
    `;
  }

  function previewUrlForHref(href) {
    const raw = String(href || "").trim();
    if (!raw || raw.startsWith("#") || /^(mailto:|tel:|data:|\/api\/)/i.test(raw)) return "";
    try {
      const url = new URL(raw, window.location.href);
      if (!isPreviewableSiteUrl(url)) return "";
      url.searchParams.set("preview", "1");
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_error) {
      return "";
    }
  }

  function readablePreviewUrl(previewUrl) {
    try {
      const url = new URL(previewUrl, window.location.origin);
      url.searchParams.delete("preview");
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_error) {
      return String(previewUrl || "").replace(/([?&])preview=1(&?)/, (_m, prefix, suffix) => suffix ? prefix : "").replace(/\?$/, "");
    }
  }

  function isPreviewableSiteUrl(url) {
    if (url.origin !== window.location.origin) return false;
    const pathname = url.pathname || "/";
    if (pathname.startsWith("/api/") || pathname.includes("/assets/") || pathname.includes("/static/")) return false;
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    if (/\.[a-z0-9]{2,6}$/i.test(lastSegment) && !lastSegment.endsWith(".html")) return false;
    const normalizedPath = pathname.replace(/\/+$/, "/");
    const routes = new Set(["/home/", "/login/", "/admin/", ...projects.map((item) => item.route).filter(Boolean)]);
    return Array.from(routes).some((route) => {
      const normalizedRoute = String(route || "/").replace(/\/+$/, "/");
      return normalizedPath === normalizedRoute || normalizedPath.startsWith(normalizedRoute);
    });
  }

  function positionLinkPreview(anchor, preview) {
    const anchorRect = anchor.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const gap = 12;
    const maxLeft = Math.max(16, window.innerWidth - previewRect.width - 16);
    const left = Math.min(maxLeft, Math.max(16, anchorRect.left));
    const belowTop = anchorRect.bottom + gap;
    const aboveTop = anchorRect.top - previewRect.height - gap;
    const top = belowTop + previewRect.height <= window.innerHeight - 16
      ? belowTop
      : Math.max(16, aboveTop);
    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
  }

  async function hydrateProtectedImages(container) {
    if (!project || project.access?.mode !== "passcode") return;
    const realm = project.access?.realm || project.slug;
    const headers = authHeadersForRealm(realm);
    if (!headers.Authorization) return;
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(images.map(async (img) => {
      const rawSrc = img.dataset.protectedSrc || img.getAttribute("src") || "";
      const url = new URL(rawSrc, window.location.origin);
      if (!url.pathname.startsWith(`/api/projects/${realm}/assets/`) && !url.pathname.startsWith(`/api/content-assets/${realm}/`)) return;
      try {
        const res = await fetch(url.toString(), {
          headers,
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
    let taskIndex = 0;
    const headingCounts = {};
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
        const baseSlug = slugify(text);
        headingCounts[baseSlug] = (headingCounts[baseSlug] || 0) + 1;
        const headingId = headingCounts[baseSlug] === 1 ? baseSlug : `${baseSlug}-${headingCounts[baseSlug]}`;
        html += `<h${level} id="${headingId}">${inline(heading[2])}</h${level}>`;
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
          const index = taskIndex;
          taskIndex += 1;
          body = `<label class="task-item"><input type="checkbox" data-task-index="${index}" ${task[1].toLowerCase() === "x" ? "checked" : ""}> <span>${inline(task[2])}</span></label>`;
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

  function renderOutline(doc, options = {}) {
    if (!els.outlineTree) return;
    if (outlineObserver) {
      outlineObserver.disconnect();
      outlineObserver = null;
    }
    if (!doc) {
      els.outlineTree.innerHTML = `<p class="outline-empty">${escapeHtml(options.message || "打开文档后显示标题。")}</p>`;
      return;
    }
    if (options.editing) {
      els.outlineTree.innerHTML = `<p class="outline-empty">编辑模式下保存后刷新标题导航。</p>`;
      return;
    }
    const body = els.documentPanel?.querySelector(".doc-body");
    const headings = Array.from(body?.querySelectorAll("h1, h2, h3") || [])
      .map((heading, index) => {
        if (!heading.id) heading.id = `${slugify(heading.textContent || "section")}-${index + 1}`;
        return {
          id: heading.id,
          level: Math.min(3, Number(heading.tagName.slice(1)) || 1),
          text: String(heading.textContent || "").trim() || `Section ${index + 1}`,
        };
      })
      .filter((item) => item.text);
    if (!headings.length) {
      els.outlineTree.innerHTML = `<p class="outline-empty">这篇文档还没有可跳转标题。</p>`;
      return;
    }
    els.outlineTree.innerHTML = headings.map((item) => `
      <button class="outline-link outline-level-${item.level}" type="button" data-heading-id="${escapeHtml(item.id)}">
        <span>${escapeHtml(item.text)}</span>
      </button>
    `).join("");
    els.outlineTree.querySelectorAll("[data-heading-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.headingId || "");
        if (!target) return;
        els.outlineTree.querySelectorAll(".active").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    initOutlineSpy(headings);
  }

  function initOutlineSpy(headings) {
    if (!("IntersectionObserver" in window)) return;
    const links = new Map(Array.from(els.outlineTree.querySelectorAll("[data-heading-id]")).map((button) => [button.dataset.headingId, button]));
    outlineObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const activeId = visible[0]?.target?.id;
      if (!activeId || !links.has(activeId)) return;
      links.forEach((button) => button.classList.remove("active"));
      links.get(activeId)?.classList.add("active");
    }, { rootMargin: "-14% 0px -70% 0px", threshold: [0, 1] });
    headings.forEach((item) => {
      const target = document.getElementById(item.id);
      if (target) outlineObserver.observe(target);
    });
    links.get(headings[0]?.id)?.classList.add("active");
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
        const previewUrl = previewUrlForHref(resolved.href);
        const previewAttrs = [
          (resolved.docId || previewUrl) ? `class="doc-preview-link"` : "",
          resolved.docId ? `data-doc-preview="${escapeHtml(resolved.docId)}"` : "",
          previewUrl ? `data-site-preview="true"` : "",
          previewUrl ? `data-preview-url="${escapeHtml(previewUrl)}"` : "",
        ].filter(Boolean).join(" ");
        return `<a href="${escapeHtml(resolved.href)}" target="${target}" rel="noreferrer"${previewAttrs ? ` ${previewAttrs}` : ""}>${label}</a>`;
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
    const routeTarget = resolveRouteDocTarget(raw);
    if (routeTarget) {
      return {
        href: `${project.route}#/doc/${encodeURIComponent(routeTarget.id)}`,
        external: false,
        docId: routeTarget.id,
      };
    }
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
      docId: target.id,
    };
  }

  function resolveRouteDocTarget(rawHref) {
    if (!project) return null;
    try {
      const url = new URL(String(rawHref || ""), window.location.origin);
      const normalizedRoute = String(project.route || "").replace(/\/+$/, "/");
      const normalizedPath = url.pathname.replace(/\/+$/, "/");
      if (normalizedPath !== normalizedRoute || !url.hash.startsWith("#/doc/")) return null;
      const id = decodeURIComponent(url.hash.replace(/^#\/doc\//, ""));
      return docs.find((doc) => doc.id === id) || null;
    } catch (_error) {
      return null;
    }
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

  function firstMarkdownImage(doc) {
    const match = String(doc?.body || "").match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (!match) return null;
    const { url } = splitImageTarget(match[2]);
    const resolved = resolveAssetUrl(url, doc);
    return { alt: match[1] || "", url: resolved };
  }

  function resolveAssetUrl(url, doc = renderedDoc) {
    const raw = String(url || "").trim();
    if (/^(https?:|data:|\/)/i.test(raw)) return raw;
    const route = project?.route || "/";
    if (/^(assets|static)\//i.test(raw)) return `${route}${raw}`;
    const baseDir = doc?.directory || "";
    const basePath = doc?.project_path || "";
    const docDir = basePath.includes("/") ? basePath.split("/").slice(0, -1).join("/") : baseDir;
    const normalized = normalizeDocPath(docDir ? `${docDir}/${raw}` : raw);
    return normalized ? `${route}${normalized}` : raw;
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
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !project || !accessState.allowed || !activeQuery.trim()) return;
    const hit = searchDocs(activeQuery)[0]?.doc;
    if (!hit) return;
    event.preventDefault();
    openSearchResult(hit.id);
  });
  document.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toLowerCase();
    if (key !== "k" || !(event.metaKey || event.ctrlKey)) return;
    if (!els.searchInput || els.searchInput.disabled) return;
    event.preventDefault();
    els.searchInput.focus();
    els.searchInput.select();
  });
  els.themeToggle?.addEventListener("click", toggleTheme);
  els.directoryContentMode?.addEventListener("click", () => setDirectoryMode("content"));
  els.directoryDateMode?.addEventListener("click", () => setDirectoryMode("date"));
  els.railToggle?.addEventListener("click", toggleRail);
  els.tocToggle?.addEventListener("click", toggleToc);
  els.tocEdgeToggle?.addEventListener("click", toggleToc);
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
  initDirectoryMode();
  initLayoutControls();
  initRailResize();
  initTocResize();
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
