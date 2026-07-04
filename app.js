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

  let activeDocId = "";
  let activeQuery = "";
  let accessState = { checked: false, allowed: false, reason: "" };
  let protectedDataLoaded = !seed.protected;
  let pendingLoginRoute = "";

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
    els.directoryTree.querySelectorAll("[data-doc-id]").forEach((button) => {
      button.addEventListener("click", () => {
        showDoc(button.dataset.docId || "");
      });
    });
  }

  function renderTreeNode(node, depth) {
    if (node.type === "doc") {
      return `<button class="tree-doc ${activeDocId === node.id ? "active" : ""}" data-doc-id="${escapeHtml(node.id)}" style="--depth:${depth}" type="button">
        <span>□</span>${escapeHtml(node.title)}
      </button>`;
    }
    const overviewId = node.overview_id || "";
    const children = (node.children || []).map((child) => renderTreeNode(child, depth + 1)).join("");
    return `<div class="tree-group" style="--depth:${depth}">
      <button class="tree-directory ${activeDocId === overviewId ? "active" : ""}" ${overviewId ? `data-doc-id="${escapeHtml(overviewId)}"` : ""} type="button">
        <span>${depth ? "▸" : "▾"}</span>${escapeHtml(node.title)}
      </button>
      <div class="tree-children">${children}</div>
    </div>`;
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
    if (!entries.length) {
      renderAccountLogin();
      return;
    }
    renderAdminPopover(entries);
  }

  function renderAccountLogin() {
    const projectOptions = projects.map((item) => `<option value="${escapeHtml(item.access?.realm || item.slug)}" data-route="${escapeHtml(item.route)}">${escapeHtml(item.title)}</option>`).join("");
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
    $("lockedLoginButton")?.addEventListener("click", () => openAccountPopover(project.route));
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
    if (!options.skipHash) history.replaceState(null, "", `${project.route}#/doc/${encodeURIComponent(doc.id)}`);
    els.documentPanel.innerHTML = `
      <div class="doc-meta">
        <span>${escapeHtml(doc.category)}</span>
        <span>${escapeHtml(doc.updated)}</span>
        <span>${doc.reading_minutes || 1} min read</span>
        <span>${escapeHtml(doc.project_path || "")}</span>
      </div>
      <div class="doc-body">${renderMarkdown(doc.body || "")}</div>
    `;
    hydrateProtectedImages(els.documentPanel);
    renderDirectoryTree();
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
      if (!url.pathname.startsWith(`/api/projects/${realm}/assets/`)) return;
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
    let codeLang = "";
    let codeLines = [];
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
        while (listStack.length > indent + 1) html += `</${listStack.pop()}>`;
        while (listStack.length < indent + 1) { listStack.push(type); html += `<${type}>`; }
        html += `<li>${inline(ordered ? ordered[2] : unordered[2])}</li>`;
        return;
      }
      paragraph.push(line.trim());
    });
    flushParagraph(); flushTable(); closeLists();
    return html;
  }

  function preprocessMarkdown(markdown) {
    return String(markdown || "")
      .replace(/\r\n/g, "\n")
      .replace(/!\[\[([^\]]+)\]\]/g, (_m, target) => `![${target}](${target})`);
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
        const target = href.startsWith("#") || href.endsWith(".md") ? "_self" : "_blank";
        return `<a href="${escapeHtml(href)}" target="${target}" rel="noreferrer">${label}</a>`;
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return text;
  }

  function splitImageTarget(raw) {
    const normalized = String(raw || "").replace(/&quot;/g, '"');
    const match = normalized.match(/^(\S+)(?:\s+"([^"]*)")?$/);
    return { url: match?.[1] || normalized, title: match?.[2] || "" };
  }

  function isProtectedAssetUrl(url) {
    try {
      const parsed = new URL(String(url || ""), window.location.origin);
      return parsed.pathname.startsWith("/api/projects/");
    } catch (_error) {
      return false;
    }
  }

  function transparentPixel() {
    return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  }

  async function route() {
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
