#!/usr/bin/env python3
from __future__ import annotations

import json
import os
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
STATIC_DIR = ROOT / "static"
PROTECTED_DIR = BUILD_DIR / "_protected"
ASSET_VERSION = datetime.now().strftime("%Y%m%d%H%M%S")


@dataclass
class Doc:
    id: str
    title: str
    category: str
    doc_type: str
    research_stage: str
    research_doc_role: str
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


def strip_suffix(value: str, suffix: str) -> str:
    return value[: -len(suffix)] if suffix and value.endswith(suffix) else value


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


def should_collect(relative: Path, overview_name: str, docs_root: Path) -> bool:
    name = relative.name
    root_readme = docs_root / "README.md"
    if relative == Path("README.md"):
        return True
    if relative == Path(overview_name) and root_readme.exists():
        return False
    if name == "README.md":
        meta = {}
        try:
            raw = (docs_root / relative).read_text(encoding="utf-8")
            meta, _body = split_front_matter(raw)
        except OSError:
            meta = {}
        if str(meta.get("research_doc_role") or "").strip() in {"root", "overview"}:
            return True
        sibling = docs_root / relative.with_name(overview_name)
        return not sibling.exists()
    return True


def stage_image_for_doc(project: dict[str, Any], project_path: str) -> str:
    parts = project_path.split("/")
    if len(parts) < 3 or parts[0] != str(project.get("catalog", {}).get("root", "research-catalog/")).strip("/"):
        return ""
    stage_key = parts[1]
    for stage in project.get("catalog", {}).get("stages", []):
        if str(stage.get("key")) == stage_key:
            return str(stage.get("image") or stage.get("source_image") or "").strip()
    return ""


def prepend_lead_image_if_missing(project: dict[str, Any], docs_root: Path, path: Path, title: str, body: str) -> str:
    if re.search(r"!\[[^\]]*\]\([^)]+\)|!\[\[[^\]]+\]\]", body):
        return body
    relative = path.relative_to(docs_root)
    image = stage_image_for_doc(project, str(relative).replace("\\", "/"))
    if not image:
        return body
    image_src = (docs_root / image).resolve()
    if not image_src.exists() or not image_src.is_file():
        return body
    rel = os.path.relpath(image_src, path.parent).replace("\\", "/")
    caption = f"{title} 在项目 pipeline 中的位置"
    return f"![{title}]({rel} \"{caption}\")\n\n{body}"


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
    research_role = str(meta.get("research_doc_role") or "").strip()
    is_overview = relative.name in {overview_name, "README.md"}
    fallback = "Overview" if is_overview else relative.stem.replace("-", " ").replace("_", " ")
    title = str(meta.get("title") or extract_title(body, fallback)).strip()
    doc_id = slugify(str(meta.get("id") or f"{project['slug']}-{strip_suffix(project_path, '.md')}"), "doc")
    base_id = doc_id
    index = 2
    while doc_id in used_ids:
        doc_id = f"{base_id}-{index}"
        index += 1
    used_ids.add(doc_id)
    category = str(meta.get("category") or ("总目录" if relative.parent == Path(".") and is_overview else "项目文档")).strip()
    doc_type = str(meta.get("doc_type") or ("overview" if is_overview else "doc")).strip()
    research_stage = str(meta.get("research_stage") or "").strip()
    research_doc_role = research_role
    visibility = normalize_visibility(meta, project_path)
    body = prepend_lead_image_if_missing(project, docs_root, path, title, body)
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
        research_stage=research_stage,
        research_doc_role=research_doc_role,
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
    overview_name = project.get("navigation", {}).get("directory_overview", "overview.md")
    for item in project.get("pinned_docs", []):
        path = docs_root / item
        rel = path.relative_to(docs_root) if path.exists() else Path(item)
        if path.exists() and path.is_file() and should_collect(rel, overview_name, docs_root):
            docs.append(load_doc(project, path, docs_root, used_ids, route_dir, protected_asset_prefix))
            seen.add(path.resolve())
    for path in sorted(docs_root.rglob("*.md")):
        if path.resolve() in seen:
            continue
        rel = path.relative_to(docs_root)
        if should_collect(rel, overview_name, docs_root):
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

    nav = project.get("navigation", {})
    labels = nav.get("directory_labels", {}) if isinstance(nav.get("directory_labels"), dict) else {}
    order = nav.get("directory_order", []) if isinstance(nav.get("directory_order"), list) else []
    order_index = {str(item).strip("/"): index for index, item in enumerate(order)}

    def label_for(path: str) -> str:
        if not path:
            return project["title"]
        if path in labels:
            return str(labels[path])
        overview = overview_by_dir.get(path)
        if overview:
            return overview.title.replace(" Overview", "")
        return path.rsplit("/", 1)[-1].replace("-", " ").title()

    def sort_dir(path: str) -> tuple[int, str]:
        return (order_index.get(path, 1000), label_for(path))

    def node(path: str) -> dict[str, Any]:
        children = []
        prefix = f"{path}/" if path else ""
        direct_dirs = sorted({
            item for item in directories
            if item and item.startswith(prefix) and "/" not in item[len(prefix):]
        }, key=sort_dir)
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


def ordered_categories(project: dict[str, Any], docs: list[Doc]) -> list[str]:
    discovered = {doc.category for doc in docs}
    nav = project.get("navigation", {})
    configured = nav.get("category_order", []) if isinstance(nav.get("category_order"), list) else []
    ordered = [str(item) for item in configured if str(item) in discovered]
    remaining = sorted(discovered.difference(ordered))
    return ordered + remaining


def write_jsonp(path: Path, variable: str, payload: dict[str, Any]) -> None:
    text = f"window.{variable} = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    path.write_text(text, encoding="utf-8")


def doc_to_public_dict(doc: Doc, include_body: bool) -> dict[str, Any]:
    payload = doc.__dict__.copy()
    if not include_body:
        payload["body"] = ""
        payload["headings"] = []
    return payload


def copytree_merge(src: Path, dst: Path) -> None:
    if not dst.exists():
        shutil.copytree(src, dst)
        return
    for item in src.iterdir():
        target = dst / item.name
        if item.is_dir():
            copytree_merge(item, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def copy_shell_files(target: Path) -> None:
    for name in ("index.html", "app.js", "styles.css", "theme.js"):
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
        copytree_merge(ASSETS_DIR, target / "assets")


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
    categories = ordered_categories(project, public_docs)
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


def build_project_shell(project: dict[str, Any], site_config: dict[str, Any]) -> dict[str, Any]:
    route = project["route"].strip("/")
    target = BUILD_DIR / route
    target.mkdir(parents=True, exist_ok=True)
    copy_shell_files(target)
    seed = shell_project(project)
    payload = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "site": site_config,
        "project": seed,
        "docs": [],
        "categories": [],
        "tree": [],
        "protected": is_protected(project),
    }
    write_jsonp(target / "site-data.js", "RELUMEOW_DATA", payload)
    return payload


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
        doc_count = len(docs) if docs else int(project.get("doc_count") or 0)
        updated = max((doc.get("updated", "") for doc in docs), default="") if docs else project.get("updated", "")
        summaries.append({
            "slug": project["slug"],
            "route": project["route"],
            "title": project["title"],
            "brand": project["brand"],
            "mark": project.get("mark", project["brand"][:3]),
            "subtitle": project.get("subtitle", ""),
            "description": project["description"],
            "access": project.get("access", {}),
            "doc_count": doc_count,
            "overview_id": overview.get("id", project.get("overview_id", "")),
            "updated": updated,
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
    copytree_merge(home, BUILD_DIR)


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


def copy_static_tree() -> None:
    if STATIC_DIR.exists():
        copytree_merge(STATIC_DIR, BUILD_DIR)


def main() -> int:
    config = yaml.safe_load(PROJECTS_FILE.read_text(encoding="utf-8"))
    site_config = config.get("site", {})
    shell_only = os.environ.get("RELUMEOW_PAGES_SHELL_ONLY") == "1"
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True)
    project_payloads = []
    for project in config.get("projects", []):
        if shell_only:
            payload = build_project_shell(project, site_config)
            project_payloads.append(payload)
            print(f"- built {project['slug']}: shell only")
        else:
            _target, docs, payload = build_project(project, site_config)
            project_payloads.append(payload)
            print(f"- built {project['slug']}: {len(docs)} public docs")
    summaries = build_project_summaries(project_payloads)
    write_project_route_summaries(project_payloads, summaries)
    build_home(site_config, summaries)
    build_static_routes(site_config, summaries)
    copy_static_tree()
    print(f"Built relumeow.top site at {BUILD_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
