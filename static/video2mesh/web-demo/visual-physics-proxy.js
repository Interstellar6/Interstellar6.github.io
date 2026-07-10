import * as THREE from "three";
import { SplatMesh, SparkRenderer } from "@sparkjsdev/spark";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const ASSET_VERSION = "local-bedroom4-anysplat-semanticmesh-gizmo-20260711";
const MANIFEST_URL = `./assets/web-demo-assets.json?v=${ASSET_VERSION}`;
const ALIGNMENT_STORAGE_KEY = "video2mesh-web-demo-alignment-offset-v4";
const ALIGNMENT_NUDGE_STEP = 0.35;
const ALIGNMENT_ROTATION_STEP_DEG = 1.5;
const ALIGNMENT_ROTATION_LIMIT_DEG = { x: 45, y: 90, z: 45 };
const CAMERA_CONTROL_VERSION = "supersplat-smooth-20260711";
const CAMERA_ORBIT_SENSITIVITY = 0.0054;
const CAMERA_TRACKPAD_ORBIT_SENSITIVITY = 0.0044;
const CAMERA_PAN_SENSITIVITY = 0.00145;
const CAMERA_WHEEL_ZOOM_SENSITIVITY = 0.00165;
const CAMERA_DRAG_ZOOM_SENSITIVITY = 0.012;
const CAMERA_MIN_POLAR = 0.035;
const CAMERA_MAX_POLAR = Math.PI - 0.035;
const CAMERA_PRESETS = ["front", "back", "left", "right", "top", "robot"];
const CAMERA_PRESET_LABELS = {
  front: "Interior front",
  back: "Interior back",
  left: "Interior left",
  right: "Interior right",
  top: "Top down",
  robot: "Robot close",
  robotFollow: "Robot follow",
  overview: "Overview",
  custom: "Custom",
  fly: "Fly",
};
const COLLIDER_MODES = ["wire", "solid", "hidden"];
const COLLIDER_LABELS = {
  wire: "wire + xray",
  solid: "solid",
  hidden: "hidden but active",
};
const QUALITY_MODES = ["balanced", "performance"];
const QUALITY_LABELS = {
  balanced: "balanced",
  performance: "performance",
};
const ROBOT_UP = new THREE.Vector3(0, 1, 0);

const canvas = document.querySelector("#sceneCanvas");
const modeChip = document.querySelector("#modeChip");
const visualMetric = document.querySelector("#visualMetric");
const meshMetric = document.querySelector("#meshMetric");
const hitMetric = document.querySelector("#hitMetric");
const semanticMetric = document.querySelector("#semanticMetric");
const fpsMetric = document.querySelector("#fpsMetric");
const robotMetric = document.querySelector("#robotMetric");
const toast = document.querySelector("#toast");

const nativePixelRatio = Math.max(0.75, window.devicePixelRatio || 1);
const initialPixelRatio = Math.min(nativePixelRatio, 1.35);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(initialPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x070a0d, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070a0d, 18, 62);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.03, 180);
camera.position.set(24, 16, 30);

const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = false;
controls.dampingFactor = 0;
controls.enablePan = false;
controls.screenSpacePanning = true;
controls.enableZoom = false;
controls.enableRotate = false;
controls.rotateSpeed = 0;
controls.zoomSpeed = 0;
controls.panSpeed = 0;
controls.minDistance = 0.08;
controls.maxDistance = 220;
controls.maxPolarAngle = Math.PI;
controls.target.set(0, 0, 0);

const sparkRenderer = new SparkRenderer({ renderer, enableLod: true });
sparkRenderer.name = "spark-anysplat-visual-renderer";
scene.add(sparkRenderer);

scene.add(new THREE.HemisphereLight(0x9ff3ed, 0x18231f, 1.08));
const sun = new THREE.DirectionalLight(0xffefd0, 1.8);
sun.position.set(8, 12, 7);
scene.add(sun);
const fill = new THREE.PointLight(0x58d7c9, 1.2, 80);
fill.position.set(-18, 8, -16);
scene.add(fill);

const visualLayer = new THREE.Group();
visualLayer.name = "visual-spark-3dgs-layer";
scene.add(visualLayer);

const colliderLayer = new THREE.Group();
colliderLayer.name = "semantic-mesh-collider-layer";
scene.add(colliderLayer);

const markerLayer = new THREE.Group();
markerLayer.name = "raycast-hit-marker-layer";
scene.add(markerLayer);

const robotLayer = new THREE.Group();
robotLayer.name = "mesh-ground-probe-robot-layer";
scene.add(robotLayer);

const raycaster = new THREE.Raycaster();
const groundRaycaster = new THREE.Raycaster();
const obstacleRaycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const keyState = new Set();

const state = {
  manifestVersion: "",
  showVisual: true,
  colliderRenderMode: "hidden",
  semanticColor: true,
  cameraMode: "orbit",
  cameraPreset: "front",
  cameraControlVersion: CAMERA_CONTROL_VERSION,
  qualityMode: "balanced",
  targetPixelRatio: Number(initialPixelRatio.toFixed(2)),
  actualPixelRatio: Number(initialPixelRatio.toFixed(2)),
  adaptivePixelRatio: true,
  fps: 0,
  sampledWireFaces: 0,
  wireSampleStride: 1,
  visualReady: false,
  colliderReady: false,
  visualUsesSpark: true,
  visualAssetId: "",
  visualUrl: "",
  visualCount: 0,
  visualSha256: "",
  visualSourcePath: "",
  colliderAssetId: "",
  colliderUrl: "",
  colliderFormat: "ply",
  colliderVertices: 0,
  colliderFaces: 0,
  colliderSha256: "",
  colliderSourcePath: "",
  transformSource: "pending",
  transformScale: 1,
  transformTranslation: { x: 0, y: 0, z: 0 },
  transformOffset: { x: 0, y: 0, z: 0 },
  defaultViewerOffset: { x: 0, y: 0, z: 0 },
  manualAlignmentOffset: { x: 0, y: 0, z: 0 },
  manualAlignmentRotationDeg: { x: 0, y: 0, z: 0 },
  transformRotationMatrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  transformRmseSceneUnits: null,
  lastHit: "none",
  lastHitInfo: null,
  robotReady: false,
  robotEnabled: true,
  robotFollowCamera: false,
  robotGrounded: false,
  robotBlocked: false,
  robotObstacleCollision: false,
  robotSpawnSource: "pending",
  robotFloorYEstimate: null,
  robotPosition: { x: 0, y: 0, z: 0 },
  robotYaw: 0,
  robotSpeed: 0,
  viewportGizmo: "idle",
  cameraPosition: { x: 0, y: 0, z: 0 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  cameraDistance: 0,
  error: "",
};

let visualSplat = null;
let colliderMesh = null;
let colliderWire = null;
let robotGroup = null;
let robotGroundY = null;
let robotBobPhase = 0;
let pointerDown = null;
let manifest = null;
let colliderFaceSemantics = [];
let colliderBounds = null;
let visualMetaBox = null;
let colliderMetaBox = null;
let transformedVisualBounds = null;
let baseVisualTransform = null;
let robotFloorYEstimate = null;
let lastFpsUpdate = 0;
let frameCount = 0;
let gizmoDrag = null;
let canvasDrag = null;

const smoothCamera = {
  initialized: false,
  target: new THREE.Vector3(),
  desiredTarget: new THREE.Vector3(),
  spherical: new THREE.Spherical(1, Math.PI / 2, 0),
  desiredSpherical: new THREE.Spherical(1, Math.PI / 2, 0),
  lastWheelTime: -Infinity,
  burstIsWheel: true,
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function formatCount(value) {
  if (!Number.isFinite(value)) return "0";
  return Intl.NumberFormat("en-US", { notation: value >= 1000000 ? "compact" : "standard" }).format(value);
}

function nextValue(values, current) {
  const index = Math.max(0, values.indexOf(current));
  return values[(index + 1) % values.length];
}

function boxFromMeta(meta) {
  return new THREE.Box3(
    new THREE.Vector3(...meta.bbox.min),
    new THREE.Vector3(...meta.bbox.max)
  );
}

function boxSize(box) {
  return box.getSize(new THREE.Vector3());
}

function boxCenter(box) {
  return box.getCenter(new THREE.Vector3());
}

function semanticColor(objectId) {
  const palette = [
    0x5ad8c8, 0xefb35f, 0xff806d, 0x9fa8ff, 0x82d173,
    0xe681c9, 0x67b7ff, 0xd9cf73, 0xb48cff, 0xf28f5b,
  ];
  const id = Math.abs(Number(objectId) || 0);
  return new THREE.Color(palette[id % palette.length]);
}

function clampFinite(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return THREE.MathUtils.clamp(parsed, min, max);
}

function applyRendererPixelRatio(value, { forceResize = false } = {}) {
  const target = clampFinite(value, 0.75, Math.min(nativePixelRatio, 1.5), initialPixelRatio);
  const current = renderer.getPixelRatio();
  if (!forceResize && Math.abs(current - target) < 0.04) return;
  renderer.setPixelRatio(target);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  state.actualPixelRatio = Number(renderer.getPixelRatio().toFixed(2));
  state.targetPixelRatio = Number(target.toFixed(2));
}

function qualityPixelRatioLimit() {
  return state.qualityMode === "performance"
    ? Math.min(nativePixelRatio, 1)
    : Math.min(nativePixelRatio, 1.35);
}

function applyQualityMode({ announce = false } = {}) {
  const limit = qualityPixelRatioLimit();
  state.adaptivePixelRatio = state.qualityMode !== "performance";
  applyRendererPixelRatio(limit, { forceResize: true });
  if (colliderMesh && state.qualityMode === "performance" && state.colliderRenderMode === "wire") {
    state.colliderRenderMode = "hidden";
    applyColliderMode();
  }
  if (announce) showToast(`Quality: ${QUALITY_LABELS[state.qualityMode]}, DPR ${state.actualPixelRatio}.`);
  updateHud();
}

function createSampledWireGeometry(geometry, maxFaces = 12000) {
  const index = geometry.index;
  const position = geometry.getAttribute("position");
  const faceCount = index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);
  const stride = Math.max(1, Math.ceil(faceCount / maxFaces));
  const sampledFaces = Math.ceil(faceCount / stride);
  const linePositions = new Float32Array(sampledFaces * 18);
  let offset = 0;

  const writeVertex = (vertexIndex) => {
    linePositions[offset] = position.getX(vertexIndex);
    linePositions[offset + 1] = position.getY(vertexIndex);
    linePositions[offset + 2] = position.getZ(vertexIndex);
    offset += 3;
  };
  const writeEdge = (a, b) => {
    writeVertex(a);
    writeVertex(b);
  };

  for (let face = 0; face < faceCount; face += stride) {
    const base = face * 3;
    const a = index ? index.getX(base) : base;
    const b = index ? index.getX(base + 1) : base + 1;
    const c = index ? index.getX(base + 2) : base + 2;
    writeEdge(a, b);
    writeEdge(b, c);
    writeEdge(c, a);
  }

  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions.subarray(0, offset), 3));
  state.sampledWireFaces = sampledFaces;
  state.wireSampleStride = stride;
  return wireGeometry;
}

function identityRotationRows() {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

function rotationRowsToMatrix4(rows) {
  return new THREE.Matrix4().set(
    rows[0][0], rows[0][1], rows[0][2], 0,
    rows[1][0], rows[1][1], rows[1][2], 0,
    rows[2][0], rows[2][1], rows[2][2], 0,
    0, 0, 0, 1
  );
}

function normalizeRotationRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 3) return identityRotationRows();
  const parsed = rows.map((row) => Array.isArray(row) ? row.map(Number) : []);
  if (parsed.some((row) => row.length !== 3 || row.some((value) => !Number.isFinite(value)))) {
    return identityRotationRows();
  }
  return parsed;
}

function vectorFromArray(values, fallback = [0, 0, 0]) {
  const source = Array.isArray(values) && values.length >= 3 ? values : fallback;
  return new THREE.Vector3(Number(source[0]) || 0, Number(source[1]) || 0, Number(source[2]) || 0);
}

function roundedVector(vector) {
  return {
    x: Number(vector.x.toFixed(6)),
    y: Number(vector.y.toFixed(6)),
    z: Number(vector.z.toFixed(6)),
  };
}

function roundedEuler(euler) {
  return {
    x: Number(euler.x.toFixed(4)),
    y: Number(euler.y.toFixed(4)),
    z: Number(euler.z.toFixed(4)),
  };
}

function roundedRotationRows(rows) {
  return rows.map((row) => row.map((value) => Number(Number(value).toFixed(8))));
}

function serializeBox(box) {
  if (!box || box.isEmpty()) return null;
  return {
    min: roundedVector(box.min),
    max: roundedVector(box.max),
    center: roundedVector(boxCenter(box)),
    size: roundedVector(boxSize(box)),
  };
}

function currentVisualTransform() {
  return {
    source: state.transformSource,
    scale: state.transformScale,
    rotationMatrix: state.transformRotationMatrix,
    translation: [
      state.transformTranslation.x,
      state.transformTranslation.y,
      state.transformTranslation.z,
    ],
    manualAlignmentOffset: [
      state.manualAlignmentOffset.x,
      state.manualAlignmentOffset.y,
      state.manualAlignmentOffset.z,
    ],
    defaultViewerOffset: [
      state.defaultViewerOffset.x,
      state.defaultViewerOffset.y,
      state.defaultViewerOffset.z,
    ],
    manualAlignmentRotationDeg: [
      state.manualAlignmentRotationDeg.x,
      state.manualAlignmentRotationDeg.y,
      state.manualAlignmentRotationDeg.z,
    ],
    transformedVisualBounds: serializeBox(transformedVisualBounds),
    rmseSceneUnits: state.transformRmseSceneUnits,
  };
}

function rotationRowsFromEulerDeg(degrees) {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(Number(degrees?.[0]) || 0),
    THREE.MathUtils.degToRad(Number(degrees?.[1]) || 0),
    THREE.MathUtils.degToRad(Number(degrees?.[2]) || 0),
    "XYZ"
  );
  const elements = new THREE.Matrix4().makeRotationFromEuler(euler).elements;
  return [
    [elements[0], elements[4], elements[8]],
    [elements[1], elements[5], elements[9]],
    [elements[2], elements[6], elements[10]],
  ];
}

function matrix4ToRotationRows(matrix) {
  const elements = matrix.elements;
  return [
    [elements[0], elements[4], elements[8]],
    [elements[1], elements[5], elements[9]],
    [elements[2], elements[6], elements[10]],
  ];
}

function cloneTransform(transform) {
  return {
    source: transform.source,
    scale: Number(transform.scale),
    rotationMatrix: normalizeRotationRows(transform.rotationMatrix),
    translation: transform.translation.clone(),
    rmseSceneUnits: transform.rmseSceneUnits,
    maxErrorSceneUnits: transform.maxErrorSceneUnits,
  };
}

function calculateTransformedBox(box, transform) {
  if (!box || !transform) return null;
  const rotation4 = rotationRowsToMatrix4(normalizeRotationRows(transform.rotationMatrix));
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotation4);
  const matrix = new THREE.Matrix4().compose(
    transform.translation,
    quaternion,
    new THREE.Vector3(transform.scale, transform.scale, transform.scale)
  );
  return box.clone().applyMatrix4(matrix);
}

function calculateVisualToColliderTransform(visualBox, colliderBox, alignmentMeta = null) {
  if (alignmentMeta?.rotationMatrix && Number.isFinite(Number(alignmentMeta.scale))) {
    const rotationMatrix = normalizeRotationRows(alignmentMeta.rotationMatrix);
    const translation = vectorFromArray(alignmentMeta.translation);
    const defaultViewerOffset = vectorFromArray(alignmentMeta.viewerDefaultOffset);
    translation.add(defaultViewerOffset);
    state.defaultViewerOffset = roundedVector(defaultViewerOffset);
    const source = alignmentMeta.viewerDefaultOffset
      ? `${alignmentMeta.id || alignmentMeta.method || "manifest_alignment"}+viewer_default`
      : (alignmentMeta.id || alignmentMeta.method || "manifest_alignment");
    return {
      source,
      scale: Number(alignmentMeta.scale),
      rotationMatrix,
      translation,
      rmseSceneUnits: Number.isFinite(Number(alignmentMeta.rmseSceneUnits))
        ? Number(alignmentMeta.rmseSceneUnits)
        : null,
      maxErrorSceneUnits: Number.isFinite(Number(alignmentMeta.maxErrorSceneUnits))
        ? Number(alignmentMeta.maxErrorSceneUnits)
        : null,
    };
  }
  const visualSize = boxSize(visualBox);
  const colliderSize = boxSize(colliderBox);
  const visualMax = Math.max(visualSize.x, visualSize.y, visualSize.z, 1e-6);
  const colliderMax = Math.max(colliderSize.x, colliderSize.y, colliderSize.z, 1e-6);
  const scale = colliderMax / visualMax;
  const visualCenter = boxCenter(visualBox);
  const colliderCenter = boxCenter(colliderBox);
  const translation = colliderCenter.clone().sub(visualCenter.clone().multiplyScalar(scale));
  state.defaultViewerOffset = { x: 0, y: 0, z: 0 };
  return {
    source: "bbox_center_max_extent_fallback",
    scale,
    rotationMatrix: identityRotationRows(),
    translation,
    rmseSceneUnits: null,
    maxErrorSceneUnits: null,
  };
}

function sanitizeAlignmentVector(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    x: clampFinite(source.x, -12, 12, 0),
    y: clampFinite(source.y, -12, 12, 0),
    z: clampFinite(source.z, -12, 12, 0),
  };
}

function sanitizeAlignmentEuler(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    x: clampFinite(source.x, -ALIGNMENT_ROTATION_LIMIT_DEG.x, ALIGNMENT_ROTATION_LIMIT_DEG.x, 0),
    y: clampFinite(source.y, -ALIGNMENT_ROTATION_LIMIT_DEG.y, ALIGNMENT_ROTATION_LIMIT_DEG.y, 0),
    z: clampFinite(source.z, -ALIGNMENT_ROTATION_LIMIT_DEG.z, ALIGNMENT_ROTATION_LIMIT_DEG.z, 0),
  };
}

function loadManualAlignment() {
  try {
    const raw = localStorage.getItem(ALIGNMENT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.manualAlignmentOffset = sanitizeAlignmentVector(parsed.offset);
    state.manualAlignmentRotationDeg = sanitizeAlignmentEuler(parsed.rotationDeg);
  } catch (error) {
    console.warn("Failed to load viewer alignment offset", error);
    state.manualAlignmentOffset = { x: 0, y: 0, z: 0 };
    state.manualAlignmentRotationDeg = { x: 0, y: 0, z: 0 };
  }
}

function saveManualAlignment() {
  const payload = {
    offset: state.manualAlignmentOffset,
    rotationDeg: state.manualAlignmentRotationDeg,
    version: ASSET_VERSION,
  };
  localStorage.setItem(ALIGNMENT_STORAGE_KEY, JSON.stringify(payload));
}

function manualAlignmentIsActive() {
  const offset = state.manualAlignmentOffset;
  const rotation = state.manualAlignmentRotationDeg;
  return (
    Math.abs(offset.x) > 1e-4 ||
    Math.abs(offset.y) > 1e-4 ||
    Math.abs(offset.z) > 1e-4 ||
    Math.abs(rotation.x) > 1e-4 ||
    Math.abs(rotation.y) > 1e-4 ||
    Math.abs(rotation.z) > 1e-4
  );
}

function buildEffectiveVisualTransform() {
  if (!baseVisualTransform) return null;
  const base = cloneTransform(baseVisualTransform);
  const manualOffset = new THREE.Vector3(
    state.manualAlignmentOffset.x,
    state.manualAlignmentOffset.y,
    state.manualAlignmentOffset.z
  );
  const manualRows = rotationRowsFromEulerDeg([
    state.manualAlignmentRotationDeg.x,
    state.manualAlignmentRotationDeg.y,
    state.manualAlignmentRotationDeg.z,
  ]);
  const manualMatrix = rotationRowsToMatrix4(manualRows);
  const baseMatrix = rotationRowsToMatrix4(base.rotationMatrix);
  const combinedMatrix = manualMatrix.clone().multiply(baseMatrix);

  const baseBox = calculateTransformedBox(visualMetaBox, base);
  const pivot = baseBox ? boxCenter(baseBox) : base.translation.clone();
  const adjustedTranslation = base.translation.clone().sub(pivot).applyMatrix4(manualMatrix).add(pivot).add(manualOffset);
  const active = manualAlignmentIsActive();
  return {
    source: active ? `${base.source}+viewer_adjust` : base.source,
    scale: base.scale,
    rotationMatrix: matrix4ToRotationRows(combinedMatrix),
    translation: adjustedTranslation,
    rmseSceneUnits: base.rmseSceneUnits,
    maxErrorSceneUnits: base.maxErrorSceneUnits,
  };
}

function applyVisualTransform(transform, { announce = false } = {}) {
  if (!visualSplat) return;
  const rotationMatrix = normalizeRotationRows(transform.rotationMatrix);
  const rotation4 = rotationRowsToMatrix4(rotationMatrix);
  visualSplat.scale.setScalar(transform.scale);
  visualSplat.quaternion.setFromRotationMatrix(rotation4);
  visualSplat.position.copy(transform.translation);
  visualSplat.updateMatrixWorld(true);
  transformedVisualBounds = calculateTransformedBox(visualMetaBox, transform);

  state.transformSource = transform.source || "manual";
  state.transformScale = Number(transform.scale.toFixed(8));
  state.transformTranslation = roundedVector(transform.translation);
  state.transformOffset = state.transformTranslation;
  state.transformRotationMatrix = roundedRotationRows(rotationMatrix);
  state.transformRmseSceneUnits = Number.isFinite(transform.rmseSceneUnits)
    ? Number(transform.rmseSceneUnits.toFixed(6))
    : null;
  updateHud();
  if (announce) showToast(`Visual alignment: ${state.transformSource}`);
}

function applyEffectiveVisualTransform({ announce = false } = {}) {
  const transform = buildEffectiveVisualTransform();
  if (!transform) return null;
  if (visualSplat) applyVisualTransform(transform, { announce });
  return transform;
}

function nudgeVisualAlignment(delta) {
  const current = new THREE.Vector3(
    state.manualAlignmentOffset.x,
    state.manualAlignmentOffset.y,
    state.manualAlignmentOffset.z
  );
  current.add(delta);
  state.manualAlignmentOffset = sanitizeAlignmentVector(current);
  saveManualAlignment();
  applyEffectiveVisualTransform();
  updateAlignmentButtons();
  showToast(`Visual offset ${state.manualAlignmentOffset.x.toFixed(2)}, ${state.manualAlignmentOffset.y.toFixed(2)}, ${state.manualAlignmentOffset.z.toFixed(2)}.`);
}

function nudgeVisualRotation(axis, deltaDeg) {
  if (!["x", "y", "z"].includes(axis)) return;
  const next = {
    ...state.manualAlignmentRotationDeg,
    [axis]: state.manualAlignmentRotationDeg[axis] + deltaDeg,
  };
  state.manualAlignmentRotationDeg = sanitizeAlignmentEuler(next);
  saveManualAlignment();
  applyEffectiveVisualTransform();
  updateAlignmentButtons();
  showToast(`Visual rotation ${axis.toUpperCase()} ${state.manualAlignmentRotationDeg[axis].toFixed(1)} deg.`);
}

function resetManualAlignment() {
  state.manualAlignmentOffset = { x: 0, y: 0, z: 0 };
  state.manualAlignmentRotationDeg = { x: 0, y: 0, z: 0 };
  saveManualAlignment();
  applyEffectiveVisualTransform({ announce: true });
  updateAlignmentButtons();
  showToast("Viewer alignment reset to default manifest correction.");
}

function buildManualVisualTransform(patch = {}) {
  const rotationMatrix = patch.rotationMatrix
    ? normalizeRotationRows(patch.rotationMatrix)
    : (patch.rotationEulerDeg ? rotationRowsFromEulerDeg(patch.rotationEulerDeg) : normalizeRotationRows(state.transformRotationMatrix));

  return {
    source: patch.source || "manual_viewer_alignment",
    scale: Number.isFinite(Number(patch.scale)) ? Number(patch.scale) : state.transformScale,
    rotationMatrix,
    translation: patch.translation
      ? vectorFromArray(patch.translation)
      : new THREE.Vector3(
        state.transformTranslation.x,
        state.transformTranslation.y,
        state.transformTranslation.z
      ),
    rmseSceneUnits: null,
    maxErrorSceneUnits: null,
  };
}

function exposeDebugApi() {
  window.__setVisualAlignment = (patch = {}) => {
    const transform = buildManualVisualTransform(patch);
    baseVisualTransform = transform;
    applyVisualTransform(transform, { announce: true });
    return syncDebugState();
  };
  window.__getVisualAlignment = () => currentVisualTransform();
  window.__nudgeVisualAlignment = (delta = {}) => {
    nudgeVisualAlignment(new THREE.Vector3(
      Number(delta.x) || 0,
      Number(delta.y) || 0,
      Number(delta.z) || 0
    ));
    return syncDebugState();
  };
  window.__resetVisualAlignmentOffset = () => {
    resetManualAlignment();
    return syncDebugState();
  };
}

function clampCameraSpherical(spherical) {
  spherical.radius = THREE.MathUtils.clamp(
    spherical.radius,
    Math.max(0.02, controls.minDistance || 0.02),
    Math.max(0.08, controls.maxDistance || 220)
  );
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, CAMERA_MIN_POLAR, CAMERA_MAX_POLAR);
  return spherical;
}

function sphericalFromCamera(eye = camera.position, target = controls.target) {
  return clampCameraSpherical(new THREE.Spherical().setFromVector3(eye.clone().sub(target)));
}

function syncSmoothCameraFromCurrent({ immediate = true } = {}) {
  const spherical = sphericalFromCamera(camera.position, controls.target);
  smoothCamera.desiredTarget.copy(controls.target);
  smoothCamera.desiredSpherical.copy(spherical);
  if (immediate || !smoothCamera.initialized) {
    smoothCamera.target.copy(controls.target);
    smoothCamera.spherical.copy(spherical);
  }
  smoothCamera.initialized = true;
}

function applySmoothCameraPose() {
  clampCameraSpherical(smoothCamera.spherical);
  const offset = new THREE.Vector3().setFromSpherical(smoothCamera.spherical);
  camera.position.copy(smoothCamera.target).add(offset);
  controls.target.copy(smoothCamera.target);
  camera.lookAt(smoothCamera.target);
}

function setSmoothCameraPose(eye, target, { immediate = false } = {}) {
  const shouldSnap = immediate || !smoothCamera.initialized;
  smoothCamera.desiredTarget.copy(target);
  smoothCamera.desiredSpherical.copy(sphericalFromCamera(eye, target));
  smoothCamera.initialized = true;
  if (shouldSnap) {
    smoothCamera.target.copy(smoothCamera.desiredTarget);
    smoothCamera.spherical.copy(smoothCamera.desiredSpherical);
    applySmoothCameraPose();
  }
}

function setSmoothCameraTarget(target, { preserveOffset = true, immediate = false } = {}) {
  if (!smoothCamera.initialized) syncSmoothCameraFromCurrent();
  smoothCamera.desiredTarget.copy(target);
  if (!preserveOffset) smoothCamera.desiredSpherical.copy(sphericalFromCamera(camera.position, target));
  if (immediate) {
    smoothCamera.target.copy(smoothCamera.desiredTarget);
    applySmoothCameraPose();
  }
}

function orbitCameraAroundTarget({ theta = 0, phi = 0, scale = 1, announce = false } = {}) {
  if (state.cameraMode !== "orbit") state.cameraMode = "orbit";
  if (!smoothCamera.initialized) syncSmoothCameraFromCurrent();
  smoothCamera.desiredSpherical.theta += theta;
  smoothCamera.desiredSpherical.phi += phi;
  smoothCamera.desiredSpherical.radius *= scale;
  clampCameraSpherical(smoothCamera.desiredSpherical);
  state.robotFollowCamera = false;
  state.cameraPreset = "custom";
  if (announce) setLayerVisibility();
  if (announce) showToast("Camera adjusted around the current indoor target.");
}

function panCameraTarget(deltaX, deltaY, { announce = false } = {}) {
  if (!smoothCamera.initialized) syncSmoothCameraFromCurrent();
  const distance = Math.max(smoothCamera.desiredSpherical.radius, 0.1);
  const panScale = distance * CAMERA_PAN_SENSITIVITY;
  const eye = smoothCamera.desiredTarget.clone().add(new THREE.Vector3().setFromSpherical(smoothCamera.desiredSpherical));
  const forward = smoothCamera.desiredTarget.clone().sub(eye).normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const move = new THREE.Vector3()
    .addScaledVector(right, -deltaX * panScale)
    .addScaledVector(up, deltaY * panScale);
  smoothCamera.desiredTarget.add(move);
  smoothCamera.target.add(move.multiplyScalar(0.22));
  state.robotFollowCamera = false;
  state.cameraMode = "orbit";
  state.cameraPreset = "custom";
  if (announce) setLayerVisibility();
  if (announce) showToast("Camera target panned.");
}

function zoomCameraByWheel(deltaY, sensitivity = CAMERA_WHEEL_ZOOM_SENSITIVITY) {
  if (!smoothCamera.initialized) syncSmoothCameraFromCurrent();
  const scale = Math.exp(THREE.MathUtils.clamp(deltaY * sensitivity, -0.7, 0.7));
  orbitCameraAroundTarget({ scale });
}

function classifyWheelInput(event) {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true;
  const rawEvent = event;
  if (typeof rawEvent.wheelDeltaY === "number" && rawEvent.wheelDeltaY !== 0) {
    return rawEvent.wheelDeltaY % 120 === 0;
  }
  if (typeof rawEvent.wheelDeltaX === "number" && rawEvent.wheelDeltaX !== 0) {
    return rawEvent.wheelDeltaX % 120 === 0;
  }
  if (event.deltaX !== 0 && event.deltaY !== 0) return false;
  return Number.isInteger(event.deltaX) && Number.isInteger(event.deltaY);
}

function updateSmoothCamera(dt) {
  if (state.cameraMode !== "orbit") return;
  if (!smoothCamera.initialized) syncSmoothCameraFromCurrent();
  const targetAlpha = 1 - Math.exp(-Math.max(dt, 0.001) * 16);
  const angleAlpha = 1 - Math.exp(-Math.max(dt, 0.001) * 18);
  const radiusAlpha = 1 - Math.exp(-Math.max(dt, 0.001) * 20);

  smoothCamera.target.lerp(smoothCamera.desiredTarget, targetAlpha);
  const thetaDelta = Math.atan2(
    Math.sin(smoothCamera.desiredSpherical.theta - smoothCamera.spherical.theta),
    Math.cos(smoothCamera.desiredSpherical.theta - smoothCamera.spherical.theta)
  );
  smoothCamera.spherical.theta += thetaDelta * angleAlpha;
  smoothCamera.spherical.phi += (smoothCamera.desiredSpherical.phi - smoothCamera.spherical.phi) * angleAlpha;
  smoothCamera.spherical.radius += (smoothCamera.desiredSpherical.radius - smoothCamera.spherical.radius) * radiusAlpha;
  applySmoothCameraPose();
}

function syncCameraState() {
  state.cameraPosition = roundedVector(camera.position);
  state.cameraTarget = roundedVector(controls.target);
  state.cameraDistance = Number(camera.position.distanceTo(controls.target).toFixed(4));
}

function syncDebugState() {
  syncCameraState();
  const snapshot = {
    ...state,
    sparkRendererVisible: sparkRenderer.visible,
    visualLayerVisible: visualLayer.visible,
    colliderLayerVisible: colliderLayer.visible,
    colliderVisible: state.colliderRenderMode !== "hidden",
    rendererPixelRatio: Number(renderer.getPixelRatio().toFixed(3)),
    robotVisible: Boolean(robotGroup?.visible),
    colliderBounds: serializeBox(colliderBounds),
    visualMetaBounds: serializeBox(visualMetaBox),
    transformedVisualBounds: serializeBox(transformedVisualBounds),
  };
  window.__visualPhysicsDemoState = snapshot;
  document.documentElement.dataset.visualPhysicsState = JSON.stringify(snapshot);
  return snapshot;
}

function updateHud() {
  visualMetric.textContent = state.visualReady ? formatCount(state.visualCount) : "loading";
  meshMetric.textContent = state.colliderReady ? formatCount(state.colliderFaces) : "loading";
  hitMetric.textContent = state.lastHitInfo ? `face ${state.lastHitInfo.faceIndex}` : "none";
  semanticMetric.textContent = state.lastHitInfo ? `id ${state.lastHitInfo.objectId}` : "none";
  robotMetric.textContent = state.robotReady
    ? (state.robotGrounded ? `${state.robotSpeed.toFixed(1)} m/s` : "air")
    : "loading";
  modeChip.textContent = [
    state.visualReady ? "AnySplat Gaussian PLY visual ready" : "loading visual PLY",
    state.colliderReady ? "semantic PLY collider ready" : "loading collider PLY",
    state.transformSource === "pending"
      ? "alignment pending"
      : `${state.transformSource}${state.transformRmseSceneUnits ? ` rmse ${state.transformRmseSceneUnits}` : ""}`,
    manualAlignmentIsActive()
      ? `manual offset ${state.manualAlignmentOffset.x.toFixed(2)}/${state.manualAlignmentOffset.y.toFixed(2)}/${state.manualAlignmentOffset.z.toFixed(2)} yaw ${state.manualAlignmentRotationDeg.y.toFixed(1)}`
      : (state.transformSource.includes("viewer_default") ? "bbox-center viewer correction" : "manifest alignment"),
    `${COLLIDER_LABELS[state.colliderRenderMode]} collider`,
    `${CAMERA_PRESET_LABELS[state.cameraPreset] || state.cameraPreset} ${state.cameraMode} camera`,
    `${QUALITY_LABELS[state.qualityMode]} dpr ${state.actualPixelRatio}`,
    state.robotEnabled ? `robot ${state.robotObstacleCollision ? "collides with mesh" : "ground-only"} ${state.robotSpawnSource}` : "robot hidden",
    "raycast ignores visual splats",
  ].join(" · ");
  syncDebugState();
}

async function loadManifest() {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) throw new Error(`Manifest failed: ${response.status} ${response.statusText}`);
  manifest = await response.json();
  state.manifestVersion = manifest.version || "";
  return manifest;
}

async function fetchPart(part, label, loaded, total) {
  const response = await fetch(`${part.url}?v=${ASSET_VERSION}`);
  if (!response.ok) throw new Error(`${label} chunk failed: ${part.url} ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (part.size && bytes.length !== part.size) {
    throw new Error(`${label} chunk size mismatch: expected ${part.size}, got ${bytes.length}`);
  }
  const pct = total ? Math.round(((loaded + bytes.length) / total) * 100) : 0;
  modeChip.textContent = `${label} chunks ${pct}%`;
  return bytes;
}

async function getChunkedBytes(assetKey) {
  const asset = manifest.assets[assetKey];
  if (!asset?.parts?.length) throw new Error(`No chunk list for ${assetKey}`);
  const merged = new Uint8Array(asset.size);
  let offset = 0;
  for (const part of asset.parts) {
    const bytes = await fetchPart(part, asset.label || assetKey, offset, asset.size);
    merged.set(bytes, offset);
    offset += bytes.length;
  }
  if (offset !== asset.size) {
    throw new Error(`${assetKey} assembled size mismatch: expected ${asset.size}, got ${offset}`);
  }
  return { asset, bytes: merged };
}

async function loadVisualSplat(transform) {
  const { asset, bytes } = await getChunkedBytes("visual");
  state.visualAssetId = asset.id;
  state.visualUrl = asset.fileName;
  state.visualCount = asset.vertexCount || 0;
  state.visualSha256 = asset.sha256 || "";
  state.visualSourcePath = asset.sourcePath || "";
  state.transformSource = transform.source;
  state.transformScale = transform.scale;
  state.transformTranslation = roundedVector(transform.translation);
  state.transformOffset = state.transformTranslation;
  state.transformRotationMatrix = roundedRotationRows(transform.rotationMatrix);
  state.transformRmseSceneUnits = Number.isFinite(transform.rmseSceneUnits)
    ? Number(transform.rmseSceneUnits.toFixed(6))
    : null;

  visualSplat = new SplatMesh({
    fileBytes: bytes,
    fileName: asset.fileName,
    fileType: asset.fileType,
    lod: true,
    raycastable: false,
    onProgress: (event) => {
      if (!event.total) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      modeChip.textContent = `Spark decode ${pct}%`;
    },
  });
  visualSplat.name = "AnySplat bedroom_4 Gaussian visual proxy";
  visualSplat.raycast = () => {};
  visualLayer.add(visualSplat);
  applyVisualTransform(transform);

  await visualSplat.initialized;
  applyVisualTransform(transform);
  state.visualReady = true;
  showToast("AnySplat Gaussian PLY visual layer loaded.");
  updateHud();
  setLayerVisibility();
}

function parseSemanticMeshPly(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  let vertexCount = 0;
  let faceCount = 0;
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith("element vertex ")) vertexCount = Number(line.split(/\s+/)[2]);
    if (line.startsWith("element face ")) faceCount = Number(line.split(/\s+/)[2]);
    if (line === "end_header") {
      i += 1;
      break;
    }
  }
  if (!vertexCount || !faceCount) throw new Error("Semantic mesh PLY header missing vertex or face count.");

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const objectIds = new Int32Array(vertexCount);
  const probabilities = new Float32Array(vertexCount);
  const sourceFaces = new Int32Array(vertexCount);
  const rawColors = new Float32Array(vertexCount * 3);

  for (let v = 0; v < vertexCount; v += 1, i += 1) {
    const parts = lines[i].trim().split(/\s+/);
    positions[v * 3] = Number(parts[0]);
    positions[v * 3 + 1] = Number(parts[1]);
    positions[v * 3 + 2] = Number(parts[2]);
    rawColors[v * 3] = Number(parts[3]) / 255;
    rawColors[v * 3 + 1] = Number(parts[4]) / 255;
    rawColors[v * 3 + 2] = Number(parts[5]) / 255;
    objectIds[v] = Number(parts[6]);
    probabilities[v] = Number(parts[7]);
    sourceFaces[v] = Number(parts[8]);
    const c = semanticColor(objectIds[v]);
    colors[v * 3] = c.r;
    colors[v * 3 + 1] = c.g;
    colors[v * 3 + 2] = c.b;
  }

  const indices = new Uint32Array(faceCount * 3);
  const faceSemantics = new Array(faceCount);
  for (let f = 0; f < faceCount; f += 1, i += 1) {
    const parts = lines[i].trim().split(/\s+/).map(Number);
    if (parts[0] !== 3) throw new Error(`Only triangular faces are supported; got ${parts[0]} at face ${f}`);
    const a = parts[1];
    const b = parts[2];
    const c = parts[3];
    indices[f * 3] = a;
    indices[f * 3 + 1] = b;
    indices[f * 3 + 2] = c;
    const objectId = Math.round((objectIds[a] + objectIds[b] + objectIds[c]) / 3);
    const probability = (probabilities[a] + probabilities[b] + probabilities[c]) / 3;
    const sourceFace = Math.round((sourceFaces[a] + sourceFaces[b] + sourceFaces[c]) / 3);
    faceSemantics[f] = { objectId, probability, sourceFace };
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("rawColor", new THREE.BufferAttribute(rawColors, 3));
  geometry.setAttribute("objectId", new THREE.Int32BufferAttribute(objectIds, 1));
  geometry.setAttribute("objectProbability", new THREE.BufferAttribute(probabilities, 1));
  geometry.setAttribute("sourceFace", new THREE.Int32BufferAttribute(sourceFaces, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return { geometry, faceSemantics, vertexCount, faceCount };
}

function estimateMainWalkableFloorY(geometry) {
  const index = geometry.index;
  const position = geometry.getAttribute("position");
  const faceCount = index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);
  const bounds = geometry.boundingBox;
  const yLimit = bounds.min.y + boxSize(bounds).y * 0.45;
  const bins = new Map();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const readVertex = (vertexIndex, target) => {
    target.set(position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex));
  };

  for (let face = 0; face < faceCount; face += 1) {
    const base = face * 3;
    const ia = index ? index.getX(base) : base;
    const ib = index ? index.getX(base + 1) : base + 1;
    const ic = index ? index.getX(base + 2) : base + 2;
    readVertex(ia, a);
    readVertex(ib, b);
    readVertex(ic, c);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac);
    const area2 = normal.length();
    if (area2 < 1e-7) continue;
    normal.divideScalar(area2);
    if (normal.y < 0.55) continue;
    const y = (a.y + b.y + c.y) / 3;
    if (y > yLimit) continue;
    const bin = Math.round(y * 2) / 2;
    bins.set(bin, (bins.get(bin) || 0) + area2 * 0.5);
  }

  let bestY = null;
  let bestArea = 0;
  for (const [y, area] of bins) {
    if (area > bestArea) {
      bestY = y;
      bestArea = area;
    }
  }
  return Number.isFinite(bestY) ? bestY : null;
}

async function loadColliderMesh() {
  const { asset, bytes } = await getChunkedBytes("collider");
  state.colliderAssetId = asset.id;
  state.colliderUrl = asset.fileName;
  state.colliderVertices = asset.vertexCount || 0;
  state.colliderFaces = asset.faceCount || 0;
  state.colliderSha256 = asset.sha256 || "";
  state.colliderSourcePath = asset.sourcePath || "";

  const text = new TextDecoder().decode(bytes);
  const parsed = parseSemanticMeshPly(text);
  colliderFaceSemantics = parsed.faceSemantics;
  colliderBounds = parsed.geometry.boundingBox.clone();
  robotFloorYEstimate = estimateMainWalkableFloorY(parsed.geometry);
  state.robotFloorYEstimate = Number.isFinite(robotFloorYEstimate)
    ? Number(robotFloorYEstimate.toFixed(3))
    : null;

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.86,
    metalness: 0.02,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  colliderMesh = new THREE.Mesh(parsed.geometry, material);
  colliderMesh.name = "semantic PLY mesh collider proxy";
  colliderMesh.userData.colliderLabel = "bedroom_4_semantic_mesh_local_debug";
  colliderMesh.userData.surfaceType = "semantic-mesh-ply-collider";
  colliderMesh.userData.walkable = true;
  colliderMesh.userData.characterCollision = true;
  colliderMesh.userData.cameraCollision = true;
  colliderLayer.add(colliderMesh);

  colliderWire = new THREE.LineSegments(
    createSampledWireGeometry(parsed.geometry),
    new THREE.LineBasicMaterial({
      color: 0xefb35f,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  colliderWire.name = "semantic PLY collider sampled wire overlay";
  colliderWire.raycast = () => {};
  colliderLayer.add(colliderWire);

  state.colliderVertices = parsed.vertexCount;
  state.colliderFaces = parsed.faceCount;
  state.colliderReady = true;
  showToast("Semantic mesh PLY collider loaded.");
  updateHud();
  return colliderBounds;
}

function applyColliderMode() {
  if (colliderMesh) {
    colliderMesh.visible = state.colliderRenderMode !== "hidden";
    colliderMesh.material.opacity = state.colliderRenderMode === "solid" ? 0.32 : 0.055;
  }
  if (colliderWire) {
    colliderWire.visible = state.colliderRenderMode === "wire";
  }
  updateHud();
}

function applySemanticColorMode() {
  if (!colliderMesh) return;
  const geometry = colliderMesh.geometry;
  const color = geometry.getAttribute("color");
  const rawColor = geometry.getAttribute("rawColor");
  if (!color || !rawColor) return;
  if (state.semanticColor) {
    const objectId = geometry.getAttribute("objectId");
    for (let i = 0; i < color.count; i += 1) {
      const c = semanticColor(objectId.getX(i));
      color.setXYZ(i, c.r, c.g, c.b);
    }
  } else {
    for (let i = 0; i < color.count; i += 1) {
      color.setXYZ(i, rawColor.getX(i), rawColor.getY(i), rawColor.getZ(i));
    }
  }
  color.needsUpdate = true;
}

function createRobot() {
  const group = new THREE.Group();
  group.name = "Video2Mesh mesh-proxy robot";

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x58d7c9,
    roughness: 0.48,
    metalness: 0.16,
    emissive: 0x092e2a,
    emissiveIntensity: 0.42,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xefb35f,
    roughness: 0.58,
    metalness: 0.08,
    emissive: 0x2b1804,
    emissiveIntensity: 0.35,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x11191c,
    roughness: 0.62,
    metalness: 0.05,
  });
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x58d7c9,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.58, 6, 14), bodyMaterial);
  body.position.y = 0.78;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), accentMaterial);
  head.scale.set(1.08, 0.88, 1.08);
  head.position.y = 1.34;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.045), eyeMaterial);
  visor.position.set(0, 1.38, 0.255);
  group.add(visor);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), accentMaterial);
  antenna.position.set(0.12, 1.68, 0);
  antenna.rotation.z = -0.24;
  group.add(antenna);

  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), eyeMaterial);
  antennaTip.position.set(0.165, 1.87, 0);
  group.add(antennaTip);

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.44, 4, 10), darkMaterial);
  leftArm.position.set(-0.42, 0.86, 0.02);
  leftArm.rotation.z = 0.2;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.42;
  rightArm.rotation.z = -0.2;
  group.add(rightArm);

  const footGeometry = new THREE.BoxGeometry(0.28, 0.12, 0.34);
  const leftFoot = new THREE.Mesh(footGeometry, darkMaterial);
  leftFoot.position.set(-0.17, 0.08, 0.05);
  group.add(leftFoot);

  const rightFoot = leftFoot.clone();
  rightFoot.position.x = 0.17;
  group.add(rightFoot);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.012, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x58d7c9, transparent: true, opacity: 0.52 })
  );
  ring.name = "robot ground probe ring";
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.035;
  group.add(ring);

  group.traverse((child) => {
    if (child.isMesh) child.raycast = () => {};
  });
  group.userData.height = 1.72;
  group.userData.groundOffset = 0.02;
  group.visible = state.robotEnabled;
  return group;
}

function getColliderProbeHeights() {
  if (!colliderBounds) return { originY: 40, range: 120 };
  const size = boxSize(colliderBounds);
  return {
    originY: colliderBounds.max.y + Math.max(4, size.y * 0.25),
    range: Math.max(16, size.y + 12),
  };
}

function groundProbe(position, { preferFloor = true } = {}) {
  if (!colliderMesh) return null;
  const { originY, range } = getColliderProbeHeights();
  groundRaycaster.set(
    new THREE.Vector3(position.x, originY, position.z),
    new THREE.Vector3(0, -1, 0)
  );
  groundRaycaster.near = 0;
  groundRaycaster.far = range;
  const hits = groundRaycaster.intersectObject(colliderMesh, false);
  if (!hits.length) return null;
  const walkableHits = hits.filter((hit) => {
    const normal = hit.face?.normal.clone() || ROBOT_UP.clone();
    normal.transformDirection(hit.object.matrixWorld);
    return normal.dot(ROBOT_UP) > 0.3;
  });
  if (!walkableHits.length) return hits[0];
  if (preferFloor && Number.isFinite(robotFloorYEstimate)) {
    const floorHit = walkableHits
      .filter((hit) => Math.abs(hit.point.y - robotFloorYEstimate) <= 2.4)
      .sort((a, b) => Math.abs(a.point.y - robotFloorYEstimate) - Math.abs(b.point.y - robotFloorYEstimate))[0];
    if (floorHit) return floorHit;
  }
  return walkableHits[0];
}

function isRobotStepBlocked(fromPosition, toPosition) {
  if (!colliderMesh || !state.robotObstacleCollision) return false;
  const direction = toPosition.clone().sub(fromPosition);
  direction.y = 0;
  const distance = direction.length();
  if (distance < 1e-4) return false;
  direction.normalize();
  const origin = fromPosition.clone();
  origin.y += 0.58;
  obstacleRaycaster.set(origin, direction);
  obstacleRaycaster.near = 0.04;
  obstacleRaycaster.far = Math.min(0.72, distance + 0.24);
  const hits = obstacleRaycaster.intersectObject(colliderMesh, false);
  return hits.some((hit) => {
    const normal = hit.face?.normal.clone() || ROBOT_UP.clone();
    normal.transformDirection(hit.object.matrixWorld);
    return Math.abs(normal.y) < 0.52;
  });
}

function isInsideColliderFootprint(position, margin = 0.8) {
  if (!colliderBounds) return false;
  return (
    position.x >= colliderBounds.min.x - margin &&
    position.x <= colliderBounds.max.x + margin &&
    position.z >= colliderBounds.min.z - margin &&
    position.z <= colliderBounds.max.z + margin
  );
}

function findGroundForStep(fromPosition, move, distance) {
  const direction = move.clone().normalize();
  const right = new THREE.Vector3().crossVectors(direction, ROBOT_UP).normalize();
  const distances = [distance, distance * 0.68, distance * 0.42, distance * 0.24];
  const lateralOffsets = [0, 0.28, -0.28, 0.58, -0.58, 0.92, -0.92];
  const hits = [];

  for (const travel of distances) {
    const base = fromPosition.clone().addScaledVector(direction, travel);
    for (const lateral of lateralOffsets) {
      const candidate = base.clone().addScaledVector(right, lateral);
      const hit = groundProbe(candidate, { preferFloor: true });
      if (!hit) continue;
      const intended = fromPosition.clone().addScaledVector(direction, distance);
      const lateralScore = Math.hypot(hit.point.x - intended.x, hit.point.z - intended.z);
      const yScore = Number.isFinite(robotFloorYEstimate)
        ? Math.abs(hit.point.y - robotFloorYEstimate) * 0.2
        : 0;
      hits.push({ hit, score: lateralScore + yScore });
    }
  }

  hits.sort((a, b) => a.score - b.score);
  if (hits.length) return { point: hits[0].hit.point.clone(), source: "mesh-nearby" };

  const fallback = fromPosition.clone().addScaledVector(direction, distance);
  if (!state.robotObstacleCollision && Number.isFinite(robotFloorYEstimate) && isInsideColliderFootprint(fallback)) {
    fallback.y = robotFloorYEstimate;
    return { point: fallback, source: "floor-plane-fallback" };
  }
  return null;
}

function respawnRobotAt(point, source = "manual") {
  if (!colliderMesh) return false;
  if (!robotGroup) {
    robotGroup = createRobot();
    robotLayer.add(robotGroup);
  }
  const spawn = point.clone();
  spawn.y += robotGroup.userData.groundOffset;
  robotGroup.position.copy(spawn);
  robotGroup.rotation.y = Math.atan2(camera.position.x - spawn.x, camera.position.z - spawn.z);
  robotGroundY = spawn.y;

  state.robotReady = true;
  state.robotGrounded = true;
  state.robotSpawnSource = source;
  state.robotPosition = roundedVector(robotGroup.position);
  state.robotYaw = Number(robotGroup.rotation.y.toFixed(4));
  if (state.robotFollowCamera) updateRobotFollowCamera(0, true);
  updateHud();
  return true;
}

function findRobotSpawnHit() {
  if (!colliderMesh || !colliderBounds) return null;
  const center = transformedVisualBounds ? boxCenter(transformedVisualBounds) : boxCenter(colliderBounds);
  const size = boxSize(colliderBounds);
  const zOffsets = [-0.18, -0.28, -0.08, 0.08, 0.2, -0.38].map((value) => value * size.z);
  const xOffsets = [0, -0.08, 0.08, -0.16, 0.16].map((value) => value * size.x);
  const candidates = [];
  for (const z of zOffsets) {
    for (const x of xOffsets) {
      candidates.push(center.clone().add(new THREE.Vector3(x, 0, z)));
    }
  }
  candidates.push(boxCenter(colliderBounds).add(new THREE.Vector3(0, 0, -size.z * 0.28)));
  candidates.push(boxCenter(colliderBounds).add(new THREE.Vector3(size.x * 0.1, 0, -size.z * 0.22)));

  const scoredHits = [];
  for (const candidate of candidates) {
    const hit = groundProbe(candidate, { preferFloor: true });
    if (!hit) continue;
    const yScore = Number.isFinite(robotFloorYEstimate)
      ? Math.abs(hit.point.y - robotFloorYEstimate)
      : 0;
    const centerScore = Math.hypot(hit.point.x - center.x, hit.point.z - center.z) * 0.035;
    scoredHits.push({ hit, score: yScore + centerScore });
  }
  scoredHits.sort((a, b) => a.score - b.score);
  return scoredHits[0]?.hit || null;
}

function spawnRobotAtBounds() {
  if (!colliderMesh || !colliderBounds) return;
  if (!robotGroup) {
    robotGroup = createRobot();
    robotLayer.add(robotGroup);
  }

  const spawnHit = findRobotSpawnHit();
  if (spawnHit) {
    respawnRobotAt(spawnHit.point, "auto-floor");
    return;
  }
  const fallback = boxCenter(colliderBounds);
  fallback.y = Number.isFinite(robotFloorYEstimate) ? robotFloorYEstimate : fallback.y;
  respawnRobotAt(fallback, "bbox-fallback");
}

function getCameraPlanarBasis() {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-5) forward.set(0, 0, -1);
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  return { forward, right };
}

function getRobotMoveVector() {
  const { forward, right } = getCameraPlanarBasis();
  const move = new THREE.Vector3();
  if (keyState.has("KeyW") || keyState.has("ArrowUp")) move.add(forward);
  if (keyState.has("KeyS") || keyState.has("ArrowDown")) move.sub(forward);
  if (keyState.has("KeyA") || keyState.has("ArrowLeft")) move.sub(right);
  if (keyState.has("KeyD") || keyState.has("ArrowRight")) move.add(right);
  if (move.lengthSq() > 0) move.normalize();
  return move;
}

function moveRobotOnMesh(move, distance) {
  if (!robotGroup || !colliderMesh || move.lengthSq() <= 0) return false;
  const current = robotGroup.position.clone();
  const target = current.clone().addScaledVector(move.clone().normalize(), distance);
  state.robotBlocked = false;

  if (!state.robotObstacleCollision && Number.isFinite(robotFloorYEstimate) && isInsideColliderFootprint(target)) {
    target.y = robotFloorYEstimate + robotGroup.userData.groundOffset;
    robotGroup.position.copy(target);
    robotGroundY = robotGroup.position.y;
    state.robotGrounded = true;
    const targetYaw = Math.atan2(move.x, move.z);
    const yawDelta = Math.atan2(
      Math.sin(targetYaw - robotGroup.rotation.y),
      Math.cos(targetYaw - robotGroup.rotation.y)
    );
    robotGroup.rotation.y += yawDelta;
    state.robotPosition = roundedVector(robotGroup.position);
    state.robotYaw = Number(robotGroup.rotation.y.toFixed(4));
    return true;
  }

  if (isRobotStepBlocked(current, target)) {
    state.robotBlocked = true;
    return false;
  }
  const stepGround = findGroundForStep(current, move, distance);
  if (!stepGround) {
    state.robotBlocked = true;
    state.robotGrounded = true;
    return false;
  }
  const next = stepGround.point.clone();
  next.y += robotGroup.userData.groundOffset;
  const maxStep = stepGround.source === "floor-plane-fallback" ? 1.25 : 0.92;
  if (robotGroundY != null && Math.abs(next.y - robotGroundY) > maxStep) {
    state.robotBlocked = true;
    return false;
  }
  robotGroup.position.copy(next);
  robotGroundY = robotGroup.position.y;
  state.robotGrounded = true;
  const targetYaw = Math.atan2(move.x, move.z);
  const yawDelta = Math.atan2(
    Math.sin(targetYaw - robotGroup.rotation.y),
    Math.cos(targetYaw - robotGroup.rotation.y)
  );
  robotGroup.rotation.y += yawDelta;
  state.robotPosition = roundedVector(robotGroup.position);
  state.robotYaw = Number(robotGroup.rotation.y.toFixed(4));
  return true;
}

function stepRobotByCamera(direction) {
  if (!robotGroup || !state.robotEnabled) return;
  const { forward, right } = getCameraPlanarBasis();
  const move = new THREE.Vector3();
  if (direction === "forward") move.copy(forward);
  if (direction === "back") move.copy(forward).multiplyScalar(-1);
  if (direction === "left") move.copy(right).multiplyScalar(-1);
  if (direction === "right") move.copy(right);
  const moved = moveRobotOnMesh(move, 0.85);
  if (state.robotFollowCamera) updateRobotFollowCamera(0, true);
  updateHud();
  showToast(moved ? "Robot stepped on mesh floor." : "Robot step blocked by mesh probe.");
}

function pulseRobotFromKey(code) {
  if (!robotGroup || !state.robotEnabled) return;
  const { forward, right } = getCameraPlanarBasis();
  const move = new THREE.Vector3();
  if (code === "KeyW" || code === "ArrowUp") move.copy(forward);
  if (code === "KeyS" || code === "ArrowDown") move.copy(forward).multiplyScalar(-1);
  if (code === "KeyA" || code === "ArrowLeft") move.copy(right).multiplyScalar(-1);
  if (code === "KeyD" || code === "ArrowRight") move.copy(right);
  if (move.lengthSq() === 0) return;
  moveRobotOnMesh(move, 0.32);
  if (state.robotFollowCamera) updateRobotFollowCamera(0, true);
  updateHud();
}

function updateRobot(dt) {
  if (!robotGroup || !state.robotEnabled) {
    state.robotSpeed = 0;
    return;
  }

  const move = getRobotMoveVector();
  const isMoving = move.lengthSq() > 0;
  const speed = (keyState.has("ShiftLeft") || keyState.has("ShiftRight")) ? 4.8 : 2.35;
  state.robotBlocked = false;
  state.robotSpeed = isMoving ? speed : 0;

  if (isMoving) {
    moveRobotOnMesh(move, speed * dt);

    const targetYaw = Math.atan2(move.x, move.z);
    const yawDelta = Math.atan2(
      Math.sin(targetYaw - robotGroup.rotation.y),
      Math.cos(targetYaw - robotGroup.rotation.y)
    );
    robotGroup.rotation.y += yawDelta * Math.min(1, dt * 12);
    robotBobPhase += dt * speed * 6.2;
    robotGroup.scale.y = 1 + Math.sin(robotBobPhase) * 0.025;
  } else {
    robotBobPhase += dt * 1.8;
    robotGroup.scale.y = 1 + Math.sin(robotBobPhase) * 0.008;
  }

  state.robotPosition = roundedVector(robotGroup.position);
  state.robotYaw = Number(robotGroup.rotation.y.toFixed(4));
  if (state.robotFollowCamera) updateRobotFollowCamera(dt);
}

function updateRobotFollowCamera(dt, immediate = false) {
  if (!robotGroup || state.cameraMode !== "orbit") return;
  const target = robotGroup.position.clone().add(new THREE.Vector3(0, 0.82, 0));
  const yaw = robotGroup.rotation.y;
  const followOffset = new THREE.Vector3(
    Math.sin(yaw + Math.PI) * 4.8,
    2.15,
    Math.cos(yaw + Math.PI) * 4.8
  );
  const desiredCamera = target.clone().add(followOffset);
  setSmoothCameraPose(desiredCamera, target, { immediate });
  state.cameraPreset = "robotFollow";
}

function cameraAnchorFromScene(bounds, { preferRobot = false } = {}) {
  const center = boxCenter(bounds);
  const floorY = Number.isFinite(robotFloorYEstimate) ? robotFloorYEstimate : bounds.min.y;
  const anchor = preferRobot && robotGroup ? robotGroup.position.clone() : center.clone();
  anchor.y = floorY + 1.15;
  return { anchor, center, floorY };
}

function cameraPresetVectors(preset, bounds) {
  const size = boxSize(bounds);
  const roomMax = Math.max(size.x, size.y, size.z, 1);
  const presetId = CAMERA_PRESETS.includes(preset) ? preset : "front";
  const { anchor, center, floorY } = cameraAnchorFromScene(bounds, { preferRobot: presetId === "robot" });
  const indoorDistance = Math.max(2.6, Math.min(7.2, Math.max(size.x, size.z) * 0.18));
  const lowHeight = Math.max(1.15, Math.min(2.1, size.y * 0.14));
  const lookAhead = Math.max(1.2, Math.min(3.8, Math.max(size.x, size.z) * 0.055));
  let eye;
  let target = anchor.clone().add(new THREE.Vector3(0, 0.42, 0));

  if (presetId === "front") {
    eye = anchor.clone().add(new THREE.Vector3(0, lowHeight, -indoorDistance));
    target.add(new THREE.Vector3(0, 0.05, lookAhead));
  } else if (presetId === "back") {
    eye = anchor.clone().add(new THREE.Vector3(0, lowHeight, indoorDistance));
    target.add(new THREE.Vector3(0, 0.05, -lookAhead));
  } else if (presetId === "left") {
    eye = anchor.clone().add(new THREE.Vector3(-indoorDistance, lowHeight, 0));
    target.add(new THREE.Vector3(lookAhead, 0.05, 0));
  } else if (presetId === "right") {
    eye = anchor.clone().add(new THREE.Vector3(indoorDistance, lowHeight, 0));
    target.add(new THREE.Vector3(-lookAhead, 0.05, 0));
  } else if (presetId === "top") {
    const topDistance = Math.max(6.5, Math.min(18, roomMax * 0.46));
    target = new THREE.Vector3(center.x, floorY + 0.45, center.z);
    eye = target.clone().add(new THREE.Vector3(0.02, topDistance, 0.02));
  } else {
    const yaw = robotGroup ? robotGroup.rotation.y : 0;
    const back = new THREE.Vector3(Math.sin(yaw + Math.PI), 0, Math.cos(yaw + Math.PI));
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(0.65);
    target = anchor.clone().add(new THREE.Vector3(0, 0.52, 0));
    eye = target.clone()
      .addScaledVector(back, Math.max(2.4, Math.min(4.2, indoorDistance * 0.74)))
      .add(side)
      .add(new THREE.Vector3(0, Math.max(1.05, lowHeight * 0.75), 0));
  }

  const minY = floorY + 0.35;
  if (eye.y < minY) eye.y = minY;
  return { eye, target, size, roomMax, presetId };
}

function setCameraOrbitView(preset = "front", { announce = false } = {}) {
  const bounds = transformedVisualBounds || colliderBounds;
  if (!bounds || bounds.isEmpty()) return;
  const { eye, target, roomMax, presetId } = cameraPresetVectors(preset, bounds);
  state.robotFollowCamera = false;
  state.cameraMode = "orbit";
  state.cameraPreset = presetId;
  keyState.clear();
  controls.minDistance = 0.08;
  controls.maxDistance = Math.max(16, Math.min(48, roomMax * 1.35));
  camera.near = 0.02;
  camera.far = Math.max(220, roomMax * 12);
  camera.updateProjectionMatrix();
  setSmoothCameraPose(eye, target, { immediate: false });
  setLayerVisibility();
  if (announce) showToast(`Camera preset: ${CAMERA_PRESET_LABELS[presetId]}.`);
}

function frameCameraToInterior({ announce = false } = {}) {
  const nextPreset = announce ? nextValue(CAMERA_PRESETS, state.cameraPreset) : state.cameraPreset;
  setCameraOrbitView(nextPreset || "front", { announce });
}

function updateAdaptiveQuality(fps) {
  if (!state.adaptivePixelRatio || state.qualityMode !== "balanced") return;
  const current = renderer.getPixelRatio();
  const ceiling = qualityPixelRatioLimit();
  if (fps < 24 && current > 0.78) {
    applyRendererPixelRatio(Math.max(0.8, current - 0.12), { forceResize: true });
    return;
  }
  if (fps > 48 && current < ceiling - 0.06) {
    applyRendererPixelRatio(Math.min(ceiling, current + 0.06), { forceResize: true });
  }
}

function frameCameraToBounds(bounds, force = false) {
  if (!bounds || bounds.isEmpty()) return;
  const center = boxCenter(bounds);
  const size = boxSize(bounds);
  const radius = Math.max(size.x, size.y, size.z, 1);
  const distance = radius * 0.95;
  const eye = center.clone().add(new THREE.Vector3(distance * 0.72, distance * 0.44, distance * 0.82));
  camera.near = Math.max(0.02, radius / 1200);
  camera.far = Math.max(220, radius * 12);
  camera.updateProjectionMatrix();
  controls.maxDistance = Math.max(80, radius * 5);
  setSmoothCameraPose(eye, center, { immediate: false });
  state.robotFollowCamera = false;
  state.cameraMode = "orbit";
  state.cameraPreset = "overview";
  setLayerVisibility();
  if (force) showToast("View reset to collider/visual proxy bounds.");
}

function respawnRobotAtCurrentViewTarget() {
  const hit = groundProbe(controls.target, { preferFloor: true });
  if (hit && respawnRobotAt(hit.point, "view-target")) {
    showToast("Robot respawned near current view target.");
    return true;
  }
  const spawnHit = findRobotSpawnHit();
  if (spawnHit && respawnRobotAt(spawnHit.point, "auto-floor")) {
    showToast("Robot respawned on estimated room floor.");
    return true;
  }
  showToast("No walkable collider point found for robot respawn.");
  return false;
}

function markHit(point, normal) {
  markerLayer.clear();
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 20),
    new THREE.MeshStandardMaterial({
      color: 0xff806d,
      emissive: 0x6b1109,
      emissiveIntensity: 0.8,
    })
  );
  marker.position.copy(point);
  markerLayer.add(marker);
  const arrow = new THREE.ArrowHelper(normal, point, 1.4, 0xff806d, 0.36, 0.18);
  markerLayer.add(arrow);
}

function describeHit(hit, normal) {
  const faceIndex = Number.isFinite(hit.faceIndex) ? hit.faceIndex : -1;
  const semantic = colliderFaceSemantics[faceIndex] || {};
  return {
    label: hit.object.userData.colliderLabel || hit.object.name || "collider",
    surfaceType: hit.object.userData.surfaceType || "mesh-collider",
    faceIndex,
    objectId: Number.isFinite(semantic.objectId) ? semantic.objectId : null,
    objectProbability: Number.isFinite(semantic.probability)
      ? Number(semantic.probability.toFixed(4))
      : null,
    sourceFace: Number.isFinite(semantic.sourceFace) ? semantic.sourceFace : null,
    point: {
      x: Number(hit.point.x.toFixed(4)),
      y: Number(hit.point.y.toFixed(4)),
      z: Number(hit.point.z.toFixed(4)),
    },
    normal: {
      x: Number(normal.x.toFixed(4)),
      y: Number(normal.y.toFixed(4)),
      z: Number(normal.z.toFixed(4)),
    },
    distance: Number(hit.distance.toFixed(4)),
  };
}

function inspectColliderAt(clientX, clientY, { focus = true, spawnRobot = false } = {}) {
  if (!colliderMesh) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(colliderMesh, false);
  if (!hits.length) {
    state.lastHit = "none";
    state.lastHitInfo = null;
    updateHud();
    showToast("No collider hit. Visual 3DGS splats are ignored by raycast.");
    return;
  }
  const hit = hits[0];
  const normal = hit.face?.normal.clone() || new THREE.Vector3(0, 1, 0);
  normal.transformDirection(hit.object.matrixWorld);
  state.lastHitInfo = describeHit(hit, normal);
  state.lastHit = `${state.lastHitInfo.label}:face-${state.lastHitInfo.faceIndex}`;
  markHit(hit.point, normal);
  if (focus && state.cameraMode === "orbit") {
    setSmoothCameraTarget(hit.point, { preserveOffset: true, immediate: false });
  }
  if (spawnRobot) {
    respawnRobotAt(hit.point, "shift-click");
  }
  updateHud();
  const idText = state.lastHitInfo.objectId ?? "n/a";
  const probText = state.lastHitInfo.objectProbability ?? "n/a";
  showToast(spawnRobot
    ? `Robot respawned on collider face ${state.lastHitInfo.faceIndex}.`
    : `Collider hit face ${state.lastHitInfo.faceIndex}, object_id ${idText}, p=${probText}.`);
}

function onPointerDown(event) {
  if (![0, 1, 2].includes(event.button)) return;
  canvas.focus({ preventScroll: true });
  if (state.cameraMode === "orbit") {
    event.preventDefault();
    state.robotFollowCamera = false;
    canvasDrag = {
      pointerId: event.pointerId,
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      time: performance.now(),
      moved: false,
    };
    pointerDown = canvasDrag;
    canvas.setPointerCapture?.(event.pointerId);
    setLayerVisibility();
    return;
  }
  if (event.button !== 0) return;
  pointerDown = { x: event.clientX, y: event.clientY, time: performance.now(), moved: false };
}

function onPointerUp(event) {
  if (state.cameraMode === "orbit" && canvasDrag && event.pointerId === canvasDrag.pointerId) {
    event.preventDefault();
    const dx = event.clientX - canvasDrag.startX;
    const dy = event.clientY - canvasDrag.startY;
    const elapsed = performance.now() - canvasDrag.time;
    const moved = canvasDrag.moved || Math.hypot(dx, dy) > 5;
    try {
      canvas.releasePointerCapture?.(canvasDrag.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    canvasDrag = null;
    pointerDown = null;
    if (!moved && elapsed <= 380 && event.button === 0) {
      inspectColliderAt(event.clientX, event.clientY, { spawnRobot: event.shiftKey });
    }
    return;
  }

  if (event.button !== 0 || !pointerDown) return;
  const dx = event.clientX - pointerDown.x;
  const dy = event.clientY - pointerDown.y;
  const elapsed = performance.now() - pointerDown.time;
  pointerDown = null;
  if (Math.hypot(dx, dy) > 5 || elapsed > 360) return;
  inspectColliderAt(event.clientX, event.clientY, { spawnRobot: event.shiftKey });
}

function endCanvasDrag(event) {
  if (!canvasDrag) return;
  try {
    canvas.releasePointerCapture?.(canvasDrag.pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
  canvasDrag = null;
  pointerDown = null;
  event?.preventDefault?.();
}

function beginViewportGizmoDrag(event, mode) {
  event.preventDefault();
  event.stopPropagation();
  state.viewportGizmo = mode;
  state.robotFollowCamera = false;
  state.cameraMode = "orbit";
  gizmoDrag = {
    mode,
    pointerId: event.pointerId,
    element: event.currentTarget,
    lastX: event.clientX,
    lastY: event.clientY,
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.currentTarget.classList.add("is-dragging");
  setLayerVisibility();
}

function updateViewportGizmoDrag(event) {
  if (!gizmoDrag) return;
  if (event.pointerId != null && gizmoDrag.pointerId != null && event.pointerId !== gizmoDrag.pointerId) return;
  event.preventDefault();
  const dx = event.clientX - gizmoDrag.lastX;
  const dy = event.clientY - gizmoDrag.lastY;
  if (dx === 0 && dy === 0) return;
  gizmoDrag.lastX = event.clientX;
  gizmoDrag.lastY = event.clientY;
  if (gizmoDrag.mode === "rotate") {
    orbitCameraAroundTarget({
      theta: -dx * CAMERA_ORBIT_SENSITIVITY,
      phi: -dy * CAMERA_ORBIT_SENSITIVITY,
    });
  } else {
    panCameraTarget(dx, dy);
  }
}

function endViewportGizmoDrag(event) {
  if (!gizmoDrag) return;
  event.preventDefault?.();
  const element = gizmoDrag.element;
  try {
    element?.releasePointerCapture?.(gizmoDrag.pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
  element?.classList.remove("is-dragging");
  state.viewportGizmo = "idle";
  gizmoDrag = null;
  setLayerVisibility();
}

function onCanvasWheel(event) {
  if (state.cameraMode !== "orbit") return;
  event.preventDefault();

  const now = performance.now();
  if (now - smoothCamera.lastWheelTime > 80) {
    smoothCamera.burstIsWheel = classifyWheelInput(event);
  }
  smoothCamera.lastWheelTime = now;

  const wheelDelta = event.shiftKey && event.deltaY === 0 ? event.deltaX : event.deltaY;
  const verticalDominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
  if (event.shiftKey) {
    panCameraTarget(event.deltaX, event.deltaY);
  } else if (verticalDominant || smoothCamera.burstIsWheel || event.ctrlKey || event.metaKey) {
    zoomCameraByWheel(wheelDelta);
  } else {
    orbitCameraAroundTarget({
      theta: -event.deltaX * CAMERA_TRACKPAD_ORBIT_SENSITIVITY,
      phi: -event.deltaY * CAMERA_TRACKPAD_ORBIT_SENSITIVITY,
    });
  }
}

function updateFlyCamera(dt) {
  if (state.cameraMode !== "fly" || state.robotEnabled) return;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const flatForward = forward.clone().setY(0);
  if (flatForward.lengthSq() > 0) flatForward.normalize();
  const right = new THREE.Vector3().crossVectors(flatForward, camera.up).normalize();
  const move = new THREE.Vector3();
  if (keyState.has("KeyW") || keyState.has("ArrowUp")) move.add(flatForward);
  if (keyState.has("KeyS") || keyState.has("ArrowDown")) move.sub(flatForward);
  if (keyState.has("KeyA") || keyState.has("ArrowLeft")) move.sub(right);
  if (keyState.has("KeyD") || keyState.has("ArrowRight")) move.add(right);
  if (keyState.has("KeyE") || keyState.has("Space")) move.y += 1;
  if (keyState.has("KeyQ") || keyState.has("ShiftLeft") || keyState.has("ShiftRight")) move.y -= 1;
  if (move.lengthSq() === 0) return;
  const speed = keyState.has("AltLeft") || keyState.has("AltRight") ? 28 : 12;
  camera.position.addScaledVector(move.normalize(), speed * dt);
  controls.target.copy(camera.position).add(forward.multiplyScalar(5));
}

function onPointerMove(event) {
  if (state.cameraMode === "orbit" && canvasDrag && event.pointerId === canvasDrag.pointerId) {
    event.preventDefault();
    const dx = event.clientX - canvasDrag.lastX;
    const dy = event.clientY - canvasDrag.lastY;
    if (dx === 0 && dy === 0) return;
    canvasDrag.lastX = event.clientX;
    canvasDrag.lastY = event.clientY;
    if (Math.hypot(event.clientX - canvasDrag.startX, event.clientY - canvasDrag.startY) > 4) {
      canvasDrag.moved = true;
    }

    const wantsZoom = event.ctrlKey || event.metaKey || canvasDrag.button === 1;
    const wantsPan = event.shiftKey || event.button === 2 || canvasDrag.button === 2;
    if (wantsZoom) {
      zoomCameraByWheel(-dy, CAMERA_DRAG_ZOOM_SENSITIVITY);
    } else if (wantsPan) {
      panCameraTarget(dx, dy);
    } else {
      orbitCameraAroundTarget({
        theta: -dx * CAMERA_ORBIT_SENSITIVITY,
        phi: -dy * CAMERA_ORBIT_SENSITIVITY,
      });
    }
    return;
  }
  if (state.cameraMode !== "fly" || event.buttons !== 1) return;
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const spherical = new THREE.Spherical().setFromVector3(direction);
  spherical.theta -= event.movementX * 0.0032;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - event.movementY * 0.0032, 0.04, Math.PI - 0.04);
  direction.setFromSpherical(spherical).normalize();
  controls.target.copy(camera.position).add(direction.multiplyScalar(5));
  camera.lookAt(controls.target);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  applyRendererPixelRatio(qualityPixelRatioLimit());
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateAlignmentButtons() {
  const offset = state.manualAlignmentOffset;
  const rotation = state.manualAlignmentRotationDeg;
  const defaultOffset = state.defaultViewerOffset;
  const label = document.querySelector("#alignmentReadout");
  if (label) {
    label.textContent = `default ${defaultOffset.x.toFixed(2)} ${defaultOffset.y.toFixed(2)} ${defaultOffset.z.toFixed(2)} · manual ${offset.x.toFixed(2)} ${offset.y.toFixed(2)} ${offset.z.toFixed(2)} · rot ${rotation.x.toFixed(1)}°/${rotation.y.toFixed(1)}°/${rotation.z.toFixed(1)}°`;
  }
  const reset = document.querySelector("#resetAlignment");
  if (reset) reset.classList.toggle("is-active", manualAlignmentIsActive());
}

function setLayerVisibility() {
  visualLayer.visible = state.showVisual;
  sparkRenderer.visible = state.showVisual && state.visualReady;
  if (visualSplat) visualSplat.visible = state.showVisual;
  document.querySelector("#toggleVisual").classList.toggle("is-active", state.showVisual);
  document.querySelector("#toggleCollider").classList.toggle("is-active", state.colliderRenderMode !== "hidden");
  document.querySelector("#toggleCollider").textContent = `Collider ${state.colliderRenderMode}`;
  document.querySelector("#toggleSemantic").classList.toggle("is-active", state.semanticColor);
  document.querySelector("#toggleCameraMode").classList.toggle("is-active", state.cameraMode === "fly");
  document.querySelector("#toggleCameraMode").textContent = state.cameraMode === "fly" ? "Fly Camera" : "Orbit Camera";
  document.querySelectorAll("[data-camera-preset]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.cameraPreset === state.cameraPreset);
  });
  document.querySelector("#toggleRobot").classList.toggle("is-active", state.robotEnabled);
  document.querySelector("#toggleRobotFollow").classList.toggle("is-active", state.robotFollowCamera);
  document.querySelector("#toggleRobotFollow").textContent = state.robotFollowCamera ? "Follow On" : "Follow Off";
  document.querySelector("#toggleRobotCollision").classList.toggle("is-active", state.robotObstacleCollision);
  document.querySelector("#toggleRobotCollision").textContent = state.robotObstacleCollision ? "Collision On" : "Collision Off";
  document.querySelector("#toggleQuality").classList.toggle("is-active", state.qualityMode === "performance");
  document.querySelector("#toggleQuality").textContent = state.qualityMode === "performance" ? "Performance" : "Balanced";
  controls.enabled = false;
  robotLayer.visible = state.robotEnabled;
  if (robotGroup) robotGroup.visible = state.robotEnabled;
  applyColliderMode();
  updateAlignmentButtons();
  updateHud();
}

function bindEvents() {
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", updateViewportGizmoDrag);
  window.addEventListener("pointerup", endViewportGizmoDrag);
  window.addEventListener("pointercancel", endViewportGizmoDrag);
  window.addEventListener("keydown", (event) => {
    const wasPressed = keyState.has(event.code);
    keyState.add(event.code);
    const robotKey = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code);
    if (robotKey && !wasPressed) pulseRobotFromKey(event.code);
    if (robotKey || ["Space"].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => keyState.delete(event.code));
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", endCanvasDrag);
  canvas.addEventListener("lostpointercapture", endCanvasDrag);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", onCanvasWheel, { passive: false });
  document.querySelectorAll("[data-viewport-gizmo]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => beginViewportGizmoDrag(event, button.dataset.viewportGizmo));
    button.addEventListener("lostpointercapture", () => {
      button.classList.remove("is-dragging");
      state.viewportGizmo = "idle";
      gizmoDrag = null;
      setLayerVisibility();
    });
  });

  document.querySelector("#toggleVisual").addEventListener("click", () => {
    state.showVisual = !state.showVisual;
    setLayerVisibility();
  });
  document.querySelector("#toggleCollider").addEventListener("click", () => {
    state.colliderRenderMode = nextValue(COLLIDER_MODES, state.colliderRenderMode);
    setLayerVisibility();
    showToast(`Collider render mode: ${COLLIDER_LABELS[state.colliderRenderMode]}. Raycast stays active.`);
  });
  document.querySelector("#toggleSemantic").addEventListener("click", () => {
    state.semanticColor = !state.semanticColor;
    applySemanticColorMode();
    setLayerVisibility();
    showToast(state.semanticColor ? "Semantic object colors enabled." : "Raw mesh vertex colors enabled.");
  });
  document.querySelector("#toggleCameraMode").addEventListener("click", () => {
    state.cameraMode = state.cameraMode === "orbit" ? "fly" : "orbit";
    state.cameraPreset = state.cameraMode === "fly" ? "fly" : "custom";
    keyState.clear();
    if (state.cameraMode === "orbit") syncSmoothCameraFromCurrent();
    setLayerVisibility();
    showToast(state.cameraMode === "fly"
      ? "Fly camera enabled. Turn Robot off if you want WASD to move the camera."
      : "Orbit camera enabled.");
  });
  document.querySelector("#toggleRobot").addEventListener("click", () => {
    state.robotEnabled = !state.robotEnabled;
    setLayerVisibility();
    showToast(state.robotEnabled ? "Robot enabled on mesh collider." : "Robot hidden; collider raycast stays active.");
  });
  document.querySelector("#toggleRobotFollow").addEventListener("click", () => {
    state.robotFollowCamera = !state.robotFollowCamera;
    if (state.robotFollowCamera && robotGroup) updateRobotFollowCamera(0, true);
    setLayerVisibility();
    showToast(state.robotFollowCamera ? "Camera follows robot." : "Camera follow disabled.");
  });
  document.querySelector("#toggleRobotCollision").addEventListener("click", () => {
    state.robotObstacleCollision = !state.robotObstacleCollision;
    setLayerVisibility();
    showToast(state.robotObstacleCollision ? "Robot obstacle rays enabled." : "Robot uses ground-only movement.");
  });
  document.querySelector("#toggleQuality").addEventListener("click", () => {
    state.qualityMode = nextValue(QUALITY_MODES, state.qualityMode);
    applyQualityMode({ announce: true });
    setLayerVisibility();
  });
  document.querySelector("#interiorView").addEventListener("click", () => {
    frameCameraToInterior({ announce: true });
  });
  document.querySelectorAll("[data-camera-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      setCameraOrbitView(button.dataset.cameraPreset, { announce: true });
    });
  });
  document.querySelectorAll("[data-camera-orbit]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.cameraOrbit;
      const turn = THREE.MathUtils.degToRad(18);
      const tilt = THREE.MathUtils.degToRad(12);
      if (action === "left") orbitCameraAroundTarget({ theta: -turn, announce: true });
      if (action === "right") orbitCameraAroundTarget({ theta: turn, announce: true });
      if (action === "up") orbitCameraAroundTarget({ phi: -tilt, announce: true });
      if (action === "down") orbitCameraAroundTarget({ phi: tilt, announce: true });
      if (action === "in") orbitCameraAroundTarget({ scale: 0.78, announce: true });
      if (action === "out") orbitCameraAroundTarget({ scale: 1.28, announce: true });
    });
  });
  document.querySelector("#respawnRobot").addEventListener("click", () => {
    respawnRobotAtCurrentViewTarget();
    setLayerVisibility();
  });
  document.querySelector("#resetView").addEventListener("click", () => {
    if (state.robotEnabled && state.robotFollowCamera && robotGroup && state.cameraMode === "orbit") {
      updateRobotFollowCamera(0, true);
      showToast("View reset to robot follow camera.");
      return;
    }
    frameCameraToBounds(colliderBounds, true);
  });
  document.querySelectorAll("[data-robot-step]").forEach((button) => {
    button.addEventListener("click", () => stepRobotByCamera(button.dataset.robotStep));
  });
  document.querySelectorAll("[data-align-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      const [axis, direction] = button.dataset.alignNudge.split(":");
      const delta = new THREE.Vector3();
      delta[axis] = Number(direction) * ALIGNMENT_NUDGE_STEP;
      nudgeVisualAlignment(delta);
    });
  });
  document.querySelectorAll("[data-align-rotate]").forEach((button) => {
    button.addEventListener("click", () => {
      const [axis, direction] = button.dataset.alignRotate.split(":");
      nudgeVisualRotation(axis, Number(direction) * ALIGNMENT_ROTATION_STEP_DEG);
    });
  });
  document.querySelector("#resetAlignment").addEventListener("click", resetManualAlignment);
  exposeDebugApi();
}

async function init() {
  try {
    bindEvents();
    resize();
    updateHud();
    await loadManifest();
    loadManualAlignment();
    visualMetaBox = boxFromMeta(manifest.assets.visual);
    colliderMetaBox = boxFromMeta(manifest.assets.collider);
    baseVisualTransform = calculateVisualToColliderTransform(visualMetaBox, colliderMetaBox, manifest.alignment);
    await loadColliderMesh();
    transformedVisualBounds = calculateTransformedBox(visualMetaBox, buildEffectiveVisualTransform());
    spawnRobotAtBounds();
    frameCameraToInterior();
    applySemanticColorMode();
    applyQualityMode();
    setLayerVisibility();
    await loadVisualSplat(buildEffectiveVisualTransform());
    applyQualityMode();
    setLayerVisibility();
    syncDebugState();
  } catch (error) {
    console.error(error);
    state.error = error?.message || String(error);
    modeChip.textContent = `Load failed: ${state.error}`;
    showToast(`Load failed: ${state.error}`);
    syncDebugState();
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.04);
  updateFlyCamera(dt);
  updateRobot(dt);
  updateSmoothCamera(dt);
  sparkRenderer.render(scene, camera);

  frameCount += 1;
  const now = performance.now();
  if (now - lastFpsUpdate > 500) {
    state.fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate || 1));
    fpsMetric.textContent = state.fps.toString();
    updateAdaptiveQuality(state.fps);
    updateHud();
    frameCount = 0;
    lastFpsUpdate = now;
  }
  requestAnimationFrame(animate);
}

lastFpsUpdate = performance.now();
init();
animate();
