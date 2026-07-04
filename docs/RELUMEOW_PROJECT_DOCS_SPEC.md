---
title: relumeow.top 项目文档接入规范
id: relumeow-project-docs-spec
category: 站点规范
visibility: private
summary: 规定每个项目如何组织 Markdown、目录 overview、图文资产和站点接入清单，保证 relumeow.top 多项目文档风格统一且易于聚合。
tags:
  - relumeow.top
  - Docs Spec
  - Publishing
---

# relumeow.top 项目文档接入规范

这份规范约束的是每个项目仓库内的文档源，不约束项目代码结构。目标是让 `relumeow.top` 能持续挂载更多项目，同时保持同一套导航、目录 overview、调研目录、进度目录和项目说明风格。整体交互参考飞书文档知识库：点进一个目录时，正文区域自动显示该目录的 `overview.md`，目录树负责展示子文档，不在正文里手工堆文件清单。

## 1. 基本原则

1. 每个项目只维护自己的内容源，公共站点壳、主题、搜索、部署和域名由中央站点项目维护。
2. 项目文档源统一放在 `docs/<project-slug>/`，其中 `<project-slug>` 必须和线上路由一致。
3. 公开文档必须写明 front matter，不依赖构建器猜测标题、分类和摘要。
4. 每个目录必须有自己的 `overview.md`。目录节点点击后显示该 overview，`overview.md` 不作为普通子文档重复列在目录里。
5. 公开文档尽量图文并茂；项目首页、目录 overview、调研阶段 overview、进度结果页必须至少有一张信息型图表或截图。
6. 图片、图表和小型附件必须跟随文档一起提交；大模型、数据集、视频、3D raw asset、checkpoint 不进入文档站发布产物。
7. 文档先说明边界和结论，再列证据、命令、指标和链接。避免把实验流水账直接暴露为主入口。

## 2. 项目目录合同

每个项目推荐使用固定四段式目录：

```text
docs/<project-slug>/
  overview.md
  project-docs/
    overview.md
    how-to-run.md
    architecture.md
  research-catalog/
    overview.md
    <stage-key>/
      overview.md
      <method-or-paper>.md
    assets/
  progress/
    overview.md
    current-results.md
    weekly-YYYY-MM-DD.md
    assets/
  contest-analysis/        # 可选：比赛/课题/需求类项目使用
    overview.md
```

各目录职责：

| 目录 | 作用 | 是否建议公开 |
|---|---|---|
| `overview.md` | 项目站首页，说明项目定位、目录和当前一句话结论 | 是 |
| `project-docs/` | 使用方式、架构、运行命令、部署、复现实验入口 | 是 |
| `research-catalog/` | 模型、论文、工业项目、方案路线调研 | 是 |
| `progress/` | 当前结果、周报、门禁结论、可展示产物 | 是 |
| `contest-analysis/` | 赛题/需求/数据集分析，非比赛项目可省略 | 视项目而定 |
| `legacy/` | 旧长文、历史草稿、内部记录 | 默认私有 |

目录规则：

1. `overview.md` 是目录的默认正文；例如点击 `/video2mesh/project-docs/` 时显示 `docs/video2mesh/project-docs/overview.md`。
2. 中央站点导航应自动生成子目录和子文档树，`overview.md` 不在同级子文档列表里重复出现。
3. `overview.md` 不承担“逐个列出本目录所有文件”的职责，只负责说明该目录的定位、结构图、推荐阅读路径和当前关键结论。
4. `README.md` 可以作为 GitHub 兼容文件保留，但不是站内目录入口；如同时存在，站点以 `overview.md` 为准。

不要把项目主文档继续散落在仓库根目录。根目录 `README.md` 可以保留给 GitHub，但面向网站的结构化文档应进入 `docs/<project-slug>/`。

## 3. 命名规则

`project-slug` 使用小写字母、数字和连字符，例如：

```text
video2mesh
challengecup-agent-system
paper-reading-d4rt
```

文档文件名使用小写连字符：

```text
how-to-run.md
current-results.md
model-soups.md
weekly-2026-07-03.md
```

图片文件名也使用小写连字符，并带语义前缀：

```text
research-catalog-pipeline.svg
yolov8-pipeline.svg
weekly-2026-07-03-error-sample.jpg
```

每篇文档的 `id` 必须全站唯一，推荐格式：

```text
<project-slug>-<section>-<topic>
```

示例：

```text
video2mesh-project-docs-overview
challengecup-yolov8
challengecup-current-results
```

## 4. Front Matter

所有公开文档必须包含：

```yaml
---
title: 文档标题
id: project-slug-topic
category: 项目文档
visibility: public
summary: 一句话说明这篇文档解决什么问题，控制在 80 字以内。
tags:
  - ProjectName
  - Keyword
---
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---:|---|
| `title` | 是 | 页面标题，尽量具体 |
| `id` | 是 | 全站唯一、稳定，不随标题轻易改变 |
| `category` | 是 | 用于侧栏和筛选 |
| `visibility` | 是 | `public` 或 `private` |
| `summary` | 是 | 卡片和搜索结果摘要 |
| `tags` | 是 | 3-6 个关键词 |
| `research_stage` | 调研项建议填 | 对应 `research-catalog/<stage-key>/` |
| `doc_type` | 目录 overview 建议填 | `overview`、`guide`、`research`、`progress` 等 |

推荐分类固定为：

```text
总目录
项目文档
调研目录
进度目录
赛题分析目录
旧文档
```

新项目可以增加少量项目特有分类，但不要为每篇文档创造一个新分类。

## 5. 目录 Overview 模板

每个目录都用 `overview.md` 作为默认打开文档。项目根目录的 `docs/<project-slug>/overview.md` 使用这个结构：

```markdown
---
title: ProjectName 总目录
id: project-slug-home
category: 总目录
doc_type: overview
visibility: public
summary: ProjectName 的公开文档入口，包含项目文档、调研目录和进度目录。
tags:
  - ProjectName
  - 总目录
---

# ProjectName 总目录

一句话说明这个项目挂在什么路由下、用来集中展示什么内容。

![ProjectName 文档结构](project-docs/assets/project-doc-map.svg "ProjectName 文档结构")

## 阅读路径

| 路径 | 内容边界 |
|---|---|
| 项目文档 | 环境、架构、命令、部署和复现实验入口 |
| 调研目录 | 模型、论文、项目和工程方案调研 |
| 进度目录 | 当前结果、实验门禁、周报和展示材料 |

## 当前一句话

用一段话说明当前项目的核心判断、当前状态或最重要结论。
```

子目录 overview 使用这个结构：

```markdown
---
title: ProjectName 项目文档 Overview
id: project-slug-project-docs-overview
category: 项目文档
doc_type: overview
visibility: public
summary: 说明这个目录收纳哪些内容，以及读者应该先看什么。
tags:
  - ProjectName
  - 项目文档
---

# ProjectName 项目文档 Overview

这个目录解决什么问题、面向什么读者、哪些内容已经稳定。

![ProjectName 项目文档结构](assets/project-doc-map.svg "项目文档从运行入口、架构、部署到数据合同的阅读路径")

## 当前建议

先用一小段话说明最推荐的阅读或操作顺序。目录树会自动显示完整子文档，不要在这里手动维护完整文件清单。
```

## 6. 调研目录规范

`research-catalog/overview.md` 负责解释调研目录的阶段图和阅读路径，不放太多细节。每个阶段目录必须有自己的 `overview.md`，每个方法/论文/项目单独成文。

推荐结构：

```text
research-catalog/
  overview.md
  assets/
  target-detection/
    overview.md
    yolov8.md
    sahi.md
  deployment/
    overview.md
    ascend-cann-atc.md
```

阶段 `overview.md` 必须回答：

1. 这个阶段在 pipeline 中负责什么。
2. 当前项目为什么需要这个阶段。
3. 本阶段主要路线、输入输出、风险和结构图。
4. 当前建议采用哪条路线，哪些只是备选。
5. 读者进入该目录时应该先理解什么，而不是只看到文件列表。

单个方法/论文/项目文档建议使用：

```markdown
## 项目/模型链接

## 摘要要点

## Pipeline

## 在本项目中的作用

## 接入状态

## 输出结果摘录

## 风险与下一步
```

## 7. 进度目录规范

`progress/overview.md` 是进度目录入口，`current-results.md` 是当前有效结论。周报使用 `weekly-YYYY-MM-DD.md`。

进度文档必须区分：

| 类型 | 写法 |
|---|---|
| 当前默认结果 | 明确写“默认候选”或“当前有效结果” |
| 探索结果 | 明确写“已尝试但暂不默认” |
| 失败路线 | 写原因、证据和后续是否继续 |
| 展示材料 | 写清本地路径、线上路径、指标口径 |

涉及指标时必须写清数据版本、命令入口、评估口径和日期。不要只写“效果提升了”。

## 8. 项目文档规范

`project-docs/` 至少包含：

```text
overview.md
how-to-run.md
```

如果项目有明确架构或部署流程，继续添加：

```text
architecture.md
deployment.md
data-contract.md
```

`how-to-run.md` 必须包含：

1. 环境要求。
2. 最短可运行命令。
3. 常用参数。
4. 输出目录。
5. 验证方式。
6. 常见失败和处理。

命令必须能从项目仓库根目录理解。涉及远端、GPU、私有数据或大文件时，要明确说明“本地轻量验证”和“远端完整运行”的边界。

## 9. 图文并茂要求

公开文档要尽量做到“图先建立直觉，文字解释边界，表格承接证据”。图片不是装饰，必须传递结构、流程、结果或对比信息。

最低配图要求：

| 文档类型 | 必须有的视觉元素 |
|---|---|
| 项目根 `overview.md` | 项目地图、系统架构图或阅读路径图 |
| 子目录 `overview.md` | 该目录的流程图、阶段图、信息架构图或代表性结果图 |
| 调研阶段 `overview.md` | 阶段 pipeline、方法对比图或决策矩阵 |
| 单个论文/模型/项目调研 | 原论文/官网图、我们重画的接入图，或输入输出示意图 |
| 进度/结果文档 | 指标表 + 结果截图、曲线图、错例图或可视化样例 |
| 运行/部署文档 | 命令流程图、输出目录树、界面截图或部署拓扑图 |

图片使用原则：

1. 优先使用项目真实截图、实验结果图、pipeline SVG、架构图和指标图。
2. 没有现成图片时，先画一张简洁 SVG/PNG 流程图；不要用无信息量的装饰图。
3. 每张图片必须有 alt 文本和 title 图注，图注要说明这张图证明什么。
4. 一篇超过 800 字的公开文档，原则上至少配一张图或一个信息表。
5. 多图长文要按“先总览图，再局部证据图”的顺序组织。
6. 外部论文/官网图片要保留来源链接或在图片下方注明来源页面。

推荐图片写法：

```markdown
![YOLOv8 在本项目中的位置](../assets/yolov8-pipeline.svg "YOLOv8 在 ChallengeCup Agent System 中承担目标检测主干")
```

## 10. Markdown 写作风格

文档站支持标题、表格、代码块、本地图片、网络图片和普通 Markdown 链接。为了统一风格：

1. 每篇文档只使用一个一级标题，并与 `title` 基本一致。
2. 二级标题用于主要段落，三级标题只在长文中使用。
3. 表格列数控制在 5 列以内，移动端能横向扫描。
4. 代码块必须标注语言或使用 `text`。
5. 图片必须有 alt 文本和 title 图注，且尽量出现在相关段落之前或之后，不要全部堆到文末。
6. 结论、状态和风险用短段落或表格表达，少用无边界长列表。
7. 外部链接用 Markdown 链接，不裸贴一串 URL。
8. 不在公开文档里写密钥、token、私人账号、远端机器密码或未脱敏数据路径。

## 11. 资产规范

允许进入文档站的资产：

| 类型 | 建议大小 | 说明 |
|---|---:|---|
| SVG 流程图 | 小于 1 MB | 首选 |
| PNG/JPG/WebP 截图 | 单张小于 2 MB | 用于结果展示 |
| 小型 JSON 摘录 | 小于 200 KB | 可作为引用，不替代完整实验输出 |

不允许直接进入文档站发布产物：

```text
*.mp4
*.mov
*.ply
*.splat
*.spz
*.glb
*.pt
*.pth
*.onnx
*.engine
*.om
dataset/
exports/
checkpoints/
```

如果需要展示这些产物，只在文档中放预览图、摘要、manifest 或外部下载链接。大资产必须由对象存储、GitHub Release、raw 分片或专门 demo pipeline 管理，不能混进普通文档发布。

## 12. 中央站点接入 Manifest

中央站点项目应为每个项目维护一条 manifest 记录。推荐结构：

```yaml
projects:
  - slug: video2mesh
    route: /video2mesh/
    title: Video2Mesh Field Notes
    brand: Video2Mesh
    mark: V2M
    subtitle: Field Notes
    description: Video2Mesh 项目文档、调研和运行手册。
    access:
      mode: passcode
      realm: video2mesh
    source:
      repo: ../Video2Mesh
      docs_root: docs/video2mesh
    navigation:
      directory_overview: overview.md
      hide_overview_from_child_list: true
    pinned_docs:
      - overview.md
      - project-docs/overview.md
      - research-catalog/overview.md
      - progress/overview.md
    catalog:
      category: 调研目录
      root: research-catalog/
      stages:
        - key: input-pose-pointcloud
          title: 输入、位姿与点云
          summary: 视频抽帧、COLMAP/MVS、learned pose fallback、稠密点云和坐标尺度合同。
          image: assets/uploaded/input-pose-pointcloud/stage-input-pose.svg
          tags:
            - COLMAP
            - Point Cloud
            - Pose
    reading_paths:
      - title: 项目文档
        tags:
          - 项目文档
        query: 运行
```

新项目接入时，项目仓库只需要满足 `docs_root` 结构；中央站点负责读 manifest、收集 Markdown、复制公共图片和生成 `/route/`。

受保护项目的正文和图片不能写入前端可直接下载的 `site-data.js`。中央站点应只在静态路由中暴露项目壳、标题和访问状态；完整 Markdown JSON 与图片进入后台受控目录，并由 `/api/projects/<realm>/data` 和 `/api/projects/<realm>/assets/...` 在 token 验证通过后返回。项目口令只以 hash/secret 的形式存在后台，不能出现在 manifest、前端 JS 或构建产物里。

中央站点导航要求：

1. 目录节点可点击，点击后打开该目录的 `overview.md`。
2. 同级文档列表里隐藏 `overview.md`，避免出现“目录”和“Overview 文档”两个重复入口。
3. 如果目录缺少 `overview.md`，构建应给出警告；公开项目不应带着空目录上线。
4. 文档正文不手写完整目录树，完整目录树由站点侧根据文件结构生成。

## 13. 接入检查表

新项目准备上传前，按这个清单检查：

```text
[ ] docs/<project-slug>/overview.md 存在，并有完整 front matter 和项目地图图示
[ ] project-docs/overview.md 和 how-to-run.md 存在
[ ] research-catalog/overview.md 存在；每个阶段目录有 overview.md
[ ] progress/overview.md 或 current-results.md 存在
[ ] 所有 public 文档有 title/id/category/visibility/summary/tags
[ ] id 全站唯一，且不会因为改标题变化
[ ] 每个公开目录 overview 都有信息型图片、流程图、架构图或结果图
[ ] 关键长文尽量图文并茂，本地图片都能从 Markdown 相对路径解析
[ ] 没有提交视频、PLY、checkpoint、dataset、exports 等大资产
[ ] 指标文档写明数据版本、评估口径和日期
[ ] 私密草稿放入 legacy/ 或标记 visibility: private
[ ] 中央站 manifest 已添加 route/source/navigation/pinned_docs/catalog/reading_paths
[ ] 本地构建通过，并检查生成站点入口和调研目录
```

## 14. 最小示例

一个最小可接入项目至少包含：

```text
docs/example-project/
  overview.md
  project-docs/
    overview.md
    how-to-run.md
  research-catalog/
    overview.md
    baseline/
      overview.md
  progress/
    overview.md
```

最小首页：

```markdown
---
title: Example Project 总目录
id: example-project-home
category: 总目录
doc_type: overview
visibility: public
summary: Example Project 的公开文档入口。
tags:
  - Example Project
  - 总目录
---

# Example Project 总目录

这个文档站挂载在 `/example-project/` 子路由下，用来集中展示项目文档、调研目录和进度结果。

![Example Project 文档地图](project-docs/assets/project-doc-map.svg "Example Project 从项目文档、调研目录到进度目录的阅读路径")

## 阅读路径

| 路径 | 内容边界 |
|---|---|
| 项目文档 | 环境、命令和复现入口 |
| 调研目录 | 技术路线和外部参考 |
| 进度目录 | 当前结果和后续优先级 |

## 当前一句话

Example Project 当前处于可运行 baseline 阶段，下一步目标是补齐评测和展示材料。
```
