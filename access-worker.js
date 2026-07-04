const REALMS = {
  "video2mesh": {
    title: "Video2Mesh",
    hashEnv: "RELUMEOW_ACCESS_VIDEO2MESH_HASH",
  },
  "challengecup-agent-system": {
    title: "ChallengeCup Agent System",
    hashEnv: "RELUMEOW_ACCESS_CHALLENGECUP_AGENT_SYSTEM_HASH",
  },
};

const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const MAX_JSON_BYTES = 4096;

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
  const passcode = String(body.passcode || "");
  if (!REALMS[realm] || !passcode) {
    return json({ ok: false, error: "invalid realm or passcode" }, cors, 400);
  }

  const expectedHash = env[REALMS[realm].hashEnv];
  const allowed = await verifyPasscodeHash(passcode, expectedHash, env);
  if (!allowed) {
    return json({ ok: false, error: "invalid passcode" }, cors, 401);
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await signToken({ realm, exp, nonce: crypto.randomUUID() }, env);
  return json({ ok: true, realm, token, expires_at: new Date(exp * 1000).toISOString() }, cors);
}

async function handleVerify(request, env, cors) {
  const body = await readJson(request);
  const realm = normalizeRealm(body.realm);
  const token = String(body.token || bearerToken(request) || "");
  const result = await verifyTokenForRealm(token, realm, env);
  return json(result.ok ? { ok: true, realm } : { ok: false, error: result.error }, cors, result.ok ? 200 : 401);
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

async function readJson(request) {
  const len = Number(request.headers.get("content-length") || "0");
  if (len > MAX_JSON_BYTES) throw new Error("request too large");
  return request.json().catch(() => ({}));
}

function normalizeRealm(value) {
  return String(value || "").trim().toLowerCase();
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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
