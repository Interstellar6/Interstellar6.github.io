(function () {
  const API_STORAGE_KEY = "v2m-blog-api-v1";
  const DEFAULT_API_URL = "https://api.relumeow.top";

  let apiConfig = loadApiConfig();
  let apiProjects = [];
  let apiTasks = [];
  let apiUser = null;

  const $ = (id) => document.getElementById(id);
  const els = {
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
  };

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  function loadApiConfig() {
    try {
      const raw = window.localStorage.getItem(API_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        url: normalizeApiUrl(parsed?.url),
        sessionToken: parsed?.sessionToken || parsed?.token || "",
        expiresAt: parsed?.expiresAt || "",
      };
    } catch (_error) {
      return { url: DEFAULT_API_URL, sessionToken: "", expiresAt: "" };
    }
  }

  function normalizeApiUrl(value) {
    const url = String(value || "").trim();
    if (!url) return DEFAULT_API_URL;
    const isLocalHttp = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(url);
    if (window.location.protocol === "https:" && isLocalHttp) return DEFAULT_API_URL;
    return url;
  }

  function persistApiConfig() {
    apiConfig = {
      url: String(els.apiUrlInput.value || DEFAULT_API_URL).replace(/\/+$/, ""),
      sessionToken: apiConfig.sessionToken || "",
      expiresAt: apiConfig.expiresAt || "",
    };
    try {
      window.localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiConfig));
    } catch (_error) {
      setApiStatus("浏览器阻止保存 API 设置", "error");
    }
  }

  function setApiStatus(message, state = "idle") {
    els.apiStatus.textContent = message;
    els.apiStatus.dataset.state = state;
  }

  function apiBaseUrl() {
    persistApiConfig();
    return apiConfig.url || DEFAULT_API_URL;
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
      renderApiLists();
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
    if (!sessionToken) return false;
    applyLoginResult({
      user: { username: params.get("v2m_username") || "GitHub", role: "admin" },
      session_token: sessionToken,
      expires_at: params.get("v2m_expires_at") || "",
    });
    history.replaceState(null, "", window.location.pathname + window.location.search);
    Promise.all([loadProjects(), loadTasks()]).catch(() => {});
    return true;
  }

  async function logout() {
    try {
      if (apiConfig.sessionToken) {
        await apiRequest("/api/auth/logout", { method: "POST" });
      }
    } catch (_error) {
      // Clear local state even if the API has already stopped.
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
    if (!apiUser) {
      els.projectList.innerHTML = `<div class="mini-empty">登录后显示项目记录。</div>`;
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
    if (!apiUser) {
      els.taskList.innerHTML = `<div class="mini-empty">登录后显示 Codex 任务队列。</div>`;
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
      form.elements.priority.value = data.priority || "normal";
      setApiStatus("任务已加入队列", "ok");
      await loadTasks();
    } catch (error) {
      setApiStatus(error.message || "任务入队失败", "error");
    }
  }

  async function syncRemoteDocFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form).entries());
    const data = {
      title: String(raw.title || ""),
      category: String(raw.category || "Remote"),
      summary: String(raw.summary || ""),
      tags: String(raw.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      markdown: String(raw.markdown || ""),
    };
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

  function init() {
    els.apiUrlInput.value = apiConfig.url || DEFAULT_API_URL;
    updateSessionInfo();
    renderApiLists();
    setApiStatus(apiConfig.sessionToken ? "检查登录态..." : "需要登录", apiConfig.sessionToken ? "busy" : "warn");
    const consumedHash = consumeAuthHash();
    if (apiConfig.sessionToken && !consumedHash) restoreSession();
  }

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
  els.taskList.addEventListener("change", updateTaskStatus);
  window.addEventListener("message", handleAuthMessage);

  init();
})();
