---
title: relumeow.top 部署说明
id: relumeow-deployment
category: 站点运维
visibility: private
summary: 中央站点的构建、权限 Worker、Cloudflare Workers Static Assets 和 GitHub Pages/CNAME 部署说明。
tags:
  - relumeow.top
  - Cloudflare Workers
  - Deploy
---

# relumeow.top 部署说明

## 本地构建

```bash
python3 build_site.py
python3 -m py_compile build_site.py
node --check app.js
node --check access-worker.js
```

`projects.yaml` 是唯一的项目接入清单。构建器会从相邻项目仓库读取 `docs/<project-slug>/`，生成 `_site/`。受保护项目的 Markdown 正文与图片会写入 `_site/_protected/<realm>/`，前端静态路由不会直接暴露这些正文。

## 口令哈希

不要把明文口令写进前端、manifest 或 Worker 源码。用脚本生成 salt 和 hash：

```bash
python3 scripts/hash_access_passcode.py --passcode "your-passcode"
python3 scripts/hash_access_passcode.py --salt "<same-salt>" --passcode "another-passcode"
```

然后把值配置成 Worker secrets：

```bash
npx wrangler secret put RELUMEOW_ACCESS_SALT
npx wrangler secret put RELUMEOW_ACCESS_TOKEN_SECRET
npx wrangler secret put RELUMEOW_ACCESS_VIDEO2MESH_HASH
npx wrangler secret put RELUMEOW_ACCESS_CHALLENGECUP_AGENT_SYSTEM_HASH
npx wrangler secret put RELUMEOW_ADMIN_VIDEO2MESH_HASH
npx wrangler secret put RELUMEOW_ADMIN_CHALLENGECUP_AGENT_SYSTEM_HASH
```

Cloudflare 文档要求敏感值使用 secrets；`wrangler secret put` 会创建并部署带新 secret 的 Worker 版本。`RELUMEOW_ACCESS_*_HASH` 是访客浏览/评论口令，`RELUMEOW_ADMIN_*_HASH` 是管理员编辑/上传口令；两类口令不要共用。

## Cloudflare Workers Static Assets

`wrangler.jsonc` 使用 Workers Static Assets：

```jsonc
{
  "main": "./access-worker.js",
  "assets": {
    "directory": "./_site",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*", "/_protected/*"]
  }
}
```

静态 HTML/CSS/JS 由 assets binding 托管；`/api/*` 先进入 Worker。Worker 负责：

| 路由 | 作用 |
|---|---|
| `/api/access/login` | 后台验证访客或管理员口令 hash，签发带 role 的短期 token |
| `/api/access/verify` | 验证 token 是否仍然有效，并返回 role |
| `/api/projects/<realm>/data` | 验证后返回受保护项目 Markdown JSON |
| `/api/projects/<realm>/assets/...` | 验证后返回受保护项目图片 |
| `/api/discussions/<realm>/<doc-id>` | 授权访客读写评论、回复和批注 |
| `/api/overlays/<realm>` | 授权访客读取后台 Markdown 覆盖层 |
| `/api/overlays/<realm>/<doc-id>` | 管理员 token 保存在线编辑正文或 checklist 状态 |
| `/api/uploads/<realm>/<doc-id>` | 管理员 token 上传正文图片 |
| `/api/content-assets/<realm>/<doc-id>/<file>` | 授权访客读取后台上传图片 |

## GitHub Pages 备选

如果临时只走 GitHub Pages，workflow 使用 `RELUMEOW_PAGES_SHELL_ONLY=1 python build_site.py`，只发布 Home、身份入口、项目卡片和项目锁定页。它不 checkout 项目内容源仓库，也不会生成或上传 `_site/_protected/`。

这样做有两个边界：

- GitHub Pages 负责让 `relumeow.top/home/`、`/login/`、`/admin/`、`/video2mesh/`、`/challengecup-agent-system/` 这些公共壳可访问。
- 受保护项目的 Markdown 正文、图片和目录树必须使用 Cloudflare Worker 或其它后台 API 承载；不要把 `_site/_protected/` 部署到纯静态 Pages。
