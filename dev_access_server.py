#!/usr/bin/env python3
from __future__ import annotations

import json
import hashlib
import mimetypes
import os
import secrets
import uuid
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
SITE = ROOT / "_site"
TOKENS: dict[str, dict[str, str]] = {}
DISCUSSIONS: dict[str, dict] = {}
OVERLAYS: dict[str, dict] = {}
UPLOADS: dict[str, tuple[bytes, str]] = {}
REALM_HASH_ENV = {
    "video2mesh": "RELUMEOW_ACCESS_VIDEO2MESH_HASH",
    "challengecup-agent-system": "RELUMEOW_ACCESS_CHALLENGECUP_AGENT_SYSTEM_HASH",
}


def load_env_file() -> None:
    for path in (ROOT / ".dev.vars", ROOT / ".env"):
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/access/login":
            body = self.read_json()
            realm = str(body.get("realm") or "")
            role = normalize_role(str(body.get("role") or "visitor"))
            passcode = str(body.get("password") or body.get("passcode") or "")
            username = str(body.get("username") or "")
            if role == "admin":
                ok = verify_admin(username, passcode)
                token_realm = "*"
            else:
                ok = verify_passcode(realm, passcode)
                token_realm = realm
            if not ok:
                self.reply({"ok": False, "error": "invalid passcode"}, HTTPStatus.UNAUTHORIZED)
                return
            token = secrets.token_urlsafe(32)
            TOKENS[token] = {"realm": token_realm, "role": role, "username": username if role == "admin" else ""}
            self.reply({"ok": True, "realm": token_realm, "role": role, "username": username if role == "admin" else "", "token": token, "expires_at": "dev"})
            return
        if parsed.path == "/api/access/verify":
            body = self.read_json()
            realm = str(body.get("realm") or "")
            token = str(body.get("token") or "")
            session = TOKENS.get(token)
            ok = bool(session and (session.get("realm") == realm or (session.get("role") == "admin" and session.get("realm") == "*")))
            self.reply({"ok": ok, "realm": realm, "role": session.get("role", "visitor") if session else "visitor"}, HTTPStatus.OK if ok else HTTPStatus.UNAUTHORIZED)
            return
        if parsed.path.startswith("/api/discussions/"):
            parts = parsed.path.split("/")
            realm, doc_id = parts[3], unquote(parts[4])
            if not self.check_token(realm):
                return
            session = self.session_for(realm) or {}
            current = DISCUSSIONS.setdefault(f"{realm}:{doc_id}", {"comments": [], "annotations": []})
            body = self.read_json()
            kind = str(body.get("kind") or "")
            item = {
                "id": str(body.get("id") or uuid.uuid4()),
                "author": "管理员" if session.get("role") == "admin" else "访客",
                "text": str(body.get("text") or "")[:1200],
                "createdAt": str(body.get("createdAt") or "dev"),
            }
            if kind == "annotation":
                item["quote"] = str(body.get("quote") or "")[:320]
                current["annotations"].insert(0, item)
            elif kind == "reply":
                item["parentId"] = str(body.get("parentId") or "")
                for comment in current["comments"]:
                    if comment.get("id") == item["parentId"]:
                        comment.setdefault("replies", []).append(item)
                        break
            else:
                current["comments"].insert(0, item)
            self.reply({"ok": True, "persisted": True, **current})
            return
        if parsed.path.startswith("/api/uploads/"):
            parts = parsed.path.split("/")
            realm, doc_id = parts[3], unquote(parts[4])
            if not self.check_token(realm, require_admin=True):
                return
            raw = self.rfile.read(int(self.headers.get("Content-Length") or "0"))
            marker = b"\r\n\r\n"
            start = raw.find(marker)
            end = raw.rfind(b"\r\n--")
            data = raw[start + len(marker):end] if start != -1 and end != -1 else raw
            ctype = "image/png"
            name = f"{uuid.uuid4()}.png"
            UPLOADS[f"{realm}:{doc_id}:{name}"] = (data, ctype)
            self.reply({"ok": True, "persisted": True, "name": name, "url": f"/api/content-assets/{realm}/{doc_id}/{name}"})
            return
        self.reply({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/overlays/"):
            parts = parsed.path.split("/")
            realm, doc_id = parts[3], unquote(parts[4])
            if not self.check_token(realm, require_admin=True):
                return
            body = self.read_json()
            overlay = {"body": str(body.get("body") or ""), "updatedAt": "dev", "updatedBy": "admin"}
            OVERLAYS.setdefault(realm, {})[doc_id] = overlay
            self.reply({"ok": True, "persisted": True, **overlay})
            return
        self.reply({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.reply({"ok": True, "service": "relumeow-dev-access"})
            return
        if parsed.path.startswith("/api/projects/") and parsed.path.endswith("/data"):
            realm = parsed.path.split("/")[3]
            if not self.check_token(realm):
                return
            target = SITE / "_protected" / realm / "site-data.json"
            if not target.exists():
                self.reply({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)
                return
            payload = json.loads(target.read_text(encoding="utf-8"))
            self.reply({"ok": True, **payload})
            return
        if parsed.path.startswith("/api/projects/") and "/assets/" in parsed.path:
            parts = parsed.path.split("/")
            realm = parts[3]
            if not self.check_token(realm):
                return
            asset_rel = "/".join(parts[5:])
            target = (SITE / "_protected" / realm / "assets" / unquote(asset_rel)).resolve()
            root = (SITE / "_protected" / realm / "assets").resolve()
            if not str(target).startswith(str(root)) or not target.is_file():
                self.reply({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)
                return
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mimetypes.guess_type(str(target))[0] or "application/octet-stream")
            self.end_headers()
            self.wfile.write(target.read_bytes())
            return
        if parsed.path.startswith("/api/discussions/"):
            parts = parsed.path.split("/")
            realm, doc_id = parts[3], unquote(parts[4])
            if not self.check_token(realm):
                return
            current = DISCUSSIONS.setdefault(f"{realm}:{doc_id}", {"comments": [], "annotations": []})
            self.reply({"ok": True, "persisted": True, **current})
            return
        if parsed.path.startswith("/api/overlays/"):
            realm = parsed.path.split("/")[3]
            if not self.check_token(realm):
                return
            self.reply({"ok": True, "persisted": True, "docs": OVERLAYS.get(realm, {})})
            return
        if parsed.path.startswith("/api/content-assets/"):
            parts = parsed.path.split("/")
            realm, doc_id, name = parts[3], unquote(parts[4]), unquote(parts[5])
            if not self.check_token(realm):
                return
            data, ctype = UPLOADS.get(f"{realm}:{doc_id}:{name}", (b"", "application/octet-stream"))
            if not data:
                self.reply({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)
                return
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", ctype)
            self.end_headers()
            self.wfile.write(data)
            return
        if parsed.path.startswith("/_protected/"):
            self.reply({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def session_for(self, realm: str) -> dict[str, str] | None:
        header = self.headers.get("Authorization", "")
        token = header[7:].strip() if header.lower().startswith("bearer ") else ""
        session = TOKENS.get(token)
        if session and (session.get("realm") == realm or (session.get("role") == "admin" and session.get("realm") == "*")):
            return session
        return None

    def check_token(self, realm: str, require_admin: bool = False) -> bool:
        session = self.session_for(realm)
        if session and (not require_admin or session.get("role") == "admin"):
            return True
        self.reply({"ok": False, "error": "admin token required" if session else "invalid token"}, HTTPStatus.FORBIDDEN if session else HTTPStatus.UNAUTHORIZED)
        return False

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def reply(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def normalize_role(role: str) -> str:
    return "admin" if role == "admin" else "visitor"


def verify_admin(username: str, password: str) -> bool:
    expected_user = os.environ.get("RELUMEOW_ADMIN_USERNAME", "")
    salt = os.environ.get("RELUMEOW_ACCESS_SALT", "")
    expected = os.environ.get("RELUMEOW_ADMIN_PASSWORD_HASH", "")
    if not expected_user or username != expected_user or not salt or not expected or not password:
        return False
    actual = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return secrets.compare_digest(actual, expected)


def verify_passcode(realm: str, passcode: str) -> bool:
    salt = os.environ.get("RELUMEOW_ACCESS_SALT", "")
    env_name = REALM_HASH_ENV.get(realm, "")
    expected = os.environ.get(env_name, "")
    if not salt or not expected or not passcode:
        return False
    actual = hashlib.sha256(f"{salt}:{passcode}".encode("utf-8")).hexdigest()
    return secrets.compare_digest(actual, expected)


def main() -> int:
    load_env_file()
    server = ThreadingHTTPServer(("127.0.0.1", 4173), Handler)
    print("relumeow dev server: http://127.0.0.1:4173/")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
