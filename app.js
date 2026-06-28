(function () {
  const seed = window.V2M_BLOG_DATA || { docs: [], categories: [], generatedAt: "" };
  const DRAFT_STORAGE_KEY = "v2m-blog-drafts-v1";
  const API_STORAGE_KEY = "v2m-blog-api-v1";
  const baseDocs = (seed.docs || []).map(cloneDoc);
  let docs = baseDocs.map(cloneDoc);
  let uploadedDocs = [];
  let draftStore = loadDraftStore();
  let apiConfig = loadApiConfig();
  let apiProjects = [];
  let apiTasks = [];
  let apiUser = null;
  let activeCategory = "All";
  let sortMode = "recent";
  let currentDocId = "";
  let pendingEditorDocId = "";

  const $ = (id) => document.getElementById(id);
  const els = {
    categoryNav: $("categoryNav"),
    categoryChips: $("categoryChips"),
    docGrid: $("docGrid"),
    searchInput: $("searchInput"),
    clearSearch: $("clearSearch"),
    buildMeta: $("buildMeta"),
    homeView: $("homeView"),
    articleView: $("articleView"),
    articleBody: $("articleBody"),
    articleMeta: $("articleMeta"),
    tocNav: $("tocNav"),
    relatedDocs: $("relatedDocs"),
    backHome: $("backHome"),
    uploadInput: $("uploadInput"),
    uploadList: $("uploadList"),
    sortRecent: $("sortRecent"),
    sortTitle: $("sortTitle"),
    newDraft: $("newDraft"),
    apiStatus: $("apiStatus"),
    apiUrlInput: $("apiUrlInput"),
    apiHealthCheck: $("apiHealthCheck"),
    loginForm: $("loginForm"),
    setupForm: $("setupForm"),
    githubLoginButton: $("githubLoginButton"),
    sessionInfo: $("sessionInfo"),
    logoutButton: $("logoutButton"),
    projectList: $("projectList"),
    projectForm: $("projectForm"),
    refreshProjects: $("refreshProjects"),
    taskList: $("taskList"),
    taskForm: $("taskForm"),
    refreshTasks: $("refreshTasks"),
    remoteDocForm: $("remoteDocForm"),
    syncCurrentDraft: $("syncCurrentDraft"),
    editDoc: $("editDoc"),
    downloadDoc: $("downloadDoc"),
    discardDraft: $("discardDraft"),
    draftStatus: $("draftStatus"),
    editorPanel: $("editorPanel"),
    markdownEditor: $("markdownEditor"),
    editorPreview: $("editorPreview"),
    saveDraft: $("saveDraft"),
    closeEditor: $("closeEditor"),
  };

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const slugify = (value) => {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_/\\]+/g, "-")
      .replace(/[^\w\u4e00-\u9fff.-]+/g, "")
      .replace(/^-+|-+$/g, "");
    return slug || "section";
  };

  const stripMarkdown = (value) => String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_\-|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function categories() {
    const list = ["All", ...Array.from(new Set(docs.map((doc) => doc.category || "Notes"))).sort()];
    return list;
  }

  function countFor(category) {
    return category === "All" ? docs.length : docs.filter((doc) => doc.category === category).length;
  }

  function renderNavigation() {
    const nav = categories().map((category) => `
      <button class="nav-item ${category === activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}" type="button">
        <span>${escapeHtml(category)}</span><span>${countFor(category)}</span>
      </button>
    `).join("");
    els.categoryNav.innerHTML = nav;
    els.categoryChips.innerHTML = categories().map((category) => `
      <button class="chip ${category === activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}" type="button">
        ${escapeHtml(category)} · ${countFor(category)}
      </button>
    `).join("");
    document.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.category || "All";
        renderAll();
      });
    });
  }

  function filteredDocs() {
    const query = els.searchInput.value.trim().toLowerCase();
    let list = docs.filter((doc) => activeCategory === "All" || doc.category === activeCategory);
    if (query) {
      list = list.filter((doc) => {
        const haystack = [doc.title, doc.summary, doc.category, (doc.tags || []).join(" "), stripMarkdown(doc.body)].join(" ").toLowerCase();
        return haystack.includes(query);
      });
    }
    list.sort((a, b) => {
      if (sortMode === "title") return a.title.localeCompare(b.title, "zh-Hans-CN");
      return String(b.updated).localeCompare(String(a.updated)) || a.title.localeCompare(b.title, "zh-Hans-CN");
    });
    return list;
  }

  function renderDocGrid() {
    const list = filteredDocs();
    if (!list.length) {
      els.docGrid.innerHTML = `<div class="empty-state">没有匹配的文档。换个关键词，或者上传一个新的 Markdown 试试。</div>`;
      return;
    }
    els.docGrid.innerHTML = list.map((doc) => `
      <a class="doc-card" href="#/doc/${encodeURIComponent(doc.id)}">
        <header><span>${escapeHtml(doc.category)}</span><span>${escapeHtml(doc.updated)} · ${doc.reading_minutes || 1} min</span></header>
        <h2>${escapeHtml(doc.title)}</h2>
        <p>${escapeHtml(doc.summary || "暂无摘要。")}</p>
        <div class="doc-tags">${(doc.tags || []).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      </a>
    `).join("");
  }

  function preprocessMarkdown(markdown) {
    return String(markdown || "")
      .replace(/\r\n/g, "\n")
      .replace(/:::details\s*(.*?)\n([\s\S]*?)\n:::/g, (_m, title, body) => `<details><summary>${escapeHtml(title || "Details")}</summary>\n\n${body}\n\n</details>`)
      .replace(/!\[\[([^\]]+)\]\]/g, (_m, target) => `![${target}](${target})`)
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_m, target, label) => obsidianLink(target, label))
      .replace(/\[\[([^\]]+)\]\]/g, (_m, target) => obsidianLink(target, target));
  }

  function obsidianLink(target, label) {
    const clean = String(target).trim();
    const match = docs.find((doc) => doc.title === clean || doc.id === slugify(clean) || doc.source_path?.endsWith(clean));
    if (match) return `<a href="#/doc/${encodeURIComponent(match.id)}">${escapeHtml(label)}</a>`;
    return `<span title="未找到匹配文档" style="color: var(--amber);">${escapeHtml(label)}</span>`;
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
    let taskIndex = 0;

    const flushParagraph = () => {
      if (paragraph.length) {
        html += `<p>${inline(paragraph.join(" "))}</p>`;
        paragraph = [];
      }
    };
    const closeLists = (target = 0) => {
      while (listStack.length > target) {
        html += `</${listStack.pop()}>`;
      }
    };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.map((row) => row.trim()).filter(Boolean);
      if (rows.length >= 2 && /^\|?\s*:?-{3,}/.test(rows[1])) {
        const split = (row) => row.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
        const headers = split(rows[0]);
        html += "<table><thead><tr>" + headers.map((cell) => `<th>${inline(cell)}</th>`).join("") + "</tr></thead><tbody>";
        rows.slice(2).forEach((row) => {
          html += "<tr>" + split(row).map((cell) => `<td>${inline(cell)}</td>`).join("") + "</tr>";
        });
        html += "</tbody></table>";
      } else {
        html += rows.map((row) => `<p>${inline(row)}</p>`).join("");
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
      if (/^\s*\|/.test(line)) {
        flushParagraph(); closeLists(); table.push(line); return;
      }
      flushTable();
      if (!line.trim()) { flushParagraph(); closeLists(); return; }
      if (/^<details>|^<\/details>|^<summary>/.test(line.trim())) {
        flushParagraph(); closeLists(); html += line; return;
      }
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph(); closeLists();
        const level = heading[1].length;
        const text = stripMarkdown(heading[2]);
        html += `<h${level} id="${slugify(text)}">${inline(heading[2])}</h${level}>`;
        return;
      }
      const quote = /^>\s?(.*)$/.exec(line);
      if (quote) {
        flushParagraph(); closeLists();
        html += `<blockquote>${inline(quote[1])}</blockquote>`;
        return;
      }
      const unordered = /^(\s*)[-*]\s+(\[[ xX]\]\s+)?(.+)$/.exec(line);
      const ordered = /^(\s*)\d+\.\s+(.+)$/.exec(line);
      if (unordered || ordered) {
        flushParagraph();
        const indent = Math.floor(((unordered || ordered)[1] || "").length / 2);
        const type = ordered ? "ol" : "ul";
        while (listStack.length > indent + 1) html += `</${listStack.pop()}>`;
        while (listStack.length < indent + 1) { listStack.push(type); html += `<${type}>`; }
        if (listStack[listStack.length - 1] !== type) {
          html += `</${listStack.pop()}>`;
          listStack.push(type);
          html += `<${type}>`;
        }
        if (unordered) {
          const task = unordered[2];
          const content = unordered[3];
          if (task) {
            const checked = /\[[xX]\]/.test(task);
            html += `<li class="task-item"><label><input type="checkbox" data-task-index="${taskIndex++}" ${checked ? "checked" : ""}>${inline(content)}</label></li>`;
          } else {
            html += `<li>${inline(content)}</li>`;
          }
        } else {
          html += `<li>${inline(ordered[2])}</li>`;
        }
        return;
      }
      paragraph.push(line.trim());
    });
    flushParagraph(); flushTable(); closeLists();
    if (inCode) html += `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
    return html;
  }

  function inline(value) {
    let text = escapeHtml(value);
    const stash = [];
    text = text.replace(/&lt;a href=&quot;([^"]+)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/g, (m, href, label) => {
      const token = `@@LINK${stash.length}@@`;
      stash.push(`<a href="${href}">${label}</a>`);
      return token;
    });
    text = text
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, `<img src="$2" alt="$1">`)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
        const target = href.startsWith("#") ? "_self" : "_blank";
        return `<a href="${href}" target="${target}" rel="noreferrer">${label}</a>`;
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    stash.forEach((html, index) => { text = text.replace(`@@LINK${index}@@`, html); });
    return text;
  }

  function cloneDoc(doc) {
    return JSON.parse(JSON.stringify(doc || {}));
  }

  function loadDraftStore() {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function loadApiConfig() {
    try {
      const raw = window.localStorage.getItem(API_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        url: parsed?.url || "http://127.0.0.1:8787",
        sessionToken: parsed?.sessionToken || parsed?.token || "",
        expiresAt: parsed?.expiresAt || "",
      };
    } catch (_error) {
      return { url: "http://127.0.0.1:8787", sessionToken: "", expiresAt: "" };
    }
  }

  function persistApiConfig() {
    apiConfig = {
      url: String(els.apiUrlInput.value || "http://127.0.0.1:8787").replace(/\/+$/, ""),
      sessionToken: apiConfig.sessionToken || "",
      expiresAt: apiConfig.expiresAt || "",
    };
    try {
      window.localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiConfig));
    } catch (_error) {
      setApiStatus("浏览器阻止保存 API 设置", "error");
    }
  }

  function persistDraftStore() {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftStore));
    } catch (_error) {
      setStatus("浏览器阻止了本地草稿保存。");
    }
  }

  function rebuildDocs() {
    const merged = [...baseDocs.map(cloneDoc), ...uploadedDocs.map(cloneDoc)];
    Object.values(draftStore).forEach((draft) => {
      if (!draft?.id || typeof draft.body !== "string") return;
      const doc = normalizeDoc(draft);
      const index = merged.findIndex((item) => item.id === doc.id);
      if (index >= 0) merged[index] = { ...merged[index], ...doc, has_draft: true };
      else merged.unshift({ ...doc, has_draft: true });
    });
    docs = merged;
  }

  function normalizeDoc(doc) {
    const body = String(doc.body || "");
    const category = doc.category || "Drafts";
    const title = extractTitle(body, doc.title || "Untitled Markdown");
    const summary = stripMarkdown(body).slice(0, 220);
    return {
      ...doc,
      title,
      category,
      summary,
      source_path: doc.source_path || `drafts/${doc.id || "untitled"}.md`,
      source_kind: doc.source_kind || "draft",
      updated: doc.updated || today(),
      tags: normalizeClientTags(doc.tags, category),
      body,
      headings: extractHeadings(body),
      reading_minutes: Math.max(1, Math.round(stripMarkdown(body).length / 650)),
    };
  }

  function normalizeClientTags(tags, category) {
    const list = Array.isArray(tags) ? tags : [];
    const next = [...list, category].map((tag) => String(tag || "").trim()).filter(Boolean);
    return Array.from(new Set(next)).slice(0, 8);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowLabel() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function currentDoc() {
    return docs.find((item) => item.id === currentDocId);
  }

  function hasPersistentSource(id) {
    return baseDocs.some((doc) => doc.id === id) || uploadedDocs.some((doc) => doc.id === id);
  }

  function setStatus(message) {
    els.draftStatus.textContent = message || "";
  }

  function updateDraftControls(doc) {
    if (!doc) {
      setStatus("");
      els.discardDraft.hidden = true;
      return;
    }
    const draft = draftStore[doc.id];
    els.discardDraft.hidden = !draft;
    if (draft) setStatus(`本地草稿 · ${draft.draft_updated_at || doc.updated || "已保存"}`);
    else setStatus("可在线编辑，保存后只存到当前浏览器。");
  }

  function openEditor() {
    const doc = currentDoc();
    if (!doc) return;
    els.markdownEditor.value = doc.body || "";
    els.editorPreview.innerHTML = renderMarkdown(els.markdownEditor.value);
    els.editorPanel.hidden = false;
    els.articleBody.hidden = true;
    els.markdownEditor.focus();
  }

  function closeEditor() {
    els.editorPanel.hidden = true;
    els.articleBody.hidden = false;
  }

  function saveDraftFromEditor() {
    const doc = currentDoc();
    if (!doc) return;
    saveDraft(doc, els.markdownEditor.value);
    showDoc(doc.id, { keepEditor: true, preserveScroll: true });
    openEditor();
  }

  function saveDraft(doc, body) {
    const draft = normalizeDoc({
      ...doc,
      body,
      updated: today(),
      draft_updated_at: nowLabel(),
      source_kind: doc.source_kind || "draft",
    });
    draft.has_draft = true;
    draft.draft_updated_at = nowLabel();
    draftStore[draft.id] = draft;
    persistDraftStore();
    rebuildDocs();
    renderAll();
    setStatus(`本地草稿 · ${draft.draft_updated_at}`);
  }

  function discardCurrentDraft() {
    const doc = currentDoc();
    if (!doc || !draftStore[doc.id]) return;
    delete draftStore[doc.id];
    persistDraftStore();
    rebuildDocs();
    renderAll();
    closeEditor();
    if (hasPersistentSource(doc.id)) showDoc(doc.id);
    else location.hash = "#/";
  }

  function createNewDraft() {
    const id = uniqueId(`draft-${Date.now().toString(36)}`);
    const body = `# 新建 Markdown\n\n- [ ] 待办项\n\n在这里写内容。\n`;
    const doc = normalizeDoc({
      id,
      title: "新建 Markdown",
      category: "Drafts",
      source_path: `drafts/${id}.md`,
      source_kind: "draft",
      tags: ["Drafts"],
      body,
      updated: today(),
      draft_updated_at: nowLabel(),
    });
    draftStore[id] = { ...doc, has_draft: true };
    persistDraftStore();
    rebuildDocs();
    activeCategory = "Drafts";
    renderAll();
    pendingEditorDocId = id;
    location.hash = `#/doc/${encodeURIComponent(id)}`;
    if (currentDocId === id) showDoc(id);
  }

  function downloadCurrentDoc() {
    const doc = currentDoc();
    if (!doc) return;
    const body = doc.body.endsWith("\n") ? doc.body : `${doc.body}\n`;
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = markdownFilename(doc);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function markdownFilename(doc) {
    const source = String(doc.source_path || "").split("/").pop();
    if (source && /\.(md|markdown)$/i.test(source)) return source;
    return `${slugify(doc.title || doc.id || "document")}.md`;
  }

  function updateTaskLine(body, taskIndex, checked) {
    let seen = -1;
    return String(body || "").split("\n").map((line) => {
      if (!/^(\s*)[-*]\s+\[[ xX]\]\s+/.test(line)) return line;
      seen += 1;
      if (seen !== taskIndex) return line;
      return line.replace(/^(\s*[-*]\s+)\[[ xX]\]/, `$1[${checked ? "x" : " "}]`);
    }).join("\n");
  }

  function handleRenderedTaskToggle(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches("[data-task-index]")) return;
    const doc = currentDoc();
    if (!doc) return;
    const nextBody = updateTaskLine(doc.body, Number(input.dataset.taskIndex), input.checked);
    const y = window.scrollY;
    saveDraft(doc, nextBody);
    showDoc(doc.id, { preserveScroll: true });
    window.scrollTo({ top: y, behavior: "instant" });
  }

  function handleEditorPreviewTaskToggle(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches("[data-task-index]")) return;
    els.markdownEditor.value = updateTaskLine(els.markdownEditor.value, Number(input.dataset.taskIndex), input.checked);
    els.editorPreview.innerHTML = renderMarkdown(els.markdownEditor.value);
    setStatus("正在编辑，尚未保存。");
  }

  function showHome() {
    currentDocId = "";
    closeEditor();
    els.homeView.hidden = false;
    els.articleView.hidden = true;
    renderDocGrid();
  }

  function showDoc(id, options = {}) {
    const doc = docs.find((item) => item.id === id) || docs[0];
    if (!doc) return showHome();
    currentDocId = doc.id;
    els.homeView.hidden = true;
    els.articleView.hidden = false;
    if (!options.keepEditor) closeEditor();
    els.articleMeta.innerHTML = `
      <span>${escapeHtml(doc.category)}</span>
      <span>${escapeHtml(doc.updated)}</span>
      <span>${doc.reading_minutes || 1} min read</span>
      <span>${escapeHtml(doc.source_path || "uploaded")}</span>
      ${draftStore[doc.id] ? "<span>本地草稿</span>" : ""}
    `;
    els.articleBody.innerHTML = renderMarkdown(doc.body);
    if (options.keepEditor) els.editorPreview.innerHTML = renderMarkdown(els.markdownEditor.value);
    renderToc(doc);
    renderRelated(doc);
    updateDraftControls(doc);
    if (pendingEditorDocId === doc.id) {
      pendingEditorDocId = "";
      openEditor();
    }
    if (!options.preserveScroll) window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderToc(doc) {
    if (!doc.headings?.length) {
      els.tocNav.innerHTML = `<span style="color: var(--muted); font-size: 13px;">暂无目录</span>`;
      return;
    }
    els.tocNav.innerHTML = doc.headings.map((heading) => `
      <a class="toc-level-${escapeHtml(heading.level)}" href="#${escapeHtml(heading.slug)}">${escapeHtml(heading.text)}</a>
    `).join("");
  }

  function renderRelated(doc) {
    const related = docs
      .filter((item) => item.id !== doc.id && (item.category === doc.category || (item.tags || []).some((tag) => (doc.tags || []).includes(tag))))
      .slice(0, 5);
    els.relatedDocs.innerHTML = related.map((item) => `
      <a class="related-item" href="#/doc/${encodeURIComponent(item.id)}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.category)} · ${escapeHtml(item.updated)}</span>
      </a>
    `).join("") || `<span style="color: var(--muted); font-size: 13px;">暂无相关文档</span>`;
  }

  function route() {
    const match = location.hash.match(/^#\/doc\/(.+)$/);
    if (match) showDoc(decodeURIComponent(match[1]));
    else showHome();
  }

  function renderAll() {
    els.buildMeta.textContent = `${docs.length} 篇文档 · 构建时间 ${seed.generatedAt || "本地"} · 支持上传 / 在线编辑 Markdown`;
    renderNavigation();
    renderDocGrid();
    renderApiLists();
  }

  function initApiPanel() {
    els.apiUrlInput.value = apiConfig.url || "http://127.0.0.1:8787";
    setApiStatus(apiConfig.sessionToken ? "检查登录态..." : "需要登录", apiConfig.sessionToken ? "busy" : "warn");
    updateSessionInfo();
    if (apiConfig.sessionToken) restoreSession();
    renderApiLists();
  }

  function setApiStatus(message, state = "idle") {
    els.apiStatus.textContent = message;
    els.apiStatus.dataset.state = state;
  }

  function apiBaseUrl() {
    persistApiConfig();
    return apiConfig.url || "http://127.0.0.1:8787";
  }

  async function apiRequest(path, options = {}) {
    apiBaseUrl();
    const headers = new Headers(options.headers || {});
    const authToken = options.authToken === undefined ? apiConfig.sessionToken : options.authToken;
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(`${apiConfig.url}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `${response.status} ${response.statusText}`);
    }
    return data;
  }

  async function checkApiHealth() {
    try {
      setApiStatus("连接中...", "busy");
      const data = await apiRequest("/api/health", { authToken: "" });
      const label = data.users_configured ? "API 已连接，请登录" : "API 已连接，请先创建管理员";
      setApiStatus(data.ok ? label : "异常", data.ok ? "ok" : "error");
      if (apiConfig.sessionToken) await restoreSession();
    } catch (error) {
      setApiStatus(error.message || "连接失败", "error");
    }
  }

  async function restoreSession() {
    try {
      const data = await apiRequest("/api/auth/me");
      apiUser = data.user || null;
      setApiStatus(apiUser ? "已登录" : "需要登录", apiUser ? "ok" : "warn");
      updateSessionInfo();
      await Promise.all([loadProjects(), loadTasks()]);
    } catch (error) {
      apiUser = null;
      apiConfig.sessionToken = "";
      apiConfig.expiresAt = "";
      persistApiConfig();
      updateSessionInfo();
      setApiStatus(error.message || "登录已失效", "warn");
    }
  }

  async function setupAdminFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {
      username: String(data.username || ""),
      password: String(data.password || ""),
    };
    try {
      setApiStatus("创建管理员...", "busy");
      const result = await apiRequest("/api/auth/setup", {
        method: "POST",
        authToken: String(data.bootstrap_token || ""),
        body: JSON.stringify(payload),
      });
      applyLoginResult(result);
      form.reset();
      await Promise.all([loadProjects(), loadTasks()]);
    } catch (error) {
      setApiStatus(error.message || "管理员创建失败", "error");
    }
  }

  async function loginFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      setApiStatus("登录中...", "busy");
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        authToken: "",
        body: JSON.stringify(payload),
      });
      applyLoginResult(result);
      form.reset();
      await Promise.all([loadProjects(), loadTasks()]);
    } catch (error) {
      setApiStatus(error.message || "登录失败", "error");
    }
  }

  function loginWithGitHub() {
    try {
      persistApiConfig();
      const returnUrl = window.location.href.split("#")[0];
      const url = `${apiConfig.url}/api/auth/github/start?return_url=${encodeURIComponent(returnUrl)}`;
      const popup = window.open(url, "v2m-github-login", "width=520,height=720");
      if (!popup) setApiStatus("浏览器拦截了 GitHub 登录窗口", "error");
      else setApiStatus("等待 GitHub 授权...", "busy");
    } catch (error) {
      setApiStatus(error.message || "GitHub 登录失败", "error");
    }
  }

  function handleAuthMessage(event) {
    const expectedOrigin = (() => {
      try { return new URL(apiConfig.url).origin; }
      catch (_error) { return ""; }
    })();
    if (expectedOrigin && event.origin !== expectedOrigin) return;
    const data = event.data || {};
    if (data.type !== "v2m-github-login") return;
    applyLoginResult({
      user: data.user,
      session_token: data.sessionToken,
      expires_at: data.expiresAt,
    });
    Promise.all([loadProjects(), loadTasks()]).catch(() => {});
  }

  function consumeAuthHash() {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const sessionToken = params.get("v2m_session_token");
    if (!sessionToken) return;
    applyLoginResult({
      user: { username: params.get("v2m_username") || "GitHub", role: "admin" },
      session_token: sessionToken,
      expires_at: params.get("v2m_expires_at") || "",
    });
    history.replaceState(null, "", window.location.pathname + window.location.search);
    Promise.all([loadProjects(), loadTasks()]).catch(() => {});
  }

  async function logout() {
    try {
      if (apiConfig.sessionToken) {
        await apiRequest("/api/auth/logout", { method: "POST" });
      }
    } catch (_error) {
      // The local session is cleared even if the server is already gone.
    }
    apiUser = null;
    apiConfig.sessionToken = "";
    apiConfig.expiresAt = "";
    persistApiConfig();
    apiProjects = [];
    apiTasks = [];
    updateSessionInfo();
    renderApiLists();
    setApiStatus("已退出登录", "warn");
  }

  function applyLoginResult(result) {
    apiUser = result.user || null;
    apiConfig.sessionToken = result.session_token || "";
    apiConfig.expiresAt = result.expires_at || "";
    persistApiConfig();
    updateSessionInfo();
    setApiStatus(apiUser ? "已登录" : "登录成功", "ok");
  }

  function updateSessionInfo() {
    if (!apiUser) {
      els.sessionInfo.textContent = apiConfig.sessionToken ? "正在恢复登录态..." : "尚未登录。只有登录后才能访问 Mac 控制接口。";
      return;
    }
    const expiry = apiConfig.expiresAt ? ` · 有效期至 ${apiConfig.expiresAt}` : "";
    els.sessionInfo.textContent = `${apiUser.username || apiUser.id} · ${apiUser.role || "admin"}${expiry}`;
  }

  async function loadProjects() {
    try {
      const data = await apiRequest("/api/projects");
      apiProjects = Array.isArray(data.projects) ? data.projects : [];
      renderApiLists();
    } catch (error) {
      apiProjects = [];
      renderProjectList(error.message);
    }
  }

  async function loadTasks() {
    try {
      const data = await apiRequest("/api/codex-tasks");
      apiTasks = Array.isArray(data.tasks) ? data.tasks : [];
      renderApiLists();
    } catch (error) {
      apiTasks = [];
      renderTaskList(error.message);
    }
  }

  function renderApiLists() {
    renderProjectList();
    renderTaskList();
  }

  function renderProjectList(error = "") {
    if (error) {
      els.projectList.innerHTML = `<div class="mini-empty">项目读取失败：${escapeHtml(error)}</div>`;
      return;
    }
    if (!apiProjects.length) {
      els.projectList.innerHTML = `<div class="mini-empty">还没有项目记录。</div>`;
      return;
    }
    els.projectList.innerHTML = apiProjects.slice(0, 8).map((project) => `
      <div class="record-item">
        <strong>${escapeHtml(project.name || project.id || "Untitled")}</strong>
        <span>${escapeHtml(project.status || "active")} · ${escapeHtml(project.updated_at || "")}</span>
        ${project.summary ? `<p>${escapeHtml(project.summary)}</p>` : ""}
        ${project.repo ? `<code>${escapeHtml(project.repo)}</code>` : ""}
      </div>
    `).join("");
  }

  function renderTaskList(error = "") {
    if (error) {
      els.taskList.innerHTML = `<div class="mini-empty">任务读取失败：${escapeHtml(error)}</div>`;
      return;
    }
    if (!apiTasks.length) {
      els.taskList.innerHTML = `<div class="mini-empty">手机或远程页面发送的 Codex 任务会出现在这里。</div>`;
      return;
    }
    els.taskList.innerHTML = apiTasks.slice(0, 10).map((task) => `
      <div class="record-item task-record">
        <div class="record-row">
          <strong>${escapeHtml(task.project || "Video2Mesh")}</strong>
          <select data-task-status="${escapeHtml(task.id || "")}" aria-label="任务状态">
            ${["queued", "running", "done", "blocked"].map((status) => `<option value="${status}" ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
        <p>${escapeHtml(task.prompt || "")}</p>
        <span>${escapeHtml(task.created_at || "")}</span>
        ${task.result_summary ? `<p>${escapeHtml(task.result_summary)}</p>` : ""}
      </div>
    `).join("");
  }

  async function createProjectFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      setApiStatus("写入项目...", "busy");
      await apiRequest("/api/projects", { method: "POST", body: JSON.stringify(data) });
      form.reset();
      setApiStatus("项目已添加", "ok");
      await loadProjects();
    } catch (error) {
      setApiStatus(error.message || "项目写入失败", "error");
    }
  }

  async function createTaskFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      setApiStatus("任务入队...", "busy");
      await apiRequest("/api/codex-tasks", { method: "POST", body: JSON.stringify(data) });
      form.reset();
      form.elements.project.value = data.project || "Video2Mesh";
      setApiStatus("任务已加入队列", "ok");
      await loadTasks();
    } catch (error) {
      setApiStatus(error.message || "任务入队失败", "error");
    }
  }

  async function syncRemoteDocFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      setApiStatus("同步 Markdown...", "busy");
      const result = await apiRequest("/api/docs", { method: "POST", body: JSON.stringify(data) });
      setApiStatus(`已同步：${result.path || data.title}`, "ok");
      form.reset();
      form.elements.category.value = "Remote";
    } catch (error) {
      setApiStatus(error.message || "Markdown 同步失败", "error");
    }
  }

  function fillRemoteDocFromCurrent() {
    const doc = currentDoc();
    if (!doc) {
      setApiStatus("先打开一篇文章再同步", "warn");
      return;
    }
    els.remoteDocForm.elements.title.value = doc.title || "";
    els.remoteDocForm.elements.category.value = doc.category || "Remote";
    els.remoteDocForm.elements.markdown.value = doc.body || "";
    els.remoteDocForm.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function updateTaskStatus(event) {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.matches("[data-task-status]")) return;
    const id = select.dataset.taskStatus;
    if (!id) return;
    try {
      setApiStatus("更新任务状态...", "busy");
      await apiRequest(`/api/codex-tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: select.value }),
      });
      setApiStatus("任务状态已更新", "ok");
      await loadTasks();
    } catch (error) {
      setApiStatus(error.message || "任务更新失败", "error");
    }
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const imageUrls = new Map();
    files
      .filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name))
      .forEach((file) => {
        const url = URL.createObjectURL(file);
        imageUrls.set(file.name, url);
        if (file.webkitRelativePath) imageUrls.set(file.webkitRelativePath, url);
        imageUrls.set(`./${file.name}`, url);
        imageUrls.set(`assets/${file.name}`, url);
        imageUrls.set(`./assets/${file.name}`, url);
      });
    const loaded = [];
    for (const file of files.filter((item) => /\.(md|markdown)$/i.test(item.name) || item.type.includes("markdown") || item.type === "text/plain")) {
      const body = await file.text();
      const bodyWithAssets = rewriteUploadedImageLinks(body, imageUrls);
      const title = extractTitle(body, file.name.replace(/\.(md|markdown)$/i, ""));
      const id = uniqueId(slugify(file.name.replace(/\.(md|markdown)$/i, "")));
      const doc = {
        id,
        title,
        category: "Uploaded",
        summary: stripMarkdown(bodyWithAssets).slice(0, 220),
        source_path: file.name,
        source_kind: "uploaded",
        updated: new Date().toISOString().slice(0, 10),
        tags: ["Uploaded"],
        body: bodyWithAssets,
        headings: extractHeadings(bodyWithAssets),
        reading_minutes: Math.max(1, Math.round(stripMarkdown(bodyWithAssets).length / 650)),
      };
      uploadedDocs = [doc, ...uploadedDocs];
      loaded.push(doc);
    }
    els.uploadList.innerHTML = loaded.length
      ? loaded.map((doc) => `<a href="#/doc/${encodeURIComponent(doc.id)}">${escapeHtml(doc.title)}</a>`).join("")
      : `<span>没有选中 Markdown 文件。</span>`;
    if (!loaded.length) return;
    rebuildDocs();
    activeCategory = "Uploaded";
    renderAll();
    location.hash = `#/doc/${encodeURIComponent(loaded[0].id)}`;
  }

  function rewriteUploadedImageLinks(body, imageUrls) {
    const resolve = (raw) => {
      const clean = String(raw).split("#", 1)[0].split("?", 1)[0];
      return imageUrls.get(clean) || imageUrls.get(clean.replace(/^\.\//, "")) || imageUrls.get(clean.split("/").pop());
    };
    return String(body)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) => {
        const url = resolve(src.trim());
        return url ? `![${alt}](${url})` : m;
      })
      .replace(/!\[\[([^\]]+)\]\]/g, (m, src) => {
        const url = resolve(src.trim());
        return url ? `![${src}](${url})` : m;
      });
  }

  function extractTitle(body, fallback) {
    const match = String(body).match(/^#\s+(.+)$/m);
    return match ? stripMarkdown(match[1]) : fallback;
  }
  function extractHeadings(body) {
    return String(body).split("\n").map((line) => {
      const match = /^(#{2,4})\s+(.+)$/.exec(line);
      if (!match) return null;
      const text = stripMarkdown(match[2]);
      return { level: String(match[1].length), text, slug: slugify(text) };
    }).filter(Boolean).slice(0, 24);
  }
  function uniqueId(base) {
    let id = base || "uploaded";
    let index = 2;
    while (docs.some((doc) => doc.id === id)) id = `${base}-${index++}`;
    return id;
  }

  els.searchInput.addEventListener("input", renderDocGrid);
  els.clearSearch.addEventListener("click", () => { els.searchInput.value = ""; renderDocGrid(); });
  els.backHome.addEventListener("click", () => { location.hash = "#/"; });
  els.uploadInput.addEventListener("change", handleUpload);
  els.sortRecent.addEventListener("click", () => { sortMode = "recent"; renderDocGrid(); });
  els.sortTitle.addEventListener("click", () => { sortMode = "title"; renderDocGrid(); });
  els.newDraft.addEventListener("click", createNewDraft);
  els.apiUrlInput.addEventListener("change", persistApiConfig);
  els.apiHealthCheck.addEventListener("click", checkApiHealth);
  els.setupForm.addEventListener("submit", setupAdminFromForm);
  els.loginForm.addEventListener("submit", loginFromForm);
  els.githubLoginButton.addEventListener("click", loginWithGitHub);
  els.logoutButton.addEventListener("click", logout);
  els.refreshProjects.addEventListener("click", loadProjects);
  els.refreshTasks.addEventListener("click", loadTasks);
  els.projectForm.addEventListener("submit", createProjectFromForm);
  els.taskForm.addEventListener("submit", createTaskFromForm);
  els.remoteDocForm.addEventListener("submit", syncRemoteDocFromForm);
  els.syncCurrentDraft.addEventListener("click", fillRemoteDocFromCurrent);
  els.taskList.addEventListener("change", updateTaskStatus);
  els.editDoc.addEventListener("click", openEditor);
  els.closeEditor.addEventListener("click", closeEditor);
  els.saveDraft.addEventListener("click", saveDraftFromEditor);
  els.downloadDoc.addEventListener("click", downloadCurrentDoc);
  els.discardDraft.addEventListener("click", discardCurrentDraft);
  els.markdownEditor.addEventListener("input", () => {
    els.editorPreview.innerHTML = renderMarkdown(els.markdownEditor.value);
    setStatus("正在编辑，尚未保存。");
  });
  els.articleBody.addEventListener("change", handleRenderedTaskToggle);
  els.editorPreview.addEventListener("change", handleEditorPreviewTaskToggle);
  window.addEventListener("hashchange", route);
  window.addEventListener("message", handleAuthMessage);

  rebuildDocs();
  initApiPanel();
  consumeAuthHash();
  renderAll();
  route();
})();
