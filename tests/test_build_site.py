from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path

import build_site


class DemoBuildTests(unittest.TestCase):
    def project(self, source: Path | None = None, href: str = "/video2world/web-demo/") -> dict:
        project = {
            "slug": "video2world",
            "route": "/video2world/",
            "title": "Video2World",
            "brand": "Video2World",
            "description": "test",
            "source": {"repo": "../video2world", "docs_root": "docs/video2world"},
            "demo": {"href": href, "label": "Web Demo", "source": "/must/not/leak"},
        }
        if source is not None:
            project["build"] = {"demo": {"source": str(source)}}
        return project

    def test_public_project_exposes_only_demo_href_and_label(self) -> None:
        project = self.project(Path("/private/video2world/dist/web"))
        public = build_site.public_project(project)

        self.assertNotIn("source", public)
        self.assertNotIn("build", public)
        self.assertEqual(
            public["demo"],
            {"href": "/video2world/web-demo/", "label": "Web Demo"},
        )
        self.assertNotIn("/private", str(public))
        self.assertNotIn("/must/not/leak", str(public))

    def test_materialize_project_demo_copies_tree_under_project_route(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dist"
            (source / "worlds" / "bedroom4").mkdir(parents=True)
            (source / "index.html").write_text("demo", encoding="utf-8")
            (source / "worlds" / "bedroom4" / "manifest.json").write_text(
                "{}", encoding="utf-8"
            )

            copied = build_site.materialize_project_demo(self.project(source), root / "site")

            self.assertTrue(copied)
            self.assertEqual(
                (root / "site" / "video2world" / "web-demo" / "index.html").read_text(
                    encoding="utf-8"
                ),
                "demo",
            )
            self.assertTrue(
                (root / "site" / "video2world" / "web-demo" / "worlds" / "bedroom4" / "manifest.json").is_file()
            )

    def test_materialize_project_demo_excludes_publish_only_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dist"
            (source / "assets").mkdir(parents=True)
            (source / "test-fixtures").mkdir(parents=True)
            (source / "worlds" / "bedroom4" / "qa" / "screenshots").mkdir(parents=True)
            (source / "worlds" / "bedroom4" / "qa" / "unified-pillow-browser").mkdir(
                parents=True
            )
            (source / "worlds" / "bedroom4" / "recarve-candidates").mkdir(parents=True)
            (source / "worlds" / "bedroom4" / "render-meshes").mkdir(parents=True)
            (source / "worlds" / "bedroom4" / "colliders").mkdir(parents=True)
            (source / "index.html").write_text("demo", encoding="utf-8")
            (source / "gaussian-review.html").write_text("debug", encoding="utf-8")
            (source / "object-review.html").write_text("debug", encoding="utf-8")
            (source / "assets" / "app.js").write_text("runtime", encoding="utf-8")
            (source / "assets" / "app.js.map").write_text("map", encoding="utf-8")
            (source / "assets" / "gaussianReview-debug.js").write_text(
                "debug", encoding="utf-8"
            )
            (source / "assets" / "objectReview-debug.js").write_text(
                "debug", encoding="utf-8"
            )
            (source / "assets" / "object-review-debug.css").write_text(
                "debug", encoding="utf-8"
            )
            (source / "test-fixtures" / "manifest.json").write_text("{}", encoding="utf-8")
            (source / "worlds" / "bedroom4" / "qa" / "browser.json").write_text("{}", encoding="utf-8")
            (source / "worlds" / "bedroom4" / "qa" / "screenshots" / "shot.png").write_bytes(b"png")
            (
                source
                / "worlds"
                / "bedroom4"
                / "qa"
                / "unified-pillow-browser"
                / "shot.png"
            ).write_bytes(b"png")
            (
                source / "worlds" / "bedroom4" / "recarve-candidates" / "candidate.chunk000"
            ).write_bytes(b"debug")
            (source / "worlds" / "bedroom4" / "render-meshes" / "plant.glb").write_bytes(b"glb")
            oversized_collider = (
                source
                / "worlds"
                / "bedroom4"
                / "colliders"
                / "collider_bedroom4_tsdf_static_carved_unified_pillow.ply"
            )
            oversized_collider.write_bytes(b"source-only collider")
            project = self.project(source)
            project["build"]["demo"]["exclude"] = [
                "*.map",
                "test-fixtures",
                "gaussian-review.html",
                "object-review.html",
                "assets/gaussianReview-*",
                "assets/objectReview-*",
                "assets/object-review-*",
                "worlds/*/qa/screenshots",
                "worlds/*/qa/unified-pillow-browser",
                "worlds/*/recarve-candidates",
                "worlds/bedroom4/colliders/collider_bedroom4_tsdf_static_carved_unified_pillow.ply",
            ]
            target = root / "site" / "video2world" / "web-demo"
            target.mkdir(parents=True)
            (target / "assets").mkdir()
            (target / "assets" / "stale.js.map").write_text("stale", encoding="utf-8")

            build_site.materialize_project_demo(project, root / "site")

            self.assertTrue((target / "assets" / "app.js").is_file())
            self.assertFalse((target / "assets" / "app.js.map").exists())
            self.assertFalse((target / "assets" / "stale.js.map").exists())
            self.assertFalse((target / "gaussian-review.html").exists())
            self.assertFalse((target / "object-review.html").exists())
            self.assertFalse((target / "assets" / "gaussianReview-debug.js").exists())
            self.assertFalse((target / "assets" / "objectReview-debug.js").exists())
            self.assertFalse((target / "assets" / "object-review-debug.css").exists())
            self.assertFalse((target / "test-fixtures").exists())
            self.assertTrue((target / "worlds" / "bedroom4" / "qa" / "browser.json").is_file())
            self.assertFalse(
                (target / "worlds" / "bedroom4" / "qa" / "screenshots").exists()
            )
            self.assertFalse(
                (target / "worlds" / "bedroom4" / "qa" / "unified-pillow-browser").exists()
            )
            self.assertFalse(
                (target / "worlds" / "bedroom4" / "recarve-candidates").exists()
            )
            self.assertTrue((target / "worlds" / "bedroom4" / "render-meshes" / "plant.glb").is_file())
            self.assertFalse(
                (
                    target
                    / "worlds"
                    / "bedroom4"
                    / "colliders"
                    / "collider_bedroom4_tsdf_static_carved_unified_pillow.ply"
                ).exists()
            )

    def test_copied_entrypoint_is_scoped_and_defaults_to_configured_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dist"
            manifest = source / "worlds" / "bedroom4" / "manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text("{}", encoding="utf-8")
            (source / "index.html").write_text(
                '<html><head><script src="/assets/app.js"></script>'
                '<link href="/assets/app.css"></head></html>',
                encoding="utf-8",
            )
            project = self.project(source)
            project["build"]["demo"].update(
                {
                    "rewrite_root_asset_urls": True,
                    "default_manifest": "worlds/bedroom4/manifest.json",
                }
            )

            build_site.materialize_project_demo(project, root / "site")

            html = (
                root / "site" / "video2world" / "web-demo" / "index.html"
            ).read_text(encoding="utf-8")
            self.assertIn('src="./assets/app.js"', html)
            self.assertIn('href="./assets/app.css"', html)
            self.assertIn("relumeow-default-demo-manifest", html)
            self.assertIn("./worlds/bedroom4/manifest.json", html)
            expected_version = hashlib.sha256(b"{}").hexdigest()[:12]
            self.assertIn(
                f"./worlds/bedroom4/manifest.json?v={expected_version}",
                html,
            )
            self.assertIn("window.history.replaceState", html)
            self.assertLess(
                html.index("relumeow-default-demo-manifest"),
                html.index('src="./assets/app.js"'),
            )

    def test_default_manifest_requires_referenced_local_file_after_filtering(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dist"
            qa_dir = source / "worlds" / "bedroom4" / "qa"
            qa_dir.mkdir(parents=True)
            (source / "index.html").write_text("<html></html>", encoding="utf-8")
            (qa_dir / "browser-qa.json").write_text("{}", encoding="utf-8")
            (source / "worlds" / "bedroom4" / "manifest.json").write_text(
                '{"productionBuild":{"browserQaReport":"./worlds/bedroom4/qa/browser-qa.json"}}',
                encoding="utf-8",
            )
            project = self.project(source)
            project["build"]["demo"].update(
                {
                    "default_manifest": "worlds/bedroom4/manifest.json",
                    "exclude": ["worlds/*/qa/screenshots"],
                }
            )

            build_site.materialize_project_demo(project, root / "site")

            published = (
                root
                / "site"
                / "video2world"
                / "web-demo"
                / "worlds"
                / "bedroom4"
                / "qa"
                / "browser-qa.json"
            )
            self.assertTrue(published.is_file())

            project["build"]["demo"]["exclude"] = ["worlds/*/qa"]
            with self.assertRaisesRegex(FileNotFoundError, "referenced local file"):
                build_site.materialize_project_demo(project, root / "site")

    def test_default_manifest_requires_all_local_world_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dist"
            manifest = source / "worlds" / "bedroom4" / "manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(
                '{"asset":{"url":"./worlds/bedroom4/objects/pillow.glb"}}',
                encoding="utf-8",
            )
            (source / "index.html").write_text("<html></html>", encoding="utf-8")
            project = self.project(source)
            project["build"]["demo"]["default_manifest"] = (
                "worlds/bedroom4/manifest.json"
            )

            with self.assertRaisesRegex(FileNotFoundError, "objects/pillow.glb"):
                build_site.materialize_project_demo(project, root / "site")

    def test_stable_manifest_must_exist_and_differ_from_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dist"
            manifest_dir = source / "worlds" / "bedroom4"
            manifest_dir.mkdir(parents=True)
            (source / "index.html").write_text("<html></html>", encoding="utf-8")
            default = manifest_dir / "manifest.json"
            stable = manifest_dir / "manifest.stable.json"
            default.write_text('{"version":"candidate"}', encoding="utf-8")
            project = self.project(source)
            project["build"]["demo"].update(
                {
                    "default_manifest": "worlds/bedroom4/manifest.json",
                    "stable_manifest": "worlds/bedroom4/manifest.stable.json",
                }
            )

            with self.assertRaisesRegex(FileNotFoundError, "stable demo manifest"):
                build_site.materialize_project_demo(project, root / "site")

            stable.write_text('{\n  "version": "candidate"\n}\n', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "content must differ"):
                build_site.materialize_project_demo(project, root / "site")

            stable.write_text(
                '{"version":"stable","asset":"./worlds/bedroom4/stable.bin"}',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(FileNotFoundError, "stable.bin"):
                build_site.materialize_project_demo(project, root / "site")

            (manifest_dir / "stable.bin").write_bytes(b"stable")
            build_site.materialize_project_demo(project, root / "site")
            published = root / "site" / "video2world" / "web-demo"
            self.assertEqual(
                (published / "worlds" / "bedroom4" / "manifest.json").read_bytes(),
                default.read_bytes(),
            )
            self.assertEqual(
                (published / "worlds" / "bedroom4" / "manifest.stable.json").read_bytes(),
                stable.read_bytes(),
            )

    def test_demo_max_file_bytes_is_enforced_after_filtering(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "dist"
            source.mkdir()
            (source / "index.html").write_text("demo", encoding="utf-8")
            (source / "oversized.ply").write_bytes(b"x" * 17)
            project = self.project(source)
            project["build"]["demo"].update({"max_file_bytes": 16})

            with self.assertRaisesRegex(ValueError, r"oversized.ply \(17 bytes\)"):
                build_site.materialize_project_demo(project, root / "site")

            project["build"]["demo"]["exclude"] = ["oversized.ply"]
            build_site.materialize_project_demo(project, root / "site")
            self.assertFalse(
                (root / "site" / "video2world" / "web-demo" / "oversized.ply").exists()
            )

    def test_missing_demo_source_is_optional_and_removes_public_link(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            prepared = build_site.prepare_project_for_build(
                self.project(root / "missing"), root / "site"
            )

            self.assertNotIn("demo", prepared)
            self.assertNotIn("demo", build_site.public_project(prepared))

    def test_demo_target_must_stay_inside_project_route(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                build_site.demo_target_for_project(
                    self.project(Path(temp), "/video2mesh/web-demo/"), Path(temp) / "site"
                )

    def test_default_manifest_path_rejects_script_injection_characters(self) -> None:
        with self.assertRaises(ValueError):
            build_site.relative_demo_path("worlds/</script>.json", "default_manifest")

    def test_demo_exclude_patterns_reject_traversal(self) -> None:
        project = self.project()
        project["build"] = {"demo": {"exclude": ["../private"]}}
        with self.assertRaises(ValueError):
            build_site.demo_exclude_patterns(project)


if __name__ == "__main__":
    unittest.main()
