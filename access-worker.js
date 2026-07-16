const REALMS = {
  "video2mesh": {
    title: "Video2Mesh",
    visitorHashEnv: "RELUMEOW_ACCESS_VIDEO2MESH_HASH",
  },
  "video2world": {
    title: "Video2World",
    visitorHashEnv: "RELUMEOW_ACCESS_VIDEO2WORLD_HASH",
  },
  "challengecup-agent-system": {
    title: "ChallengeCup Agent System",
    visitorHashEnv: "RELUMEOW_ACCESS_CHALLENGECUP_AGENT_SYSTEM_HASH",
  },
};

const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const MAX_JSON_BYTES = 256 * 1024;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, service: "relumeow-access", realms: Object.keys(REALMS) }, cors);
      }

      if (url.pathname === "/api/access/login" && request.method === "POST") {
        return await handleLogin(request, env, cors);
      }

      if (url.pathname === "/api/access/verify" && request.method === "POST") {
        return await handleVerify(request, env, cors);
      }

      const projectDataMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/data$/);
      if (projectDataMatch && request.method === "GET") {
        return await handleProjectData(projectDataMatch[1], request, env, cors);
      }

      const assetMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/assets\/(.+)$/);
      if (assetMatch && request.method === "GET") {
        return await handleProjectAsset(assetMatch[1], assetMatch[2], request, env, cors);
      }

      const discussionMatch = url.pathname.match(/^\/api\/discussions\/([^/]+)\/([^/]+)$/);
      if (discussionMatch && (request.method === "GET" || request.method === "POST")) {
        return await handleDiscussion(discussionMatch[1], discussionMatch[2], request, env, cors);
      }

      const overlaysMatch = url.pathname.match(/^\/api\/overlays\/([^/]+)$/);
      if (overlaysMatch && request.method === "GET") {
        return await handleProjectOverlays(overlaysMatch[1], request, env, cors);
      }

      const overlayDocMatch = url.pathname.match(/^\/api\/overlays\/([^/]+)\/([^/]+)$/);
      if (overlayDocMatch && request.method === "PUT") {
        return await handleDocOverlay(overlayDocMatch[1], overlayDocMatch[2], request, env, cors);
      }

      const uploadMatch = url.pathname.match(/^\/api\/uploads\/([^/]+)\/([^/]+)$/);
      if (uploadMatch && request.method === "POST") {
        return await handleUpload(uploadMatch[1], uploadMatch[2], request, env, cors);
      }

      const contentAssetMatch = url.pathname.match(/^\/api\/content-assets\/([^/]+)\/(.+)$/);
      if (contentAssetMatch && request.method === "GET") {
        return await handleContentAsset(contentAssetMatch[1], contentAssetMatch[2], request, env, cors);
      }

      if (url.pathname.startsWith("/api/")) {
        return json({ ok: false, error: "not found" }, cors, 404);
      }

      if (url.pathname.startsWith("/_protected/")) {
        return json({ ok: false, error: "not found" }, cors, 404);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({
        event: "relumeow_access_error",
        message: error?.message || String(error),
        path: url.pathname,
      }));
      return json({ ok: false, error: "server error" }, cors, 500);
    }
  },
};

async function handleLogin(request, env, cors) {
  const body = await readJson(request);
  const realm = normalizeRealm(body.realm);
  const role = normalizeRole(body.role);
  if (role === "admin") {
    return await handleAdminLogin(body, env, cors);
  }
  const passcode = String(body.passcode || "");
  if (!REALMS[realm] || !passcode) {
    return json({ ok: false, error: "invalid realm or passcode" }, cors, 400);
  }

  const expectedHash = expectedVisitorPasscodeHash(realm, env);
  if (!expectedHash) {
    return json({ ok: false, error: "access login is not configured" }, cors, 403);
  }
  const allowed = await verifyPasscodeHash(passcode, expectedHash, env);
  if (!allowed) {
    return json({ ok: false, error: "invalid passcode" }, cors, 401);
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await signToken({ realm, role, exp, nonce: crypto.randomUUID() }, env);
  return json({ ok: true, realm, role, token, expires_at: new Date(exp * 1000).toISOString() }, cors);
}

async function handleAdminLogin(body, env, cors) {
  const username = String(body.username || "").trim();
  const password = String(body.password || body.passcode || "");
  const expectedUser = String(env.RELUMEOW_ADMIN_USERNAME || "").trim();
  const expectedHash = String(env.RELUMEOW_ADMIN_PASSWORD_HASH || "").trim();
  if (!expectedUser || !expectedHash) {
    return json({ ok: false, error: "admin login is not configured" }, cors, 403);
  }
  if (!username || !password || username !== expectedUser) {
    return json({ ok: false, error: "invalid admin credentials" }, cors, 401);
  }
  const allowed = await verifyPasscodeHash(password, expectedHash, env);
  if (!allowed) {
    return json({ ok: false, error: "invalid admin credentials" }, cors, 401);
  }
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await signToken({ realm: "*", role: "admin", username, exp, nonce: crypto.randomUUID() }, env);
  return json({ ok: true, realm: "*", role: "admin", username, token, expires_at: new Date(exp * 1000).toISOString() }, cors);
}

async function handleVerify(request, env, cors) {
  const body = await readJson(request);
  const realm = normalizeRealm(body.realm);
  const token = String(body.token || bearerToken(request) || "");
  const result = await verifyTokenForRealm(token, realm, env);
  return json(result.ok ? { ok: true, realm, role: result.payload.role } : { ok: false, error: result.error }, cors, result.ok ? 200 : 401);
}

async function handleProjectData(rawRealm, request, env, cors) {
  const realm = normalizeRealm(rawRealm);
  const result = await verifyTokenForRealm(bearerToken(request), realm, env);
  if (!result.ok) return json({ ok: false, error: result.error }, cors, 401);

  const response = await env.ASSETS.fetch(new Request(new URL(`/_protected/${realm}/site-data.json`, request.url).toString()));
  if (!response.ok) return json({ ok: false, error: "project data not found" }, cors, 404);
  const payload = await response.json();
  return json({ ok: true, ...payload }, cors);
}

async function handleProjectAsset(rawRealm, rawPath, request, env, cors) {
  const realm = normalizeRealm(rawRealm);
  const result = await verifyTokenForRealm(bearerToken(request), realm, env);
  if (!result.ok) return json({ ok: false, error: result.error }, cors, 401);

  const cleanPath = sanitizeAssetPath(rawPath);
  if (!cleanPath) return json({ ok: false, error: "invalid asset path" }, cors, 400);
  const target = new URL(`/_protected/${realm}/assets/${cleanPath}`, request.url);
  const response = await env.ASSETS.fetch(new Request(target.toString()));
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  headers.set("Cache-Control", "private, max-age=300");
  return new Response(response.body, { status: response.status, headers });
}

async function handleDiscussion(rawRealm, rawDocId, request, env, cors) {
  const realm = normalizeRealm(rawRealm);
  const gate = await requireRealmAccess(realm, request, env);
  if (!gate.ok) return json({ ok: false, error: gate.error }, cors, gate.status);

  const docId = sanitizeDocId(rawDocId);
  if (!docId) return json({ ok: false, error: "invalid doc id" }, cors, 400);

  const persisted = Boolean(contentStore(env));
  const current = await readDiscussion(env, realm, docId);
  if (request.method === "GET") return json({ ok: true, persisted, ...current }, cors);

  const body = await readJson(request);
  const kind = String(body.kind || "").trim();
  const item = sanitizeDiscussionItem(kind, body, gate.role);
  if (!item) return json({ ok: false, error: "invalid discussion item" }, cors, 400);

  if (kind === "annotation") {
    current.annotations.unshift(item);
  } else if (kind === "reply") {
    const target = current.comments.find((comment) => comment.id === item.parentId);
    if (!target) return json({ ok: false, error: "parent comment not found" }, cors, 404);
    target.replies = Array.isArray(target.replies) ? target.replies : [];
    target.replies.push(item);
  } else {
    current.comments.unshift(item);
  }
  current.comments = current.comments.slice(0, 200);
  current.annotations = current.annotations.slice(0, 200);
  await writeDiscussion(env, realm, docId, current);
  return json({ ok: true, persisted, ...current }, cors);
}

async function handleProjectOverlays(rawRealm, request, env, cors) {
  const realm = normalizeRealm(rawRealm);
  const gate = await requireRealmAccess(realm, request, env);
  if (!gate.ok) return json({ ok: false, error: gate.error }, cors, gate.status);
  const docs = await readProjectOverlays(env, realm);
  return json({ ok: true, persisted: Boolean(contentStore(env)), docs }, cors);
}

async function handleDocOverlay(rawRealm, rawDocId, request, env, cors) {
  const realm = normalizeRealm(rawRealm);
  const gate = await requireAdminAccess(realm, request, env);
  if (!gate.ok) return json({ ok: false, error: gate.error }, cors, gate.status);
  const docId = sanitizeDocId(rawDocId);
  if (!docId) return json({ ok: false, error: "invalid doc id" }, cors, 400);
  if (!contentStore(env)) return json({ ok: false, error: "content storage not configured" }, cors, 503);
  const body = await readJson(request, MAX_JSON_BYTES);
  const text = String(body.body || "").replace(/\r\n/g, "\n");
  if (!text.trim() || text.length > MAX_JSON_BYTES) {
    return json({ ok: false, error: "invalid body" }, cors, 400);
  }
  const overlay = {
    body: text,
    updatedAt: new Date().toISOString(),
    updatedBy: "admin",
  };
  await contentStore(env).put(overlayKey(realm, docId), JSON.stringify(overlay));
  const projectDocs = await readProjectOverlays(env, realm);
  projectDocs[docId] = overlay;
  await contentStore(env).put(projectOverlayIndexKey(realm), JSON.stringify(projectDocs));
  return json({ ok: true, persisted: true, ...overlay }, cors);
}

async function handleUpload(rawRealm, rawDocId, request, env, cors) {
  const realm = normalizeRealm(rawRealm);
  const gate = await requireAdminAccess(realm, request, env);
  if (!gate.ok) return json({ ok: false, error: gate.error }, cors, gate.status);
  const docId = sanitizeDocId(rawDocId);
  if (!docId) return json({ ok: false, error: "invalid doc id" }, cors, 400);
  if (!contentStore(env)) return json({ ok: false, error: "content storage not configured" }, cors, 503);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "missing file" }, cors, 400);
  if (!file.type.startsWith("image/") || file.size > MAX_UPLOAD_BYTES) {
    return json({ ok: false, error: "invalid image" }, cors, 400);
  }
  const ext = safeImageExtension(file.name, file.type);
  const id = crypto.randomUUID();
  const key = uploadKey(realm, docId, `${id}.${ext}`);
  await contentStore(env).put(key, await file.arrayBuffer(), {
    metadata: {
      contentType: file.type,
      name: clampText(file.name, 160),
      uploadedAt: new Date().toISOString(),
    },
  });
  return json({
    ok: true,
    persisted: true,
    name: clampText(file.name, 160),
    url: `/api/content-assets/${encodeURIComponent(realm)}/${encodeURIComponent(docId)}/${encodeURIComponent(`${id}.${ext}`)}`,
  }, cors);
}

async function handleContentAsset(rawRealm, rawPath, request, env, cors) {
  const realm = normalizeRealm(rawRealm);
  const gate = await requireRealmAccess(realm, request, env);
  if (!gate.ok) return json({ ok: false, error: gate.error }, cors, gate.status);
  if (!contentStore(env)) return json({ ok: false, error: "not found" }, cors, 404);
  const parts = sanitizeUploadPath(rawPath);
  if (!parts) return json({ ok: false, error: "invalid asset path" }, cors, 400);
  const key = uploadKey(realm, parts.docId, parts.fileName);
  const value = await contentStore(env).getWithMetadata(key, "arrayBuffer");
  if (!value?.value) return json({ ok: false, error: "not found" }, cors, 404);
  const headers = new Headers(cors);
  headers.set("Content-Type", value.metadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "private, max-age=300");
  return new Response(value.value, { headers });
}

async function readJson(request, maxBytes = 4096) {
  const len = Number(request.headers.get("content-length") || "0");
  if (len > maxBytes) throw new Error("request too large");
  return request.json().catch(() => ({}));
}

function normalizeRealm(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase() === "admin" ? "admin" : "visitor";
}

function expectedVisitorPasscodeHash(realm, env) {
  const config = REALMS[realm];
  if (!config) return "";
  return String(env[config.visitorHashEnv] || "");
}

function sanitizeAssetPath(rawPath) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(rawPath || ""));
  } catch (_error) {
    return "";
  }
  const parts = decoded.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === ".." || part.includes("\\"))) return "";
  return parts.map(encodeURIComponent).join("/");
}

function sanitizeDocId(rawDocId) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(rawDocId || ""));
  } catch (_error) {
    return "";
  }
  return /^[\w\u4e00-\u9fff.-]{1,160}$/.test(decoded) ? decoded : "";
}

function sanitizeDiscussionItem(kind, body, role = "visitor") {
  if (kind !== "comment" && kind !== "annotation" && kind !== "reply") return null;
  const text = clampText(body.text, 1200);
  if (!text) return null;
  const item = {
    id: clampText(body.id, 80) || crypto.randomUUID(),
    author: role === "admin" ? "管理员" : "访客",
    text,
    createdAt: clampText(body.createdAt, 40) || new Date().toISOString(),
  };
  if (kind === "annotation") {
    const quote = clampText(body.quote, 320);
    if (!quote) return null;
    item.quote = quote;
  }
  if (kind === "reply") {
    const parentId = clampText(body.parentId, 80);
    if (!parentId) return null;
    item.parentId = parentId;
  }
  return item;
}

function clampText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function readDiscussion(env, realm, docId) {
  const empty = { comments: [], annotations: [] };
  const store = contentStore(env);
  if (!store) return empty;
  const value = await store.get(discussionKey(realm, docId), "json");
  if (!value || typeof value !== "object") return empty;
  return {
    comments: Array.isArray(value.comments) ? value.comments : [],
    annotations: Array.isArray(value.annotations) ? value.annotations : [],
  };
}

async function writeDiscussion(env, realm, docId, value) {
  const store = contentStore(env);
  if (!store) return;
  await store.put(discussionKey(realm, docId), JSON.stringify(value));
}

function discussionKey(realm, docId) {
  return `discussion:${realm}:${docId}`;
}

async function readProjectOverlays(env, realm) {
  const store = contentStore(env);
  if (!store) return {};
  const value = await store.get(projectOverlayIndexKey(realm), "json");
  return value && typeof value === "object" ? value : {};
}

function projectOverlayIndexKey(realm) {
  return `doc-overlays:${realm}`;
}

function overlayKey(realm, docId) {
  return `doc-overlay:${realm}:${docId}`;
}

function uploadKey(realm, docId, fileName) {
  return `upload:${realm}:${docId}:${fileName}`;
}

function contentStore(env) {
  return env.RELUMEOW_CONTENT || env.RELUMEOW_DISCUSSIONS || null;
}

async function requireRealmAccess(realm, request, env) {
  if (!REALMS[realm]) return { ok: false, error: "invalid realm", status: 400 };
  const result = await verifyTokenForRealm(bearerToken(request), realm, env);
  if (!result.ok) return { ok: false, error: result.error, status: 401 };
  return { ok: true, role: result.payload.role, payload: result.payload };
}

async function requireAdminAccess(realm, request, env) {
  const gate = await requireRealmAccess(realm, request, env);
  if (!gate.ok) return gate;
  if (gate.role !== "admin") return { ok: false, error: "admin token required", status: 403 };
  return gate;
}

function safeImageExtension(name, type) {
  const ext = String(name || "").split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/gif") return "gif";
  if (type === "image/webp") return "webp";
  if (type === "image/svg+xml") return "svg";
  return "bin";
}

function sanitizeUploadPath(rawPath) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(rawPath || ""));
  } catch (_error) {
    return null;
  }
  const parts = decoded.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const docId = sanitizeDocId(parts[0]);
  const fileName = parts[1];
  if (!docId || !/^[\w.-]{1,220}$/.test(fileName)) return null;
  return { docId, fileName };
}

async function verifyPasscodeHash(passcode, expectedHash, env) {
  if (!expectedHash || !env.RELUMEOW_ACCESS_SALT) return false;
  const actual = await sha256Hex(`${env.RELUMEOW_ACCESS_SALT}:${passcode}`);
  return timingSafeEqualHex(actual, String(expectedHash));
}

async function signToken(payload, env) {
  const body = b64UrlEncode(JSON.stringify(payload));
  const signature = await hmacHex(body, signingKey(env));
  return `${body}.${signature}`;
}

async function verifyTokenForRealm(token, realm, env) {
  if (!REALMS[realm]) return { ok: false, error: "invalid realm" };
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return { ok: false, error: "missing token" };
  const expected = await hmacHex(body, signingKey(env));
  if (!timingSafeEqualHex(signature, expected)) return { ok: false, error: "invalid token" };

  let payload = {};
  try {
    payload = JSON.parse(b64UrlDecode(body));
  } catch (_error) {
    return { ok: false, error: "invalid token" };
  }
  payload.role = normalizeRole(payload.role);
  if (payload.role === "admin" && payload.realm === "*") {
    if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) return { ok: false, error: "token expired" };
    return { ok: true, payload };
  }
  if (payload.realm !== realm) return { ok: false, error: "wrong realm" };
  if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) return { ok: false, error: "token expired" };
  return { ok: true, payload };
}

function signingKey(env) {
  return env.RELUMEOW_ACCESS_TOKEN_SECRET || env.RELUMEOW_ACCESS_SALT || "";
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

async function hmacHex(value, secret) {
  if (!secret) throw new Error("missing token secret");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(new Uint8Array(signature));
}

function timingSafeEqualHex(left, right) {
  const a = fromHex(String(left || ""));
  const b = fromHex(String(right || ""));
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    diff |= (a[i % a.length] || 0) ^ (b[i % b.length] || 0);
  }
  return diff === 0;
}

function toHex(bytes) {
  return Array.from(bytes, (item) => item.toString(16).padStart(2, "0")).join("");
}

function fromHex(value) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) bytes[i / 2] = Number.parseInt(value.slice(i, i + 2), 16);
  return bytes;
}

function b64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function bearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.RELUMEOW_ALLOWED_ORIGINS || "https://relumeow.top,http://127.0.0.1:4173,http://localhost:4173")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "https://relumeow.top";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(payload, cors, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
