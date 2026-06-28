window.V2M_BLOG_DATA = {
  "generatedAt": "2026-06-28 23:06",
  "docs": [
    {
      "id": "readme",
      "title": "Video2Mesh",
      "category": "Pipeline",
      "summary": "Video2Mesh turns a spatial scan video into a scene-level 3DGS, object/background 3D semantic masks, object reference frames, 3DGS-derived object meshes, and simulator-ready assets.",
      "source_path": "README.md",
      "source_kind": "builtin",
      "updated": "2026-06-26",
      "tags": [
        "Pipeline"
      ],
      "body": "# Video2Mesh\n\nVideo2Mesh turns a spatial scan video into a scene-level 3DGS, object/background 3D semantic masks, object reference frames, 3DGS-derived object meshes, and simulator-ready assets.\n\nCurrent default pipeline:\n\n```text\nvideo\n  -> uniform dense real-frame extraction (<=200 frames)\n  -> COLMAP poses + full sparse point cloud\n  -> GraphDECO 3D Gaussian Splatting\n  -> SAM prompts + SAM2 video masks\n  -> 2D-to-3D semantic mask fusion\n  -> semantic/probability Gaussian export\n  -> object frame selection\n  -> object meshes\n  -> MuJoCo / Unity / Isaac asset export\n```\n\n## Quick Start\n\nRemote server:\n\n```bash\ncd /root/autodl-tmp/workspace/Video2Mesh\nsource /etc/network_turbo >/dev/null 2>&1 || true\n\nbash run.sh --image_path dataset/<video>.mp4\n```\n\nEquivalent direct quick runner:\n\n```bash\nbash tools/run_video2mesh_quick.sh dataset/<video>.mp4\n```\n\nRun a fixed real-video window without interpolation:\n\n```bash\nSTART_SEC=47 END_SEC=56 MAX_FRAMES=200 EXTRACT_EVERY=1 \\\nbash tools/run_video2mesh_quick.sh dataset/bedroom_4_CmEIg9gMI74/bedroom_4_Cm.mp4\n```\n\nThe quick entrypoint defaults to:\n\n- `RUN_COLMAP=1`\n- `RUN_MAST3R=0`\n- `MAX_FRAMES=200`\n- `GS_BACKEND=graphdeco`\n- `GRAPHDECO_ROOT=/root/autodl-tmp/workspace/gaussian-splatting`\n- `GRAPHDECO_ITERATIONS=30000`\n- `MASK_BACKEND=sam2`\n- full COLMAP sparse `scene/reconstruction/point_cloud.ply` for 3DGS and semantic fusion\n- simulator/export QA reports at the end\n\nFrame extraction first computes how many real frames the requested video/window\nwould produce. If that exceeds `MAX_FRAMES`, it uniformly samples from those\ndecoded source frames instead of interpolating or using synthetic frames.\n\nThe GraphDECO default is now the full training preset: full COLMAP point-cloud\ninitialization, 30000 iterations, checkpoints at 7000 and 30000,\ndensification/pruning, opacity reset, and SH degree 3 appearance enabled. Use\nsmaller overrides only for explicit smoke tests or memory-constrained debugging.\n\n## Object Mesh Route\n\n`reconstruct-object-meshes` can still export quick OBJ baselines from fused\nobject mask point clouds so the simulator/export path has concrete geometry to\ninspect. Those OBJ files are not the target 3DGS-to-mesh method.\n\nCurrent mask-cloud OBJ output is expected to be fragmented: sparse/uneven point\nsupport creates many disconnected triangle islands, holes, floating sheets, and\nnon-watertight surfaces. Treat these meshes as debug geometry only, useful for\nchecking object scale, rough placement, and export wiring. They should not be\nshown as final object assets.\n\nThe default production direction is:\n\n```text\ntrained 3DGS + object 2D/3D masks + registered cameras\n  -> render multi-view RGB/depth/normal/mask observations\n  -> fuse masked depth/normal evidence with TSDF fusion\n  -> extract surfaces with marching cubes / Poisson reconstruction\n  -> optionally refine with NeuS-style SDF optimization\n  -> bake texture, simplify collider, export simulator mesh\n```\n\nThis route treats 3DGS as the geometric scene representation and extracts a\nsurface from rendered multi-view evidence, rather than meshing raw sparse\npoints directly.\n\n## Frame Window Rule\n\nFrame extraction uses real decoded frames only. For a requested full video or\ntime window, the pipeline estimates the candidate frame count first. If the\ncandidate count exceeds `MAX_FRAMES`, it uniformly samples from those real\nframes so total input stays within the cap.\n\n```bash\nSTART_SEC=47 END_SEC=56 MAX_FRAMES=200 EXTRACT_EVERY=1 \\\nbash tools/run_video2mesh_quick.sh dataset/bedroom_4_CmEIg9gMI74/bedroom_4_Cm.mp4\n```\n\nIf COLMAP fails readiness because the segment has too little parallax or too\nfew registered poses, choose a different real time window and rerun. Do not\nfill gaps with interpolated frames.\n\nAfter a project already has valid COLMAP/GraphDECO outputs, resume a lighter\ndownstream pass with:\n\n```bash\nbash tools/run_video2mesh_downstream_light.sh exports/<run> dataset/<video>_best10.mp4\n```\n\nThis resume script still fuses object masks against the full scene point cloud,\nbut caps background-plane RANSAC sampling by default so recovery runs remain\ninteractive on 16M+ point clouds.\n\nRefresh demo/advisor reports and list showable files with:\n\n```bash\nbash tools/audit_showcase_artifacts.sh exports/<run>\n```\n\nWhen exporting semantic masks for large GraphDECO runs, avoid generating viewer\nPLYs inside `export-splat-masks` if the semantic source PLY is already large:\n\n```bash\npython -m video2mesh.cli export-splat-masks \\\n  --project-root exports/<run> \\\n  --splat-ply exports/<run>/scene/reconstruction/point_cloud.ply \\\n  --mask-source-ply exports/<run>/scene/reconstruction/point_cloud.ply \\\n  --transfer-mode index \\\n  --no-export-viewer-plys \\\n  --output exports/<run>/simulator_assets/semantic_point_cloud_full.ply\n\npython -m video2mesh.cli export-viewer-plys \\\n  --project-root exports/<run> \\\n  --splat-ply exports/<run>/simulator_assets/semantic_point_cloud_full.ply \\\n  --output-dir exports/<run>/simulator_assets/viewer_plys \\\n  --prefix semantic_3dgs \\\n  --include-labels\n```\n\n## Key Docs\n\n- `Video2Mesh_PROJECT_README.md`: project overview.\n- `VIDEO2MESH_PIPELINE.md`: current pipeline and commands.\n- `Video2Mesh_real_demo_runbook.md`: remote experiment runbook.\n- `REMOTE_SETUP_STATUS.md`: remote environment status.\n- `Video2Mesh_milscene3_showcase.md`: showcase asset checklist.\n- `SVLGaussian_frame_matching_notes.md`: frame selection algorithm notes.\n\nGenerated data, exports, checkpoints, videos, and model weights are intentionally ignored by Git.\n",
      "headings": [
        {
          "level": "2",
          "text": "Quick Start",
          "slug": "quick-start"
        },
        {
          "level": "2",
          "text": "Object Mesh Route",
          "slug": "object-mesh-route"
        },
        {
          "level": "2",
          "text": "Frame Window Rule",
          "slug": "frame-window-rule"
        },
        {
          "level": "2",
          "text": "Key Docs",
          "slug": "key-docs"
        }
      ],
      "reading_minutes": 2
    },
    {
      "id": "video2mesh-project-readme",
      "title": "Video2Mesh 项目说明",
      "category": "Pipeline",
      "summary": "更新时间：2026-06-20 Video2Mesh 的目标是把一段真实空间扫描视频转换为可展示、可分解、可进入仿真器的 3D 场景资产。 当前工程目标不是“单图生成一个好看的 mesh”，而是： 真实视频实验默认使用： - MASt3R-SLAM：从视频估计相机位姿、keyframes 和原始场景点云。",
      "source_path": "Video2Mesh_PROJECT_README.md",
      "source_kind": "builtin",
      "updated": "2026-06-26",
      "tags": [
        "Pipeline"
      ],
      "body": "# Video2Mesh 项目说明\n\n更新时间：2026-06-20\n\n## 1. 项目目标\n\nVideo2Mesh 的目标是把一段真实空间扫描视频转换为可展示、可分解、可进入仿真器的 3D 场景资产。\n\n当前工程目标不是“单图生成一个好看的 mesh”，而是：\n\n```text\n扫描视频\n  -> 相机位姿与场景点云\n  -> 场景级 3D Gaussian Splatting\n  -> 物体/背景结构级 3D semantic masks\n  -> 每个物体的相关帧与裁图\n  -> 每个物体 3DGS-derived mesh\n  -> MuJoCo / Unity / Isaac 可消费的资产包\n```\n\n## 2. 当前默认路线\n\n真实视频实验默认使用：\n\n- MASt3R-SLAM：从视频估计相机位姿、keyframes 和原始场景点云。\n- GraphDECO Gaussian Splatting：默认 3DGS trainer。\n- SAM v1 ViT-B：生成初始 object prompts。\n- SAM2.1 Hiera Tiny：做 video mask propagation。\n- Video2Mesh fusion：把 2D masks 通过相机投影融合成 3D masks，并回写到 Gaussian / viewer PLY。\n- SVLGaussian-style frame selection：采用 SVLGaussian 论文的 view-selection protocol（DOI `10.1049/cit2.70148`），为每个物体选择 anchor、5/10 frame offset、30-frame random-window 补充帧；这不是完整复现其 Flash3D/Qwen/SAM 单图 pipeline。\n- baseline mesh exporter：先从 3D mask cloud 得到可查看 OBJ，只用于 debug、尺度检查和 simulator 接口验证；这类 mesh 当前会明显碎片化，常见问题是 disconnected triangle islands、holes、floating sheets 和非 watertight。\n- production mesh route：从训练好的 3DGS 按真实相机位姿渲染多视角 depth/normal/mask，再做 TSDF fusion / Poisson / NeuS-style surface extraction，得到更接近真实几何的物体 mesh。\n- simulator exporter：导出 object pose、mesh、collider、physics stub、语义 ID 和仿真器 adapter。\n\n内置 minimal `train-gsplat` 只作为 smoke/debug fallback；真实实验默认使用 GraphDECO。\n\n## 3. 一键入口\n\n远端运行：\n\n```bash\ncd /root/autodl-tmp/workspace/Video2Mesh\nsource /etc/network_turbo >/dev/null 2>&1 || true\n\nbash tools/run_video2mesh_quick.sh /root/autodl-tmp/workspace/Video2Mesh/dataset/<video>.mp4\n```\n\n默认参数：\n\n```text\nGS_BACKEND=graphdeco\nGRAPHDECO_ROOT=/root/autodl-tmp/workspace/gaussian-splatting\nGRAPHDECO_ITERATIONS=7000\nGRAPHDECO_RESOLUTION=1\nGRAPHDECO_DENSIFY_UNTIL_ITER=0\nMASK_BACKEND=sam2\nMAX_FRAMES=72\nEXTRACT_EVERY=2\n```\n\nGraphDECO 默认使用 MASt3R full point cloud 初始化，但关闭 densification。这个设置是为了避免千万级初始化点云在 32GB 显存上继续扩点导致 OOM；它不是降采样策略。\n\n如果 MASt3R-SLAM 对长视频运行超过 1.5 小时仍未产出 `camera_info.json` 和 `point_cloud.ply`，当前实验策略是中断该次 MASt3R，把视频前 60 秒裁剪成新的 dataset 文件，例如：\n\n```text\ndataset/bedroom_100_first60.mp4\n```\n\n然后对该新数据集重新运行一键流程。\n\n如果 `*_first60.mp4` 的 MASt3R 仍超过 30 分钟，或 30 分钟内结束但 readiness 显示单 pose / 空点云，则继续裁剪更稳定的 10 秒片段作为新 dataset，例如 `dataset/bedroom_100_first60_best10.mp4`。这条规则用于避免把不可重建片段送入 GraphDECO 或语义融合。\n\n推荐使用仓库内的 OpenCV 裁剪工具生成该 fallback 数据集：\n\n```bash\npython tools/crop_best_video_window.py dataset/bedroom_100_first60.mp4 \\\n  --duration 10 \\\n  --output dataset/bedroom_100_first60_best10.mp4 \\\n  --force\n```\n\n当 MASt3R/GraphDECO 已经完成、只需要恢复下游资产阶段时，使用：\n\n```bash\nbash tools/run_video2mesh_downstream_light.sh \\\n  exports/<run> \\\n  dataset/bedroom_100_first60_best10.mp4\n```\n\n该入口默认跳过 Gaussian semantic backprojection，并只限制背景平面 RANSAC 采样；object 级 3D mask fusion 仍使用 full MASt3R point cloud。\n\n展示前可运行：\n\n```bash\nbash tools/audit_showcase_artifacts.sh exports/<run>\n```\n\n## 4. 不降采样约定\n\n高质量实验默认使用 MASt3R-SLAM 原始点云：\n\n```text\nscene/reconstruction/point_cloud.ply\n```\n\n它同时作为：\n\n- GraphDECO COLMAP `points3D.txt` 的来源。\n- 2D-to-3D mask fusion 的点索引源。\n- semantic splat transfer 的点索引源。\n- object mask cloud 和背景结构 mask 的点索引源。\n\n`point_cloud_10k.ply`、`point_cloud_30000.ply` 只用于轻量预览、人工检查或低资源 debug，不作为默认训练/分割输入。\n\n检查命令：\n\n```bash\npython -m video2mesh.cli audit-3dgs-init-point-cloud \\\n  --project-root exports/<run>\n```\n\n## 5. 关键输出\n\n每个 run 默认在：\n\n```text\nexports/<scene>_quick_<timestamp>/\n```\n\n核心产物：\n\n```text\nscene/cameras/camera_info.json\nscene/reconstruction/point_cloud.ply\nscene/reconstruction/3dgs_graphdeco/\nmasks/2d*/\nmasks/3d/object_masks.json\nobjects/<object_id>/selected_frames/\nobjects/<object_id>/object_images/\nsimulator_assets/viewer_plys/\nsimulator_assets/semantic_splats.ply\nsimulator_assets/simulator_asset_bundle.json\nsimulator_assets/adapters/\nsimulator_assets/review/index.html\n```\n\nViewer PLY 约定：\n\n| 文件 | 用途 |\n|---|---|\n| `*_point_cloud.ply` | 普通 XYZ/RGB 点云，Mac Preview、MeshLab、CloudCompare 可看。 |\n| `*_supersplat.ply` | GraphDECO/SuperSplat 字段 PLY，可上传到 SuperSplat。 |\n| `semantic_*` | 语义颜色或 `object_id/object_probability` 已写入的版本。 |\n\n## 6. 两个参考项目的角色\n\n`SceneVersepp`：\n\n- 不是任意扫描视频到 3DGS 的完整推理系统。\n- 主要提供 SVPP-style 数据格式、SpatialLM/PQ3D 的场景理解训练/评估接口。\n- Video2Mesh 复用它的数据组织方式：`mesh.ply`、`camera_info.json`、`metadata.json`、`data_info.json`。\n\n`image-blaster`：\n\n- 不是视频重建系统。\n- 主要提供单图/物体图到 mesh、world 目录和 Three.js viewer 的资产生成思路。\n- Video2Mesh 复用其 `worlds/<world>/output/<object>/` 资产约定，后续可接 Hunyuan/Meshy/FAL。\n\n## 7. 当前局限\n\n- GraphDECO 已接入为默认 trainer，但长视频重建质量仍受 MASt3R 位姿、帧选择、显存和训练时间影响。\n- SAM2.1 tiny 比 SAM v1 bbox tracking 更稳定，但对折叠椅、植物、透明/反光/细结构仍会过分割或漂移。\n- 物体语义名还需要开放词汇检测或 VLM 回流。\n- 当前物体 OBJ 多为 object mask cloud baseline，适合验证尺度和接口，不是最终仿真质量；它们会有碎片化、破洞、悬浮面片和非 watertight 问题。生产路线应升级为 3DGS 多视角渲染 depth/normal/mask 后的 TSDF fusion / Poisson / NeuS-style surface extraction，并配套 connected-component filtering、hole filling、simplification 和 watertight QA。\n- 背景结构仍以 floor/wall/ceiling 等 baseline 为主，door/window/cabinet 等需要更强 scene structure segmentation。\n- 仿真器资产仍需要真实尺度标定、碰撞体质量检查和物理属性测量。\n\n## 8. 文档入口\n\n- `README.md`：GitHub 首页。\n- `VIDEO2MESH_PIPELINE.md`：完整流程、命令和数据协议。\n- `Video2Mesh_real_demo_runbook.md`：远端实验运行手册。\n- `REMOTE_SETUP_STATUS.md`：远端环境、依赖、权重和 GraphDECO 状态。\n- `Video2Mesh_milscene3_showcase.md`：当前可展示产物清单。\n- `SVLGaussian_frame_matching_notes.md`：帧匹配/选帧算法说明。\n",
      "headings": [
        {
          "level": "2",
          "text": "1. 项目目标",
          "slug": "1.-项目目标"
        },
        {
          "level": "2",
          "text": "2. 当前默认路线",
          "slug": "2.-当前默认路线"
        },
        {
          "level": "2",
          "text": "3. 一键入口",
          "slug": "3.-一键入口"
        },
        {
          "level": "2",
          "text": "4. 不降采样约定",
          "slug": "4.-不降采样约定"
        },
        {
          "level": "2",
          "text": "5. 关键输出",
          "slug": "5.-关键输出"
        },
        {
          "level": "2",
          "text": "6. 两个参考项目的角色",
          "slug": "6.-两个参考项目的角色"
        },
        {
          "level": "2",
          "text": "7. 当前局限",
          "slug": "7.-当前局限"
        },
        {
          "level": "2",
          "text": "8. 文档入口",
          "slug": "8.-文档入口"
        }
      ],
      "reading_minutes": 2
    },
    {
      "id": "video2mesh-pipeline",
      "title": "Video2Mesh 当前流水线",
      "category": "Pipeline",
      "summary": "更新时间：2026-06-24 常用覆盖： 指定真实视频时间窗，例如 bedroom_4 的 47-56 秒： 该脚本默认： - 输出到 exports/_quick_。 - 使用 /root/autodl-tmp/venvs/v2m-svpp/bin/python。 - 对输入视频/时间窗均匀抽取真实帧，默认 MAX_FRAMES=200、EXTRACT_EVERY=1。如果预估帧数超过上限，会在真实候选帧中均匀取样，不插值。",
      "source_path": "VIDEO2MESH_PIPELINE.md",
      "source_kind": "builtin",
      "updated": "2026-06-26",
      "tags": [
        "Pipeline"
      ],
      "body": "# Video2Mesh 当前流水线\n\n更新时间：2026-06-24\n\n## 1. 总体流程\n\n```text\n输入视频\n  -> extract-frames (uniform dense real frames, <=200)\n  -> COLMAP\n  -> GraphDECO 3DGS\n  -> SAM prompt + SAM2 tracking\n  -> 2D-to-3D mask fusion\n  -> semantic/probability splat export\n  -> object frame selection\n  -> object images\n  -> object mesh (3DGS rendered depth/normal/mask -> fusion/extraction)\n  -> simulator assets\n  -> QA / readiness / showcase reports\n```\n\n## 2. 推荐一键命令\n\n```bash\ncd /root/autodl-tmp/workspace/Video2Mesh\nsource /etc/network_turbo >/dev/null 2>&1 || true\n\nbash tools/run_video2mesh_quick.sh /path/to/video.mp4\n```\n\n常用覆盖：\n\n```bash\nMAX_FRAMES=200 \\\nEXTRACT_EVERY=1 \\\nGRAPHDECO_ITERATIONS=30000 \\\nGRAPHDECO_SAVE_ITERATIONS=\"7000 30000\" \\\nGRAPHDECO_TEST_ITERATIONS=\"7000 30000\" \\\nGRAPHDECO_RESOLUTION=1 \\\nbash tools/run_video2mesh_quick.sh /path/to/video.mp4\n```\n\n指定真实视频时间窗，例如 `bedroom_4` 的 47-56 秒：\n\n```bash\nSTART_SEC=47 \\\nEND_SEC=56 \\\nMAX_FRAMES=200 \\\nEXTRACT_EVERY=1 \\\nbash tools/run_video2mesh_quick.sh dataset/bedroom_4_CmEIg9gMI74/bedroom_4_Cm.mp4\n```\n\n该脚本默认：\n\n- 输出到 `exports/<scene>_quick_<timestamp>`。\n- 使用 `/root/autodl-tmp/venvs/v2m-svpp/bin/python`。\n- 对输入视频/时间窗均匀抽取真实帧，默认 `MAX_FRAMES=200`、`EXTRACT_EVERY=1`。如果预估帧数超过上限，会在真实候选帧中均匀取样，不插值。\n- 用 COLMAP 生成 camera poses 和 full sparse `point_cloud.ply`。\n- 用 GraphDECO `train.py` 训练满血 3DGS：full COLMAP point cloud 初始化，30000 iter，保存/测试 7000 和 30000，开启 densification/pruning、opacity reset 和 SH appearance。\n- 用 SAM v1 自动生成 prompts。\n- 用 SAM2.1 Hiera Tiny 传播视频 masks。\n- 使用 full `point_cloud.ply` 做 mask fusion、semantic transfer 和 object mask clouds。\n- 导出 review pack、viewer PLY、simulator bundle 和 QA reports。\n\n## 3. COLMAP 默认重建\n\n默认重建入口是：\n\n```bash\npython -m video2mesh.cli run-colmap \\\n  --project-root exports/<run> \\\n  --frames-dir exports/<run>/scene/frames\n```\n\n`run-pipeline --run-colmap` 会在抽帧后自动执行该阶段，并把 COLMAP text model 导入为：\n\n```text\nscene/cameras/camera_info.json\nscene/reconstruction/point_cloud.ply\n```\n\n导入时只保留 COLMAP 成功注册位姿的真实帧，因此后续 3DGS、SAM2、mask fusion、preview 和 object frame selection 都使用同一个稠密帧目录，不使用 MASt3R keyframes。\n\n如果需要回退旧 MASt3R-SLAM 路径，显式设置：\n\n```bash\nRUN_COLMAP=0 RUN_MAST3R=1 bash tools/run_video2mesh_quick.sh /path/to/video.mp4\n```\n\n如果 COLMAP readiness 显示注册 pose 太少、空点云或帧-相机覆盖率不足，选择另一个真实时间窗重跑；不要用插值帧补齐输入。\n\n如果已有 project 已经完成 COLMAP/GraphDECO，只需要恢复下游 SAM2、3D mask、选帧、mesh 和 simulator 资产，使用轻量恢复入口：\n\n```bash\nbash tools/run_video2mesh_downstream_light.sh \\\n  exports/<run> \\\n  dataset/<video>.mp4\n```\n\n默认 `SEMANTIC_SPLATS=0`，即先产出 3D object masks、object meshes 和 simulator bundle，跳过最重的 Gaussian semantic backprojection。需要语义 splat 时再显式打开：\n\n```bash\nSEMANTIC_SPLATS=1 GAUSSIAN_BACKPROJECT=0 \\\nbash tools/run_video2mesh_downstream_light.sh exports/<run> dataset/<video>_best10.mp4\n```\n\n该脚本仍用 full scene point cloud 做 object mask fusion；为了避免背景结构 RANSAC 在千万级点云上压满机器，默认只对背景平面拟合采样：\n\n```text\nBACKGROUND_RANSAC_MAX_POINTS=200000\nBACKGROUND_FIT_MAX_POINTS=80000\n```\n\n导师展示前刷新并检查可展示产物：\n\n```bash\nbash tools/audit_showcase_artifacts.sh exports/<run>\n```\n\n重点看这些文件是否存在：\n\n```text\nsimulator_assets/review/index.html\nsimulator_assets/advisor_demo_summary.md\nsimulator_assets/showcase_pack_verification.json\nsimulator_assets/viewer_plys/scene_3dgs_supersplat.ply\nsimulator_assets/simulator_asset_bundle.json\nsimulator_assets/adapters/unity/unity_adapter.json\n```\n\n## 4. GraphDECO 3DGS\n\n远端 GraphDECO 路径：\n\n```text\n/root/autodl-tmp/workspace/gaussian-splatting\n```\n\n单独对已有 run 补跑：\n\n```bash\ncd /root/autodl-tmp/workspace/Video2Mesh\n\nITERATIONS=30000 SAVE_ITERATIONS=\"7000 30000\" TEST_ITERATIONS=\"7000 30000\" RESOLUTION=1 \\\nbash tools/run_graphdeco_3dgs.sh /root/autodl-tmp/workspace/Video2Mesh/exports/<run>\n```\n\n脚本会：\n\n1. 检查 `camera_info.json` 和 full `point_cloud.ply`。\n2. 拒绝 `point_cloud_10k.ply`、`point_cloud_30000.ply` 等下采样输入。\n3. 生成 COLMAP-style source。\n4. 调用 GraphDECO `train.py --disable_viewer`。\n5. 用 `import-3dgs-result` 注册结果并导出 viewer PLY / semantic preview。\n\n默认 GraphDECO 参数：\n\n```text\n--iterations 30000\n--save_iterations 7000 30000\n--test_iterations 7000 30000\n--sh_degree 3\n--densify_from_iter 500\n--densify_until_iter 15000\n--densification_interval 100\n--opacity_reset_interval 3000\n```\n\n这是默认生产训练档：不使用 `point_cloud_10k.ply` / `point_cloud_30000.ply`\n初始化，保留 full COLMAP/重建 point cloud，并启用 GraphDECO 的\ndensification/pruning、opacity reset 和 SH appearance。只有显式做 smoke\ntest 或显存调试时，才用环境变量覆盖为短训练或关闭 densification。\n\nGraphDECO 输出默认在：\n\n```text\nscene/reconstruction/3dgs_graphdeco/\n```\n\n进入 GraphDECO 或语义 mask fusion 前，`run-pipeline` 会写入：\n\n```text\nsimulator_assets/reconstruction_readiness_report.json\n```\n\n这个报告检查帧数、相机 pose、帧-相机覆盖率和 `scene/reconstruction/point_cloud.ply` 点数。默认门槛是至少 3 帧、2 个 pose、100 个点、80% camera coverage。若 COLMAP/重建阶段只得到单 pose 或空点云，pipeline 会在 3DGS 训练前失败，避免继续消耗训练时间。\n\n## 5. 点云和 PLY 约定\n\n| 文件 | 含义 |\n|---|---|\n| `scene/reconstruction/point_cloud.ply` | COLMAP/重建阶段原始全量点云，默认训练和语义源。 |\n| `scene/reconstruction/point_cloud_10k.ply` | 轻量预览点云，不作为默认训练/分割输入。 |\n| `simulator_assets/viewer_plys/*_point_cloud.ply` | 普通点云查看器友好版本。 |\n| `simulator_assets/viewer_plys/*_supersplat.ply` | SuperSplat/GraphDECO 字段版本。 |\n\nSuperSplat 需要 `f_dc_*`、`opacity`、`scale_*`、`rot_*` 等 Gaussian 字段。只有普通 XYZ/RGB 的 PLY 能被 Mac Preview 打开，但不能被 SuperSplat 当作 3DGS 加载。\n\n## 6. 2D 到 3D 语义 mask\n\n输入：\n\n```text\nmasks/2d/<object_id>/<frame>.png\nscene/cameras/camera_info.json\nscene/reconstruction/point_cloud.ply\n```\n\n核心步骤：\n\n```bash\npython -m video2mesh.cli fuse-masks \\\n  --project-root exports/<run> \\\n  --point-cloud exports/<run>/scene/reconstruction/point_cloud.ply \\\n  --fusion-mode probability \\\n  --min-votes 1\n\npython -m video2mesh.cli export-splat-masks \\\n  --project-root exports/<run> \\\n  --mask-source-ply exports/<run>/scene/reconstruction/point_cloud.ply \\\n  --transfer-mode nearest\n\npython -m video2mesh.cli backproject-gaussian-probabilities \\\n  --project-root exports/<run>\n```\n\n输出：\n\n```text\nmasks/3d/<object_id>/point_indices.json\nmasks/3d/<object_id>/point_probabilities.npz\nsimulator_assets/semantic_splats.ply\nsimulator_assets/semantic_gaussian_probabilities.ply\n```\n\n## 7. 选帧和物体 mesh\n\n默认选帧策略：\n\n```text\nanchor best visible frame\n  + frame offset 5\n  + frame offset 10\n  + random window 30\n  + masked crop diversity fallback\n```\n\n命令：\n\n```bash\npython -m video2mesh.cli select-frames \\\n  --project-root exports/<run> \\\n  --selection-method svlgaussian \\\n  --top-k 4\n\npython -m video2mesh.cli prepare-object-images \\\n  --project-root exports/<run> \\\n  --top-k 4 \\\n  --skip-missing\n```\n\n临时 baseline mesh：\n\n```bash\npython -m video2mesh.cli reconstruct-object-meshes \\\n  --project-root exports/<run> \\\n  --method bbox \\\n  --skip-failed\n```\n\n这一步只把 fused 3D mask cloud 先转成可查看的 OBJ，方便检查物体尺度、\n位置和 simulator 导出接口；它不是最终的 3DGS-to-mesh 技术路线。\n当前这类 mesh 明显会太碎：会出现大量 disconnected triangle islands、\nholes、floating sheets，很多对象不是 watertight。原因是直接从稀疏/不均匀\nmask cloud 做 surface reconstruction 时，点支持不足且噪声点会被连成片。\n因此它只能作为 debug/baseline，不能作为最终物体模型展示。\n\n生产 mesh 默认路线改为：\n\n```text\ntrained GraphDECO 3DGS\n  + object masks\n  + registered camera poses\n  -> render object-centric multi-view RGB/depth/normal/mask\n  -> TSDF fusion over masked depth/normal observations\n  -> marching cubes / Poisson surface extraction\n  -> optional NeuS-style SDF refinement\n  -> texture baking + mesh simplification + collider generation\n  -> simulator-ready OBJ/GLB\n```\n\n实现要求：\n\n- depth、normal、mask 来自真实相机位姿下的 3DGS 多视角渲染，不用插值帧。\n- TSDF fusion 是默认几何融合路径，Poisson 可作为 normal-oriented surface extraction fallback。\n- NeuS-style refinement 作为高质量后处理，用同一组真实视角和 mask 约束优化 SDF surface。\n- surface extraction 后需要做 connected-component filtering、hole filling、mesh simplification 和 watertight/fragment QA，避免再次输出碎片化 mesh。\n- 旧的 object-mask-cloud meshing 只保留为 debug/baseline，不作为生产质量结果。\n\n当前实现入口：\n\n```bash\npython -m video2mesh.cli export-3dgs-mesh-observations \\\n  --project-root exports/<run> \\\n  --max-frames-per-object 6 \\\n  --device cuda\n\npython -m video2mesh.cli reconstruct-3dgs-object-meshes \\\n  --project-root exports/<run> \\\n  --method auto \\\n  --format obj \\\n  --skip-failed\n\npython -m video2mesh.cli prepare-neus-surface-jobs \\\n  --project-root exports/<run> \\\n  --provider external_neus_sdf\n```\n\n第一步从 active 3DGS 和真实注册相机位姿渲染每个 object 的\n`rgb.png`、`depth.npy/png`、`normal.npy/png`、`mask.png`。第二步默认先尝试\nTSDF fusion；如果 TSDF 没有足够 masked depth，会回退到从这些 3DGS-rendered\ndepth observations 反投影点云，再用 Poisson surface extraction 出 mesh。\n第三步把同一批观测打包成 NeuS-style SDF optimization 的外部 backend 作业；\n仓库内不伪装实现神经 SDF 训练器，但会固定输入/输出合同，后续可接 NeuS/VolSDF/NeuS2\n等后端。\n\n## 8. 仿真器导出\n\n```bash\npython -m video2mesh.cli export-simulator-assets \\\n  --project-root exports/<run> \\\n  --simulator-format mujoco unity \\\n  --collision-proxy bbox \\\n  --use-collision-proxy \\\n  --collider box \\\n  --body-type dynamic\n```\n\n输出：\n\n```text\nsimulator_assets/simulator_asset_bundle.json\nsimulator_assets/adapters/mujoco/scene.xml\nsimulator_assets/adapters/unity/unity_adapter.json\nsimulator_assets/review/index.html\n```\n\n## 9. QA\n\n推荐每个 run 最后执行：\n\n```bash\npython -m video2mesh.cli evaluate \\\n  --project-root exports/<run> \\\n  --json \\\n  --output exports/<run>/simulator_assets/evaluation_report.json\n\npython -m video2mesh.cli validate \\\n  --project-root exports/<run>\n\npython -m video2mesh.cli production-readiness \\\n  --project-root exports/<run> \\\n  --no-require-scale-calibration\n\npython -m video2mesh.cli verify-showcase-pack \\\n  --project-root exports/<run> \\\n  --require-semantic-probability \\\n  --no-require-review-tar \\\n  --no-scan-common-remote-roots\n```\n\n关键检查：\n\n- `evaluate.ok == true`\n- `validate.ok == true`\n- `showcase_pack_verification.required_failed == []`\n- `3dgs_init_point_cloud_audit.full_point_cloud_contract_ready`\n- `production_ready == false` 仍可接受，因为当前系统是 demo-ready baseline，不是生产级系统。\n\n## 10. 生产升级方向\n\n下一步按优先级：\n\n1. GraphDECO 高质量训练稳定化：长迭代、合适分辨率、preview 指标、导入验证。\n2. SAM2 base/large 或 DEVA/XMem：减少椅子、花草等物体过分割。\n3. GroundingDINO / YOLO-World / OWL-ViT + VLM：给 object_id 生成可靠类别和描述。\n4. 3DGS-to-mesh：从 3DGS 多视角渲染 depth/normal/mask，再做 TSDF fusion / Poisson / NeuS-style surface extraction，替换 bbox/object-mask-cloud baseline mesh。\n5. 背景结构语义：floor、wall、ceiling、door、window、cabinet。\n6. 真实尺度标定、碰撞体简化、质量/摩擦/恢复系数估计。\n7. SceneVerse++ / PQ3D 数据桥接和评估。\n\n## 11. 实验检查点记录\n\n`bedroom_100` 当前结果：\n\n```text\ndataset/bedroom_100.mp4\n  -> MASt3R > 1.5h 无有效相机/点云\n  -> 中断\n  -> dataset/bedroom_100_first60.mp4\n  -> MASt3R 只得到 1 pose 和空 point_cloud.ply\n  -> GraphDECO 未开始训练\n  -> 裁剪最佳 10 秒片段 dataset/bedroom_100_first60_best10.mp4\n  -> MASt3R 恢复 161 poses 和 full point_cloud.ply\n  -> GraphDECO 真实训练应使用默认满血档：30000 iter，保存 7000/30000，开启 densification/pruning、opacity reset、SH appearance\n```\n\n该失败说明：裁剪前 60 秒并不保证可重建；如果视频开头缺乏足够视差、纹理或稳定运动，MASt3R 仍可能只输出单 pose/空点云。本次已按该诊断改用更合适的 10 秒片段继续 GraphDECO/SAM2 后半段。\n\n该 run 已可用 `reconstruction-readiness` 明确诊断：\n\n```text\nframes=1 poses=1 points=0\nok=False colmap=False 3dgs=False mask_fusion=False\n```\n",
      "headings": [
        {
          "level": "2",
          "text": "1. 总体流程",
          "slug": "1.-总体流程"
        },
        {
          "level": "2",
          "text": "2. 推荐一键命令",
          "slug": "2.-推荐一键命令"
        },
        {
          "level": "2",
          "text": "3. COLMAP 默认重建",
          "slug": "3.-colmap-默认重建"
        },
        {
          "level": "2",
          "text": "4. GraphDECO 3DGS",
          "slug": "4.-graphdeco-3dgs"
        },
        {
          "level": "2",
          "text": "5. 点云和 PLY 约定",
          "slug": "5.-点云和-ply-约定"
        },
        {
          "level": "2",
          "text": "6. 2D 到 3D 语义 mask",
          "slug": "6.-2d-到-3d-语义-mask"
        },
        {
          "level": "2",
          "text": "7. 选帧和物体 mesh",
          "slug": "7.-选帧和物体-mesh"
        },
        {
          "level": "2",
          "text": "8. 仿真器导出",
          "slug": "8.-仿真器导出"
        },
        {
          "level": "2",
          "text": "9. QA",
          "slug": "9.-qa"
        },
        {
          "level": "2",
          "text": "10. 生产升级方向",
          "slug": "10.-生产升级方向"
        },
        {
          "level": "2",
          "text": "11. 实验检查点记录",
          "slug": "11.-实验检查点记录"
        }
      ],
      "reading_minutes": 3
    },
    {
      "id": "scene-scanning-solutions-survey",
      "title": "场景扫描学术与工业方案调研：对 Video2Mesh 流水线的改进建议",
      "category": "Surveys",
      "summary": "调研日期：2026-06-28 面向项目：Video2Mesh 当前流水线 Video2Mesh 现在的路线是正确的：视频抽帧、COLMAP 位姿、3DGS 重建、GroundingDINO + SAM2 分割、2D mask 投回 3D、再切物体 mesh 和仿真资产。这条链路和近两年学术界/工业界的主流方向一致，不是“换一个大模型”就能解决，而是要把每个阶段的质量控制、跨视角一致性和资产化细节补强。",
      "source_path": "SCENE_SCANNING_SOLUTIONS_SURVEY.md",
      "source_kind": "builtin",
      "updated": "2026-06-28",
      "tags": [
        "Surveys"
      ],
      "body": "# 场景扫描学术与工业方案调研：对 Video2Mesh 流水线的改进建议\n\n调研日期：2026-06-28  \n面向项目：Video2Mesh 当前流水线\n\n## 0. 结论先行\n\nVideo2Mesh 现在的路线是正确的：视频抽帧、COLMAP 位姿、3DGS 重建、GroundingDINO + SAM2 分割、2D mask 投回 3D、再切物体 mesh 和仿真资产。这条链路和近两年学术界/工业界的主流方向一致，不是“换一个大模型”就能解决，而是要把每个阶段的质量控制、跨视角一致性和资产化细节补强。\n\n最值得优先做的提升有五类：\n\n1. **采集和抽帧 QA 前置**：工业产品做得好的地方不是算法更神秘，而是采集时就告诉用户哪里缺覆盖、哪里模糊、哪里视差不足。Video2Mesh 应增加 blur/overlap/parallax/registered-pose 预检和 smart keyframing。\n2. **COLMAP 失败时用学习式几何兜底**：COLMAP 对低纹理、少视差、运动模糊、动态物体敏感。可以把 DUSt3R/MASt3R/MegaSaM 类方法作为 pose/depth fallback 或候选时间窗评分器，而不是完全替代 COLMAP。\n3. **2D mask 到 3D 不只投票，要做一致性优化**：当前 vote/probability fusion 是基础版。可以参考 SAM3D、SA3D、Gaussian Grouping、SAGA、GaussianCut，把 2D mask 投影、跨帧关联、3D 图优化/连通性/边界细化合起来。\n4. **物体 mesh 不应从稀疏点云直接三角化**：工业可用 mesh 更接近 “多视角 RGB/depth/normal/mask 融合 -> TSDF/Poisson/marching cubes -> texture bake -> collider 简化”。GS2Mesh、SuGaR、2DGS 等方法都说明，3DGS 很适合渲染，但直接从原始 Gaussian 属性取表面会噪。\n5. **资产输出要从 debug 几何升级为产品化包**：Matterport、Apple RoomPlan、RealityScan 的共同点是输出结构明确：点云/mesh/材质/平面/房间结构/测量/标准格式。Video2Mesh 应把 `metadata.json`、object visibility、mesh quality、collider、mass/friction 估计和 Unity/Isaac/MuJoCo adapter 做成稳定契约。\n\n## 1. 当前 Video2Mesh 对标位置\n\n当前流水线可以拆成这些能力：\n\n| Video2Mesh 阶段 | 现有方案 | 外部对标 | 主要短板 |\n|---|---|---|---|\n| 视频采集/抽帧 | ffmpeg/OpenCV 均匀抽帧 | Polycam smart keyframing、RealityScan quality heatmap、Matterport scan guidance | 没有前置质量评分和用户反馈 |\n| 位姿/稀疏点云 | COLMAP SfM | COLMAP、DUSt3R、MASt3R、MegaSaM、RGB-D SLAM | 低纹理/少视差/动态视频会断 |\n| 场景表示 | GraphDECO 3DGS | 3DGS、2DGS、SuGaR、Gaussian Surfels | 外观好，几何表面不一定稳 |\n| 2D 检测/分割 | GroundingDINO + SAM2 | Grounded-SAM2、SAM3D、SA3D、OpenMask3D | 依赖 prompt 和单视角 mask 质量 |\n| 2D->3D 融合 | mask 投影 + vote/probability | Gaussian Grouping、SAGA、GaussianCut、FlashSplat | 缺少 3D 正则、边界细化、实例关联 |\n| 背景结构 | RANSAC plane fitting | RoomPlan、SpatialLM、Matterport floor/BIM | 只能拟合平面，缺少结构化 layout |\n| 单物体 mesh | Open3D alpha/ball/convex/bbox 等 | GS2Mesh、SuGaR、2DGS、TSDF fusion | debug 可用，仿真/展示质量不足 |\n| 仿真资产 | 自定义导出 | MatterPak、USD/USDZ、E57、RealityScan mesh/texture | 标准化、质量指标和 collider 还可增强 |\n\n## 2. 学术界怎么做\n\n### 2.1 位姿与重建：从经典 SfM 到学习式几何兜底\n\n**COLMAP** 仍是可靠基线。官方文档将其定位为通用 SfM + MVS 工具，支持有序/无序图像集合，并提供自动重建入口；GraphDECO 3DGS 也默认依赖 COLMAP sparse points 初始化。对 Video2Mesh 来说，COLMAP 的优势是成熟、可复现、输出标准，短板是对扫描视频质量很挑剔。\n\n可借鉴做法：\n\n- 保留 COLMAP 作为默认生产路径。\n- 在抽帧后立即输出 COLMAP readiness 之前的 **预估质量报告**：blur score、feature count、frame overlap、baseline/parallax、动态区域比例。\n- 把失败原因具体化：不是只说 “pose 少”，而是说“低纹理、强反光、视差不足、运动模糊、时间窗太短、过多动态前景”。\n\n代表资料：\n\n- [COLMAP documentation](https://colmap.github.io/)\n- [Structure-from-Motion Revisited](https://demuc.de/papers/schoenberger2016sfm.pdf)\n- [COLMAP GitHub](https://github.com/colmap/colmap)\n\n**DUSt3R / MASt3R / MASt3R-SLAM** 的价值在于：它们把相机位姿、匹配、深度估计的一部分问题转成学习式 pointmap / dense matching。DUSt3R 可以在未知内外参的图像集合上做 dense reconstruction；MASt3R 强化了跨视角匹配；MASt3R-SLAM 把这种 3D prior 做成实时 monocular dense SLAM。它们不一定替代 COLMAP，但很适合做：\n\n- COLMAP 失败时间窗的候选兜底。\n- 抽帧前的 scan quality scorer。\n- 对低纹理、宽基线、弱校准视频提供粗 pose/depth。\n- 给 3DGS 或 TSDF object mesh 提供额外 depth prior。\n\n代表资料：\n\n- [DUSt3R: Geometric 3D Vision Made Easy](https://arxiv.org/abs/2312.14132)\n- [MASt3R: Grounding Image Matching in 3D](https://arxiv.org/abs/2406.09756)\n- [MASt3R-SLAM](https://arxiv.org/abs/2412.12392)\n- [MegaSaM](https://arxiv.org/abs/2412.04463)\n\n**RGB-D/SLAM 系路线** 更偏工业可靠性。BundleFusion、NICE-SLAM、Open3D TSDF 都说明：一旦有深度，mesh 会稳定很多。Video2Mesh 当前是 RGB 视频，如果未来支持 iPhone LiDAR/ARKit/Depth Anything/MegaSaM depth，可以加一个 optional depth path：\n\n```text\nRGB video + optional depth/estimated depth + camera poses\n  -> masked depth rendering/fusion\n  -> TSDF volume per object\n  -> marching cubes / Poisson\n  -> texture bake + collider simplification\n```\n\n代表资料：\n\n- [BundleFusion](https://graphics.stanford.edu/projects/bundlefusion/)\n- [NICE-SLAM](https://pengsongyou.github.io/nice-slam)\n- [Open3D RGB-D integration / Scalable TSDF](https://www.open3d.org/docs/latest/tutorial/pipelines/rgbd_integration.html)\n- [BundleSDF](https://bundlesdf.github.io/)\n\n### 2.2 3DGS：外观强，几何要另补\n\nGraphDECO 3DGS 的核心优势是：从 SfM sparse points 初始化，把场景表示成可优化的 3D Gaussians，用实时 splatting 渲染获得高质量新视角。原始论文强调 sparse points 初始化、各向异性 Gaussian、density control 和 visibility-aware splatting，这与 Video2Mesh 当前 GraphDECO 路径一致。\n\n代表资料：\n\n- [3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079)\n- [GraphDECO official repo](https://github.com/graphdeco-inria/gaussian-splatting)\n\n但论文和工业实践都显示：3DGS 的视觉质量不等于 mesh 几何质量。Gaussians 是为 photometric rendering 优化的，表面可能漂浮、膨胀、半透明、断裂。因此外部方案通常会做几何增强：\n\n- **2DGS**：把 3D 体 Gaussian 变成 2D oriented disks，用 depth distortion 和 normal consistency 改善表面几何。\n- **SuGaR**：加入 surface-aligned regularization，再用 Poisson 提取 mesh，适合从 3DGS 取可编辑 mesh。\n- **Gaussian Surfels**：用 surfel-like 表示强化 surface alignment。\n- **GS2Mesh**：不直接读 Gaussian 表面，而是渲染 stereo novel views，用预训练 stereo model 估深，再多视角融合 mesh。\n\n对 Video2Mesh 的启发：\n\n- 保留 3DGS 作为可视化和 mask carrier。\n- 物体 mesh 走 “3DGS render RGB/depth/normal/mask -> TSDF/Poisson”。\n- 给 mesh 阶段增加 view selection：优先用物体 mask 面积大、视角互补、重投影一致、低模糊的帧。\n- 增加几何正则选项：2DGS/SuGaR/GS2Mesh-style 后处理，而不是只对 sparse object cloud 做 alpha shape。\n\n代表资料：\n\n- [2D Gaussian Splatting](https://arxiv.org/abs/2403.17888)\n- [SuGaR](https://arxiv.org/abs/2311.12775)\n- [GS2Mesh](https://arxiv.org/abs/2404.01810)\n- [Gaussian Surfels](https://arxiv.org/abs/2404.17774)\n\n### 2.3 开集检测与视频分割：GroundingDINO + SAM2 是合理组合\n\nGroundingDINO 的强项是 open-set / language-guided detection，可以用类别名或 referring expression 找 bbox。SAM2 的强项是 promptable image/video segmentation，使用 streaming memory 做视频目标传播。当前 Video2Mesh 用 GroundingDINO 找框、SAM2 跨帧传播 mask，是业界和开源 demo 里常见组合。\n\n代表资料：\n\n- [GroundingDINO](https://arxiv.org/abs/2303.05499)\n- [GroundingDINO GitHub](https://github.com/IDEA-Research/GroundingDINO)\n- [SAM2](https://arxiv.org/abs/2408.00714)\n- [SAM2 GitHub](https://github.com/facebookresearch/sam2)\n- [Grounded-SAM2](https://github.com/IDEA-Research/grounded-sam-2)\n\n可以提升的点：\n\n- prompt 不能只用单个 label。应维护 prompt set：`chair`, `wooden chair`, `dining chair`, `seat`, 中文/英文别名，合并候选框。\n- 对每个 object track 做 mask health check：面积突变、bbox 跳变、mask 断裂、出画、遮挡、和 3D 投影不一致。\n- 对 anchor frame 自动重选：如果第一帧 prompt 很弱，选择可见面积最大/锐度最高/视角最正的帧重新 prompt SAM2。\n- 用 3D projection 反向纠错：3D object mask 投回视频后，发现某帧 IoU 太低时重新跑 SAM2/局部 SAM。\n\n### 2.4 2D mask 到 3D：从投票融合升级为优化问题\n\nVideo2Mesh 当前的 2D->3D fusion 已经有正确骨架：相机投影 + 2D mask + 点/高斯概率累积。但学术界更进一步，会引入跨视角一致性、3D 连通性、语义特征和图优化。\n\n**SAM3D** 的思路是：对有 pose 的 RGB 图像跑 SAM，投到点云，再通过相邻帧双向 merging 逐步合成 3D mask。这和 Video2Mesh 的点云投票非常接近，但更强调 mask 合并顺序、双向一致和 over-segmentation 辅助。\n\n**SA3D** 的思路是：在 radiance field 中从一个视角 prompt 开始，通过密度引导 inverse rendering 得到 3D mask，再渲染到其他视角作为 self-prompt，形成跨视角闭环。\n\n**Gaussian Grouping / SAGA / GaussianCut** 直接把 segmentation 能力注入 3DGS：\n\n- Gaussian Grouping：给每个 Gaussian 加 identity encoding，用 SAM 2D masks 监督，并加 3D spatial consistency。\n- SAGA：给每个 Gaussian 学 affinity feature，支持 2D prompt 后毫秒级 3D Gaussian segmentation。\n- GaussianCut：把 Gaussians 建图，用 graph cut 结合用户输入、2D/video segmentation 和 scene properties 做前景/背景划分，不必重新训练。\n- FlashSplat / Unified-Lift / Lifting by Gaussians：强调把 2D mask 到 Gaussian label 的 lifting 做得更快、更全局一致。\n\n对 Video2Mesh 的落地路线：\n\n1. 短期：在已有 probability fusion 后加 3D 连通域、半径图平滑、平面/背景排除、visibility-weighted vote。\n2. 中期：把 Gaussians 建 kNN graph，对每个 object 做 GaussianCut-style graph refinement。\n3. 长期：训练/优化 semantic Gaussian attributes，让 object id / semantic id 成为 Gaussian 的一等属性，而不是只在导出 PLY 时附加。\n\n代表资料：\n\n- [SAM3D](https://arxiv.org/abs/2306.03908)\n- [SA3D: Segment Anything in 3D with NeRFs](https://proceedings.neurips.cc/paper_files/paper/2023/hash/525d24400247f884c3419b0b7b1c4829-Abstract-Conference.html)\n- [Gaussian Grouping](https://arxiv.org/abs/2312.00732)\n- [SAGA: Segment Any 3D Gaussians](https://arxiv.org/abs/2312.00860)\n- [GaussianCut](https://arxiv.org/abs/2411.07555)\n- [FlashSplat](https://arxiv.org/abs/2409.08270)\n\n### 2.5 开词表 3D 语义与场景图：别只切物体，要形成结构化场景\n\nVideo2Mesh 现在偏 “找到物体 -> 切物体 -> 导出资产”。如果想进一步提升场景理解和仿真可用性，需要把物体、平面、房间结构和关系组织起来。\n\n可参考方案：\n\n- **OpenMask3D**：先有 class-agnostic 3D instance masks，再用多视角 CLIP image features 给每个 3D mask 聚合开放词表语义。\n- **ConceptGraphs**：从 posed RGB-D 序列中做 2D instance segmentation，投影到 3D 点云，跨视角关联融合，形成 object-level 3D scene graph。\n- **LangSplat / Feature 3DGS / Semantic Gaussians / OpenGaussian**：把 2D foundation model 的语义特征蒸馏到 3DGS，让自然语言查询、语义分割和编辑在 3D 表示里完成。\n- **SpatialLM**：把点云转成结构化室内建模输出，包括墙、门、窗和 oriented object boxes。\n- **SceneVerse++**：把未标注互联网视频提升为 instance-level point clouds、object layouts、spatial VQA、导航等监督，说明 “自动数据引擎 + 多模块互补 + 质量筛选” 是未来方向。\n\n对 Video2Mesh 的启发：\n\n- 在 `metadata.json` 中把 object mask、semantic label、3D bbox、support plane、room/layout relation、source frames、confidence 统一记录。\n- 每个 object 生成视觉语言 caption 和 affordance：例如 `chair: sit-able, supported_by=floor, near=desk`。\n- 用 SpatialLM/规则几何为仿真提供结构先验：墙/地/天花板/门窗/柜体等不一定都要生成可动物体 mesh。\n- 对同一物体的多个文本标签做 CLIP/LLM 合并，减少 “chair/seat/stool” 重复实例。\n\n代表资料：\n\n- [OpenMask3D](https://arxiv.org/abs/2306.13631)\n- [ConceptGraphs](https://concept-graphs.github.io/)\n- [LangSplat](https://arxiv.org/abs/2312.16084)\n- [Feature 3DGS](https://arxiv.org/abs/2312.03203)\n- [Semantic Gaussians](https://semantic-gaussians.github.io/)\n- [OpenGaussian](https://proceedings.neurips.cc/paper_files/paper/2024/file/21f7b745f73ce0d1f9bcea7f40b1388e-Paper-Conference.pdf)\n- [SpatialLM](https://arxiv.org/abs/2506.07491)\n- [SceneVerse++](https://sv-pp.github.io/)\n\n## 3. 工业界怎么做\n\n### 3.1 Matterport：硬件 + 云端重建 + 标准资产包\n\nMatterport 的强项是产品闭环：采集设备、空间对齐、云端处理、数字孪生 viewer、测量、BIM/CAD 导出。Pro3 使用 LiDAR，官方资料强调室内外、较大空间、较高测量精度、E57/MatterPak/BIM 工作流。Cortex AI 则把计算机视觉、图像处理和深度学习用于自动生成空间数据和属性。\n\n可借鉴点：\n\n- 扫描引导比后处理更重要：明确告诉用户扫描间距、楼层、窗户、移动物体等风险。\n- 输出不是单一 mesh：MatterPak/E57 这样的包包含点云、图像、metadata，可进入第三方 CAD/BIM。\n- 把质量和用途绑定：营销展示、测量、BIM、设施管理对应不同精度和输出格式。\n\n对 Video2Mesh 的建议：\n\n- 增加 `scan_readiness_report.md/json`：记录有效帧、模糊帧、注册帧、点云密度、遮挡/动态风险。\n- 增加 `asset_bundle_manifest.json`：统一列出 scene splat、semantic splat、object mesh、collider、Unity/Isaac/MuJoCo adapter。\n- 输出 E57/PLY/GLB/USDZ 的兼容层，至少在 manifest 里明确每个资产的坐标系、单位、up axis。\n\n代表资料：\n\n- [Matterport Cortex AI](https://matterport.com/cortex-ai)\n- [Matterport Pro3 overview](https://support.matterport.com/s/article/Overview-of-Pro3?language=en_US)\n- [MatterPak bundle](https://support.matterport.com/s/article/Download-the-MatterPak-Bundle?language=en_US)\n- [Matterport E57 file](https://support.matterport.com/s/article/Overview-of-Matterport-E57-File?language=en_US)\n\n### 3.2 Apple RoomPlan / Object Capture：参数化结构和拍摄规范\n\nRoomPlan 不是通用 photorealistic 3DGS，而是面向室内结构化扫描：用 ARKit + camera + LiDAR 生成房间 floor plan，输出 USD/USDZ，包含墙、柜体、家具类别、尺寸和位置。Object Capture 则强调用多张照片生成物体 3D 模型，并给出拍摄对象选择和图像采集最佳实践。\n\n可借鉴点：\n\n- 房间结构用参数化表达，不一定用高密 mesh 表达。\n- 家具、墙、门窗、柜体等对象要有 dimensions 和 semantic type。\n- 采集阶段有 coaching UI，而不是等重建失败后才告诉用户。\n\n对 Video2Mesh 的建议：\n\n- 背景结构输出分两层：`layout.json` 记录墙/地/天花板/门窗/柜体参数，`scene.splat` 负责视觉展示。\n- 对室内仿真，优先让背景平面 watertight 和尺度正确，外观细节留给 3DGS。\n- 增加 ARKit/LiDAR 输入适配：如果用户有 iPhone LiDAR，直接把 depth/pose 作为可选增强信号。\n\n代表资料：\n\n- [Apple RoomPlan](https://developer.apple.com/augmented-reality/roomplan/)\n- [Apple Object Capture WWDC](https://developer.apple.com/videos/play/wwdc2021/10076/)\n- [Capturing photographs for RealityKit Object Capture](https://developer.apple.com/documentation/realitykit/capturing-photographs-for-realitykit-object-capture)\n\n### 3.3 Polycam：Photogrammetry 和 Gaussian Splat 分用途\n\nPolycam 明确区分两类输出：photogrammetry mesh 适合 3D printing、engineering、architecture、insurance documentation；Gaussian Splats 适合 photorealistic visualization、复杂材质、透明/反光对象和艺术展示。它也提供了上传图片/视频生成 photogrammetry 或 Gaussian splat 的流程，并强调 60-80% overlap、足够覆盖、steady footage、smart keyframing、过滤模糊或冗余帧。\n\n可借鉴点：\n\n- 不同目标采用不同表示：mesh 用于工程/仿真，splat 用于展示。\n- smart keyframing 是视频输入的关键产品功能。\n- 采集引导包括多高度环绕、均匀漫射光、避免动态主体、避免纯白低纹理表面。\n\n对 Video2Mesh 的建议：\n\n- 把抽帧从 “均匀抽帧” 升级为 “均匀覆盖 + blur filter + baseline diversity + object visibility”。\n- 保留 `MAX_FRAMES=200`，但从候选帧中选择更适合 COLMAP/3DGS/SAM2 的帧。\n- 给用户输出 capture tips：如果检测到低纹理/强反光/运动模糊，建议重拍方式。\n\n代表资料：\n\n- [Polycam Object Mode](https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode)\n- [Polycam upload images/videos](https://learn.poly.cam/hc/en-us/articles/30549121659412-How-to-Create-Photogrammetry-and-Gaussian-splats-from-Existing-Images-and-Videos)\n- [Polycam Gaussian Splatting tool](https://poly.cam/tools/gaussian-splatting)\n\n### 3.4 Scaniverse / Niantic：移动端 3DGS、mesh、SPZ 压缩和大规模空间数据\n\nScaniverse/Niantic Spatial 的亮点是把高保真扫描、Gaussian Splats、mesh 和开放格式 SPZ 做成移动端/企业级数据入口。官方企业页强调 iOS/Android、360 相机、无人机、多传感器输入，输出标准 3D 格式和开源 SPZ，SPZ 可减少文件体积。\n\n可借鉴点：\n\n- 3DGS 需要压缩和标准交换格式，不然很难进入产品链路。\n- 移动端 capture 的价值在于“快速 intake”，后端再做标准化清洗和资产发布。\n- mesh 与 splat 并存：mesh 做碰撞/测量/编辑，splat 做真实感查看。\n\n对 Video2Mesh 的建议：\n\n- 加 SPZ 或压缩 PLY 导出适配，至少提供 SuperSplat/PlayCanvas 友好版本。\n- asset bundle 同时输出 `scene.splat/spz` 和 `scene_collision.glb`。\n- 对每个 object 同时保存 `object_visual.splat` 和 `object_physics.glb`，不要强行让一个表示承担所有任务。\n\n代表资料：\n\n- [Niantic Spatial Capture](https://www.nianticspatial.com/products/capture)\n- [Scaniverse](https://dev.scaniverse.com/)\n- [Scaniverse Gaussian splatting announcement](https://medium.com/scaniverse/scaniverse-introduces-support-for-3d-gaussian-splatting-9f7f63f5469b)\n\n### 3.5 RealityScan / RealityCapture：AI mask、alignment、quality heatmap\n\nRealityScan 2.0 的新功能很贴近 Video2Mesh 的痛点：AI-assisted masking、alignment 改进、visual quality inspection、aerial LiDAR support。它强调在 meshing 前用 heatmap 找到覆盖不足区域，避免后期返工。\n\n可借鉴点：\n\n- AI mask 不只是为了语义，也可以用于重建前去背景、去动态干扰。\n- alignment failure 是产品级重点，需要默认参数和质量检查降低人工干预。\n- heatmap/coverage report 是扫描产品最有价值的反馈之一。\n\n对 Video2Mesh 的建议：\n\n- 在 COLMAP 前用 segmentation 去掉人、屏幕、水面、镜面、窗外强动态等干扰区域，至少可作为 feature mask。\n- 生成 object/scene coverage heatmap：每个表面/物体有多少视角支持、mask 是否一致。\n- 在 `advisor_demo_summary.md` 里加入 “为什么这个 mesh 不能展示/哪里缺视角” 的具体解释。\n\n代表资料：\n\n- [RealityScan 2.0 release](https://www.realityscan.com/news/realityscan-20-new-release-brings-powerful-new-features-to-a-rebranded-realitycapture)\n\n### 3.6 Luma AI：低门槛 scene capture 和在线交互展示\n\nLuma Interactive Scenes 把视频/图片输入转成可交互 3D 场景，重点是小文件、快速流式加载、嵌入网页和商业可用。它对 Video2Mesh 的启发不是算法细节，而是发布体验：产物要能一键预览、一键分享、一眼看懂质量。\n\n可借鉴点：\n\n- viewer 是资产质量评估的一部分，不只是展示。\n- 场景要能边加载边查看，资产体积要控制。\n- 每个导出资产应有快速可视化入口。\n\n代表资料：\n\n- [Luma Interactive Scenes](https://lumalabs.ai/interactive-scenes)\n\n## 4. 对 Video2Mesh 的具体改进方案\n\n### 4.1 采集/抽帧：加入 smart keyframing 和质量报告\n\n现状：均匀抽帧，真实帧上限 200。  \n问题：均匀不等于好；模糊、低视差、重复帧会拖累 COLMAP/3DGS/SAM2。\n\n建议实现：\n\n```text\nvideo\n  -> decode candidate frames\n  -> compute blur, exposure, feature count, optical flow, scene change\n  -> estimate baseline diversity and overlap\n  -> remove blurry/redundant frames\n  -> keep uniform temporal coverage\n  -> write frame_selection_report.json\n```\n\n核心指标：\n\n| 指标 | 用途 |\n|---|---|\n| Laplacian blur / motion blur | 过滤模糊帧 |\n| feature count / matchability | 预测 COLMAP 成功率 |\n| optical flow magnitude | 保证视差，不选几乎静止帧 |\n| frame overlap | 避免跨度太大导致匹配断 |\n| dynamic mask ratio | 剔除人/屏幕/运动物体占比高的帧 |\n| object visibility | 为每个物体选好 anchor 和 mesh source views |\n\n短期改动位置：\n\n- `extract-frames` 增加 `--selection-method smart_uniform`\n- 输出 `scene/frames/frame_quality.json`\n- `reconstruction_readiness_report.json` 加入抽帧质量统计\n\n### 4.2 COLMAP 兜底：增加 learned pose/depth fallback\n\n建议分三层，不要一开始重构主链路：\n\n1. **时间窗推荐器**：用 blur/flow/feature/match 评分，帮用户找更适合 COLMAP 的 8-15 秒窗口。\n2. **MASt3R/DUSt3R 辅助匹配**：当 SIFT matching 弱时，用学习式匹配补 candidate pairs。\n3. **MegaSaM/MASt3R-SLAM fallback**：COLMAP 注册率太低时输出 coarse pose/depth，供下游低质量预览或重拍建议使用。\n\n成功判据：\n\n- registered frame ratio 提升。\n- camera coverage 提升。\n- 3DGS train 不再因 sparse cloud 太弱直接失败。\n- 失败时能明确提示重拍，而不是下游生成一堆坏资产。\n\n### 4.3 分割：从单 prompt 跑通升级为 track QA\n\n建议为每个 object track 记录：\n\n```json\n{\n  \"object_id\": \"chair_01\",\n  \"prompts\": [\"chair\", \"wooden chair\", \"seat\"],\n  \"anchor_frame\": \"000084.png\",\n  \"track_health\": {\n    \"mean_mask_area\": 0.071,\n    \"area_jump_frames\": [],\n    \"lost_frames\": [\"000121.png\"],\n    \"projection_iou_mean\": 0.64,\n    \"needs_reprompt\": false\n  }\n}\n```\n\n改进策略：\n\n- 多 prompt 合并候选 bbox。\n- 从最高可见面积帧重新初始化 SAM2。\n- 传播后做 temporal smoothing。\n- 用 3D 重投影检查 bad frames，bad frames 局部重跑 SAM/SAM2。\n- 小物体增加 high-res crop segmentation，不只在整图上分。\n\n### 4.4 2D->3D 融合：visibility-weighted probability + graph refinement\n\n当前投票可以升级为：\n\n```text\nfor each point/gaussian g:\n  for each visible camera c:\n    project g -> pixel p\n    if p inside valid image and depth-consistent:\n      add vote weighted by:\n        mask probability\n        viewing angle\n        projected area\n        object visibility score\n        frame quality score\n        depth consistency\n```\n\n然后做后处理：\n\n- 3D kNN graph smoothing。\n- connected component filtering。\n- plane-aware background suppression。\n- object bbox prior。\n- GaussianCut-style foreground/background graph cut。\n- 多 object 冲突解算：同一个 Gaussian 不能高置信属于多个实例，除非是透明/薄结构特殊标记。\n\n输出建议：\n\n```text\nmasks/3d/<object_id>/\n  point_indices.json\n  gaussian_indices.json\n  probabilities.npz\n  fusion_report.json\n  projection_debug/\n```\n\n### 4.5 Semantic Gaussian：让语义成为 3DGS 属性\n\n短期不用训练新模型，也可以先加字段：\n\n```text\nsemantic_id\ninstance_id\nsemantic_prob\nobject_prob_topk\nvisibility_count\nsource_frame_count\n```\n\n中期参考 Gaussian Grouping / SAGA：\n\n- 给每个 Gaussian 增加 compact identity embedding。\n- 用 SAM2 masks + 当前 3D fusion 作为 pseudo-label。\n- 加 spatial consistency loss。\n- 支持 “点一下/输入文本 -> 返回 object Gaussian subset”。\n\n收益：\n\n- 物体编辑/删除/导出更稳定。\n- 同一物体跨帧 mask 不再只是后处理标签，而是训练/优化目标的一部分。\n- 后续 viewer 可以直接按语义开关显示。\n\n### 4.6 Object mesh：从 debug OBJ 升级为生产路线\n\n推荐生产路线：\n\n```text\ntrained 3DGS + object 3D mask + selected source/rendered views\n  -> render RGB/depth/normal/alpha/mask\n  -> filter views by visibility, sharpness, angle diversity\n  -> masked TSDF fusion\n  -> marching cubes / Poisson\n  -> mesh cleanup: connected component, hole fill, remesh, decimate\n  -> texture bake from selected RGB views\n  -> collider: bbox / convex decomposition / simplified proxy\n  -> export GLB/USD/OBJ + metadata\n```\n\n关键实现点：\n\n- 不从稀疏点云直接 alpha shape 作为最终 mesh。\n- 对每个 object 单独 TSDF volume，避免背景粘连。\n- 如果 3DGS depth 不可靠，尝试 GS2Mesh-style stereo depth 或 external monocular/depth model。\n- mesh 输出分 visual mesh 和 collision proxy。\n- 质量指标写入 `mesh_quality.json`：面数、连通分量、watertightness、bbox 尺寸、source view count、texture coverage。\n\n### 4.7 背景结构：从 RANSAC plane 到 layout\n\n当前 RANSAC plane fitting 可以继续保留，但建议升级为：\n\n```text\npoint cloud / Gaussian mask\n  -> dominant planes: floor, ceiling, walls\n  -> Manhattan alignment if indoor\n  -> openings: doors/windows if visible\n  -> support relation: object supported_by floor/table/shelf\n  -> layout.json\n```\n\n可以先用规则几何实现：\n\n- floor: lowest large horizontal plane\n- ceiling: highest large horizontal plane\n- walls: vertical large planes\n- object support: object bbox bottom center 到最近水平 plane\n\n后续可接 SpatialLM，把点云转成结构化 room layout 和 oriented object boxes。\n\n### 4.8 仿真资产：输出分层，而不是只导 mesh\n\n建议每个 object 输出：\n\n```text\nobjects/<object_id>/\n  visual.glb\n  collision.glb\n  object.splat.ply or object.spz\n  masks/\n  source_frames/\n  metadata.json\n  mesh_quality.json\n```\n\n`metadata.json` 建议字段：\n\n```json\n{\n  \"object_id\": \"chair_01\",\n  \"category\": \"chair\",\n  \"aliases\": [\"seat\", \"wooden chair\"],\n  \"bbox_world\": {\n    \"center\": [0, 0, 0],\n    \"size\": [0.5, 0.5, 0.9],\n    \"rotation_z\": 0.0\n  },\n  \"support\": {\n    \"type\": \"floor\",\n    \"plane_id\": \"floor_00\"\n  },\n  \"assets\": {\n    \"visual_mesh\": \"visual.glb\",\n    \"collision_proxy\": \"collision.glb\",\n    \"splat\": \"object.spz\"\n  },\n  \"physics\": {\n    \"mass_kg_estimate\": 5.0,\n    \"friction_estimate\": 0.6,\n    \"movable\": true\n  },\n  \"quality\": {\n    \"source_view_count\": 12,\n    \"mask_confidence\": 0.82,\n    \"mesh_status\": \"preview\"\n  }\n}\n```\n\n## 5. 分阶段路线图\n\n### 5.1 立刻可做：1-2 周\n\n| 优先级 | 改动 | 预期收益 |\n|---|---|---|\n| P0 | Smart keyframing：blur/filter/redundancy/feature count | COLMAP 和 3DGS 成功率提升 |\n| P0 | `frame_quality.json` + `scan_readiness_report` | 失败可解释，方便重拍 |\n| P0 | object track health report | 及时发现 SAM2 漂移/丢失 |\n| P1 | visibility-weighted mask fusion | 3D mask 少粘连、少噪声 |\n| P1 | connected component + plane-aware cleanup | 物体 mask 更干净 |\n| P1 | mesh_quality.json | 防止 debug mesh 被当最终资产展示 |\n\n### 5.2 中期增强：2-6 周\n\n| 优先级 | 改动 | 预期收益 |\n|---|---|---|\n| P1 | MASt3R/DUSt3R 辅助时间窗评分或 fallback | 少视差/弱纹理场景更稳 |\n| P1 | GaussianCut-style graph refinement | 3D object mask 边界更稳 |\n| P1 | 3DGS render depth/normal/mask -> object TSDF mesh | mesh 从 debug 升级到可展示 |\n| P2 | layout.json：墙/地/天花板/支撑关系 | 仿真资产更有结构 |\n| P2 | prompt ensemble + CLIP/LLM label merge | open-vocabulary 检测更少漏检/重复 |\n\n### 5.3 长期方向：1-3 个月\n\n| 优先级 | 改动 | 预期收益 |\n|---|---|---|\n| P2 | Semantic Gaussian identity embedding | 语义成为 3DGS 一等属性 |\n| P2 | ConceptGraphs-style object graph | 可做空间问答、任务规划、机器人仿真 |\n| P2 | SuGaR/2DGS/GS2Mesh 替代或补充 GraphDECO mesh path | 高质量 mesh 输出 |\n| P3 | ARKit/LiDAR optional depth input | iPhone/移动扫描显著更稳 |\n| P3 | SPZ/splat compression/export | 展示和分发更轻 |\n\n## 6. 建议增加的评测指标\n\n### 6.1 重建阶段\n\n| 指标 | 说明 |\n|---|---|\n| registered_frame_ratio | COLMAP 成功注册帧比例 |\n| mean_reprojection_error | SfM 几何质量 |\n| sparse_point_count / density | sparse cloud 是否足够 |\n| camera_coverage | 参与后续阶段的相机覆盖 |\n| train PSNR/SSIM/LPIPS | 3DGS 外观质量 |\n\n### 6.2 分割/语义阶段\n\n| 指标 | 说明 |\n|---|---|\n| mask_area_stability | SAM2 track 是否漂移 |\n| projection_iou | 3D mask 投回 2D 与原 mask 的一致性 |\n| visibility_count | 物体有多少可靠视角支持 |\n| object_conflict_ratio | 同一点/高斯被多个物体高置信占用比例 |\n| connected_components | 3D mask 是否碎裂 |\n\n### 6.3 mesh/仿真阶段\n\n| 指标 | 说明 |\n|---|---|\n| component_count | mesh 是否碎成很多块 |\n| watertightness / boundary_edges | 是否适合碰撞/仿真 |\n| texture_coverage | 贴图是否完整 |\n| collider_volume_ratio | collider 与 visual bbox 是否合理 |\n| support_plane_consistency | 物体是否漂浮/穿地 |\n| asset_manifest_completeness | Unity/Isaac/MuJoCo 导出是否完整 |\n\n## 7. 推荐的扫描规范\n\n给用户的短版拍摄建议：\n\n1. 每个房间/局部空间拍 8-20 秒，移动慢，不要快速转身。\n2. 先做一圈完整大范围，再补高/低视角。\n3. 保持 60-80% 画面重叠，避免连续帧几乎一样或跨度过大。\n4. 避免强反光、纯白墙面、透明玻璃、水面、强背光。\n5. 尽量关掉电视/屏幕，避免人和宠物进入画面。\n6. 重要物体至少让它在 8-12 个清晰视角中出现。\n7. 如果是要导出单物体 mesh，绕物体补一圈近景，比只扫房间整体更重要。\n\n系统内的自动提示应该对应这些规则，例如：\n\n```text\n该视频 COLMAP 风险较高：\n- 42% 帧运动模糊偏高\n- 关键物体 chair_01 只有 3 个可靠视角\n- 低纹理墙面占比高，建议增加斜向视角\n- 第 5-8 秒存在快速转身，建议截取 12-22 秒重跑\n```\n\n## 8. 推荐下一步实现清单\n\n最值得在当前代码库里先落的功能：\n\n1. `smart_uniform` 抽帧模式：质量评分 + 均匀覆盖。\n2. `frame_quality.json`：每帧 blur、feature、flow、selected_reason。\n3. `track_health.json`：每个 object 的 SAM2 mask 稳定性、lost frames、needs_reprompt。\n4. `fuse-masks` 增加 visibility/depth/frame-quality 权重。\n5. `cleanup-3d-mask`：连通域、kNN 平滑、平面背景剔除。\n6. `render-object-observations`：从 3DGS 渲染 object RGB/depth/normal/mask。\n7. `reconstruct-object-meshes --method tsdf_from_gs`：生产 mesh 路线。\n8. `mesh_quality.json` 和 “debug/preview/production” 资产状态。\n9. `layout.json`：floor/walls/ceiling/support relations。\n10. `asset_bundle_manifest.json`：稳定资产契约。\n\n## 9. 参考资料\n\n### 基础重建与位姿\n\n- COLMAP: <https://colmap.github.io/>\n- COLMAP GitHub: <https://github.com/colmap/colmap>\n- Structure-from-Motion Revisited: <https://demuc.de/papers/schoenberger2016sfm.pdf>\n- DUSt3R: <https://arxiv.org/abs/2312.14132>\n- MASt3R: <https://arxiv.org/abs/2406.09756>\n- MASt3R-SLAM: <https://arxiv.org/abs/2412.12392>\n- MegaSaM: <https://arxiv.org/abs/2412.04463>\n- BundleFusion: <https://graphics.stanford.edu/projects/bundlefusion/>\n- NICE-SLAM: <https://pengsongyou.github.io/nice-slam>\n- Open3D RGB-D integration: <https://www.open3d.org/docs/latest/tutorial/pipelines/rgbd_integration.html>\n- BundleSDF: <https://bundlesdf.github.io/>\n\n### 3DGS 与 mesh\n\n- 3D Gaussian Splatting: <https://arxiv.org/abs/2308.04079>\n- GraphDECO 3DGS: <https://github.com/graphdeco-inria/gaussian-splatting>\n- 2D Gaussian Splatting: <https://arxiv.org/abs/2403.17888>\n- SuGaR: <https://arxiv.org/abs/2311.12775>\n- GS2Mesh: <https://arxiv.org/abs/2404.01810>\n- Gaussian Surfels: <https://arxiv.org/abs/2404.17774>\n\n### 检测、分割与 2D-to-3D lifting\n\n- GroundingDINO: <https://arxiv.org/abs/2303.05499>\n- GroundingDINO GitHub: <https://github.com/IDEA-Research/GroundingDINO>\n- SAM2: <https://arxiv.org/abs/2408.00714>\n- SAM2 GitHub: <https://github.com/facebookresearch/sam2>\n- Grounded-SAM2: <https://github.com/IDEA-Research/grounded-sam-2>\n- SAM3D: <https://arxiv.org/abs/2306.03908>\n- SA3D: <https://proceedings.neurips.cc/paper_files/paper/2023/hash/525d24400247f884c3419b0b7b1c4829-Abstract-Conference.html>\n- Gaussian Grouping: <https://arxiv.org/abs/2312.00732>\n- SAGA: <https://arxiv.org/abs/2312.00860>\n- GaussianCut: <https://arxiv.org/abs/2411.07555>\n- FlashSplat: <https://arxiv.org/abs/2409.08270>\n\n### 开词表 3D 语义和场景理解\n\n- OpenMask3D: <https://arxiv.org/abs/2306.13631>\n- ConceptGraphs: <https://concept-graphs.github.io/>\n- LangSplat: <https://arxiv.org/abs/2312.16084>\n- Feature 3DGS: <https://arxiv.org/abs/2312.03203>\n- Semantic Gaussians: <https://semantic-gaussians.github.io/>\n- OpenGaussian: <https://proceedings.neurips.cc/paper_files/paper/2024/file/21f7b745f73ce0d1f9bcea7f40b1388e-Paper-Conference.pdf>\n- SpatialLM: <https://arxiv.org/abs/2506.07491>\n- SceneVerse++: <https://sv-pp.github.io/>\n\n### 工业产品和实践\n\n- Matterport Cortex AI: <https://matterport.com/cortex-ai>\n- Matterport Pro3 overview: <https://support.matterport.com/s/article/Overview-of-Pro3?language=en_US>\n- MatterPak bundle: <https://support.matterport.com/s/article/Download-the-MatterPak-Bundle?language=en_US>\n- Matterport E57: <https://support.matterport.com/s/article/Overview-of-Matterport-E57-File?language=en_US>\n- Apple RoomPlan: <https://developer.apple.com/augmented-reality/roomplan/>\n- Apple Object Capture: <https://developer.apple.com/videos/play/wwdc2021/10076/>\n- Apple Object Capture photo guidance: <https://developer.apple.com/documentation/realitykit/capturing-photographs-for-realitykit-object-capture>\n- Polycam Object Mode: <https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode>\n- Polycam image/video upload: <https://learn.poly.cam/hc/en-us/articles/30549121659412-How-to-Create-Photogrammetry-and-Gaussian-splats-from-Existing-Images-and-Videos>\n- Polycam Gaussian Splatting: <https://poly.cam/tools/gaussian-splatting>\n- Niantic Spatial Capture: <https://www.nianticspatial.com/products/capture>\n- Scaniverse: <https://dev.scaniverse.com/>\n- Scaniverse Gaussian splatting: <https://medium.com/scaniverse/scaniverse-introduces-support-for-3d-gaussian-splatting-9f7f63f5469b>\n- RealityScan 2.0: <https://www.realityscan.com/news/realityscan-20-new-release-brings-powerful-new-features-to-a-rebranded-realitycapture>\n- Luma Interactive Scenes: <https://lumalabs.ai/interactive-scenes>\n",
      "headings": [
        {
          "level": "2",
          "text": "0. 结论先行",
          "slug": "0.-结论先行"
        },
        {
          "level": "2",
          "text": "1. 当前 Video2Mesh 对标位置",
          "slug": "1.-当前-video2mesh-对标位置"
        },
        {
          "level": "2",
          "text": "2. 学术界怎么做",
          "slug": "2.-学术界怎么做"
        },
        {
          "level": "3",
          "text": "2.1 位姿与重建：从经典 SfM 到学习式几何兜底",
          "slug": "2.1-位姿与重建从经典-sfm-到学习式几何兜底"
        },
        {
          "level": "3",
          "text": "2.2 3DGS：外观强，几何要另补",
          "slug": "2.2-3dgs外观强几何要另补"
        },
        {
          "level": "3",
          "text": "2.3 开集检测与视频分割：GroundingDINO + SAM2 是合理组合",
          "slug": "2.3-开集检测与视频分割groundingdino--sam2-是合理组合"
        },
        {
          "level": "3",
          "text": "2.4 2D mask 到 3D：从投票融合升级为优化问题",
          "slug": "2.4-2d-mask-到-3d从投票融合升级为优化问题"
        },
        {
          "level": "3",
          "text": "2.5 开词表 3D 语义与场景图：别只切物体，要形成结构化场景",
          "slug": "2.5-开词表-3d-语义与场景图别只切物体要形成结构化场景"
        },
        {
          "level": "2",
          "text": "3. 工业界怎么做",
          "slug": "3.-工业界怎么做"
        },
        {
          "level": "3",
          "text": "3.1 Matterport：硬件 + 云端重建 + 标准资产包",
          "slug": "3.1-matterport硬件--云端重建--标准资产包"
        },
        {
          "level": "3",
          "text": "3.2 Apple RoomPlan / Object Capture：参数化结构和拍摄规范",
          "slug": "3.2-apple-roomplan-object-capture参数化结构和拍摄规范"
        },
        {
          "level": "3",
          "text": "3.3 Polycam：Photogrammetry 和 Gaussian Splat 分用途",
          "slug": "3.3-polycamphotogrammetry-和-gaussian-splat-分用途"
        },
        {
          "level": "3",
          "text": "3.4 Scaniverse / Niantic：移动端 3DGS、mesh、SPZ 压缩和大规模空间数据",
          "slug": "3.4-scaniverse-niantic移动端-3dgsmeshspz-压缩和大规模空间数据"
        },
        {
          "level": "3",
          "text": "3.5 RealityScan / RealityCapture：AI mask、alignment、quality heatmap",
          "slug": "3.5-realityscan-realitycaptureai-maskalignmentquality-heatmap"
        },
        {
          "level": "3",
          "text": "3.6 Luma AI：低门槛 scene capture 和在线交互展示",
          "slug": "3.6-luma-ai低门槛-scene-capture-和在线交互展示"
        },
        {
          "level": "2",
          "text": "4. 对 Video2Mesh 的具体改进方案",
          "slug": "4.-对-video2mesh-的具体改进方案"
        },
        {
          "level": "3",
          "text": "4.1 采集/抽帧：加入 smart keyframing 和质量报告",
          "slug": "4.1-采集-抽帧加入-smart-keyframing-和质量报告"
        },
        {
          "level": "3",
          "text": "4.2 COLMAP 兜底：增加 learned pose/depth fallback",
          "slug": "4.2-colmap-兜底增加-learned-pose-depth-fallback"
        },
        {
          "level": "3",
          "text": "4.3 分割：从单 prompt 跑通升级为 track QA",
          "slug": "4.3-分割从单-prompt-跑通升级为-track-qa"
        },
        {
          "level": "3",
          "text": "4.4 2D->3D 融合：visibility-weighted probability + graph refinement",
          "slug": "4.4-2d-3d-融合visibility-weighted-probability--graph-refinement"
        },
        {
          "level": "3",
          "text": "4.5 Semantic Gaussian：让语义成为 3DGS 属性",
          "slug": "4.5-semantic-gaussian让语义成为-3dgs-属性"
        },
        {
          "level": "3",
          "text": "4.6 Object mesh：从 debug OBJ 升级为生产路线",
          "slug": "4.6-object-mesh从-debug-obj-升级为生产路线"
        },
        {
          "level": "3",
          "text": "4.7 背景结构：从 RANSAC plane 到 layout",
          "slug": "4.7-背景结构从-ransac-plane-到-layout"
        },
        {
          "level": "3",
          "text": "4.8 仿真资产：输出分层，而不是只导 mesh",
          "slug": "4.8-仿真资产输出分层而不是只导-mesh"
        }
      ],
      "reading_minutes": 7
    },
    {
      "id": "feed-forward-gaussian-scene-graph-survey",
      "title": "前馈高斯与 Scene Graph 调研：对 Video2Mesh 的替代价值和落地路线",
      "category": "Surveys",
      "summary": "调研日期：2026-06-28 面向项目：Video2Mesh 问题：是否用 AnySplat、VGGT、VGGT-Omega 等前馈 3D/高斯模型替代当前 COLMAP + GraphDECO 3DGS；是否引入 scene graph。 不建议现在把 GraphDECO 3DGS 整体替换成前馈高斯模型。更稳的路线是：",
      "source_path": "FEED_FORWARD_GAUSSIAN_SCENE_GRAPH_SURVEY.md",
      "source_kind": "builtin",
      "updated": "2026-06-28",
      "tags": [
        "Scene Graph",
        "Surveys"
      ],
      "body": "# 前馈高斯与 Scene Graph 调研：对 Video2Mesh 的替代价值和落地路线\n\n调研日期：2026-06-28  \n面向项目：Video2Mesh  \n问题：是否用 AnySplat、VGGT、VGGT-Omega 等前馈 3D/高斯模型替代当前 COLMAP + GraphDECO 3DGS；是否引入 scene graph。\n\n## 0. 结论先行\n\n不建议现在把 GraphDECO 3DGS 整体替换成前馈高斯模型。更稳的路线是：\n\n```text\n短期：前馈几何模型做预检、兜底、快速预览\n中期：前馈模型输出 pose/depth/point map，作为 COLMAP/GraphDECO/mesh 的增强输入\n长期：保留优化式高质量 3DGS，同时引入 scene graph 作为语义和仿真的结构层\n```\n\n核心判断：\n\n1. **前馈高斯很有用，但先不要当最终资产源**。AnySplat、pixelSplat、MVSplat、Splatt3R、NoPoSplat 这类模型的强项是秒级或近实时生成可渲染 3DGS，尤其适合无位姿/稀疏视角/快速预览。但 Video2Mesh 的目标不只是 novel view synthesis，而是要输出物体 mask、mesh、碰撞体、物理属性和模拟器 adapter。前馈 splat 通常缺少稳定的 per-object identity、几何 QA、尺度校准和可仿真 mesh 约束。\n2. **VGGT/VGGT-Omega 比“前馈高斯替代 3DGS”更应该优先接入**。VGGT 直接预测 camera intrinsics/extrinsics、depth、point maps、point tracks；VGGT-Omega 又增强了静态/动态场景能力和长视频扩展性。这正好补 Video2Mesh 的 COLMAP 脆弱点：低纹理、少视差、模糊、动态物体、注册帧少。\n3. **GraphDECO 3DGS 仍适合作为生产级视觉表示**。GraphDECO 的优化式 3DGS 有成熟的 per-scene refinement、densification/pruning、SH appearance 和 viewer/export 生态。我们现在的 pipeline、QA 和 simulator asset contract 都围绕它建立。把它拿掉，短期会丢失很多稳定性和可解释中间产物。\n4. **Scene graph 应该加，而且应该作为资产层的主索引**。Video2Mesh 现在已经有 object masks、3D bbox、semantic_splats、SVPP metadata、simulator_asset_bundle。下一步不是只追求更漂亮的 splat，而是把 `object -> relation -> support plane -> room/layout -> simulator affordance` 串起来。\n5. **最值得做的 MVP**：新增一个 `feedforward-geometry` 后端，先接 VGGT 或 VGGT-Omega，输出 `camera_info.json`、dense depth/point cloud、confidence 和 preview；再新增 `scene_graph.json`，从已有 object metadata、3D bbox、background planes 和 labels 生成第一版结构图。\n\n## 1. 当前 Video2Mesh 的真实边界\n\n当前默认链路是：\n\n```text\nvideo\n  -> real-frame extraction\n  -> COLMAP poses + sparse/full point cloud\n  -> GraphDECO 3DGS\n  -> SAM prompts + SAM2 masks\n  -> 2D-to-3D semantic mask fusion\n  -> semantic/probability Gaussian export\n  -> object frame selection\n  -> object meshes\n  -> MuJoCo / Unity / Isaac asset export\n```\n\n这意味着 3DGS 在项目里有三种角色：\n\n| 角色 | 当前依赖 | 替代风险 |\n|---|---|---|\n| photorealistic scene viewer | GraphDECO 输出 PLY / SuperSplat 兼容 PLY | 前馈高斯可替代一部分 |\n| semantic carrier | `semantic_splats.ply`、`semantic_gaussian_probabilities.ply`、`object_id` / probability | 前馈高斯需要 object id 和概率映射接口 |\n| mesh/source evidence | 用相机、mask、depth/normal/semantic support 辅助物体 mesh | 单靠前馈 splat 不够，需要 depth/confidence/scale |\n\n所以“替代 3DGS”不能只问渲染效果，还要问这些输出是否稳定：\n\n- `scene/cameras/camera_info.json`\n- `scene/reconstruction/point_cloud.ply`\n- `scene/reconstruction/3dgs_graphdeco/**/point_cloud.ply`\n- `masks/3d/<object_id>/point_indices.json`\n- `simulator_assets/semantic_splats.ply`\n- `simulator_assets/semantic_gaussian_probabilities.ply`\n- `objects/<object_id>/object.json`\n- `simulator_assets/simulator_asset_bundle.json`\n- `simulator_assets/adapters/{unity,isaac,mujoco}/...`\n\n如果某个前馈模型只输出一个能看的 splat，但不能对齐这些 contract，它就只能是 preview backend，不能直接当生产 backend。\n\n## 2. 方法横向比较\n\n| 方法 | 输入 | 输出 | 强项 | 对 Video2Mesh 的价值 | 不适合直接替代的原因 |\n|---|---|---|---|---|---|\n| GraphDECO 3DGS | 已知/估计相机 + sparse points | per-scene optimized 3D Gaussians | 高质量 NVS、成熟生态、可控训练 | 继续做生产视觉层和 semantic splat carrier | 慢、依赖 COLMAP，几何表面不一定 mesh-ready |\n| pixelSplat | image pair | 3D Gaussians | 前馈、可编辑 radiance field、推理快 | 稀疏双视角快速预览参考 | 主要面向 NVS，不是扫描资产管线 |\n| MVSplat | sparse posed multi-view images | clean feed-forward Gaussians | cost volume 带来几何定位，速度快 | 可作为 sparse-view preview / depth prior | 通常需要相机或多视角条件，语义和资产 contract 要另做 |\n| Splatt3R | uncalibrated image pair | pose-free Gaussians | 基于 MASt3R，适合 in-the-wild 双图 | COLMAP 失败时的低成本 fallback | 双图/局部场景为主，长视频全局一致性仍需处理 |\n| NoPoSplat | unposed sparse multi-view | 3D Gaussians | 不依赖准确 pose，实时 | 适合无位姿 sparse scan 的 preview | canonical frame、尺度和跨物体语义需再对齐 |\n| AnySplat | uncalibrated image collection | 3D Gaussians + camera intrinsics/extrinsics | 一次前向预测 pose 和 splat，支持 sparse/dense views | 很适合做 `feedforward-gs-preview` 和 COLMAP fallback | 输出 splat 不等于 mesh/simulator asset；需要验证尺度、object labels、动态鲁棒性 |\n| VGGT | one/few/hundreds views | camera params、depth maps、point maps、point tracks | 秒级多任务 3D 几何，直接补 pose/depth | 最适合先接入，用作 pose/depth/point cloud fallback | 它不是 3DGS renderer，本身不输出最终 splat |\n| VGGT-Omega | images/video | camera + depth + confidence/point cloud style outputs | 更强静态/动态重建，长视频更可扩展 | 更适合 Video2Mesh 扫描视频，尤其动态/低纹理场景 | 模型权重可能 gated；license/算力/接口稳定性要评估 |\n\n## 3. 对关键模型的判断\n\n### 3.1 AnySplat：可以做前馈高斯预览，不宜直接替代生产 3DGS\n\nAnySplat 的亮点是从未标定多视角图像中一次前向预测 3D Gaussian primitives 和相机内外参。它正好命中我们现在最慢、最容易失败的部分：COLMAP + GraphDECO 的组合。\n\n可用场景：\n\n- 用户上传视频后，几秒到几十秒内给出 preview splat。\n- COLMAP readiness 失败时，生成粗 camera/scene 供用户判断是否值得重拍。\n- 给 SAM2 mask fusion 提供临时相机和粗点云。\n- 作为 GraphDECO 初始化候选：用 AnySplat/VGGT 预测 pose/depth，再转成 COLMAP-style source 或 point cloud。\n\n不建议直接替代的点：\n\n- Video2Mesh 需要 object-level stable id；AnySplat 主要解决 NVS 和几何/外观表示。\n- 前馈 splat 的 Gaussian 分布可能更偏渲染，不一定适合做 object mesh support。\n- 输出质量和尺度一致性需要按我们的真实房间视频测，不应只看论文 demo。\n\n### 3.2 VGGT：比前馈高斯更适合优先集成\n\nVGGT 的价值不是输出漂亮 splat，而是输出我们下游真正缺的几何中间量：\n\n- camera intrinsics/extrinsics\n- depth maps\n- point maps\n- 3D point tracks\n\n这几个输出可以直接接入 Video2Mesh：\n\n```text\nframes\n  -> VGGT\n  -> camera_info_vggt.json\n  -> depth_maps/*.npy or .exr\n  -> point_cloud_vggt.ply\n  -> confidence_maps/*.npy\n```\n\n然后有三条用法：\n\n1. **COLMAP fallback**：COLMAP pose 少或点云空时，用 VGGT 产物继续跑低质量预览和语义融合。\n2. **COLMAP scorer**：不替代 COLMAP，只用 VGGT 预估视差、重叠、深度稳定性，帮用户选 8-15 秒最佳窗口。\n3. **mesh evidence**：物体 mesh 阶段用 VGGT depth/confidence 做 TSDF/Poisson 输入，减少 raw sparse cloud 的破碎。\n\n### 3.3 VGGT-Omega：中长期最值得关注的扫描视频几何底座\n\nVGGT-Omega 相比 VGGT 更贴近我们的目标：它强调更大规模训练、更低训练内存、静态和动态场景能力、视频数据、自监督，以及 reconstruction latents 对 spatial understanding / language alignment 的帮助。\n\n对 Video2Mesh 的意义：\n\n- 可能比 MASt3R-SLAM 更适合短视频和动态室内扫描。\n- 可以将动态物体作为低置信区域或独立 track 处理，减少 COLMAP 被动态前景拖垮。\n- learned registers / latents 未来可作为 scene graph node feature 或 VLM/LLM grounding feature。\n\n风险：\n\n- 权重访问、license、模型版本和工程接口仍需实测。\n- 目前不应把它写死进默认生产路径；适合做 optional backend。\n- 需要专门评估 metric scale、长视频分块一致性、rolling shutter/blur、室内重复纹理。\n\n## 4. 推荐架构：不要“替代”，要“双轨”\n\n建议把 Video2Mesh 的重建层改成双轨：\n\n```text\n输入视频\n  -> frame QA / window selection\n  -> feed-forward geometry backend\n       - VGGT / VGGT-Omega\n       - optional AnySplat preview\n       - outputs: pose, depth, point cloud, confidence, preview splat\n  -> classical/optimized backend\n       - COLMAP\n       - GraphDECO 3DGS\n       - optional geometry-aware 3DGS cleanup\n  -> semantic fusion\n  -> object mesh\n  -> scene graph\n  -> simulator assets\n```\n\n这样能同时获得：\n\n- 前馈模型的速度和鲁棒先验。\n- COLMAP/GraphDECO 的可控 refinement 和成熟输出。\n- 下游语义、mesh、simulator contract 的连续性。\n\n## 5. Scene Graph：应该加在哪\n\nScene graph 不应该替代 3DGS/mesh。它应该是 Video2Mesh 的结构化索引层：\n\n```text\nscene_graph.json\n  nodes:\n    scene / room / floor / wall / object / background_structure\n  edges:\n    contains\n    supported_by\n    on / under / next_to / inside / attached_to\n    near\n    blocks / affords / movable / static\n  evidence:\n    3D bbox\n    point indices\n    semantic splat ids\n    source frames\n    mask confidence\n    mesh path\n    physics metadata\n```\n\n### 5.1 为什么需要 scene graph\n\n当前资产包已经能把物体导出到模拟器，但缺一个统一表达：\n\n- 床在地面上。\n- 枕头在床上。\n- 桌子靠墙。\n- 椅子在桌子旁边。\n- 墙、地、天花板是固定结构，不应该当可动物体 mesh。\n- 柜门/抽屉/椅子等物体具有不同 affordance。\n\n这些关系对下游很重要：\n\n- 物体摆放和碰撞初始化。\n- QA：物体 mesh 是否偏离自己的 support plane。\n- 仿真：可动/不可动、mass/friction/collider 默认值。\n- 语言查询：`find the chair near the desk`。\n- 场景补全：如果物体 mesh 缺失，可以用 scene graph 找合适的替代生成 prompt。\n\n### 5.2 代表方案\n\n| 方案 | 核心思路 | 对 Video2Mesh 的启发 |\n|---|---|---|\n| ConceptGraphs | 2D foundation model 输出经多视角关联融合为 open-vocabulary 3D scene graph | 可借鉴 object-level map + spatial relation，用于 planning/语言任务 |\n| Open3DSG | 从 point cloud 预测 open-vocabulary object classes 和 open-set relationships | 可借鉴关系预测，不只预测 `near/on` 这类固定关系 |\n| HOV-SG | floor/room/object 层级 open-vocabulary graph，用于机器人导航 | 对室内/多房间结构特别适合，能让 layout 成为一等节点 |\n| SceneGraphLoc | 用 object-level graph 做视觉定位，减少对大图像库依赖 | 可用于 scan resume、局部重定位、后续增量扫描 |\n| GaussianGraph | 在 3DGS 上做 semantic clustering 和 scene graph generation | 适合我们已有 semantic splat 的中期升级 |\n| SplatTalk | 用 generalizable 3DGS 生成 3D tokens，接 LLM 做 3D VQA | 可作为未来 QA/自然语言解释层，而不是第一版资产层 |\n\n### 5.3 第一版 schema 建议\n\n建议新增：\n\n```text\nsimulator_assets/scene_graph.json\n```\n\n最小结构：\n\n```json\n{\n  \"scene_id\": \"bedroom_4\",\n  \"coordinate_frame\": \"video2mesh_world\",\n  \"nodes\": [\n    {\n      \"id\": \"object:gdino_object_bed\",\n      \"type\": \"object\",\n      \"label\": \"bed\",\n      \"bbox_3d\": {\"center\": [0, 0, 0], \"extent\": [2, 1.5, 0.5]},\n      \"semantic_id\": 3,\n      \"point_count\": 120345,\n      \"mesh\": \"objects/gdino_object_bed/mesh.obj\",\n      \"source_frames\": [\"000010\", \"000034\"],\n      \"confidence\": 0.82\n    },\n    {\n      \"id\": \"structure:floor\",\n      \"type\": \"background_structure\",\n      \"label\": \"floor\",\n      \"plane\": {\"normal\": [0, 1, 0], \"offset\": 0.0},\n      \"static\": true\n    }\n  ],\n  \"edges\": [\n    {\n      \"source\": \"object:gdino_object_bed\",\n      \"target\": \"structure:floor\",\n      \"type\": \"supported_by\",\n      \"confidence\": 0.91,\n      \"evidence\": {\"bbox_bottom_distance\": 0.03}\n    }\n  ]\n}\n```\n\n第一版关系可以不用训练模型，直接用几何规则：\n\n- `contains`: scene/room contains object。\n- `supported_by`: object bbox bottom 接近 floor/table/bed top。\n- `on`: A 的底面高于 B 的顶面且 XY overlap 足够。\n- `next_to`: 3D bbox 水平距离小于阈值且高度重叠。\n- `attached_to`: object bbox 与 wall/ceiling 接近。\n- `static`: floor/wall/ceiling/large background structures。\n- `movable`: 小家具/小物体，后续由 label + size + mass 估计。\n\n## 6. 落地路线\n\n### 6.1 短期，一周内\n\n目标：不破坏现有生产管线，增加可试验接口。\n\n1. 写 `feedforward_geometry_manifest.json` contract：\n   - provider: `vggt`, `vggt_omega`, `anysplat`\n   - input frames\n   - camera output\n   - point cloud output\n   - depth/confidence output\n   - preview output\n   - scale/alignment status\n2. 新增 `prepare-feedforward-geometry-job`：\n   - 从 `scene/frames` 导出模型输入列表。\n   - 记录 frame ids 和原始尺寸。\n3. 新增 `import-feedforward-geometry-result`：\n   - 导入 `camera_info.json`\n   - 导入 `point_cloud.ply`\n   - 可选导入 `depth_maps`\n   - 写入 manifest artifact。\n4. 新增 `export-scene-graph`：\n   - 从 objects、masks、background planes、semantic manifest、simulator bundle 生成 `scene_graph.json`。\n\n短期不要做：\n\n- 不要把 AnySplat/VGGT-Omega 设为默认。\n- 不要删除 GraphDECO。\n- 不要让 scene graph 依赖 LLM 在线推理。\n\n### 6.2 中期，两到四周\n\n目标：让前馈几何真正增强质量。\n\n1. 用 VGGT/VGGT-Omega 结果做 COLMAP readiness 预估：\n   - depth consistency\n   - pose baseline\n   - frame overlap\n   - confidence heatmap\n2. 在 COLMAP 失败时启用 fallback：\n   - `scene/cameras/camera_info_vggt.json`\n   - `scene/reconstruction/point_cloud_vggt.ply`\n   - 后续 SAM2/mask fusion 使用 fallback geometry。\n3. 物体 mesh 阶段接入 depth/confidence：\n   - masked depth fusion\n   - confidence-weighted TSDF\n   - semantic support crop。\n4. scene graph 加 QA：\n   - floating object\n   - unsupported object\n   - duplicate object\n   - object mesh too large for bbox\n   - wall/floor/ceiling missing。\n\n### 6.3 长期\n\n目标：Video2Mesh 从“扫描到资产”升级为“扫描到可推理、可仿真的场景”。\n\n1. GaussianGraph / ConceptGraphs-style semantic graph：\n   - Gaussian/point/node features\n   - open-vocabulary labels\n   - relationship prediction\n2. VGGT-Omega registers/latents 做 node feature：\n   - object-level pooling\n   - language alignment\n   - affordance estimation\n3. 动态场景：\n   - dynamic foreground track\n   - static background graph\n   - movable object state graph。\n4. 增量扫描：\n   - SceneGraphLoc-style relocalization\n   - merge new scan into existing scene graph。\n\n## 7. 推荐实验\n\n选择 3 个已有视频窗口：\n\n| 场景 | 目的 |\n|---|---|\n| COLMAP 成功的 bedroom 窗口 | 比较 GraphDECO vs VGGT/AnySplat 的几何和渲染 |\n| COLMAP 注册少/失败的窗口 | 测前馈 geometry fallback 是否能继续下游 |\n| 动态/遮挡多的视频 | 测 VGGT-Omega 对动态场景是否更稳 |\n\n指标：\n\n- camera coverage / pose count\n- point cloud density\n- depth consistency\n- semantic mask fusion coverage\n- object bbox stability\n- mesh support quality\n- simulator QA pass rate\n- preview generation time\n- end-to-end wall time\n\n验收标准不是“splat 看起来更好”，而是：\n\n```text\n前馈模型加入后，至少一个失败视频能继续生成可检查的 semantic/object/simulator 资产；\n且成功视频的 GraphDECO 质量不下降，现有 artifacts contract 不破。\n```\n\n## 8. 我的建议排序\n\n优先级从高到低：\n\n1. **接 VGGT/VGGT-Omega 作为 feed-forward geometry fallback**。\n2. **新增 `scene_graph.json`，先用规则生成几何关系**。\n3. **接 AnySplat 作为 preview/alternative 3DGS backend，不替换 GraphDECO**。\n4. **把 VGGT depth/confidence 用到 object mesh 的 TSDF/Poisson 阶段**。\n5. **中期调研 GaussianGraph / ConceptGraphs，把 scene graph 从规则升级为 open-vocabulary graph**。\n\n一句话：  \n**前馈模型解决“快”和“失败兜底”，GraphDECO 解决“高质量可视化”，scene graph 解决“资产可理解、可仿真、可推理”。三者应互补，不要互相硬替代。**\n\n## 参考资料\n\n- [3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079)\n- [GraphDECO official gaussian-splatting repository](https://github.com/graphdeco-inria/gaussian-splatting)\n- [AnySplat: Feed-forward 3D Gaussian Splatting from Unconstrained Views](https://arxiv.org/abs/2505.23716)\n- [AnySplat project page](https://city-super.github.io/anysplat/)\n- [VGGT: Visual Geometry Grounded Transformer](https://arxiv.org/abs/2503.11651)\n- [VGGT project page](https://vgg-t.github.io/)\n- [VGGT GitHub](https://github.com/facebookresearch/vggt)\n- [VGGT-Omega](https://arxiv.org/abs/2605.15195)\n- [VGGT-Omega project page](https://vggt-omega.github.io/)\n- [VGGT-Omega GitHub](https://github.com/facebookresearch/vggt-omega)\n- [pixelSplat](https://arxiv.org/abs/2312.12337)\n- [MVSplat](https://arxiv.org/abs/2403.14627)\n- [Splatt3R](https://arxiv.org/abs/2408.13912)\n- [NoPoSplat](https://noposplat.github.io/)\n- [ConceptGraphs](https://arxiv.org/abs/2309.16650)\n- [Open3DSG](https://arxiv.org/abs/2402.12259)\n- [HOV-SG](https://arxiv.org/abs/2403.17846)\n- [SceneGraphLoc](https://arxiv.org/abs/2404.00469)\n- [GaussianGraph](https://arxiv.org/abs/2503.04034)\n- [SplatTalk](https://arxiv.org/abs/2503.06271)\n",
      "headings": [
        {
          "level": "2",
          "text": "0. 结论先行",
          "slug": "0.-结论先行"
        },
        {
          "level": "2",
          "text": "1. 当前 Video2Mesh 的真实边界",
          "slug": "1.-当前-video2mesh-的真实边界"
        },
        {
          "level": "2",
          "text": "2. 方法横向比较",
          "slug": "2.-方法横向比较"
        },
        {
          "level": "2",
          "text": "3. 对关键模型的判断",
          "slug": "3.-对关键模型的判断"
        },
        {
          "level": "3",
          "text": "3.1 AnySplat：可以做前馈高斯预览，不宜直接替代生产 3DGS",
          "slug": "3.1-anysplat可以做前馈高斯预览不宜直接替代生产-3dgs"
        },
        {
          "level": "3",
          "text": "3.2 VGGT：比前馈高斯更适合优先集成",
          "slug": "3.2-vggt比前馈高斯更适合优先集成"
        },
        {
          "level": "3",
          "text": "3.3 VGGT-Omega：中长期最值得关注的扫描视频几何底座",
          "slug": "3.3-vggt-omega中长期最值得关注的扫描视频几何底座"
        },
        {
          "level": "2",
          "text": "4. 推荐架构：不要“替代”，要“双轨”",
          "slug": "4.-推荐架构不要替代要双轨"
        },
        {
          "level": "2",
          "text": "5. Scene Graph：应该加在哪",
          "slug": "5.-scene-graph应该加在哪"
        },
        {
          "level": "3",
          "text": "5.1 为什么需要 scene graph",
          "slug": "5.1-为什么需要-scene-graph"
        },
        {
          "level": "3",
          "text": "5.2 代表方案",
          "slug": "5.2-代表方案"
        },
        {
          "level": "3",
          "text": "5.3 第一版 schema 建议",
          "slug": "5.3-第一版-schema-建议"
        },
        {
          "level": "2",
          "text": "6. 落地路线",
          "slug": "6.-落地路线"
        },
        {
          "level": "3",
          "text": "6.1 短期，一周内",
          "slug": "6.1-短期一周内"
        },
        {
          "level": "3",
          "text": "6.2 中期，两到四周",
          "slug": "6.2-中期两到四周"
        },
        {
          "level": "3",
          "text": "6.3 长期",
          "slug": "6.3-长期"
        },
        {
          "level": "2",
          "text": "7. 推荐实验",
          "slug": "7.-推荐实验"
        },
        {
          "level": "2",
          "text": "8. 我的建议排序",
          "slug": "8.-我的建议排序"
        },
        {
          "level": "2",
          "text": "参考资料",
          "slug": "参考资料"
        }
      ],
      "reading_minutes": 4
    },
    {
      "id": "interactive-game-scene-from-3dgs-survey",
      "title": "从 3DGS / 扫描点云到可交互游戏场景：业界工作流调研",
      "category": "Game Scenes",
      "summary": "调研日期：2026-06-28 面向项目：Video2Mesh 问题：游戏制作、虚拟制作和场景建模行业，如何把扫描得到的 3DGS / 点云变成可以交互的游戏场景。 业界通常不会把 3DGS 本体直接当作“游戏世界”。更常见、更可靠的做法是把扫描资产拆成多层： 一句话： 3DGS 负责“看起来像真实世界”，但游戏交互依赖 mesh、collider、navmesh、语义对象和引擎组件。",
      "source_path": "INTERACTIVE_GAME_SCENE_FROM_3DGS_SURVEY.md",
      "source_kind": "builtin",
      "updated": "2026-06-28",
      "tags": [
        "3DGS",
        "Game Scenes"
      ],
      "body": "# 从 3DGS / 扫描点云到可交互游戏场景：业界工作流调研\n\n调研日期：2026-06-28  \n面向项目：Video2Mesh  \n问题：游戏制作、虚拟制作和场景建模行业，如何把扫描得到的 3DGS / 点云变成可以交互的游戏场景。\n\n## 0. 结论先行\n\n业界通常不会把 3DGS 本体直接当作“游戏世界”。更常见、更可靠的做法是把扫描资产拆成多层：\n\n```text\n3DGS / scan / photogrammetry\n  -> visual layer: 高保真外观，用 splat / Nanite mesh / textured mesh 展示\n  -> collision layer: 低模碰撞代理，box / convex hull / simplified mesh\n  -> navigation layer: navmesh / walkable surface / off-mesh links\n  -> interaction layer: 可拾取、可推、可打开、可破坏的独立 actor/prefab\n  -> semantic layer: object ids, labels, affordances, scene graph, gameplay metadata\n  -> engine package: Unity / Unreal / Godot prefab、level、material、physics、scripts\n```\n\n一句话：  \n**3DGS 负责“看起来像真实世界”，但游戏交互依赖 mesh、collider、navmesh、语义对象和引擎组件。**\n\n对 Video2Mesh 的建议：\n\n1. 保留 scene-level 3DGS 作为背景视觉层。\n2. 把从 3DGS / 点云 / mask 得到的 object mesh 只当 visual mesh，不直接当 physics mesh。\n3. 每个对象额外生成 collision proxy：box、convex hull、capsule、简化 mesh。\n4. 从 floor / stairs / ramps / large planes 生成 navmesh source，而不是从全部 splat 生成导航。\n5. 用 `scene_graph.json` 或 `simulator_asset_bundle.json` 记录 object category、static/dynamic、support relation、interactable type。\n6. 导出 Unity/Unreal/Godot 时，不只是导出 `.ply/.obj/.glb`，而是导出 prefab/actor 级别的组件配置。\n\n## 1. 行业共识：视觉和物理是两套资产\n\n扫描场景进入游戏引擎后通常分成两条线：\n\n| 层 | 目标 | 常见资产 | 典型工具 |\n|---|---|---|---|\n| 视觉层 | 让场景看起来真实 | 3DGS、Nanite high-poly mesh、textured mesh、light probes、pano/HDRI | SuperSplat、Unreal Nanite、RealityCapture、Luma/Polycam/Scaniverse |\n| 几何层 | 让玩家/物体能碰撞 | simplified mesh、UCX collision、box/convex hull、heightfield | Blender、Houdini、Unreal Static Mesh collision、Unity MeshCollider |\n| 导航层 | 让角色/NPC 能走 | navmesh、walkable floor polygons、stairs/ramps links | Recast/NavMesh、Unity AI Navigation、Unreal Navigation System |\n| 交互层 | 让对象可操作 | prefabs/actors、rigidbody、trigger、socket、animation rig | Unity Prefab、Unreal Blueprint、Godot Scene |\n| 语义层 | 让系统知道“是什么” | labels、object ids、scene graph、affordance、physics metadata | DCC tagging、level design metadata、LLM/VLM 辅助标注 |\n\n这就是为什么 photogrammetry 和 3DGS demo 看起来很真实，但一进游戏项目就会被拆：\n\n- 高模 mesh / splat 可能非常重，不适合直接碰撞。\n- 扫描表面有洞、噪声、漂浮点和不闭合边界。\n- 游戏需要明确的可行走面、墙体阻挡、门窗、可动物体。\n- 交互对象需要 pivot、local frame、抓取点、质量、摩擦、脚本事件。\n- 引擎 runtime 更关心稳定、可调、可 LOD、可打包，而不是只看离线重建质量。\n\n## 2. 代表性工作流\n\n### 2.1 PlayCanvas / SuperSplat：直接把 3DGS 做成小游戏\n\nPlayCanvas 公开案例 “Turning a Gaussian Splat into a Videogame” 很接近这个问题：他们从 Polycam 扫描得到 Gaussian splat，再做成一个 FPS 风格可行走 demo。\n\n关键步骤不是“直接在 splat 上碰撞”，而是：\n\n1. 用 SuperSplat 编辑清理 splat。\n2. 基于 splat 生成碰撞 mesh。\n3. 把 splat 放到 PlayCanvas 里作为视觉层。\n4. 用碰撞 mesh 做物理阻挡。\n5. 用 Blender 补光照探针和场景代理。\n6. 添加角色控制器、拾取、射击、物体交互、NPC、NavMesh。\n\n这说明 3DGS 可以进入游戏，但它在游戏里主要是 environment rendering layer。真正让游戏跑起来的是：\n\n- collision mesh\n- character controller\n- navmesh\n- interactive entity\n- scripting\n- light/probe setup\n\nSuperSplat / SplatTransform 也已经往行业工具方向走：它们不只是看 splat，还在提供 collision generation、压缩格式、编辑和引擎集成能力。\n\n对 Video2Mesh 的启发：\n\n- `semantic_splats.ply` 可以成为视觉层。\n- `object_masks_3d` / `bbox_3d` / background planes 可以生成 collision layer。\n- `simulator_asset_bundle.json` 应扩展为 game-ready bundle，不只是 robotics simulator bundle。\n\n### 2.2 Unreal / RealityCapture / Nanite：扫描到高保真关卡\n\nUnreal 生态里，RealityCapture/RealityScan 常用于 photogrammetry asset pipeline。典型流程是：\n\n```text\nphotos / video frames / lidar\n  -> RealityCapture alignment\n  -> dense reconstruction\n  -> high-poly mesh\n  -> simplify / retopology\n  -> UV unwrap\n  -> texture bake\n  -> export FBX/OBJ/GLB/texture\n  -> Unreal import\n  -> Nanite for visual mesh\n  -> simple/complex collision setup\n  -> navmesh + gameplay actors\n```\n\nUnreal Nanite 可以让高面数静态视觉 mesh 进入实时场景，但它仍不等于游戏交互层。碰撞通常仍要单独处理：\n\n- 简单碰撞：box、sphere、capsule、convex hull、UCX meshes。\n- 复杂碰撞：使用 render mesh triangles，但昂贵，通常用于静态环境或查询，不适合所有动态物理。\n- Gameplay object：用 Blueprint/Actor 包住 mesh、collider、interaction logic。\n\n对扫描场景，Unreal 常见做法是：\n\n- 背景大环境：Nanite high-poly mesh 或 3DGS plugin 做视觉。\n- 地面/墙体：单独 simplified collision mesh。\n- 可交互物：从扫描中切出来，重新做低模、UV、pivot、碰撞体。\n- 导航：只用清理后的地面/楼梯/坡道生成 NavMesh。\n\n### 2.3 Unity：mesh/prefab/component 化\n\nUnity 工作流更强调 prefab 和 component：\n\n```text\nscan visual asset\n  -> import as mesh / splat renderer\n  -> create GameObject hierarchy\n  -> add MeshRenderer / SplatRenderer\n  -> add BoxCollider / MeshCollider / Convex Collider\n  -> add Rigidbody / CharacterController / NavMeshSurface\n  -> bake navmesh\n  -> add interaction scripts\n  -> package prefab / scene\n```\n\nUnity 里 MeshCollider 可以用 mesh，但动态刚体通常需要 convex collider；复杂扫描 mesh 直接作为动态碰撞会慢、不稳定，也经常不满足 convex 限制。所以行业做法仍然是：\n\n- 静态环境可以用 simplified MeshCollider 或多个 primitive colliders。\n- 动态物体尽量用 primitive / convex hull / compound colliders。\n- 角色行走依赖 NavMeshSurface 或 CharacterController，不依赖 splat。\n- 视觉 splat 和 physics collider 是两个 sibling objects 或 parent-child objects。\n\n这和 Video2Mesh 当前 `export-simulator-assets --collision-proxy bbox --collider box` 的方向一致，只是还需要更游戏化：\n\n- `interactable_type`\n- `prefab_role`\n- `navmesh_area`\n- `occluder`\n- `grab_points`\n- `door_hinge` / `drawer_slide`\n- `static_batching` / `lod_group`\n\n### 2.4 DCC/外包建模：扫描只是参考，不是最终资产\n\n在游戏/影视资产制作里，扫描常作为高保真参考或高模来源，最终还会经过 DCC：\n\n```text\nscan high-poly / splat\n  -> cleanup\n  -> retopology / decimation\n  -> UV unwrap\n  -> texture bake\n  -> material authoring\n  -> collision proxy\n  -> LODs\n  -> pivot/origin adjustment\n  -> naming and hierarchy\n  -> engine import\n```\n\n特别是可交互对象，通常不会直接用扫描 mesh：\n\n- 桌椅需要合理 pivot 和局部坐标。\n- 门需要 hinge axis。\n- 抽屉需要 slide axis。\n- 瓶子/杯子需要抓取点和稳定碰撞。\n- 可破坏物需要 fracture mesh 或替换 prefab。\n\n因此如果 Video2Mesh 目标是“交互游戏场景”，仅做 3DGS-to-mesh 不够，还要做 asset authoring metadata。\n\n## 3. 从 3DGS 到可交互场景的通用架构\n\n推荐把 Video2Mesh 的输出从“一个场景 splat + 若干 object mesh”升级为多层 game scene package：\n\n```text\nexports/<run>/game_scene/\n  visual/\n    scene.splat or scene.spz\n    scene_visual.glb\n    materials/\n    textures/\n  collision/\n    world_collision.glb\n    objects/<object_id>_collider.glb\n    navmesh_source.glb\n  navigation/\n    navmesh.json or engine-specific baked data\n    walkable_surfaces.json\n  objects/\n    <object_id>/\n      visual.glb\n      collider.glb\n      prefab.json\n      interaction.json\n  semantics/\n    scene_graph.json\n    labels.json\n    affordances.json\n  adapters/\n    unity/\n    unreal/\n    godot/\n```\n\n### 3.1 Visual Layer\n\n可选表达：\n\n- scene-level 3DGS / SPZ / PLY for photorealistic background。\n- high-poly static mesh for Nanite / static rendering。\n- object visual GLB for editable objects。\n- baked textures/materials。\n\nVideo2Mesh 对应：\n\n- `simulator_assets/semantic_splats.ply`\n- `simulator_assets/viewer_plys/*_supersplat.ply`\n- `objects/<object_id>/mesh_asset`\n- 未来的 `scene_visual.glb` / `scene.spz`\n\n### 3.2 Collision Layer\n\n碰撞层要比视觉层简单、闭合、稳定。\n\n常用策略：\n\n| 对象类型 | 推荐 collider | 原因 |\n|---|---|---|\n| 地面/墙/天花板 | simplified static mesh / boxes / planes | 静态、大、需要稳定阻挡 |\n| 桌椅柜等家具 | box / convex hull / compound colliders | 性能好，足够游戏交互 |\n| 小物体 | primitive colliders | 稳定、便宜 |\n| 楼梯/坡道 | ramp proxy + navmesh | 角色控制更稳定 |\n| 复杂不可动物体 | low-poly MeshCollider | 只做静态碰撞 |\n| 动态物体 | convex hull / primitive compound | 避免非凸三角网格刚体 |\n\nVideo2Mesh 已有：\n\n- `bbox_3d`\n- `collision_proxy`\n- `body_type`\n- `collider`\n- `mass_kg`\n- `material.friction/restitution`\n\n应增强：\n\n- oriented bbox，而不是只有 axis-aligned bbox。\n- convex decomposition。\n- per-object compound collider。\n- floor/wall/ceiling collision export。\n- collision QA：闭合、面数、是否过大、是否偏离视觉 mesh。\n\n### 3.3 Navigation Layer\n\n导航层不是从全部点云或全部 splat 直接生成，而是从 walkable surface 生成：\n\n- floor plane\n- ramps\n- stairs simplified proxy\n- obstacle volumes\n- no-walk zones\n\n推荐流程：\n\n```text\nbackground masks + plane fitting + object bboxes\n  -> classify floor / obstacle / wall\n  -> generate navmesh_source.glb\n  -> export Unity NavMeshSurface / Unreal Recast settings\n  -> engine bake navmesh\n```\n\n第一版可以先输出：\n\n```json\n{\n  \"walkable_surfaces\": [\n    {\"id\": \"floor_main\", \"source\": \"background_structure:floor\", \"slope\": 0.0}\n  ],\n  \"obstacles\": [\n    {\"object_id\": \"bed\", \"bbox\": \"...\"},\n    {\"object_id\": \"table\", \"bbox\": \"...\"}\n  ]\n}\n```\n\n### 3.4 Interaction Layer\n\n可交互性来自 object-level prefab/actor，而不是来自 splat：\n\n| 交互类型 | 需要的额外信息 |\n|---|---|\n| 拾取 | mass、grabbable、grab point、collider、local origin |\n| 推动 | rigidbody、friction、mass、stable collider |\n| 打开门 | hinge axis、closed/open angle、door frame relation |\n| 拉抽屉 | slide axis、limits、handle position |\n| 坐下 | seat surface、approach direction、height |\n| 遮挡/阻挡 | occluder mesh、static collider |\n| 触发区域 | trigger volume、event name |\n\n这就是 scene graph 和 affordance metadata 的价值。\n\n推荐 Video2Mesh 先做规则版：\n\n- category in `chair/sofa/bed`: add `sit_surface_candidate`\n- category in `door/cabinet`: add `hinge_candidate`\n- small movable object: add `grabbable_candidate`\n- large background structure: `static_environment`\n- floor: `walkable`\n\n### 3.5 Semantic / Scene Graph Layer\n\n游戏场景需要知道：\n\n- 哪些对象是静态背景。\n- 哪些对象可以移动。\n- 哪些对象在地面上。\n- 哪些对象依附于墙。\n- 哪些对象互相支撑。\n- 哪些对象可以被脚本引用。\n\n建议输出：\n\n```text\ngame_scene/semantics/scene_graph.json\n```\n\n核心节点：\n\n- scene\n- room\n- floor/wall/ceiling\n- object\n- interaction volume\n- nav area\n\n核心边：\n\n- contains\n- supported_by\n- attached_to\n- blocks\n- walkable_on\n- near\n- interactable_as\n\n## 4. 对 Video2Mesh 的落地改造建议\n\n### 4.1 新增 game-scene bundle\n\n在现有 `simulator_asset_bundle.json` 旁边新增：\n\n```text\nsimulator_assets/game_scene_bundle.json\n```\n\n最小字段：\n\n```json\n{\n  \"scene_id\": \"bedroom_4\",\n  \"visual_layer\": {\n    \"splat\": \"simulator_assets/semantic_splats.ply\",\n    \"preview\": \"simulator_assets/review/index.html\"\n  },\n  \"collision_layer\": {\n    \"world_collision\": \"simulator_assets/game/collision/world_collision.glb\",\n    \"object_colliders\": {}\n  },\n  \"navigation_layer\": {\n    \"navmesh_source\": \"simulator_assets/game/navigation/navmesh_source.glb\",\n    \"walkable_surfaces\": []\n  },\n  \"interaction_layer\": {\n    \"objects\": {}\n  },\n  \"semantic_layer\": {\n    \"scene_graph\": \"simulator_assets/game/semantics/scene_graph.json\"\n  },\n  \"adapters\": {\n    \"unity\": \"...\",\n    \"unreal\": \"...\",\n    \"godot\": \"...\"\n  }\n}\n```\n\n### 4.2 新增命令建议\n\n建议加 4 个命令：\n\n```bash\npython -m video2mesh.cli export-game-collision \\\n  --project-root exports/<run> \\\n  --output simulator_assets/game/collision\n\npython -m video2mesh.cli export-game-navigation \\\n  --project-root exports/<run> \\\n  --output simulator_assets/game/navigation\n\npython -m video2mesh.cli export-game-scene-graph \\\n  --project-root exports/<run> \\\n  --output simulator_assets/game/semantics/scene_graph.json\n\npython -m video2mesh.cli export-game-engine-adapter \\\n  --project-root exports/<run> \\\n  --format unity unreal godot\n```\n\n第一版实现可以很轻：\n\n- collision：用已有 bbox / background plane 生成 box colliders。\n- navigation：用 floor plane + object bbox obstacles 生成 navmesh source manifest。\n- scene graph：用 object labels + bbox + support relation 生成 JSON。\n- adapters：输出 Unity/Unreal/Godot import manifest，不急着生成完整项目。\n\n### 4.3 Unity adapter 应该输出什么\n\nUnity 方向建议输出：\n\n```text\ngame_scene/adapters/unity/\n  unity_game_scene_adapter.json\n  Assets/Video2MeshScene/\n    Visual/\n    Colliders/\n    Prefabs/\n    Materials/\n```\n\n每个对象：\n\n```json\n{\n  \"object_id\": \"chair_01\",\n  \"visual\": \"objects/chair_01/visual.glb\",\n  \"collider\": {\n    \"type\": \"compound_box\",\n    \"parts\": []\n  },\n  \"components\": [\n    \"MeshRenderer\",\n    \"BoxCollider\",\n    \"Rigidbody\",\n    \"V2MInteractable\"\n  ],\n  \"physics\": {\n    \"body_type\": \"dynamic\",\n    \"mass_kg\": 4.0,\n    \"friction\": 0.6\n  },\n  \"interaction\": {\n    \"grabbable\": true,\n    \"sit_surface\": false\n  }\n}\n```\n\n### 4.4 Unreal adapter 应该输出什么\n\nUnreal 方向建议输出：\n\n```text\ngame_scene/adapters/unreal/\n  unreal_game_scene_adapter.json\n  Content/Video2Mesh/\n```\n\n关键字段：\n\n- visual asset path\n- Nanite recommended true/false\n- simple collision mesh path\n- complex collision allowed true/false\n- actor class\n- mobility static/movable\n- tags\n- gameplay interface metadata\n\n对象策略：\n\n- 背景视觉层：Splat plugin actor 或 Nanite mesh actor。\n- 地面墙体：StaticMeshActor + simple collision。\n- 动态物体：Blueprint Actor + StaticMeshComponent + simple/convex collision + physics。\n- 语义对象：Actor tags / DataAsset。\n\n## 5. 推荐路线图\n\n### 5.1 短期\n\n目标：让扫描结果能进一个 game viewer 并且可走、可撞。\n\n1. 输出 `game_scene_bundle.json`。\n2. 从 floor/background planes 生成 world collision proxy。\n3. 从 object bbox 生成 object colliders。\n4. 从 floor plane 和 obstacle bbox 生成 navmesh source manifest。\n5. 在 image-blaster viewer 或 Unity adapter 里加载：\n   - splat visual\n   - collider mesh\n   - object visual meshes\n   - simple physics settings。\n\n### 5.2 中期\n\n目标：让物体可交互，而不是只有静态碰撞。\n\n1. 生成 oriented bbox 和 convex hull。\n2. 做 collision QA。\n3. 生成 scene graph + affordances。\n4. 给常见类别生成默认 interaction profile：\n   - chair/sofa/bed: sit target\n   - door/cabinet: hinge candidate\n   - bottle/cup/book: grabbable\n   - table/shelf: support surface\n5. Unity/Unreal adapter 生成 prefab/actor skeleton。\n\n### 5.3 长期\n\n目标：接近游戏资产生产线。\n\n1. 3DGS-to-mesh 生产质量：\n   - TSDF fusion\n   - Poisson / SDF refinement\n   - texture baking\n   - retopology\n   - LODs\n2. 自动生成 collision compound：\n   - convex decomposition\n   - stairs/ramp proxies\n   - occluder meshes\n3. 自动材质和光照：\n   - texture atlas\n   - PBR material estimation\n   - light probes / reflection probes\n4. 可编辑关卡：\n   - object hierarchy\n   - pivot/origin cleanup\n   - prefab variants\n   - gameplay tags\n5. 增量扫描：\n   - 新扫描更新 scene graph\n   - 保留手工编辑过的 collision/interaction metadata。\n\n## 6. 对我们项目的关键判断\n\nVideo2Mesh 当前方向是对的：它已经有 `semantic_splats`、object mask、object mesh、collision proxy、physics metadata、Unity/MuJoCo/Isaac adapter。缺的是把这些从“仿真资产导出”升级为“游戏场景生产包”：\n\n| 已有能力 | 还缺什么 |\n|---|---|\n| scene-level 3DGS / semantic splat | game visual layer packaging, SPZ/SOGS 等 runtime 格式 |\n| object masks / bbox | oriented bbox, support surface, relation graph |\n| object mesh baseline | production mesh, texture bake, LOD, pivot cleanup |\n| collision proxy bbox | convex/compound/static world collision |\n| physics metadata | interaction profiles, gameplay tags |\n| Unity adapter skeleton | prefab/actor/component-level adapter |\n| review HTML | interactive game viewer with collision/nav/debug overlays |\n\n最重要的改造不是“把 3DGS 转成一个大 mesh”，而是：\n\n```text\n把 3DGS 场景拆成 visual、collision、navigation、interaction、semantic 五层，\n然后按游戏引擎的 prefab / actor / component 模型导出。\n```\n\n这也是游戏行业真正把扫描场景变成可玩空间的方式。\n\n## 参考资料\n\n- [PlayCanvas: Turning a Gaussian Splat into a Videogame](https://blog.playcanvas.com/turning-a-gaussian-splat-into-a-videogame/)\n- [PlayCanvas SplatTransform Collision](https://developer.playcanvas.com/user-manual/splat-transform/collision/)\n- [SuperSplat](https://superspl.at/)\n- [Unreal Engine: Simple versus Complex Collision](https://dev.epicgames.com/documentation/unreal-engine/simple-versus-complex-collision-in-unreal-engine)\n- [Unreal Engine: Nanite Virtualized Geometry](https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite-virtualized-geometry-in-unreal-engine)\n- [RealityCapture export documentation](https://rshelp.capturingreality.com/en-US/tools/export.htm)\n- [Unity AI Navigation: NavMesh Surface](https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/manual/NavMeshSurface.html)\n- [Unity Mesh Collider documentation](https://docs.unity3d.com/Manual/class-MeshCollider.html)\n- [Scaniverse SPZ format](https://scaniverse.com/news/spz-gaussian-splat-open-source-file-format)\n- [Niantic Labs spz GitHub](https://github.com/nianticlabs/spz)\n",
      "headings": [
        {
          "level": "2",
          "text": "0. 结论先行",
          "slug": "0.-结论先行"
        },
        {
          "level": "2",
          "text": "1. 行业共识：视觉和物理是两套资产",
          "slug": "1.-行业共识视觉和物理是两套资产"
        },
        {
          "level": "2",
          "text": "2. 代表性工作流",
          "slug": "2.-代表性工作流"
        },
        {
          "level": "3",
          "text": "2.1 PlayCanvas / SuperSplat：直接把 3DGS 做成小游戏",
          "slug": "2.1-playcanvas-supersplat直接把-3dgs-做成小游戏"
        },
        {
          "level": "3",
          "text": "2.2 Unreal / RealityCapture / Nanite：扫描到高保真关卡",
          "slug": "2.2-unreal-realitycapture-nanite扫描到高保真关卡"
        },
        {
          "level": "3",
          "text": "2.3 Unity：mesh/prefab/component 化",
          "slug": "2.3-unitymesh-prefab-component-化"
        },
        {
          "level": "3",
          "text": "2.4 DCC/外包建模：扫描只是参考，不是最终资产",
          "slug": "2.4-dcc-外包建模扫描只是参考不是最终资产"
        },
        {
          "level": "2",
          "text": "3. 从 3DGS 到可交互场景的通用架构",
          "slug": "3.-从-3dgs-到可交互场景的通用架构"
        },
        {
          "level": "3",
          "text": "3.1 Visual Layer",
          "slug": "3.1-visual-layer"
        },
        {
          "level": "3",
          "text": "3.2 Collision Layer",
          "slug": "3.2-collision-layer"
        },
        {
          "level": "3",
          "text": "3.3 Navigation Layer",
          "slug": "3.3-navigation-layer"
        },
        {
          "level": "3",
          "text": "3.4 Interaction Layer",
          "slug": "3.4-interaction-layer"
        },
        {
          "level": "3",
          "text": "3.5 Semantic / Scene Graph Layer",
          "slug": "3.5-semantic-scene-graph-layer"
        },
        {
          "level": "2",
          "text": "4. 对 Video2Mesh 的落地改造建议",
          "slug": "4.-对-video2mesh-的落地改造建议"
        },
        {
          "level": "3",
          "text": "4.1 新增 game-scene bundle",
          "slug": "4.1-新增-game-scene-bundle"
        },
        {
          "level": "3",
          "text": "4.2 新增命令建议",
          "slug": "4.2-新增命令建议"
        },
        {
          "level": "3",
          "text": "4.3 Unity adapter 应该输出什么",
          "slug": "4.3-unity-adapter-应该输出什么"
        },
        {
          "level": "3",
          "text": "4.4 Unreal adapter 应该输出什么",
          "slug": "4.4-unreal-adapter-应该输出什么"
        },
        {
          "level": "2",
          "text": "5. 推荐路线图",
          "slug": "5.-推荐路线图"
        },
        {
          "level": "3",
          "text": "5.1 短期",
          "slug": "5.1-短期"
        },
        {
          "level": "3",
          "text": "5.2 中期",
          "slug": "5.2-中期"
        },
        {
          "level": "3",
          "text": "5.3 长期",
          "slug": "5.3-长期"
        },
        {
          "level": "2",
          "text": "6. 对我们项目的关键判断",
          "slug": "6.-对我们项目的关键判断"
        },
        {
          "level": "2",
          "text": "参考资料",
          "slug": "参考资料"
        }
      ],
      "reading_minutes": 4
    },
    {
      "id": "video2mesh-technical-survey-draft",
      "title": "Video2Mesh 技术调研草案：从空间扫描视频到语义 3DGS 与可仿真物体 Mesh",
      "category": "Surveys",
      "summary": "我们希望构建的系统不是“从单张图片生成一个看起来合理的 3D 场景”，而是从真实空间扫描视频中恢复一个可分析、可拆分、可导入仿真器的三维场景资产。理想输入是一段围绕室内或局部空间拍摄的扫描视频；理想输出包括场景级 3D Gaussian Splatting、每个物体的 3D 语义/实例 mask、每个物体对应的高质量相关帧，以及每个物体独立的 mesh 资产。",
      "source_path": "Video2Mesh_technical_survey_draft.md",
      "source_kind": "builtin",
      "updated": "2026-06-26",
      "tags": [
        "3DGS",
        "Surveys"
      ],
      "body": "# Video2Mesh 技术调研草案：从空间扫描视频到语义 3DGS 与可仿真物体 Mesh\n\n## 1. 背景与任务目标\n\n我们希望构建的系统不是“从单张图片生成一个看起来合理的 3D 场景”，而是从真实空间扫描视频中恢复一个可分析、可拆分、可导入仿真器的三维场景资产。理想输入是一段围绕室内或局部空间拍摄的扫描视频；理想输出包括场景级 3D Gaussian Splatting、每个物体的 3D 语义/实例 mask、每个物体对应的高质量相关帧，以及每个物体独立的 mesh 资产。\n\n更具体地说，目标系统应该完成以下链路：\n\n```text\n空间扫描视频\n  -> 抽帧、相机位姿估计、稀疏/稠密重建\n  -> 场景级 3DGS\n  -> 帧级 2D detection / segmentation / tracking\n  -> 2D mask 跨帧关联并融合到 3D\n  -> 物体级 3D 语义/实例 mask\n  -> 每个物体自动选择相关帧\n  -> 每个物体 mesh 重建\n  -> 仿真器可用资产包\n```\n\n最终产物不应该只是视觉展示，而应该具备明确的几何、语义和资产组织结构。例如：\n\n- `scene.splat` 或 `.spz`：场景级 3DGS，用于快速可视化和沉浸式浏览。\n- `objects/<object_id>/mask_3d.*`：每个物体在 3DGS、点云或 mesh 顶点空间里的 mask。\n- `objects/<object_id>/frames.json`：该物体相关帧列表，包含可见面积、遮挡程度、视角评分和对应 2D mask。\n- `objects/<object_id>/mesh.glb`：可导入仿真器的单物体 mesh。\n- `objects/<object_id>/metadata.json`：类别、语义名称、尺度、姿态、坐标系变换、碰撞体、材质和来源帧。\n- `scene_manifest.json`：场景级索引，描述坐标系、单位、相机轨迹、物体列表和资产路径。\n\n这类系统与单图 3D 生成的关键区别在于：它必须尊重输入视频的真实空间结构，保持物体之间的相对位置、尺度和可见性；并且需要将“场景重建”和“物体资产生成”连接起来。\n\n## 2. 两个参考项目总览\n\n当前工作区中有两个相关项目：\n\n- `SceneVersepp`\n- `image-blaster`\n\n它们都与目标任务有关，但覆盖的是不同层面。\n\n`SceneVersepp` 是研究型 3D 场景理解项目，主题是把互联网级未标注视频提升成 3D 场景理解监督信号。它关注的是 3D object detection、3D instance segmentation、layout、视觉语言问答和导航等任务。对 Video2Mesh 来说，它最有价值的地方是提供了一个“视频/重建场景如何组织成 3D supervision”的参考框架。\n\n`image-blaster` 是生成式资产流水线，目标是从单张图片快速创建 3D 环境、物体 mesh 和音效。它通过 World Labs Marble 生成静态环境 splat，通过 FAL 上的 Hunyuan 3D 或 Meshy 生成单物体 mesh，并提供 React/Three.js viewer 查看资产。对 Video2Mesh 来说，它最有价值的地方是单图物体 mesh 生成、资产目录组织和 viewer。\n\n需要特别强调：这两个项目不是天然上下游。`SceneVersepp` 并不会直接输出 `image-blaster` 所需的物体参考图；`image-blaster` 也不会处理视频相机位姿、跨帧 mask、3DGS 训练或 3D semantic mask。它们分别覆盖了“3D 场景理解”和“单图资产生成”的两端，中间还需要设计并实现桥接模块。\n\n## 3. SceneVerse++ 详细理解\n\n### 3.1 项目定位\n\n`SceneVersepp` 对应的论文方向是将未标注互联网视频提升为结构化 3D scene understanding 数据。仓库根目录的 `README.md` 将项目概括为一个 automated data engine，能够从 web videos 中构建 instance-level point clouds、object layouts、spatial VQA 和 vision-language navigation 等训练信号。\n\n从代码结构看，公开仓库主要包含三部分：\n\n```text\nSceneVersepp/\n  data_processing/\n  SpatialLM/\n  PQ3D/\n```\n\n这三部分分别对应：\n\n- `data_processing`：视频下载、抽帧和相机位姿可视化。\n- `SpatialLM`：3D object/layout detection 训练、推理与评估。\n- `PQ3D`：3D instance segmentation 训练和数据生成。\n\n因此，这个仓库更像是“数据处理 + 训练代码 + 公开数据集适配”，而不是一个可以直接输入任意扫描视频并输出语义 3DGS 的完整应用。\n\n### 3.2 data_processing：视频与相机数据处理\n\n`SceneVersepp/data_processing` 中有三个主要脚本：\n\n- `download_videos.py`\n- `extract_images.py`\n- `view_camera_poses.py`\n\n`download_videos.py` 会遍历数据集目录下包含 `data_info.json` 的 scene folder，并根据其中的 `video_url` 下载 YouTube 视频，默认保存为 `video.mp4`。\n\n`extract_images.py` 会读取 `data_info.json` 里的 `data_frames`，从 `video.mp4` 中抽取指定帧，输出到：\n\n```text\nimages/\ncrop_images/\n```\n\n其中 `crop_images/` 会做 resize 和 center crop，方便后续模型使用。\n\n`view_camera_poses.py` 会读取一个 scene 的 `mesh.ply` 和 `camera_info.json`，用 Open3D 显示场景 mesh 与相机 frustum。它假设 scene folder 中已经有：\n\n```text\nmesh.ply\ncamera_info.json\n```\n\n这说明 `SceneVersepp` 的公开处理脚本已经站在“场景 mesh 和相机位姿已存在”的阶段。它能帮助理解 SVPP 数据结构，但并不包含从新视频估计相机位姿或训练 3DGS 的部分。\n\n### 3.3 SVPP 数据形态\n\n从 `SpatialLM/data_generation/svpp/generate_layout.py` 和 `PQ3D/data_process/generate_dataset.py` 可以看到，SVPP scene 通常依赖以下文件：\n\n```text\n<scene_name>/\n  data_info.json\n  video.mp4\n  images/\n  crop_images/\n  mesh.ply\n  camera_info.json\n  metadata.json\n```\n\n这些文件的大致含义如下：\n\n| 文件 | 作用 |\n| --- | --- |\n| `data_info.json` | 记录视频 URL、使用的 frame ids 等视频来源信息。 |\n| `video.mp4` | 下载后的原始视频。 |\n| `images/` | 从视频抽取的原始帧。 |\n| `crop_images/` | 经过 resize/crop 的帧。 |\n| `mesh.ply` | 场景级 mesh 或点云/网格数据。 |\n| `camera_info.json` | 相机内参和每帧外参。 |\n| `metadata.json` | 物体级实例信息，包含类别和点级实例归属。 |\n\n其中 `metadata.json` 对 Video2Mesh 尤其重要，因为它表达了物体实例与 3D 点之间的关系。在 `SpatialLM` 中，`metadata.json` 会被读取为 instance-level box；在 `PQ3D` 中，它会被读取为点级 instance label。\n\n从这个角度看，Video2Mesh 可以借鉴 SVPP 的数据组织方式，把自己的中间结果也整理成类似结构：\n\n```text\n<scene_id>/\n  video.mp4\n  frames/\n  camera_info.json\n  scene_3dgs/\n  point_cloud.ply\n  metadata.json\n  objects/\n```\n\n其中 `metadata.json` 可以作为跨模块的核心语义文件，记录每个 object id 的类别、3D mask、相关帧、bbox、mesh 路径和仿真属性。\n\n### 3.4 SpatialLM：3D object/layout detection\n\n`SceneVersepp/SpatialLM` 是对 SpatialLM 的适配。它的主要目标是从点云中预测场景 layout 和物体 boxes。\n\nSVPP 数据生成流程大致是：\n\n```bash\npython data_generation/svpp/generate_layout.py \\\n  --data_root /path/to/svpp_data \\\n  --save_path ./data/svpp \\\n  --voxel_size 0.02 \\\n  --workers 16 \\\n  --process_number -1 \\\n  --label-map ./scannetv2-labels.combined.tsv\n\npython data_generation/svpp/generate_dataset.py \\\n  --dataset_dir ./data/svpp \\\n  --dataset_name svpp \\\n  --code_template_file ./code_template.txt\n```\n\n`generate_layout.py` 会读取每个 scene 的 `mesh.ply` 和 `metadata.json`，将物体实例转换成类似如下的文本 layout：\n\n```text\nbbox_0=Bbox(chair,1.2,0.4,0.8,0.0,0.6,0.5,1.0)\nbbox_1=Bbox(table,2.1,1.5,0.7,0.0,1.2,0.8,0.7)\n```\n\n这个 layout 表示：\n\n- 物体类别。\n- 3D 中心位置。\n- 绕 z 轴旋转角。\n- 3D box 尺寸。\n\n`generate_dataset.py` 会把点云和 layout 组合成 ShareGPT 风格训练样本，让模型学习从 point cloud 到 layout code 的映射。推理脚本 `inference.py` 通过 prompt 让模型生成 layout，支持 `all`、`arch`、`object` 三种 detection 类型。\n\n对 Video2Mesh 来说，SpatialLM 的价值主要在于：\n\n- 提供一种“点云到 object boxes”的 3D grounding 思路。\n- 提供 `Bbox(...)` 形式的结构化 layout 表达。\n- 可作为 3D mask 生成后的几何摘要或 sanity check。\n- 可用于辅助 frame selection，例如从 3D bbox 判断物体空间范围。\n\n但 SpatialLM 本身不解决：\n\n- 视频到点云/3DGS 的重建。\n- 2D mask 到 3D mask 的融合。\n- 物体 mesh 生成。\n- 仿真器资产导出。\n\n### 3.5 PQ3D：3D instance segmentation\n\n`SceneVersepp/PQ3D` 是对 PQ3D 的适配，用于 SceneVerse++ 数据生成和 3D instance segmentation 训练。\n\n数据处理脚本 `PQ3D/data_process/generate_dataset.py` 会读取 scene mesh 和 metadata，并生成 PQ3D 训练所需的中间数据：\n\n```text\ntraining_datas/\n  segments/\n  base/<dataset_name>/scan_data/\n    instance_id_to_label/\n    pcd_with_global_alignment/\n  aux/<dataset_name>/segment_id/\n```\n\n其中：\n\n- `instance_id_to_label` 保存 instance id 到语义类别的映射。\n- `pcd_with_global_alignment` 保存点坐标、颜色和 instance label。\n- `segment_id` 保存 over-segmentation 或重新切分后的 segment id。\n\nPQ3D 的模型配置中使用 Mask3D / MinkowskiEngine 风格的点云 backbone，输出 query-based mask。配置文件 `configs/svpp_gt.yaml` 用 SVPP 预训练，`configs/svpp_gt_scannet_fps.yaml` 用 ScanNet fine-tune。\n\n对 Video2Mesh 来说，PQ3D 的价值主要在于：\n\n- 提供 3D instance segmentation 的训练框架。\n- 展示如何把点云、segment、instance label 组织成训练数据。\n- 展示如何从 scene-level 3D 数据学习 object-level masks。\n\n但要注意，当前公开代码依赖 `metadata.json` 中已有的 point-level instance assignment。也就是说，它默认训练数据里已经知道每个点属于哪个物体。对于一个新的空间扫描视频，Video2Mesh 仍然需要先生成这类 3D instance label，或者训练一个模型在新点云上预测它。\n\n### 3.6 SceneVerse++ 对 Video2Mesh 的启发与限制\n\nSceneVerse++ 对目标系统的启发可以概括为：\n\n1. 用统一 scene folder 管理视频、帧、相机、mesh、metadata。\n2. 用 `metadata.json` 记录 object instance 和 3D 点/segment 的对应关系。\n3. 用 3D detection/layout 作为场景语义摘要。\n4. 用 3D instance segmentation 训练或预测物体级 mask。\n\n它的限制也很明确：\n\n1. 不直接训练或输出 3DGS。\n2. 不包含从任意新视频做 SfM/SLAM/3DGS 的完整流程。\n3. 不包含 2D segmentation 到 3D mask 的自动融合模块。\n4. 不包含 object frame selection。\n5. 不包含单物体 mesh 生成和仿真器导出。\n\n因此，SceneVerse++ 更适合作为数据结构和 3D scene understanding 方法参考，而不能直接作为 Video2Mesh 的完整实现。\n\n## 4. image-blaster 详细理解\n\n### 4.1 项目定位\n\n`image-blaster` 的 README 将项目描述为：从单张图片创建 3D environments、SFX 和 meshes。它依赖 Claude skills、World Labs 和 FAL，可以快速把一张输入图变成：\n\n- 静态环境 Gaussian splat。\n- 动态物体的 `.glb` / `.obj`。\n- 环境音和物体音效。\n- 可在浏览器中查看的 Three.js 场景。\n\n它更像是一个资产生成工具或 demo pipeline，而不是研究型视频重建系统。\n\n### 4.2 项目目录与产物约定\n\n`image-blaster` 的核心资产目录是：\n\n```text\nimage-blaster/\n  input/\n  worlds/\n    <world-slug>/\n      project.json\n      scene.json\n      image.json\n      source/\n      output/\n        world/\n        sfx/\n        <object-slug>/\n```\n\n其中：\n\n- `input/` 用于临时放入用户输入图片。\n- `worlds/<slug>/source/` 存放稳定的源图和图像分析 JSON。\n- `worlds/<slug>/image.json` 存放合并后的场景理解和候选物体。\n- `worlds/<slug>/output/world/` 存放 World Labs 生成的环境资产。\n- `worlds/<slug>/output/<object-slug>/` 存放某个物体的 `object.json`、参考图和 3D model。\n- `scene.json` 存放 viewer 中的物体摆放状态。\n\n生成文件采用 index convention：\n\n```text\nN-slug.ext\n.N-slug-request.json\n```\n\n例如一个 world generation 可能生成：\n\n```text\n0-world.json\n0-world-plate.png\n0-world.glb\n0-world-pano.png\n0-world-thumbnail.webp\n0-world-full_res.spz\n.0-world-request.json\n```\n\n这个约定对 Video2Mesh 很有参考价值，因为我们也需要为每个物体保存不同阶段的结果，例如 selected frame、mask crop、reference image、mesh、collision mesh 和 request metadata。\n\n### 4.3 World Labs Marble：单图到静态环境 splat\n\n`image-blaster/.claude/scripts/world/generate-world.mjs` 调用 World Labs Marble API。它可以输入图片或文本 prompt，输出 world assets。关键产物包括：\n\n- `.spz`：Gaussian splat 格式的环境表现。\n- `.glb`：collider mesh。\n- panorama image。\n- thumbnail image。\n- JSON response metadata。\n\n`image-blaster` 的 viewer 只加载本地文件，provider URL 主要作为 provenance 和 resume metadata。\n\n这个模块与 Video2Mesh 的“场景 3DGS”目标看起来接近，但有一个本质差异：\n\n- `image-blaster` 的环境 splat 是从单张图生成的，偏生成式 hallucination。\n- Video2Mesh 目标中的场景 3DGS 应该从扫描视频重建，尽量保留真实几何和相机一致性。\n\n因此，World Labs Marble 可以作为快速 demo 或 fallback，但不应该作为真实扫描重建的主路径。\n\n### 4.4 Hunyuan 3D / Meshy：单图到物体 mesh\n\n`image-blaster/.claude/scripts/asset-pipeline/generate-single-asset.mjs` 是单物体 3D 生成的主要脚本。它支持：\n\n- Hunyuan 3D。\n- Meshy。\n- 先通过 image edit 提取干净物体参考图。\n- 再把参考图送入 3D provider 生成 `.glb`、`.obj` 等模型文件。\n\nHunyuan 3D 相关参数包括：\n\n- `--face-count`\n- `--enable-pbr`\n- `--generate-type Normal|LowPoly|Geometry`\n- `--polygon-type triangle|quadrilateral`\n\nMeshy 相关参数包括：\n\n- `--target-polycount`\n- `--topology`\n- `--should-remesh`\n- `--should-texture`\n- `--enable-pbr`\n\n对 Video2Mesh 来说，这部分可以直接作为早期原型的物体 mesh 生成后端。我们可以先从每个物体选出最佳帧或最佳 crop，然后调用类似流程生成 mesh。\n\n但长期看，单图物体 mesh 会有局限：\n\n- 背面几何通常是模型补全，不一定与真实物体一致。\n- 对薄结构、透明物体、反光物体和遮挡物体效果不稳定。\n- 尺度和姿态需要额外从 3D 场景中恢复。\n- 生成 mesh 与场景 3D mask 的几何可能无法严格对齐。\n\n因此，单图 mesh 适合作为 v0/v1 的快速可用路线；后续更理想的是引入多视角 object-centric reconstruction。\n\n### 4.5 React/Three.js Viewer\n\n`image-blaster/app` 是一个 React + Three.js viewer，核心能力包括：\n\n- 加载 world splat。\n- 加载 collider mesh。\n- 加载单物体 mesh。\n- 支持物体摆放和 scene project。\n- 支持 audio、physics、character/fly controller。\n\n相关文件包括：\n\n- `image-blaster/app/src/components/WorldViewer.tsx`\n- `image-blaster/app/src/utils/worldLoader.ts`\n- `image-blaster/app/src/types/world.ts`\n\n这对 Video2Mesh 很有价值。即使我们不用 `image-blaster` 的单图 world generation，也可以复用或参考它的 viewer，构建一个检查系统输出的可视化界面：\n\n- 显示重建出的真实场景 3DGS。\n- 高亮某个 object 的 3D mask。\n- 显示选中的相关帧。\n- 加载物体 mesh 并与原始 3D mask 对齐比较。\n- 编辑物体 pose 和导出仿真配置。\n\n### 4.6 image-blaster 对 Video2Mesh 的启发与限制\n\nimage-blaster 的启发包括：\n\n1. 资产目录组织清晰，适合管理多阶段生成结果。\n2. 有单图物体 mesh 生成 pipeline，可以作为早期 mesh backend。\n3. 有可交互 viewer，适合做结果质检和 demo。\n4. 有 provider request metadata 的管理机制，方便复现和恢复。\n\n它的限制包括：\n\n1. 输入是单张图片，不是视频扫描。\n2. 不处理相机位姿估计。\n3. 不训练真实场景 3DGS。\n4. 不做 2D mask tracking。\n5. 不做 2D-to-3D semantic fusion。\n6. 不保证生成 mesh 与真实场景几何严格对齐。\n\n## 5. 目标系统推荐技术路线\n\n### 5.1 总体架构\n\n推荐将 Video2Mesh 设计为多个相对独立的模块：\n\n```text\nVideo2Mesh/\n  video_ingest/\n  reconstruction/\n  segmentation_2d/\n  tracking/\n  mask_fusion_3d/\n  object_frame_selection/\n  object_mesh_generation/\n  asset_export/\n  viewer/\n```\n\n对应的数据流如下：\n\n```mermaid\nflowchart TD\n    A[\"Input: scan video\"] --> B[\"Frame extraction\"]\n    B --> C[\"Camera pose estimation / SfM / SLAM\"]\n    C --> D[\"Scene 3DGS training\"]\n    B --> E[\"2D detection + segmentation\"]\n    E --> F[\"Video object tracking\"]\n    C --> G[\"2D-to-3D mask projection\"]\n    F --> G\n    D --> G\n    G --> H[\"Object-level 3D masks\"]\n    H --> I[\"Object frame selection\"]\n    I --> J[\"Object mesh generation\"]\n    H --> K[\"Scene/object metadata\"]\n    J --> L[\"Simulator asset export\"]\n    K --> L\n    D --> M[\"Viewer / QA\"]\n    H --> M\n    J --> M\n```\n\n### 5.2 视频预处理与抽帧\n\n输入视频需要先拆成帧，并记录 frame id、timestamp、分辨率和图像路径。可以参考 `SceneVersepp/data_processing/extract_images.py` 的方式，但 Video2Mesh 应该支持更通用的输入：\n\n```text\nscenes/<scene_id>/\n  input/\n    video.mp4\n  frames/\n    000000.png\n    000001.png\n  frame_index.json\n```\n\n`frame_index.json` 可以记录：\n\n- 原始视频路径。\n- FPS。\n- 抽帧间隔。\n- 每帧 timestamp。\n- 是否为关键帧。\n- 图像尺寸。\n\n早期实现可以每隔固定帧数抽取一帧，例如 2 fps 或 5 fps；后续可以根据运动模糊、视角变化和覆盖率做 adaptive frame selection。\n\n### 5.3 相机位姿与场景 3DGS\n\n场景重建建议先走传统 SfM + 3DGS 路线：\n\n1. 使用 COLMAP 从抽帧估计相机内外参和稀疏点云。\n2. 使用 3D Gaussian Splatting 实现训练场景 3DGS。\n3. 导出相机轨迹、稀疏点云、3DGS 文件和渲染检查结果。\n\n中间文件建议组织为：\n\n```text\nreconstruction/\n  colmap/\n    cameras.bin\n    images.bin\n    points3D.bin\n  cameras.json\n  sparse_points.ply\n  scene_3dgs/\n    point_cloud/\n    config.json\n    output.splat 或 output.ply\n```\n\n如果输入来自手机 ARKit/ARCore/Polycam/Record3D 等扫描工具，也可以优先使用已有 camera poses，以减少 COLMAP 失败风险。\n\n这一阶段的主要成功标准是：\n\n- 相机轨迹稳定。\n- 3DGS novel view 渲染与原视频视角一致。\n- 场景尺度可恢复或可通过人工标定。\n- 输出坐标系后续可用于 mask projection 和仿真器导出。\n\n### 5.4 帧级 2D segmentation / detection / tracking\n\n每帧需要识别可拆分物体。可选路线包括：\n\n- open-vocabulary detection：根据文本类别或自动 caption 找物体。\n- instance segmentation：生成每帧物体 mask。\n- video object tracking：跨帧保持同一物体 ID 一致。\n\n一个 practical pipeline 可以是：\n\n```text\nGroundingDINO / OWL-ViT / YOLO-world\n  -> SAM / SAM2\n  -> video tracking / mask propagation\n  -> per-frame instance masks\n```\n\n输出建议为：\n\n```text\nsegmentation_2d/\n  frames/\n    000000.instances.json\n    000000.mask.png\n  tracks/\n    track_0001.json\n    track_0002.json\n```\n\n每个 track 应该记录：\n\n- `track_id`\n- `category`\n- `category_confidence`\n- `frames`\n- 每帧 bbox\n- 每帧 mask path\n- 可见面积\n- 遮挡或截断评分\n\n这一阶段的难点是跨帧 ID consistency。2D detector 每帧单独运行容易产生 ID 抖动，因此需要 tracking 或后处理，把同一物体在不同帧中的 mask 合并为同一 object track。\n\n### 5.5 2D mask 到 3D mask 的融合\n\n这是目标系统的核心桥接模块。它需要把每帧的 2D object mask 利用相机位姿投影到 3DGS 或点云上，最终得到每个物体的 3D semantic / instance mask。\n\n可以考虑两种实现路线。\n\n第一种是点云空间融合：\n\n1. 从 COLMAP sparse/dense point cloud 或 3DGS centers 获取 3D points。\n2. 对每个 3D point，根据相机内外参投影到多个帧。\n3. 检查投影位置是否落入某个 2D mask。\n4. 对每个 point 累积 object id 投票。\n5. 用最大投票或置信度模型决定 point-level object label。\n\n第二种是 Gaussian 空间融合：\n\n1. 使用每个 Gaussian 的中心点作为投影对象。\n2. 结合 Gaussian opacity、scale 和可见性筛选。\n3. 对每个 Gaussian 累积 object track 的 mask votes。\n4. 得到 Gaussian-level semantic mask。\n\n点云空间更容易实现和调试；Gaussian 空间更贴近最终 3DGS 表达。建议早期先用点云空间融合，后续再将 label transfer 到 Gaussian splats。\n\n输出可以设计为：\n\n```text\nsemantic_3d/\n  objects.json\n  point_labels.npy\n  gaussian_labels.npy\n  object_masks/\n    object_0001.npy\n    object_0002.npy\n```\n\n`objects.json` 应该记录：\n\n- object id。\n- 类别。\n- 3D bbox。\n- mask confidence。\n- 支持它的帧数。\n- 最佳可见帧。\n- 对应 2D track id。\n\n### 5.6 每个物体自动选帧\n\n选帧的目标是为 mesh generation 提供尽可能干净、完整、有代表性的物体图像。对每个 object track，可以为每一帧计算评分：\n\n```text\nscore =\n  visible_area_score\n  + sharpness_score\n  + viewpoint_score\n  + mask_confidence_score\n  - occlusion_penalty\n  - truncation_penalty\n  - motion_blur_penalty\n```\n\n常用指标包括：\n\n- 2D mask 面积占图像比例。\n- bbox 是否贴边，判断是否被截断。\n- Laplacian variance，判断清晰度。\n- 与相邻 mask 的 overlap，判断遮挡。\n- 物体在 3D bbox 上的视角覆盖。\n- 是否有多个互补视角。\n\n输出建议为：\n\n```text\nobjects/<object_id>/\n  selected_frames.json\n  crops/\n    000123.png\n    000287.png\n  masks/\n    000123.png\n    000287.png\n```\n\n`selected_frames.json` 需要记录每张图的评分和选择原因，方便后续调试。例如：\n\n```json\n{\n  \"object_id\": \"object_0004\",\n  \"category\": \"chair\",\n  \"selected_frames\": [\n    {\n      \"frame_id\": 123,\n      \"image\": \"frames/000123.png\",\n      \"mask\": \"segmentation_2d/frames/000123.object_0004.png\",\n      \"score\": 0.91,\n      \"visible_area\": 0.18,\n      \"sharpness\": 0.83,\n      \"truncation\": 0.02,\n      \"notes\": \"largest clear frontal view\"\n    }\n  ]\n}\n```\n\n### 5.7 每个物体 mesh 重建\n\nmesh generation 可以分为三个阶段。\n\n第一阶段是快速原型：单图 mesh generation。直接复用 `image-blaster` 的思路，对每个物体的最佳 crop 调用 Hunyuan 3D 或 Meshy，输出 `.glb` 或 `.obj`。\n\n第二阶段是多图辅助：为同一物体选择多个互补视角，先用 image editing 生成 clean object references，再用支持多视角或 image set 的 3D reconstruction/generation 模型。\n\n第三阶段是 3DGS-to-mesh：用 object masks 和注册相机位姿，从训练好的 3DGS 渲染 object-centric 多视角 RGB/depth/normal/mask，再把 masked depth/normal 观测融合成 surface。这个阶段不应只把 sparse point cloud 或 Gaussian centers 直接连成网格；那只能作为 debug baseline。\n\n当前 object mask cloud 直接转 mesh 的失败形态已经很明确：表面会被打碎成大量 disconnected triangle islands，伴随 holes、floating sheets 和非 watertight 区域。根因是点云本身稀疏、不均匀、带悬浮噪声，并且局部三角化会把错误邻域硬连成薄片。因此这条路线只能用于快速看位置和 bbox 规模，不能作为最终物体 mesh。\n\n早期推荐路线：\n\n```text\nbest object crop\n  -> background removal / clean reference\n  -> Hunyuan 3D or Meshy\n  -> generated mesh\n  -> scale and pose alignment using 3D mask bbox\n  -> simulator export\n```\n\n长期推荐路线：\n\n```text\ntrained 3DGS + object masks + registered camera poses\n  -> object-centric multi-view RGB/depth/normal/mask rendering\n  -> TSDF fusion over masked observations\n  -> marching cubes / Poisson surface extraction\n  -> optional NeuS-style SDF refinement\n  -> connected-component filtering / hole filling / simplification / watertight QA\n  -> texture baking\n  -> physics collider generation\n  -> simulator export\n```\n\n### 5.8 仿真器资产导出\n\n仿真器通常不只需要 mesh，还需要尺度、姿态、坐标系、碰撞体、材质和物理属性。建议导出结构如下：\n\n```text\nexports/simulator/\n  scene_manifest.json\n  scene_background.spz\n  objects/\n    object_0001/\n      mesh.glb\n      collider.glb\n      material.json\n      metadata.json\n```\n\n`metadata.json` 可以包含：\n\n```json\n{\n  \"object_id\": \"object_0001\",\n  \"category\": \"chair\",\n  \"name\": \"chair_0001\",\n  \"scale\": [1.0, 1.0, 1.0],\n  \"position\": [0.0, 0.0, 0.0],\n  \"rotation_quat\": [0.0, 0.0, 0.0, 1.0],\n  \"bbox_center\": [1.2, 0.4, 0.8],\n  \"bbox_size\": [0.6, 0.5, 1.0],\n  \"semantic_id\": 4,\n  \"physics\": {\n    \"type\": \"rigidbody\",\n    \"mass\": 3.0,\n    \"collider\": \"collider.glb\"\n  }\n}\n```\n\n如果目标仿真器是 Isaac Sim、MuJoCo、Genesis、PyBullet、Habitat、Unity 或 Unreal，导出格式会不同，但核心信息类似。早期可以先导出通用 `.glb + JSON manifest`，后续再写具体 simulator adapter。\n\n## 6. 两个项目如何复用\n\n### 6.1 可复用 SceneVerse++ 的部分\n\n`SceneVersepp` 可复用或参考的部分包括：\n\n1. SVPP scene folder 组织方式。\n2. `data_info.json` / `camera_info.json` / `metadata.json` 的数据理念。\n3. `SpatialLM` 的 layout 表达和 object bbox 生成方式。\n4. `PQ3D` 的 3D instance segmentation 数据格式。\n5. 点云、segment、instance label 的训练数据组织方式。\n\n推荐在 Video2Mesh 中引入类似 SVPP 的 scene metadata，但扩展字段以支持 3DGS 和 mesh：\n\n```json\n{\n  \"scene_id\": \"room_001\",\n  \"coordinate_system\": \"z_up\",\n  \"unit\": \"meter\",\n  \"objects\": {\n    \"object_0001\": {\n      \"category\": \"chair\",\n      \"track_id\": \"track_0007\",\n      \"bbox_3d\": {},\n      \"mask_3d\": \"semantic_3d/object_masks/object_0001.npy\",\n      \"selected_frames\": \"objects/object_0001/selected_frames.json\",\n      \"mesh\": \"objects/object_0001/mesh.glb\"\n    }\n  }\n}\n```\n\n### 6.2 可复用 image-blaster 的部分\n\n`image-blaster` 可复用或参考的部分包括：\n\n1. `worlds/<slug>` 风格的资产目录。\n2. `object.json` 的物体意图和 provenance 记录。\n3. `generate-single-asset.mjs` 的单图到 mesh pipeline。\n4. World/object generation request metadata 管理方式。\n5. React/Three.js viewer。\n6. `.spz`、`.glb`、object placement、physics viewer 的前端加载方式。\n\n最直接的复用方式是：Video2Mesh 先生成每个物体的最佳 crop，然后把它组织成 `image-blaster` 风格的 object folder，再调用单物体生成脚本。\n\n例如：\n\n```text\nobjects/object_0001/best_crop.png\n  -> image-blaster style object reference\n  -> Hunyuan 3D / Meshy\n  -> objects/object_0001/mesh.glb\n```\n\n后续可以把 `image-blaster/app` 改造成 Video2Mesh 的 QA viewer：\n\n- 左侧显示场景和物体列表。\n- 中间显示真实扫描得到的 3DGS。\n- 点击物体时高亮其 3D mask。\n- 右侧显示 selected frames 和 generated mesh。\n- 支持导出 simulator asset bundle。\n\n### 6.3 需要新增的桥接模块\n\n两项目之间缺失的关键桥接模块包括：\n\n| 模块 | 输入 | 输出 | 作用 |\n| --- | --- | --- | --- |\n| Video2GS | 视频帧 | camera poses、3DGS、点云 | 从真实视频重建场景。 |\n| 2D Segmentation + Tracking | 视频帧 | per-frame masks、object tracks | 得到跨帧一致的物体候选。 |\n| 2D-to-3D Mask Fusion | masks、camera poses、3DGS/点云 | 物体级 3D mask | 把图像语义提升到三维。 |\n| Object Frame Selector | tracks、3D mask、frames | selected frames/crops | 为每个物体挑选重建参考图。 |\n| Mesh Backend Adapter | selected frames | object mesh | 调用 Hunyuan/Meshy 或多视角重建。 |\n| Simulator Exporter | 3D mask、mesh、metadata | 仿真器资产包 | 导出可用资产和 manifest。 |\n\n## 7. 关键技术难点\n\n### 7.1 视频重建质量与尺度恢复\n\n如果视频存在快速运动、模糊、低纹理墙面、反光表面或重复纹理，COLMAP/SfM 可能失败。即使相机轨迹成功，重建的尺度也通常是任意尺度，需要通过已知物体尺寸、深度传感器、ARKit scale 或人工标定恢复米制单位。\n\n仿真器对尺度非常敏感，因此 Video2Mesh 不能只输出视觉上合理的模型，还需要明确单位和坐标系。\n\n### 7.2 2D mask 跨帧一致性\n\n每帧单独检测会产生 object id 抖动。例如同一把椅子在不同帧中可能被分配成多个实例，也可能与相邻椅子混淆。解决方案需要结合：\n\n- mask tracking。\n- appearance embedding。\n- 3D geometric consistency。\n- temporal smoothing。\n- human-in-the-loop correction。\n\n对于室内多相似物体场景，如多把椅子、多本书、多只杯子，这个问题会特别明显。\n\n### 7.3 3D mask 融合噪声\n\n2D mask 投影到 3D 时会遇到：\n\n- 相机位姿误差。\n- depth/visibility 不准。\n- 物体遮挡。\n- mask 边界不稳定。\n- 透明和反光物体难以分割。\n- Gaussian splat 没有显式 surface connectivity。\n\n因此 3D mask 不应该只做一次硬投票，还需要置信度、可见性、空间平滑和后处理。例如可以在点云上做 connected component filtering，去掉离群点；或在 Gaussian graph 上做 label smoothing。\n\n### 7.4 mesh 生成与真实几何对齐\n\n单图生成 mesh 的外观可能好，但与真实 3D mask 不一定一致。典型问题包括：\n\n- mesh 尺寸与真实 bbox 不匹配。\n- 正面好看但背面错误。\n- 物体底部或遮挡部分被 hallucinate。\n- 细长结构断裂。\n- mesh 原点、朝向、重心不适合仿真。\n\n因此需要额外做 mesh alignment：\n\n1. 根据 3D mask bbox 缩放 mesh。\n2. 根据物体主方向旋转 mesh。\n3. 将 mesh 底部对齐地面或 mask 下边界。\n4. 生成简化 collider。\n5. 检查 mesh 是否与场景其他物体严重穿插。\n\n### 7.5 仿真器物理属性缺失\n\n真实仿真器通常需要：\n\n- mass。\n- friction。\n- restitution。\n- collider shape。\n- static/dynamic 属性。\n- articulation 信息。\n- semantic category。\n\n从视频中很难直接恢复这些属性，因此 v0 可以使用类别默认值。例如椅子、桌子、柜子默认 static 或 rigidbody，墙面和地板默认 static，杯子和小物体默认 rigidbody。后续可以引入材质识别和 LLM 规则库生成物理参数。\n\n## 8. 阶段性开发计划\n\n### Phase 1：单视频到 3DGS\n\n目标：选择一个小型室内扫描视频，跑通抽帧、相机位姿估计和场景 3DGS。\n\n主要产物：\n\n- `frames/`\n- `cameras.json`\n- `sparse_points.ply`\n- `scene_3dgs/`\n- 渲染质量检查视频或图片。\n\n验收标准：\n\n- novel view 渲染可接受。\n- 相机轨迹没有明显漂移。\n- 场景尺度有初步标定方案。\n\n### Phase 2：2D segmentation + tracking\n\n目标：对抽帧结果生成帧级 object masks，并保持跨帧 object id 一致。\n\n主要产物：\n\n- `segmentation_2d/frames/*.json`\n- `segmentation_2d/tracks/*.json`\n- 每个 object track 的可视化视频。\n\n验收标准：\n\n- 主要物体能被识别。\n- 同一物体跨帧 ID 基本稳定。\n- 输出 mask 能用于后续投影。\n\n### Phase 3：投影融合得到 3D object masks\n\n目标：将 2D masks 融合到点云或 Gaussian centers，得到每个物体的 3D mask。\n\n主要产物：\n\n- `semantic_3d/objects.json`\n- `semantic_3d/point_labels.npy`\n- `semantic_3d/object_masks/*.npy`\n- 3D mask 可视化结果。\n\n验收标准：\n\n- 每个主要物体有独立 3D mask。\n- mask 空间位置与原场景一致。\n- 大面积错误标签可通过后处理减少。\n\n### Phase 4：自动选帧并接入 mesh 生成\n\n目标：为每个物体选择最佳帧/crop，并调用单图 mesh backend 生成 mesh。\n\n主要产物：\n\n- `objects/<object_id>/selected_frames.json`\n- `objects/<object_id>/best_crop.png`\n- `objects/<object_id>/mesh.glb`\n\n验收标准：\n\n- 每个主要物体至少生成一个 mesh。\n- mesh 尺度和位置可初步对齐 3D mask。\n- 失败案例有日志和 fallback。\n\n### Phase 5：导出仿真器资产包\n\n目标：将场景背景、物体 mesh、pose、scale、semantic id 和 physics metadata 打包导出。\n\n主要产物：\n\n- `exports/simulator/scene_manifest.json`\n- `exports/simulator/objects/*/mesh.glb`\n- `exports/simulator/objects/*/collider.glb`\n- simulator adapter 脚本。\n\n验收标准：\n\n- 至少能在一个目标仿真器或 Three.js viewer 中加载。\n- 物体位置、尺度和朝向大致正确。\n- 背景场景和物体资产可分离显示。\n\n### Phase 6：viewer 与评估指标\n\n目标：构建 QA viewer 和基础评估指标，用于快速发现重建、mask 和 mesh 的错误。\n\nviewer 需要支持：\n\n- 场景 3DGS 浏览。\n- object mask 高亮。\n- selected frames 显示。\n- mesh 与 mask 对齐比较。\n- 导出 manifest 检查。\n\n评估指标包括：\n\n- 相机位姿重投影误差。\n- 3DGS PSNR/SSIM/LPIPS 或主观渲染检查。\n- 2D mask tracking consistency。\n- 3D mask coverage / compactness。\n- mesh-bbox alignment error。\n- simulator import success rate。\n\n## 9. 建议实验与评估\n\n### 9.1 最小可行实验\n\n建议先选择一个小型室内场景作为最小样例，例如：\n\n- 一张桌子、两把椅子、一个柜子。\n- 视频长度 30-60 秒。\n- 拍摄时缓慢绕场景移动。\n- 尽量避免强反光、透明物体和严重运动模糊。\n\n这个实验不追求全类别泛化，而是验证完整链路：\n\n```text\nvideo -> 3DGS -> object masks -> selected frames -> object meshes -> viewer/export\n```\n\n### 9.2 对比实验\n\n建议设计三类 mesh 生成对比：\n\n1. 单图 mesh：只使用每个物体的最佳帧 crop。\n2. 多图 mesh：使用多个 selected frames。\n3. 3DGS-to-mesh：从 3DGS 多视角渲染 depth/normal/mask，再做 TSDF fusion / Poisson / NeuS-style surface extraction。\n\n比较维度包括：\n\n- 形状真实性。\n- 纹理质量。\n- 与原场景 bbox 的对齐程度。\n- 背面/遮挡区域合理性。\n- 仿真器导入成功率。\n- 生成耗时和失败率。\n\n### 9.3 消融实验\n\n可以考虑以下消融：\n\n- 是否使用 tracking，只用 per-frame segmentation 会怎样。\n- 是否使用 3D consistency 来合并 object tracks。\n- 选帧策略：最大面积 vs 综合评分。\n- 3D mask 融合：硬投票 vs 置信度加权 vs spatial smoothing。\n- mesh 生成：best crop vs clean plate/reference edit。\n\n### 9.4 人工标注小基准\n\n为了量化效果，可以人工标注少量数据：\n\n- 5-10 个视频场景。\n- 每个场景 5-20 个主要物体。\n- 少量关键帧 2D mask。\n- 粗略 3D bbox 或手工检查的 3D mask。\n\n这样可以评估：\n\n- 物体发现召回率。\n- 跨帧 ID consistency。\n- 3D mask 与人工检查结果的一致性。\n- mesh 可用率。\n\n## 10. 推荐文件结构草案\n\nVideo2Mesh 后续可以采用如下结构保存每个场景：\n\n```text\ndata/\n  scenes/\n    room_001/\n      input/\n        video.mp4\n      frames/\n        000000.png\n        000001.png\n      frame_index.json\n      reconstruction/\n        cameras.json\n        sparse_points.ply\n        scene_3dgs/\n      segmentation_2d/\n        frames/\n        tracks/\n      semantic_3d/\n        objects.json\n        point_labels.npy\n        gaussian_labels.npy\n        object_masks/\n      objects/\n        object_0001/\n          object.json\n          selected_frames.json\n          crops/\n          masks/\n          mesh.glb\n          collider.glb\n        object_0002/\n      exports/\n        simulator/\n          scene_manifest.json\n```\n\n这个结构结合了 SceneVerse++ 的 scene-level 数据组织和 image-blaster 的 object-level asset organization。\n\n## 11. 推荐元数据 schema 草案\n\n### 11.1 scene_manifest.json\n\n```json\n{\n  \"schema_version\": 1,\n  \"scene_id\": \"room_001\",\n  \"unit\": \"meter\",\n  \"coordinate_system\": \"z_up\",\n  \"source_video\": \"input/video.mp4\",\n  \"frames\": \"frame_index.json\",\n  \"camera_info\": \"reconstruction/cameras.json\",\n  \"scene_3dgs\": \"reconstruction/scene_3dgs/output.splat\",\n  \"objects\": [\n    {\n      \"object_id\": \"object_0001\",\n      \"category\": \"chair\",\n      \"metadata\": \"objects/object_0001/object.json\",\n      \"mesh\": \"objects/object_0001/mesh.glb\",\n      \"collider\": \"objects/object_0001/collider.glb\"\n    }\n  ]\n}\n```\n\n### 11.2 object.json\n\n```json\n{\n  \"schema_version\": 1,\n  \"object_id\": \"object_0001\",\n  \"track_id\": \"track_0007\",\n  \"category\": \"chair\",\n  \"name\": \"chair_0001\",\n  \"bbox_3d\": {\n    \"center\": [1.2, 0.4, 0.8],\n    \"size\": [0.6, 0.5, 1.0],\n    \"rotation_z\": 0.0\n  },\n  \"mask_3d\": {\n    \"type\": \"point_indices\",\n    \"path\": \"../../semantic_3d/object_masks/object_0001.npy\",\n    \"confidence\": 0.82\n  },\n  \"selected_frames\": \"selected_frames.json\",\n  \"mesh\": \"mesh.glb\",\n  \"pose_in_scene\": {\n    \"position\": [1.2, 0.4, 0.0],\n    \"rotation_quat\": [0.0, 0.0, 0.0, 1.0],\n    \"scale\": [1.0, 1.0, 1.0]\n  },\n  \"physics\": {\n    \"mode\": \"rigidbody\",\n    \"mass\": 3.0,\n    \"collider\": \"collider.glb\"\n  }\n}\n```\n\n这个 schema 可以先保持宽松，随着 pipeline 稳定再固化。\n\n## 12. 结论\n\n`SceneVersepp` 和 `image-blaster` 都对 Video2Mesh 有参考价值，但它们解决的是不同问题。\n\n`SceneVersepp` 适合作为 3D scene understanding 和数据组织参考。它展示了如何把重建后的场景 mesh、metadata、point-level instance labels 和 3D layout 组织成训练数据，并进一步训练 object detection 和 instance segmentation 模型。但它并不直接提供任意扫描视频到 3DGS 和 3D semantic masks 的完整推理系统。\n\n`image-blaster` 适合作为资产生成和 viewer 参考。它展示了如何从单张图生成环境 splat、物体 mesh 和可交互浏览器场景，并提供了清晰的 object asset organization。但它不处理视频、多视角、真实相机位姿、3DGS 训练或物体级 3D mask。\n\n因此，Video2Mesh 的核心工作是补齐中间桥接层：\n\n```text\n真实视频重建\n  + 2D segmentation/tracking\n  + 2D-to-3D semantic fusion\n  + object frame selection\n  + object-centric mesh generation\n  + simulator export\n```\n\n短期最现实的路线是：先用传统 SfM/3DGS 跑通真实扫描场景，再用 2D segmentation 和 tracking 生成物体 tracks，通过投影融合得到 3D masks，并用 object mask cloud OBJ 作为临时 debug mesh 检查尺度、位置和导出接口。这个 OBJ baseline 会很碎，只能证明链路闭合，不能代表最终资产质量。长期和生产路线应升级为 3DGS-to-mesh：从 3DGS 在真实相机位姿下渲染多视角 depth/normal/mask，再用 TSDF fusion、Poisson surface extraction 或 NeuS-style SDF refinement 提取物体表面，从而提高真实几何一致性。\n\n## 13. 下一步建议\n\n优先级最高的下一步不是训练大模型，而是先做一个可运行的 end-to-end prototype：\n\n1. 选一个简单室内扫描视频。\n2. 跑通 COLMAP + 3DGS。\n3. 对抽帧运行 2D segmentation 和 tracking。\n4. 将 2D masks 投影融合到点云，得到 object-level 3D masks。\n5. 为每个 object 自动选多视角真实帧和 mask。\n6. 从 3DGS 渲染 object-centric depth/normal/mask，做 TSDF fusion / Poisson / NeuS-style surface extraction 得到 `.obj` 或 `.glb`。\n7. 用 viewer 检查场景 3DGS、object mask 和 mesh 是否能对齐。\n\n这个 prototype 一旦跑通，就可以围绕失败案例逐步增强：更好的 tracking、更稳的 3D fusion、更好的选帧、多视角 mesh、仿真器专用导出和人工校正界面。\n",
      "headings": [
        {
          "level": "2",
          "text": "1. 背景与任务目标",
          "slug": "1.-背景与任务目标"
        },
        {
          "level": "2",
          "text": "2. 两个参考项目总览",
          "slug": "2.-两个参考项目总览"
        },
        {
          "level": "2",
          "text": "3. SceneVerse++ 详细理解",
          "slug": "3.-sceneverse-详细理解"
        },
        {
          "level": "3",
          "text": "3.1 项目定位",
          "slug": "3.1-项目定位"
        },
        {
          "level": "3",
          "text": "3.2 data_processing：视频与相机数据处理",
          "slug": "3.2-data-processing视频与相机数据处理"
        },
        {
          "level": "3",
          "text": "3.3 SVPP 数据形态",
          "slug": "3.3-svpp-数据形态"
        },
        {
          "level": "3",
          "text": "3.4 SpatialLM：3D object/layout detection",
          "slug": "3.4-spatiallm3d-object-layout-detection"
        },
        {
          "level": "3",
          "text": "3.5 PQ3D：3D instance segmentation",
          "slug": "3.5-pq3d3d-instance-segmentation"
        },
        {
          "level": "3",
          "text": "3.6 SceneVerse++ 对 Video2Mesh 的启发与限制",
          "slug": "3.6-sceneverse-对-video2mesh-的启发与限制"
        },
        {
          "level": "2",
          "text": "4. image-blaster 详细理解",
          "slug": "4.-image-blaster-详细理解"
        },
        {
          "level": "3",
          "text": "4.1 项目定位",
          "slug": "4.1-项目定位"
        },
        {
          "level": "3",
          "text": "4.2 项目目录与产物约定",
          "slug": "4.2-项目目录与产物约定"
        },
        {
          "level": "3",
          "text": "4.3 World Labs Marble：单图到静态环境 splat",
          "slug": "4.3-world-labs-marble单图到静态环境-splat"
        },
        {
          "level": "3",
          "text": "4.4 Hunyuan 3D / Meshy：单图到物体 mesh",
          "slug": "4.4-hunyuan-3d-meshy单图到物体-mesh"
        },
        {
          "level": "3",
          "text": "4.5 React/Three.js Viewer",
          "slug": "4.5-react-three.js-viewer"
        },
        {
          "level": "3",
          "text": "4.6 image-blaster 对 Video2Mesh 的启发与限制",
          "slug": "4.6-image-blaster-对-video2mesh-的启发与限制"
        },
        {
          "level": "2",
          "text": "5. 目标系统推荐技术路线",
          "slug": "5.-目标系统推荐技术路线"
        },
        {
          "level": "3",
          "text": "5.1 总体架构",
          "slug": "5.1-总体架构"
        },
        {
          "level": "3",
          "text": "5.2 视频预处理与抽帧",
          "slug": "5.2-视频预处理与抽帧"
        },
        {
          "level": "3",
          "text": "5.3 相机位姿与场景 3DGS",
          "slug": "5.3-相机位姿与场景-3dgs"
        },
        {
          "level": "3",
          "text": "5.4 帧级 2D segmentation / detection / tracking",
          "slug": "5.4-帧级-2d-segmentation-detection-tracking"
        },
        {
          "level": "3",
          "text": "5.5 2D mask 到 3D mask 的融合",
          "slug": "5.5-2d-mask-到-3d-mask-的融合"
        },
        {
          "level": "3",
          "text": "5.6 每个物体自动选帧",
          "slug": "5.6-每个物体自动选帧"
        },
        {
          "level": "3",
          "text": "5.7 每个物体 mesh 重建",
          "slug": "5.7-每个物体-mesh-重建"
        }
      ],
      "reading_minutes": 8
    },
    {
      "id": "svlgaussian-frame-matching-notes",
      "title": "Video2Mesh 帧匹配算法说明",
      "category": "Notes",
      "summary": "更新时间：2026-06-20 帧匹配模块解决的问题是： 给定一个已经有 2D masks 和 3D mask 的物体，自动找出若干相关帧，用于后续物体裁图、单物体 mesh 或多视角 mesh 重建。 它不是传统图像检索，也不是完整复现 SVLGaussian 论文。当前实现采用的是论文里的 view-selection protocol 工程化适配：RE10K 的 5/10 frame offset、30-frame random ...",
      "source_path": "SVLGaussian_frame_matching_notes.md",
      "source_kind": "builtin",
      "updated": "2026-06-22",
      "tags": [
        "Notes"
      ],
      "body": "# Video2Mesh 帧匹配算法说明\n\n更新时间：2026-06-20\n\n## 1. 算法目的\n\n帧匹配模块解决的问题是：\n\n给定一个已经有 2D masks 和 3D mask 的物体，自动找出若干相关帧，用于后续物体裁图、单物体 mesh 或多视角 mesh 重建。\n\n它不是传统图像检索，也不是完整复现 SVLGaussian 论文。当前实现采用的是论文里的 view-selection protocol 工程化适配：RE10K 的 5/10 frame offset、30-frame random interval，以及 lerf_ovs 的 ±3 frame visibility window，并结合 Video2Mesh 已有的 object mask 可见性和 crop 多样性。\n\n## 2. 输入\n\n每个 object 有：\n\n```text\nmasks/2d/<object_id>/<frame>.png\nmasks/3d/<object_id>/point_indices.json\nscene/frames 或 scene/mast3r_keyframes\ncamera_info.json\n```\n\n每个候选帧会计算：\n\n- mask area：物体在图像里是否足够大。\n- hit points：该帧 mask 能解释多少 3D 点。\n- sharpness：裁图是否模糊。\n- masked crop feature：用于去重和视角多样性。\n\n## 3. 选择步骤\n\n### Step 1：选 anchor\n\n选择质量最高、可见性最好的帧：\n\n```text\nreason = svlgaussian_anchor_best_visible\n```\n\n当前策略优先选择能覆盖更多 offset 的 anchor，再按 object 可见性分数排序：\n\n```text\nreason = svlgaussian_anchor_offset_coverage\n```\n\n### Step 2：补 5/10 frame offset\n\n围绕 anchor 查找：\n\n```text\nanchor +/- 5\nanchor +/- 10\n```\n\n允许 visibility window：\n\n```text\n±3 frames\n```\n\n输出 reason：\n\n```text\nsvlgaussian_offset_5\nsvlgaussian_offset_10\n```\n\n### Step 3：补随机窗口\n\n在 anchor 附近：\n\n```text\n±30 frames\n```\n\n用固定 seed 选择一个可复现的补充视角：\n\n```text\nsvlgaussian_random_window_30\n```\n\n### Step 4：masked crop diversity fallback\n\n默认 `top_k=4`，对应：\n\n```text\nanchor + offset_5 + offset_10 + random_window\n```\n\n如果候选帧不足或无法满足 offset/random slot，才对候选 crop 计算简化视觉特征：\n\n```text\nmask bbox crop -> grayscale -> resize 32x32 -> normalize -> dot-product similarity\n```\n\n然后按：\n\n```text\nquality_score - similarity_penalty * max_similarity + temporal_bonus\n```\n\n补足剩余帧。\n\n## 4. 输出\n\n```text\nobjects/<object_id>/selected_frames/\nsimulator_assets/selected_frames.json\nsimulator_assets/frame_selection_matching/frame_selection_matching_report.json\nsimulator_assets/frame_selection_quality_report.json\n```\n\n每条记录会保存：\n\n- frame id\n- score\n- selection reason\n- mask/crop path\n- offset coverage\n- protocol_slots.expected_top_k\n- per-object offset match details\n\n其中 `frame_selection_matching_report.json` 会记录官方 DOI：\n\n```text\n10.1049/cit2.70148\n```\n\n并显式说明采用的是 SVLGaussian 的 view-selection protocol，而不是完整单图 SVLGaussian pipeline。\n\n## 5. 当前局限\n\n- 如果 SAM2 masks 本身过分割，选帧会为“碎片 object”选帧，而不是完整真实物体。\n- 如果物体只在少数 keyframes 可见，5/10 offset 可能无法满足。\n- 当前 crop feature 是轻量灰度特征，不是 CLIP/DINOv2 级别的语义匹配。\n- 对花草、折叠椅、杆状物等复杂结构，需要先提升 segmentation 和 object merge，再谈高质量 mesh。\n\n## 6. 推荐升级\n\n1. 用 DINOv2/CLIP crop feature 替代 32x32 灰度特征。\n2. 结合 camera baseline 和 viewing angle 选择真正多视角帧。\n3. 将 object merge 结果反馈到 frame selection，避免为碎片单独重建 mesh。\n4. 对每个 selected frame 增加可视化 QA：原图、mask、crop、命中 3D 点。\n",
      "headings": [
        {
          "level": "2",
          "text": "1. 算法目的",
          "slug": "1.-算法目的"
        },
        {
          "level": "2",
          "text": "2. 输入",
          "slug": "2.-输入"
        },
        {
          "level": "2",
          "text": "3. 选择步骤",
          "slug": "3.-选择步骤"
        },
        {
          "level": "3",
          "text": "Step 1：选 anchor",
          "slug": "step-1选-anchor"
        },
        {
          "level": "3",
          "text": "Step 2：补 5/10 frame offset",
          "slug": "step-2补-5-10-frame-offset"
        },
        {
          "level": "3",
          "text": "Step 3：补随机窗口",
          "slug": "step-3补随机窗口"
        },
        {
          "level": "3",
          "text": "Step 4：masked crop diversity fallback",
          "slug": "step-4masked-crop-diversity-fallback"
        },
        {
          "level": "2",
          "text": "4. 输出",
          "slug": "4.-输出"
        },
        {
          "level": "2",
          "text": "5. 当前局限",
          "slug": "5.-当前局限"
        },
        {
          "level": "2",
          "text": "6. 推荐升级",
          "slug": "6.-推荐升级"
        }
      ],
      "reading_minutes": 1
    },
    {
      "id": "video2mesh-real-demo-runbook",
      "title": "Video2Mesh 真实实验运行手册",
      "category": "Runs",
      "summary": "更新时间：2026-06-20 推荐 Python： SAM2 Python： 不要优先用 conda base 跑完整流程；base 的 PyTorch 可用，但历史上 OpenCV/NumPy/Scipy 组合出现过 ABI 和递归问题。 输出目录： 当前默认： - MASt3R-SLAM 抽取 keyframes、camera poses 和 full point cloud。",
      "source_path": "Video2Mesh_real_demo_runbook.md",
      "source_kind": "builtin",
      "updated": "2026-06-22",
      "tags": [
        "Runs"
      ],
      "body": "# Video2Mesh 真实实验运行手册\n\n更新时间：2026-06-20\n\n## 1. 远端环境\n\n```bash\nssh -p 14225 root@connect.westd.seetacloud.com\ncd /root/autodl-tmp/workspace/Video2Mesh\nsource /etc/network_turbo >/dev/null 2>&1 || true\n```\n\n推荐 Python：\n\n```text\n/root/autodl-tmp/venvs/v2m-svpp/bin/python\n```\n\nSAM2 Python：\n\n```text\n/root/autodl-tmp/workspace/venvs/v2m-sam2-clean/bin/python\n```\n\n不要优先用 conda base 跑完整流程；base 的 PyTorch 可用，但历史上 OpenCV/NumPy/Scipy 组合出现过 ABI 和递归问题。\n\n## 2. 一条视频跑完整流程\n\n```bash\ncd /root/autodl-tmp/workspace/Video2Mesh\n\nbash tools/run_video2mesh_quick.sh dataset/<video>.mp4\n```\n\n输出目录：\n\n```text\nexports/<video_slug>_quick_<timestamp>\n```\n\n当前默认：\n\n- MASt3R-SLAM 抽取 keyframes、camera poses 和 full point cloud。\n- GraphDECO 训练 3DGS。\n- SAM v1 生成 prompts。\n- SAM2.1 tiny 跟踪 masks。\n- full `point_cloud.ply` 做 3D semantic fusion。\n- 导出 viewer PLY、object images、baseline mesh、simulator bundle 和 QA。\n\n## 3. bedroom_100 当前实验规则\n\n输入：\n\n```text\ndataset/bedroom_100.mp4\n```\n\n如果 MASt3R-SLAM 运行超过 1.5 小时仍无：\n\n```text\nexports/<run>/scene/cameras/camera_info.json\nexports/<run>/scene/reconstruction/point_cloud.ply\n```\n\n则停止该次 MASt3R，裁剪前 60 秒：\n\n```bash\nffmpeg -y \\\n  -i dataset/bedroom_100.mp4 \\\n  -t 60 \\\n  -c copy \\\n  dataset/bedroom_100_first60.mp4\n```\n\n如 stream copy 失败：\n\n```bash\nffmpeg -y \\\n  -i dataset/bedroom_100.mp4 \\\n  -t 60 \\\n  -c:v libx264 -crf 18 -preset veryfast \\\n  -c:a copy \\\n  dataset/bedroom_100_first60.mp4\n```\n\n然后把裁剪视频作为新数据集重跑：\n\n```bash\nbash tools/run_video2mesh_quick.sh dataset/bedroom_100_first60.mp4\n```\n\n## 4. 监控命令\n\n查看进程：\n\n```bash\nps -eo pid,ppid,pgid,etime,stat,pcpu,pmem,cmd | \\\n  grep -E \"run_video2mesh_quick|MASt3R-SLAM|mast3r|graphdeco|train.py\" | \\\n  grep -v grep\n```\n\n查看 GPU：\n\n```bash\nnvidia-smi\n```\n\n查看关键输出是否出现：\n\n```bash\nfind exports/<run>/scene -maxdepth 4 \\\n  \\( -name camera_info.json -o -name point_cloud.ply \\) -ls\n```\n\n查看 MASt3R 日志：\n\n```bash\ntail -80 exports/<run>/logs/mast3r_slam_run.log\n```\n\n## 5. 单独补跑 GraphDECO\n\n如果 run 已经有相机和 full cloud，但 active 3DGS 不是 GraphDECO：\n\n```bash\ncd /root/autodl-tmp/workspace/Video2Mesh\n\nITERATIONS=7000 RESOLUTION=1 \\\nbash tools/run_graphdeco_3dgs.sh exports/<run>\n```\n\n低显存 fallback 顺序：\n\n1. 保持 full `point_cloud.ply`。\n2. 降低 `RESOLUTION`，例如 `RESOLUTION=2`。\n3. 降低 `ITERATIONS`，例如 `ITERATIONS=3000`。\n4. 只有完全无法训练时，才考虑实验性点数限制；这不是默认策略。\n\n## 6. 展示产物\n\n| 目标 | 文件 |\n|---|---|\n| 总览网页 | `simulator_assets/review/index.html` |\n| 场景普通点云 | `simulator_assets/viewer_plys/scene_3dgs_point_cloud.ply` |\n| 场景 SuperSplat | `simulator_assets/viewer_plys/scene_3dgs_supersplat.ply` |\n| 语义 SuperSplat | `simulator_assets/viewer_plys/semantic_3dgs_supersplat.ply` |\n| 概率语义 3DGS | `simulator_assets/semantic_gaussian_probability_supersplat.ply` |\n| 3D semantic masks | `simulator_assets/object_masks_3d/*.ply` |\n| 物体相关帧 | `objects/<object_id>/selected_frames/` |\n| 物体裁图 | `objects/<object_id>/object_images/` |\n| 粗 mesh | `simulator_assets/reconstructed_meshes/<object_id>/` |\n| 仿真资产 | `simulator_assets/simulator_asset_bundle.json` |\n| MuJoCo | `simulator_assets/adapters/mujoco/scene.xml` |\n| Unity | `simulator_assets/adapters/unity/unity_adapter.json` |\n| QA | `simulator_assets/evaluation_report.json` |\n\n## 7. 结束后检查\n\n```bash\npython -m video2mesh.cli evaluate \\\n  --project-root exports/<run> \\\n  --json \\\n  --output exports/<run>/simulator_assets/evaluation_report.json\n\npython -m video2mesh.cli production-readiness \\\n  --project-root exports/<run> \\\n  --no-require-scale-calibration\n\npython -m video2mesh.cli verify-showcase-pack \\\n  --project-root exports/<run> \\\n  --require-semantic-probability \\\n  --no-require-review-tar \\\n  --no-scan-common-remote-roots\n```\n\n如果 `production_ready=false` 但 `demo_ready=true`，当前阶段可以接受。主要原因通常是：语义标签仍弱、mesh 仍粗、scale/physics 未真实标定。\n\n## 8. bedroom_100 当前检查点\n\n2026-06-20 的 `bedroom_100` 实验状态：\n\n- 原始 `dataset/bedroom_100.mp4` 时长约 604.5 秒，MASt3R 超过 1.5 小时仍未产出相机/有效点云，已中断。\n- 已生成新数据集 `dataset/bedroom_100_first60.mp4`，时长约 59.99 秒。\n- first60 run 路径为 `exports/bedroom_100_first60_quick_first60_graphdeco_20260620_052824`。\n- first60 使用 GraphDECO quick 入口，但 MASt3R 只产生 1 pose 和空点云，GraphDECO 未能开始训练。\n- 失败信息：`No points found in point cloud`。\n- 因未跑通，不执行 `video2mesh/cli.py` 拆分。\n",
      "headings": [
        {
          "level": "2",
          "text": "1. 远端环境",
          "slug": "1.-远端环境"
        },
        {
          "level": "2",
          "text": "2. 一条视频跑完整流程",
          "slug": "2.-一条视频跑完整流程"
        },
        {
          "level": "2",
          "text": "3. bedroom_100 当前实验规则",
          "slug": "3.-bedroom-100-当前实验规则"
        },
        {
          "level": "2",
          "text": "4. 监控命令",
          "slug": "4.-监控命令"
        },
        {
          "level": "2",
          "text": "5. 单独补跑 GraphDECO",
          "slug": "5.-单独补跑-graphdeco"
        },
        {
          "level": "2",
          "text": "6. 展示产物",
          "slug": "6.-展示产物"
        },
        {
          "level": "2",
          "text": "7. 结束后检查",
          "slug": "7.-结束后检查"
        },
        {
          "level": "2",
          "text": "8. bedroom_100 当前检查点",
          "slug": "8.-bedroom-100-当前检查点"
        }
      ],
      "reading_minutes": 1
    },
    {
      "id": "remote-setup-status",
      "title": "Video2Mesh 远端环境状态",
      "category": "Runs",
      "summary": "更新时间：2026-06-20 GPU： 主 Python： 已验证包： - PyTorch CUDA 可用。 - OpenCV drawing 可用。 - Open3D / NumPy / SciPy / scikit-learn 可用于当前 CLI。 - video2mesh.cli 可编译。 不推荐默认使用 conda base 跑完整流程；base 里曾出现 OpenCV/NumPy/Scipy 组合问题。",
      "source_path": "REMOTE_SETUP_STATUS.md",
      "source_kind": "builtin",
      "updated": "2026-06-22",
      "tags": [
        "Runs"
      ],
      "body": "# Video2Mesh 远端环境状态\n\n更新时间：2026-06-20\n\n## 1. 路径\n\n```text\n远端项目：/root/autodl-tmp/workspace/Video2Mesh\n远端数据：/root/autodl-tmp/workspace/Video2Mesh/dataset\n远端输出：/root/autodl-tmp/workspace/Video2Mesh/exports\nMASt3R-SLAM：/root/autodl-tmp/workspace/MASt3R-SLAM\nGraphDECO：/root/autodl-tmp/workspace/gaussian-splatting\nSAM2：/root/autodl-tmp/workspace/sam2\n主 venv：/root/autodl-tmp/venvs/v2m-svpp\nSAM2 venv：/root/autodl-tmp/workspace/venvs/v2m-sam2-clean\n```\n\n## 2. GPU 和 Python\n\nGPU：\n\n```text\nNVIDIA GeForce RTX 4080 SUPER\nCUDA runtime: torch 2.5.1+cu124\n```\n\n主 Python：\n\n```bash\n/root/autodl-tmp/venvs/v2m-svpp/bin/python\n```\n\n已验证包：\n\n- PyTorch CUDA 可用。\n- OpenCV drawing 可用。\n- Open3D / NumPy / SciPy / scikit-learn 可用于当前 CLI。\n- `video2mesh.cli` 可编译。\n\n不推荐默认使用 conda base 跑完整流程；base 里曾出现 OpenCV/NumPy/Scipy 组合问题。\n\n## 3. 权重\n\n远端权重：\n\n```text\n/root/autodl-tmp/checkpoints/sam/sam_vit_b_01ec64.pth\n/root/autodl-tmp/workspace/sam2/checkpoints/sam2.1_hiera_tiny.pt\n/root/autodl-tmp/workspace/MASt3R-SLAM/checkpoints/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric.pth\n```\n\n本地同步目标：\n\n```text\n/Users/zhangyuxiang/Desktop/worksplace/Video2Mesh/checkpoints/sam/sam_vit_b_01ec64.pth\n/Users/zhangyuxiang/Desktop/worksplace/Video2Mesh/checkpoints/sam2/sam2.1_hiera_tiny.pt\n/Users/zhangyuxiang/Desktop/worksplace/Video2Mesh/checkpoints/mast3r/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric.pth\n```\n\n这些文件不进 Git，已由 `.gitignore` 排除。\n\n## 4. GraphDECO 状态\n\nGraphDECO repo：\n\n```text\n/root/autodl-tmp/workspace/gaussian-splatting\n```\n\n已处理：\n\n- 主 repo 已同步到远端。\n- `submodules/simple-knn` 已安装并可导入。\n- `submodules/diff-gaussian-rasterization` 已安装并可导入。\n- `diff-gaussian-rasterization/third_party/glm` 已补齐。\n- `fused-ssim` 是可选项；当前可不装，GraphDECO 会使用 fallback SSIM。\n- `train.py --help` 已通过。\n\n运行 GraphDECO 时需要把 torch shared library 加入 `LD_LIBRARY_PATH`。`tools/run_video2mesh_quick.sh` 和 `tools/run_graphdeco_3dgs.sh` 已自动处理。\n\n## 5. 快速入口\n\n```bash\ncd /root/autodl-tmp/workspace/Video2Mesh\nsource /etc/network_turbo >/dev/null 2>&1 || true\n\nbash tools/run_video2mesh_quick.sh dataset/<video>.mp4\n```\n\n脚本默认：\n\n- `GS_BACKEND=graphdeco`\n- `MASK_BACKEND=sam2`\n- `GRAPHDECO_ITERATIONS=7000`\n- `GRAPHDECO_RESOLUTION=1`\n- 不降采样 MASt3R full cloud\n- GraphDECO 默认 `DENSIFY_UNTIL_ITER=0` / `GRAPHDECO_DENSIFY_UNTIL_ITER=0`，即保留 full cloud 初始化但关闭 densification，避免 16M+ 初始化点在 32GB 显存上 OOM。\n\n单独补跑 GraphDECO：\n\n```bash\nITERATIONS=7000 RESOLUTION=1 \\\nbash tools/run_graphdeco_3dgs.sh exports/<run>\n```\n\n## 6. MASt3R 超时策略\n\n长视频规则：\n\n- MASt3R-SLAM 运行小于 1.5 小时时，只要 GPU/CPU 有持续负载就不杀。\n- 超过 1.5 小时仍未产出 `camera_info.json` 和 `point_cloud.ply`，中断当前 run。\n- 裁剪前 60 秒到 `dataset/<name>_first60.mp4`。\n- 对裁剪视频重新跑 quick script。\n- 对 `*_first60.mp4` 使用 30 分钟 MASt3R 预算；如果超时，或虽然结束但 readiness 显示单 pose / 空点云，则裁剪更稳定的 10 秒片段到 `dataset/<name>_best10.mp4` 继续。\n- 远端没有 `ffmpeg` 时，用 `python tools/crop_best_video_window.py ...`，该脚本基于 OpenCV 写出新 dataset 视频。\n\n裁剪命令：\n\n```bash\nffmpeg -y -i dataset/<name>.mp4 -t 60 -c copy dataset/<name>_first60.mp4\n```\n\n重编码 fallback：\n\n```bash\nffmpeg -y -i dataset/<name>.mp4 -t 60 \\\n  -c:v libx264 -crf 18 -preset veryfast \\\n  -c:a copy dataset/<name>_first60.mp4\n```\n\nOpenCV fallback：\n\n```bash\npython tools/crop_best_video_window.py dataset/<name>_first60.mp4 \\\n  --duration 10 \\\n  --output dataset/<name>_first60_best10.mp4 \\\n  --force\n```\n\n远端恢复下游阶段：\n\n```bash\nbash tools/run_video2mesh_downstream_light.sh \\\n  exports/<run> \\\n  dataset/<name>_first60_best10.mp4\n```\n\n该入口默认使用 SAM2，但限制 prompt/object 数和 tracking 帧数，并跳过最重的 Gaussian semantic backprojection。若只需要补语义 splat，可设置 `SEMANTIC_SPLATS=1`；若机器负载正常再设置 `GAUSSIAN_BACKPROJECT=1`。\n\n注意：该入口不降采样 object mask fusion 使用的 full cloud，但默认限制背景平面 RANSAC/Fit 采样点数，避免背景结构推断在 16M+ 点云上把机器压到无法 SSH。\n\n导师展示产物审计：\n\n```bash\nbash tools/audit_showcase_artifacts.sh exports/<run>\n```\n\n## 7. 网络和磁盘\n\nGitHub/HuggingFace 下载前：\n\n```bash\nsource /etc/network_turbo\n```\n\n注意事项：\n\n- 大模型、数据集、exports、checkpoints 都放 `/root/autodl-tmp`。\n- 清理 pip cache 可释放系统盘：`rm -rf /root/.cache/pip`。\n- 不要把 `exports/`、`dataset/`、`checkpoints/` 推到 GitHub。\n\n## 8. 当前风险\n\n- 长视频 MASt3R 可能耗时超过 1.5 小时，需要裁剪策略。\n- GraphDECO 训练真实质量依赖位姿质量、训练帧和分辨率；OOM 时优先降分辨率，不降 full cloud。\n- SAM2 tiny 对复杂家具和植物仍可能过分割。\n- 当前 mesh 是 baseline，生产质量需要外部物体重建。\n\n## 9. 2026-06-20 bedroom_100 检查点\n\n输入数据：\n\n```text\ndataset/bedroom_100.mp4\n```\n\n执行结果：\n\n- 原始 604.5 秒视频运行 MASt3R-SLAM 超过 1.5 小时仍未产出 `camera_info.json` 和有效 `point_cloud.ply`，已按规则中断。\n- 已用 OpenCV 裁剪前 60 秒为新数据集：\n\n```text\ndataset/bedroom_100_first60.mp4\n```\n\n裁剪文件信息：\n\n```text\nduration: 59.993s\nfps: 29.97\nframes: 1798\nresolution: 640x360\nsize: 42 MB\n```\n\nfirst60 GraphDECO quick run：\n\n```text\nexports/bedroom_100_first60_quick_first60_graphdeco_20260620_052824\n```\n\n状态：\n\n- `tools/run_video2mesh_quick.sh` 已确认使用 `GS_BACKEND=graphdeco`，命令中包含 `3dgs_graphdeco` 和 GraphDECO `train.py --disable_viewer`。\n- first60 在 30 分钟阈值内结束 MASt3R，但只导入 `1` 个 pose。\n- `scene/reconstruction/point_cloud.ply` 是空 PLY，Open3D 报 `Read PLY failed: number of vertex <= 0`。\n- `reconstruction-readiness` 已能提前诊断该状态：`frames=1 poses=1 points=0`，`ok=False colmap=False 3dgs=False mask_fusion=False`。\n- pipeline 现在会在 GraphDECO source/point-cloud 准备前写 `simulator_assets/reconstruction_readiness_report.json` 并停止，避免空点云继续进入训练。\n- 该 first60 片段未进入 GraphDECO 训练；后续已裁剪更稳定的 10 秒片段继续。\n\n后续执行：\n\n1. 已对 `bedroom_100_first60.mp4` 选择更有视差和稳定运动的 10 秒片段，保存为 `dataset/bedroom_100_first60_best10.mp4`。\n2. 该 best10 片段已跑通 MASt3R full cloud，并进入 GraphDECO/SAM2 后半段验证。\n3. `video2mesh/cli.py` 在 GraphDECO 训练跑通后做了第一批低风险拆分，把 3DGS path/helper 逻辑移到 `video2mesh/gsplat_utils.py`。\n",
      "headings": [
        {
          "level": "2",
          "text": "1. 路径",
          "slug": "1.-路径"
        },
        {
          "level": "2",
          "text": "2. GPU 和 Python",
          "slug": "2.-gpu-和-python"
        },
        {
          "level": "2",
          "text": "3. 权重",
          "slug": "3.-权重"
        },
        {
          "level": "2",
          "text": "4. GraphDECO 状态",
          "slug": "4.-graphdeco-状态"
        },
        {
          "level": "2",
          "text": "5. 快速入口",
          "slug": "5.-快速入口"
        },
        {
          "level": "2",
          "text": "6. MASt3R 超时策略",
          "slug": "6.-mast3r-超时策略"
        },
        {
          "level": "2",
          "text": "7. 网络和磁盘",
          "slug": "7.-网络和磁盘"
        },
        {
          "level": "2",
          "text": "8. 当前风险",
          "slug": "8.-当前风险"
        },
        {
          "level": "2",
          "text": "9. 2026-06-20 bedroom_100 检查点",
          "slug": "9.-2026-06-20-bedroom-100-检查点"
        }
      ],
      "reading_minutes": 2
    },
    {
      "id": "video2mesh-milscene2-showcase",
      "title": "Video2Mesh 展示清单：milscene2",
      "category": "Runs",
      "summary": "更新时间：2026-06-20 milscene2 是早期真实视频 baseline，用于验证： - MASt3R-SLAM 导入。 - 3DGS viewer PLY 导出。 - 2D mask 到 3D semantic mask。 - object frame selection。 - baseline mesh 和 simulator bundle。",
      "source_path": "Video2Mesh_milscene2_showcase.md",
      "source_kind": "builtin",
      "updated": "2026-06-22",
      "tags": [
        "Runs"
      ],
      "body": "# Video2Mesh 展示清单：milscene2\n\n更新时间：2026-06-20\n\n## 1. 定位\n\n`milscene2` 是早期真实视频 baseline，用于验证：\n\n- MASt3R-SLAM 导入。\n- 3DGS viewer PLY 导出。\n- 2D mask 到 3D semantic mask。\n- object frame selection。\n- baseline mesh 和 simulator bundle。\n\n它保留为历史对照；新实验默认使用 GraphDECO 3DGS 和 SAM2。\n\n## 2. 推荐查看路径\n\n```text\nexports/milscene2_hq_20260618_065920\n```\n\n关键文件：\n\n| 展示目标 | 文件 |\n|---|---|\n| Review HTML | `simulator_assets/review/index.html` |\n| 普通 3DGS 点云 | `simulator_assets/viewer_plys/scene_3dgs_point_cloud.ply` |\n| SuperSplat 3DGS | `simulator_assets/viewer_plys/scene_3dgs_supersplat.ply` |\n| 语义 SuperSplat | `simulator_assets/viewer_plys/semantic_3dgs_supersplat.ply` |\n| semantic splats | `simulator_assets/semantic_splats.ply` |\n| 3D masks | `simulator_assets/object_masks_3d/*.ply` |\n| simulator bundle | `simulator_assets/simulator_asset_bundle.json` |\n| MuJoCo | `simulator_assets/adapters/mujoco/scene.xml` |\n| QA | `simulator_assets/evaluation_report.json` |\n\n## 3. 和当前默认流程的差异\n\n| 项 | milscene2 历史 run | 当前默认 |\n|---|---|---|\n| 3DGS | minimal gsplat baseline | GraphDECO |\n| masks | SAM/SAM bbox tracking 为主 | SAM prompts + SAM2 video tracking |\n| 点云 | 已逐步改为 full cloud | full `point_cloud.ply` 默认 |\n| mesh | object mask cloud baseline | baseline，后续接 Hunyuan/Meshy/多视角 |\n| 目标 | 工程闭环验证 | 高质量真实实验 |\n\n## 4. 结论\n\n`milscene2` 可用于展示“系统已经闭环”，但不应作为当前最高质量默认结果。当前新实验应优先看 GraphDECO quick pipeline 输出。\n",
      "headings": [
        {
          "level": "2",
          "text": "1. 定位",
          "slug": "1.-定位"
        },
        {
          "level": "2",
          "text": "2. 推荐查看路径",
          "slug": "2.-推荐查看路径"
        },
        {
          "level": "2",
          "text": "3. 和当前默认流程的差异",
          "slug": "3.-和当前默认流程的差异"
        },
        {
          "level": "2",
          "text": "4. 结论",
          "slug": "4.-结论"
        }
      ],
      "reading_minutes": 1
    },
    {
      "id": "video2mesh-milscene3-showcase",
      "title": "Video2Mesh 展示清单：milscene3 与当前默认流程",
      "category": "Runs",
      "summary": "更新时间：2026-06-20 milscene3_full_20260618_124804 是已完成的端到端 baseline 展示包，证明工程链路已经闭合： 它不是最终生产质量结果。新实验默认切到 GraphDECO 3DGS；该历史 run 中的 active 3DGS 仍是 minimal gsplat full-cloud baseline。",
      "source_path": "Video2Mesh_milscene3_showcase.md",
      "source_kind": "builtin",
      "updated": "2026-06-22",
      "tags": [
        "Runs"
      ],
      "body": "# Video2Mesh 展示清单：milscene3 与当前默认流程\n\n更新时间：2026-06-20\n\n## 1. 当前展示定位\n\n`milscene3_full_20260618_124804` 是已完成的端到端 baseline 展示包，证明工程链路已经闭合：\n\n```text\n扫描视频 -> 3DGS -> 3D semantic masks -> object frames -> mesh -> simulator assets\n```\n\n它不是最终生产质量结果。新实验默认切到 GraphDECO 3DGS；该历史 run 中的 active 3DGS 仍是 minimal gsplat full-cloud baseline。\n\n远端路径：\n\n```text\n/root/autodl-tmp/workspace/Video2Mesh/exports/milscene3_full_20260618_124804\n```\n\n本地路径：\n\n```text\n/Users/zhangyuxiang/Desktop/worksplace/Video2Mesh/exports/milscene3_full_20260618_124804\n```\n\n## 2. 展示产物表\n\n| 展示目标 | 文件 |\n|---|---|\n| 总览网页 | `simulator_assets/review/index.html` |\n| 场景级 3DGS | `simulator_assets/viewer_plys/scene_3dgs_supersplat.ply` |\n| 普通场景点云 | `simulator_assets/viewer_plys/scene_3dgs_point_cloud.ply` |\n| 语义 3DGS | `simulator_assets/viewer_plys/semantic_3dgs_supersplat.ply` |\n| 语义普通点云 | `simulator_assets/viewer_plys/semantic_3dgs_point_cloud.ply` |\n| Gaussian probability | `simulator_assets/semantic_gaussian_probability_supersplat.ply` |\n| 3D mask clouds | `simulator_assets/object_masks_3d/*.ply` |\n| 物体选帧 | `objects/<object_id>/selected_frames/` |\n| 物体裁图 | `objects/<object_id>/object_images/` |\n| baseline mesh | `simulator_assets/reconstructed_meshes/<object_id>/` |\n| simulator bundle | `simulator_assets/simulator_asset_bundle.json` |\n| MuJoCo adapter | `simulator_assets/adapters/mujoco/scene.xml` |\n| Unity adapter | `simulator_assets/adapters/unity/unity_adapter.json` |\n| evaluation | `simulator_assets/evaluation_report.json` |\n| showcase verification | `simulator_assets/showcase_pack_verification.json` |\n| production readiness | `simulator_assets/production_readiness_report.json` |\n\n## 3. 推荐展示顺序\n\n1. 打开 `review/index.html`，先讲完整链路。\n2. 用 SuperSplat 打开 `scene_3dgs_supersplat.ply`，展示场景级 3DGS。\n3. 打开 `semantic_3dgs_supersplat.ply` 或 `semantic_gaussian_probability_supersplat.ply`，展示语义已经写入 Gaussian/point representation。\n4. 打开 `object_masks_3d/*.ply`，展示每个 object/background structure 的 3D mask。\n5. 展示 selected frames 和 object crops，说明后续 mesh 是从相关帧或 mask cloud 生成。\n6. 展示 reconstructed meshes 和 simulator asset bundle。\n7. 最后展示 readiness/QA，明确 baseline 和 production gap。\n\n## 4. 当前系统能力\n\n已完成：\n\n- 视频到相机/点云。\n- 场景级 3DGS 表达。\n- SAM2 video masks 接口。\n- 2D masks 到 3D semantic masks。\n- semantic/probability PLY 导出。\n- object frame selection。\n- coarse object mesh。\n- simulator bundle 和 MuJoCo/Unity adapter。\n- SceneVerse++/SVPP-style export contract。\n\n仍是 baseline：\n\n- 3DGS 画质依赖当前 trainer 和位姿质量。\n- object labels 仍需要 open-vocabulary/VLM。\n- SAM2 tiny 仍会把折叠椅、植物、细杆等复杂结构切碎。\n- baseline mesh 还不能直接当最终仿真 mesh。\n- scale、physics、collider 仍需真实标定和 QA。\n\n## 5. 新实验默认\n\n以后新实验不再默认用 minimal gsplat；默认使用：\n\n```bash\nbash tools/run_video2mesh_quick.sh dataset/<video>.mp4\n```\n\n其中：\n\n- `GS_BACKEND=graphdeco`\n- `MASK_BACKEND=sam2`\n- 使用 full `scene/reconstruction/point_cloud.ply`\n- 超过 1.5 小时无 MASt3R 输出时裁剪前 60 秒为新 dataset\n",
      "headings": [
        {
          "level": "2",
          "text": "1. 当前展示定位",
          "slug": "1.-当前展示定位"
        },
        {
          "level": "2",
          "text": "2. 展示产物表",
          "slug": "2.-展示产物表"
        },
        {
          "level": "2",
          "text": "3. 推荐展示顺序",
          "slug": "3.-推荐展示顺序"
        },
        {
          "level": "2",
          "text": "4. 当前系统能力",
          "slug": "4.-当前系统能力"
        },
        {
          "level": "2",
          "text": "5. 新实验默认",
          "slug": "5.-新实验默认"
        }
      ],
      "reading_minutes": 1
    },
    {
      "id": "api-remote-control",
      "title": "本机 API、用户登录与手机远程控制",
      "category": "Guide",
      "summary": "先登录本机 API，再让 Codex 或手机把 Markdown、项目记录和任务队列同步进网站。",
      "source_path": "docs-blog/content/API_REMOTE_CONTROL.md",
      "source_kind": "content",
      "updated": "2026-06-28",
      "tags": [
        "API",
        "Codex",
        "Remote",
        "Guide"
      ],
      "body": "\n# 本机 API、用户登录与手机远程控制\n\n这个网站本身仍然是 GitHub Pages 静态站。动态能力由本机侧边 API 提供：它运行在这台电脑上，负责登录鉴权、写入 Markdown、记录多个项目、接收 Codex 任务队列。\n\n## 启动 API\n\n```bash\n./docs-blog/run_api.sh\n```\n\n默认监听：\n\n```text\nhttp://127.0.0.1:8787\n```\n\n第一次启动时会生成 bootstrap token。它只用于首次创建管理员账号：\n\n```bash\ncat docs-blog/runtime/api_token.txt\n```\n\n如果想固定配置，可以创建 `docs-blog/.env`：\n\n```env\nV2M_API_TOKEN=change-this-long-random-token\nV2M_API_HOST=127.0.0.1\nV2M_API_PORT=8787\nV2M_SESSION_TTL_SECONDS=604800\nV2M_GITHUB_ALLOWED_LOGINS=Interstellar6\n```\n\n## 首次创建管理员\n\n账号建议使用：\n\n```text\nInterstellar6\n```\n\n创建管理员：\n\n```bash\nexport V2M_BOOTSTRAP_TOKEN=\"$(cat docs-blog/runtime/api_token.txt)\"\n\ncurl -H \"Authorization: Bearer $V2M_BOOTSTRAP_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"username\":\"Interstellar6\",\"password\":\"替换成强密码\"}' \\\n  http://127.0.0.1:8787/api/auth/setup\n```\n\n返回里的 `session_token` 是登录会话 token。以后访问 Mac 控制接口都用这个会话 token，而不是 bootstrap token。\n\n## 普通登录\n\n```bash\nexport V2M_SESSION_TOKEN=\"$(\n  curl -s -H \"Content-Type: application/json\" \\\n    -d '{\"username\":\"Interstellar6\",\"password\":\"替换成强密码\"}' \\\n    http://127.0.0.1:8787/api/auth/login \\\n  | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"session_token\"])'\n)\"\n```\n\n检查当前登录用户：\n\n```bash\ncurl -H \"Authorization: Bearer $V2M_SESSION_TOKEN\" \\\n  http://127.0.0.1:8787/api/auth/me\n```\n\n## GitHub 授权登录\n\n先在 GitHub 创建一个 OAuth App，Authorization callback URL 填：\n\n```text\nhttp://127.0.0.1:8787/api/auth/github/callback\n```\n\n然后在 `docs-blog/.env` 里配置：\n\n```env\nV2M_GITHUB_CLIENT_ID=你的_client_id\nV2M_GITHUB_CLIENT_SECRET=你的_client_secret\nV2M_GITHUB_REDIRECT_URI=http://127.0.0.1:8787/api/auth/github/callback\nV2M_GITHUB_ALLOWED_LOGINS=Interstellar6\n```\n\n重启 API 后，管理员界面 `#/admin` 里的“GitHub 授权登录”会打开 GitHub OAuth。API 会校验 GitHub 登录名必须在 `V2M_GITHUB_ALLOWED_LOGINS` 里，默认只允许 `Interstellar6`。\n\n## 管理员界面\n\n公开首页只展示文档，不显示 Mac 控制台。需要远程控制时，打开：\n\n```text\n#/admin\n```\n\n例如本地预览是：\n\n```text\nhttp://127.0.0.1:8000/docs-blog/#/admin\n```\n\n线上个人主页是：\n\n```text\nhttps://interstellar6.github.io/#/admin\n```\n\n## 让 Codex 同步一篇文档\n\n```bash\ncurl -H \"Authorization: Bearer $V2M_SESSION_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"title\": \"Codex Remote Note\",\n    \"category\": \"Remote\",\n    \"tags\": [\"Codex\", \"Remote\"],\n    \"markdown\": \"# Codex Remote Note\\n\\n这篇文档来自本机 API。\"\n  }' \\\n  http://127.0.0.1:8787/api/docs\n```\n\nAPI 会把文件写入：\n\n```text\ndocs-blog/content/remote/\n```\n\n然后自动运行：\n\n```bash\npython3 docs-blog/build_site.py\n```\n\n## 多项目记录\n\n添加项目：\n\n```bash\ncurl -H \"Authorization: Bearer $V2M_SESSION_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"name\": \"Video2Mesh\",\n    \"repo\": \"/Users/zhangyuxiang/Desktop/worksplace/Video2Mesh\",\n    \"summary\": \"文档站、远程 API 和任务队列\"\n  }' \\\n  http://127.0.0.1:8787/api/projects\n```\n\n读取项目：\n\n```bash\ncurl -H \"Authorization: Bearer $V2M_SESSION_TOKEN\" \\\n  http://127.0.0.1:8787/api/projects\n```\n\n## Codex 任务队列\n\n手机端或网页端可以把工作请求写入队列：\n\n```bash\ncurl -H \"Authorization: Bearer $V2M_SESSION_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"project\": \"Video2Mesh\",\n    \"prompt\": \"请 Codex 调研如何把 3DGS 场景转成可交互游戏关卡。\"\n  }' \\\n  http://127.0.0.1:8787/api/codex-tasks\n```\n\n本机 Codex 可以读取：\n\n```bash\ncurl -H \"Authorization: Bearer $V2M_SESSION_TOKEN\" \\\n  http://127.0.0.1:8787/api/codex-tasks\n```\n\n也可以用本机辅助脚本登录并读取队列：\n\n```bash\npython3 docs-blog/codex_queue.py login --username Interstellar6\npython3 docs-blog/codex_queue.py next\npython3 docs-blog/codex_queue.py list --status queued\n```\n\n执行后更新状态：\n\n```bash\ncurl -X PATCH \\\n  -H \"Authorization: Bearer $V2M_SESSION_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"status\":\"done\",\"result_summary\":\"已完成并同步到网站。\"}' \\\n  http://127.0.0.1:8787/api/codex-tasks/task-id\n```\n\n或者：\n\n```bash\npython3 docs-blog/codex_queue.py patch task-id --status done --summary \"已完成并同步到网站。\"\n```\n\n## 手机怎么连\n\n局域网内调试可以临时改成：\n\n```env\nV2M_API_HOST=0.0.0.0\n```\n\n然后手机访问同一个网站的管理员界面 `#/admin`，在 API 地址里填：\n\n```text\nhttp://这台电脑的局域网IP:8787\n```\n\n公网访问建议走 Cloudflare Tunnel、Tailscale Funnel、ngrok 或自建 HTTPS 反代，并且只暴露给自己使用。\n\n如果网站通过 `https://relumeow.top` 打开，浏览器通常会拦截页面调用普通 `http://` API。手机远程控制时，API 地址最好也是 HTTPS 隧道地址，或者在局域网调试时用普通 HTTP 页面打开网站。\n\n## 安全边界\n\n- API 不提供任意 shell 执行接口。\n- 远程控制只进入任务队列，由本机 Codex 读取后人工或半自动执行。\n- token 不提交到 git；默认保存在 `docs-blog/runtime/api_token.txt`。\n- GitHub Pages 只能托管静态站，不能直接运行这个 API。\n\n这个边界能让手机远程“派活”，但不把电脑变成一个公网命令执行入口。\n",
      "headings": [
        {
          "level": "2",
          "text": "启动 API",
          "slug": "启动-api"
        },
        {
          "level": "2",
          "text": "首次创建管理员",
          "slug": "首次创建管理员"
        },
        {
          "level": "2",
          "text": "普通登录",
          "slug": "普通登录"
        },
        {
          "level": "2",
          "text": "GitHub 授权登录",
          "slug": "github-授权登录"
        },
        {
          "level": "2",
          "text": "管理员界面",
          "slug": "管理员界面"
        },
        {
          "level": "2",
          "text": "让 Codex 同步一篇文档",
          "slug": "让-codex-同步一篇文档"
        },
        {
          "level": "2",
          "text": "多项目记录",
          "slug": "多项目记录"
        },
        {
          "level": "2",
          "text": "Codex 任务队列",
          "slug": "codex-任务队列"
        },
        {
          "level": "2",
          "text": "手机怎么连",
          "slug": "手机怎么连"
        },
        {
          "level": "2",
          "text": "安全边界",
          "slug": "安全边界"
        }
      ],
      "reading_minutes": 1
    },
    {
      "id": "readme-2",
      "title": "上传 Markdown 更新网站",
      "category": "Guide",
      "summary": "把新的 .md 文件放进这个目录，重新构建后就会出现在博客网站中。",
      "source_path": "docs-blog/content/README.md",
      "source_kind": "content",
      "updated": "2026-06-28",
      "tags": [
        "Guide"
      ],
      "body": "\n# 上传 Markdown 更新网站\n\n这个目录是博客网站的可追加内容入口。\n\n## 怎么新增文章\n\n1. 把新的 `.md` 文件放到 `docs-blog/content/`。\n2. 如果 Markdown 引用了图片，把图片放到 `docs-blog/content/assets/` 或文档旁边。\n3. 在仓库根目录运行：\n\n```bash\npython3 docs-blog/build_site.py\n```\n\n4. 打开 `docs-blog/index.html` 查看。\n\n## 怎么在线编辑\n\n1. 打开文章后点“编辑 Markdown”，左侧改源码，右侧会实时预览。\n2. 点“保存草稿”后，修改会保存在当前浏览器的本地草稿里，刷新页面也还在。\n3. 文章里的任务勾选框可以直接点，勾选状态会同步回 Markdown 草稿。\n4. 点“下载 md”可以导出当前 Markdown；要永久进入网站，把导出的文件放进 `docs-blog/content/` 后重新构建。\n5. 点“撤销草稿”可以回到构建出来的原始版本。\n\n## 支持的 Markdown 能力\n\n- `#` 到 `######` 标题。\n- 表格。\n- 代码块。\n- 图片：`![说明](./assets/example.png)`。\n- 任务勾选：`- [ ] todo` 和 `- [x] done`。\n- 折叠块：\n\n```markdown\n:::details 标题\n这里是可折叠内容。\n:::\n```\n\n- Obsidian 风格内部链接：`[[Video2Mesh 当前流水线]]`。\n\n## 真实交互示例\n\n- [x] 已经支持从构建脚本收录仓库 Markdown。\n- [ ] 上传一篇新的 Markdown 测试临时预览。\n- [ ] 把图片和 Markdown 一起选中，验证本地图片展示。\n\n:::details 点开查看 Obsidian 风格链接示例\n这里有一个内部链接：[[Video2Mesh 当前流水线]]。\n\n如果目标标题存在，网站会把它渲染成站内文章链接。\n:::\n\n## 可选 Front Matter\n\n```markdown\n---\ntitle: 文章标题\ncategory: Surveys\nsummary: 文章摘要\ntags:\n  - 3DGS\n  - Scene Graph\n---\n```\n\n不写也可以，网站会自动从一级标题里提取标题。\n",
      "headings": [
        {
          "level": "2",
          "text": "怎么新增文章",
          "slug": "怎么新增文章"
        },
        {
          "level": "2",
          "text": "怎么在线编辑",
          "slug": "怎么在线编辑"
        },
        {
          "level": "2",
          "text": "支持的 Markdown 能力",
          "slug": "支持的-markdown-能力"
        },
        {
          "level": "2",
          "text": "真实交互示例",
          "slug": "真实交互示例"
        },
        {
          "level": "2",
          "text": "可选 Front Matter",
          "slug": "可选-front-matter"
        }
      ],
      "reading_minutes": 1
    }
  ],
  "categories": [
    "Game Scenes",
    "Guide",
    "Notes",
    "Pipeline",
    "Runs",
    "Surveys"
  ]
};
