#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parent
PROJECTS_FILE = ROOT / "projects.yaml"
BUILD_DIR = ROOT / "_site"
ASSETS_DIR = ROOT / "assets"
PROTECTED_DIR = BUILD_DIR / "_protected"
ASSET_VERSION = datetime.now().strftime("%Y%m%d%H%M%S")


@dataclass
class Doc:
    id: str
    title: str
    category: str
    doc_type: str
    visibility: str
    summary: str
    source_path: str
    project_path: str
    directory: str
    is_overview: bool
    updated: str
    tags: list[str]
    body: str
    headings: list[dict[str, str]]
    reading_minutes: int


def slugify(value: str, fallback: str = "doc") -> str:
    text = value.strip().lower()
    text = re.sub(r"[\s_/\\]+", "-", text)
    text = re.sub(r"[^a-z0-9\u4e00-\u9fff.-]+", "", text)
    text = text.strip(".-")
    return text or fallback


def split_front_matter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    data = yaml.safe_load(text[4:end]) or {}
    return (data if isinstance(data, dict) else {}), text[end + 5 :]


def strip_markdown(value: str) -> str:
    value = re.sub(r"```[\s\S]*?```", " ", value)
    value = re.sub(r"`([^`]+)`", r"\1", value)
    value = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"[*_#>|-]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def extract_title(body: str, fallback: str) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", body, re.MULTILINE)
    return strip_markdown(match.group(1)).strip() if match else fallback


def extract_headings(body: str) -> list[dict[str, str]]:
    headings: list[dict[str, str]] = []
    for line in body.splitlines():
        match = re.match(r"^(#{2,4})\s+(.+?)\s*$", line)
        if not match:
            continue
        text = strip_markdown(match.group(2)).strip()
        headings.append({"level": str(len(match.group(1))), "text": text, "slug": slugify(text)})
    return headings[:32]


def extract_summary(body: str, meta: dict[str, Any]) -> str:
    if meta.get("summary"):
        return str(meta["summary"]).strip()
    lines = []
    in_code = False
    for raw in body.splitlines():
        line = raw.strip()
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code or not line or line.startswith("#") or line.startswith("|") or line.startswith("!"):
            continue
        clean = strip_markdown(line)
        if clean:
            lines.append(clean)
        if len(" ".join(lines)) > 150:
            break
    summary = " ".join(lines).strip()
    return summary[:220] + ("..." if len(summary) > 220 else "")


def normalize_tags(meta: dict[str, Any], category: str) -> list[str]:
    tags: list[str] = []
    raw = meta.get("tags")
    if isinstance(raw, list):
        tags.extend(str(item) for item in raw)
    elif isinstance(raw, str):
        tags.extend(part.strip() for part in raw.split(","))
    tags.append(category)
    unique: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        clean = str(tag).strip()
        key = clean.lower()
        if clean and key not in seen:
            unique.append(clean)
            seen.add(key)
    return unique[:8]


def normalize_visibility(meta: dict[str, Any], relative: str) -> str:
    raw = str(meta.get("visibility") or "").strip().lower()
    if raw in {"public", "private"}:
        return raw
    if "/legacy/" in f"/{relative}":
        return "private"
    return "public"


def is_protected(project: dict[str, Any]) -> bool:
    return project.get("access", {}).get("mode") == "passcode"


def access_realm(project: dict[str, Any]) -> str:
    return str(project.get("access", {}).get("realm") or project["slug"])


def public_project(project: dict[str, Any]) -> dict[str, Any]:
    public = dict(project)
    public.pop("source", None)
    return public


def shell_project(project: dict[str, Any]) -> dict[str, Any]:
    return {
        "slug": project["slug"],
        "route": project["route"],
        "title": project["title"],
        "brand": project.get("brand", project["title"]),
        "mark": project.get("mark", project.get("brand", project["title"])[:3]),
        "subtitle": project.get("subtitle", ""),
        "description": project.get("description", ""),
        "access": project.get("access", {}),
        "doc_count": project.get("doc_count", 0),
        "updated": project.get("updated", ""),
        "overview_id": project.get("overview_id", ""),
    }


def should_collect(relative: Path, overview_name: str) -> bool:
    name = relative.name
    if name == "README.md":
        sibling = relative.with_name(overview_name)
        return not sibling.exists()
    return True


def copy_local_assets(
    project: dict[str, Any],
    doc_abs: Path,
    doc_id: str,
    body: str,
    target_assets: Path,
    asset_url_prefix: str,
) -> str:
    def split_target(raw_url: str) -> tuple[str, str]:
        match = re.match(r'^(\S+)(\s+"[^"]*")\s*$', raw_url.strip())
        if match:
            return match.group(1), match.group(2)
        return raw_url.strip(), ""

    def copy_one(raw_url: str) -> str | None:
        url, _title = split_target(raw_url)
        if re.match(r"^(https?:|data:|#)", url):
            return None
        url_path = url.split("#", 1)[0].split("?", 1)[0]
        src = (doc_abs.parent / url_path).resolve()
        if not src.exists() or not src.is_file():
            return None
        dst_dir = target_assets / "uploaded" / f"{project['slug']}-{doc_id}"
        dst_dir.mkdir(parents=True, exist_ok=True)
        dst = dst_dir / src.name
        if src.resolve() != dst.resolve():
            shutil.copy2(src, dst)
        return f"{asset_url_prefix.rstrip('/')}/uploaded/{project['slug']}-{doc_id}/{src.name}"

    def replace(match: re.Match[str]) -> str:
        alt, raw_url = match.group(1), match.group(2).strip()
        _url, title = split_target(raw_url)
        copied = copy_one(raw_url)
        return f"![{alt}]({copied}{title})" if copied else match.group(0)

    def replace_obsidian(match: re.Match[str]) -> str:
        raw = match.group(1).strip()
        if not re.search(r"\.(png|jpe?g|gif|webp|svg)$", raw, re.IGNORECASE):
            return match.group(0)
        copied = copy_one(raw)
        return f"![{Path(raw).stem}]({copied})" if copied else match.group(0)

    body = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", replace, body)
    return re.sub(r"!\[\[([^\]]+)\]\]", replace_obsidian, body)


def load_doc(
    project: dict[str, Any],
    path: Path,
    docs_root: Path,
    used_ids: set[str],
    route_dir: Path,
    protected_asset_prefix: str,
) -> Doc:
    raw = path.read_text(encoding="utf-8")
    meta, body = split_front_matter(raw)
    relative = path.relative_to(docs_root)
    project_path = str(relative).replace("\\", "/")
    overview_name = project.get("navigation", {}).get("directory_overview", "overview.md")
    is_overview = relative.name == overview_name
    fallback = "Overview" if is_overview else relative.stem.replace("-", " ").replace("_", " ")
    title = str(meta.get("title") or extract_title(body, fallback)).strip()
    doc_id = slugify(str(meta.get("id") or f"{project['slug']}-{project_path.removesuffix('.md')}"), "doc")
    base_id = doc_id
    index = 2
    while doc_id in used_ids:
        doc_id = f"{base_id}-{index}"
        index += 1
    used_ids.add(doc_id)
    category = str(meta.get("category") or ("总目录" if project_path == overview_name else "项目文档")).strip()
    doc_type = str(meta.get("doc_type") or ("overview" if is_overview else "doc")).strip()
    visibility = normalize_visibility(meta, project_path)
    if visibility == "public":
        if is_protected(project):
            realm = access_realm(project)
            body = copy_local_assets(
                project,
                path,
                doc_id,
                body,
                PROTECTED_DIR / realm / "assets",
                protected_asset_prefix,
            )
        else:
            body = copy_local_assets(project, path, doc_id, body, route_dir / "assets", "assets")
    words = re.findall(r"[\w\u4e00-\u9fff]+", strip_markdown(body))
    directory = "" if relative.parent == Path(".") else str(relative.parent).replace("\\", "/")
    return Doc(
        id=doc_id,
        title=title,
        category=category,
        doc_type=doc_type,
        visibility=visibility,
        summary=extract_summary(body, meta),
        source_path=f"{project['source']['docs_root'].rstrip('/')}/{project_path}",
        project_path=project_path,
        directory=directory,
        is_overview=is_overview,
        updated=datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d"),
        tags=normalize_tags(meta, category),
        body=body,
        headings=extract_headings(body),
        reading_minutes=max(1, round(len(words) / 420)),
    )


def collect_docs(project: dict[str, Any], route_dir: Path, protected_asset_prefix: str) -> list[Doc]:
    repo = (ROOT / project["source"]["repo"]).resolve()
    docs_root = (repo / project["source"]["docs_root"]).resolve()
    if not docs_root.exists():
        raise FileNotFoundError(f"docs_root not found for {project['slug']}: {docs_root}")
    used_ids: set[str] = set()
    docs: list[Doc] = []
    seen: set[Path] = set()
    for item in project.get("pinned_docs", []):
        path = docs_root / item
        if path.exists() and path.is_file():
            docs.append(load_doc(project, path, docs_root, used_ids, route_dir, protected_asset_prefix))
            seen.add(path.resolve())
    overview_name = project.get("navigation", {}).get("directory_overview", "overview.md")
    for path in sorted(docs_root.rglob("*.md")):
        if path.resolve() in seen:
            continue
        rel = path.relative_to(docs_root)
        if rel.name == "README.md" and (path.parent / overview_name).exists():
            continue
        if should_collect(rel, overview_name):
            docs.append(load_doc(project, path, docs_root, used_ids, route_dir, protected_asset_prefix))
    return docs


def build_directory_tree(project: dict[str, Any], docs: list[Doc]) -> list[dict[str, Any]]:
    overview_by_dir = {doc.directory: doc for doc in docs if doc.is_overview}
    child_docs: dict[str, list[Doc]] = {}
    directories: set[str] = {""}
    for doc in docs:
        directories.add(doc.directory)
        if not doc.is_overview:
            child_docs.setdefault(doc.directory, []).append(doc)
        parts = Path(doc.project_path).parent.parts
        for i in range(1, len(parts) + 1):
            directories.add("/".join(parts[:i]))

    def label_for(path: str) -> str:
        if not path:
            return project["title"]
        overview = overview_by_dir.get(path)
        if overview:
            return overview.title.replace(" Overview", "")
        return path.rsplit("/", 1)[-1].replace("-", " ").title()

    def node(path: str) -> dict[str, Any]:
        children = []
        prefix = f"{path}/" if path else ""
        direct_dirs = sorted({
            item for item in directories
            if item and item.startswith(prefix) and "/" not in item[len(prefix):]
        })
        for child in direct_dirs:
            children.append(node(child))
        for doc in sorted(child_docs.get(path, []), key=lambda item: item.title):
            children.append({"type": "doc", "id": doc.id, "title": doc.title, "path": doc.project_path})
        overview = overview_by_dir.get(path)
        return {
            "type": "directory",
            "path": path,
            "title": label_for(path),
            "overview_id": overview.id if overview else "",
            "children": children,
        }

    return [node("")]


def write_jsonp(path: Path, variable: str, payload: dict[str, Any]) -> None:
    text = f"window.{variable} = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    path.write_text(text, encoding="utf-8")


def doc_to_public_dict(doc: Doc, include_body: bool) -> dict[str, Any]:
    payload = doc.__dict__.copy()
    if not include_body:
        payload["body"] = ""
        payload["headings"] = []
    return payload


def copy_shell_files(target: Path) -> None:
    for name in ("index.html", "app.js", "styles.css", "theme.js", "CNAME", ".nojekyll"):
        src = ROOT / name
        if src.exists():
            if name == "index.html":
                html = src.read_text(encoding="utf-8")
                html = html.replace('./styles.css"', f'./styles.css?v={ASSET_VERSION}"')
                html = html.replace('./site-data.js"', f'./site-data.js?v={ASSET_VERSION}"')
                html = html.replace('./app.js"', f'./app.js?v={ASSET_VERSION}"')
                (target / name).write_text(html, encoding="utf-8")
            else:
                shutil.copy2(src, target / name)
    if ASSETS_DIR.exists():
        shutil.copytree(ASSETS_DIR, target / "assets", dirs_exist_ok=True)


def build_project(project: dict[str, Any], site_config: dict[str, Any]) -> tuple[Path, list[Doc], dict[str, Any]]:
    route = project["route"].strip("/")
    target = BUILD_DIR / route
    target.mkdir(parents=True, exist_ok=True)
    copy_shell_files(target)
    realm = access_realm(project)
    api_url = str(site_config.get("access_api_url") or site_config.get("api_url") or "").rstrip("/")
    protected_asset_prefix = f"{api_url}/api/projects/{realm}/assets" if api_url.startswith("http") else f"/api/projects/{realm}/assets"
    docs = collect_docs(project, target, protected_asset_prefix)
    public_docs = [doc for doc in docs if doc.visibility == "public"]
    categories = sorted({doc.category for doc in public_docs})
    tree = build_directory_tree(project, public_docs)
    project_public = public_project(project)
    project_public["doc_count"] = len(public_docs)
    project_public["updated"] = max((doc.updated for doc in public_docs), default="")
    project_public["overview_id"] = next((doc.id for doc in public_docs if doc.is_overview and not doc.directory), public_docs[0].id if public_docs else "")
    protected = is_protected(project)
    project_seed = shell_project(project_public) if protected else project_public
    payload = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "site": site_config,
        "project": project_seed,
        "docs": [doc_to_public_dict(doc, include_body=not protected) for doc in public_docs] if not protected else [],
        "categories": categories if not protected else [],
        "tree": tree if not protected else [],
        "protected": protected,
    }
    if protected:
        private_dir = PROTECTED_DIR / access_realm(project)
        private_dir.mkdir(parents=True, exist_ok=True)
        private_payload = {
            "generatedAt": payload["generatedAt"],
            "site": site_config,
            "project": project_public,
            "docs": [doc_to_public_dict(doc, include_body=True) for doc in public_docs],
            "categories": categories,
            "tree": tree,
            "protected": True,
        }
        (private_dir / "site-data.json").write_text(
            json.dumps(private_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    write_jsonp(target / "site-data.js", "RELUMEOW_DATA", payload)
    return target, public_docs, payload


def build_project_summaries(project_payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summaries = []
    for payload in project_payloads:
        project = payload["project"]
        docs = payload["docs"]
        if payload.get("protected"):
            protected_file = PROTECTED_DIR / access_realm(project) / "site-data.json"
            if protected_file.exists():
                docs = json.loads(protected_file.read_text(encoding="utf-8")).get("docs", [])
        overview = next((doc for doc in docs if doc.get("is_overview") and not doc.get("directory")), docs[0] if docs else {})
        summaries.append({
            "slug": project["slug"],
            "route": project["route"],
            "title": project["title"],
            "brand": project["brand"],
            "mark": project.get("mark", project["brand"][:3]),
            "subtitle": project.get("subtitle", ""),
            "description": project["description"],
            "access": project.get("access", {}),
            "doc_count": len(docs),
            "overview_id": overview.get("id", ""),
            "updated": max((doc.get("updated", "") for doc in docs), default=""),
        })
    return summaries


def build_home(site_config: dict[str, Any], summaries: list[dict[str, Any]]) -> None:
    home = BUILD_DIR / "home"
    home.mkdir(parents=True, exist_ok=True)
    copy_shell_files(home)
    payload = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "site": site_config,
        "projects": summaries,
    }
    write_jsonp(home / "site-data.js", "RELUMEOW_DATA", payload)
    shutil.copytree(home, BUILD_DIR, dirs_exist_ok=True)


def write_project_route_summaries(project_payloads: list[dict[str, Any]], summaries: list[dict[str, Any]]) -> None:
    for payload in project_payloads:
        route = payload["project"]["route"].strip("/")
        payload["projects"] = summaries
        write_jsonp(BUILD_DIR / route / "site-data.js", "RELUMEOW_DATA", payload)
        if payload.get("protected"):
            private_file = PROTECTED_DIR / access_realm(payload["project"]) / "site-data.json"
            if private_file.exists():
                private_payload = json.loads(private_file.read_text(encoding="utf-8"))
                private_payload["projects"] = summaries
                private_file.write_text(
                    json.dumps(private_payload, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )


def build_static_routes(site_config: dict[str, Any], summaries: list[dict[str, Any]]) -> None:
    for route in ("login", "admin"):
        target = BUILD_DIR / route
        target.mkdir(parents=True, exist_ok=True)
        copy_shell_files(target)
        write_jsonp(target / "site-data.js", "RELUMEOW_DATA", {
            "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "site": site_config,
            "projects": summaries,
        })
    (BUILD_DIR / "CNAME").write_text("relumeow.top\n", encoding="utf-8")
    (BUILD_DIR / ".nojekyll").write_text("", encoding="utf-8")
    (BUILD_DIR / "index.html").write_text(
        """<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=/home/">
<title>relumeow.top</title>
<a href="/home/">进入 relumeow.top</a>
""",
        encoding="utf-8",
    )


def main() -> int:
    config = yaml.safe_load(PROJECTS_FILE.read_text(encoding="utf-8"))
    site_config = config.get("site", {})
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True)
    project_payloads = []
    for project in config.get("projects", []):
        _target, docs, payload = build_project(project, site_config)
        project_payloads.append(payload)
        print(f"- built {project['slug']}: {len(docs)} public docs")
    summaries = build_project_summaries(project_payloads)
    write_project_route_summaries(project_payloads, summaries)
    build_home(site_config, summaries)
    build_static_routes(site_config, summaries)
    print(f"Built relumeow.top site at {BUILD_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
