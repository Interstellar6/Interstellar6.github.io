import * as THREE from "three";
import { SplatMesh, SparkRenderer } from "@sparkjsdev/spark";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const ASSET_VERSION = "local-bedroom4-anysplat-semanticmesh-20260711";
const MANIFEST_URL = `./assets/web-demo-assets.json?v=${ASSET_VERSION}`;
const COLLIDER_MODES = ["wire", "solid", "hidden"];
const COLLIDER_LABELS = {
  wire: "wire + xray",
  solid: "solid",
  hidden: "hidden but active",
};

const canvas = document.querySelector("#sceneCanvas");
const modeChip = document.querySelector("#modeChip");
const visualMetric = document.querySelector("#visualMetric");
const meshMetric = document.querySelector("#meshMetric");
const hitMetric = document.querySelector("#hitMetric");
const semanticMetric = document.querySelector("#semanticMetric");
const fpsMetric = document.querySelector("#fpsMetric");
const toast = document.querySelector("#toast");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x070a0d, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070a0d, 18, 62);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.03, 180);
camera.position.set(24, 16, 30);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 0.5;
controls.maxDistance = 140;
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

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const keyState = new Set();

const state = {
  manifestVersion: "",
  showVisual: true,
  colliderRenderMode: "wire",
  semanticColor: true,
  cameraMode: "orbit",
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
  transformScale: 1,
  transformOffset: { x: 0, y: 0, z: 0 },
  lastHit: "none",
  lastHitInfo: null,
  error: "",
};

let visualSplat = null;
let colliderMesh = null;
let colliderWire = null;
let pointerDown = null;
let manifest = null;
let colliderFaceSemantics = [];
let colliderBounds = null;
let lastFpsUpdate = 0;
let frameCount = 0;

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

function calculateVisualToColliderTransform(visualBox, colliderBox) {
  const visualSize = boxSize(visualBox);
  const colliderSize = boxSize(colliderBox);
  const visualMax = Math.max(visualSize.x, visualSize.y, visualSize.z, 1e-6);
  const colliderMax = Math.max(colliderSize.x, colliderSize.y, colliderSize.z, 1e-6);
  const scale = colliderMax / visualMax;
  const visualCenter = boxCenter(visualBox);
  const colliderCenter = boxCenter(colliderBox);
  const offset = colliderCenter.clone().sub(visualCenter.clone().multiplyScalar(scale));
  return { scale, offset };
}

function syncDebugState() {
  const snapshot = {
    ...state,
    sparkRendererVisible: sparkRenderer.visible,
    visualLayerVisible: visualLayer.visible,
    colliderLayerVisible: colliderLayer.visible,
    colliderVisible: state.colliderRenderMode !== "hidden",
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
  modeChip.textContent = [
    state.visualReady ? "AnySplat Gaussian PLY visual ready" : "loading visual PLY",
    state.colliderReady ? "semantic PLY collider ready" : "loading collider PLY",
    `${COLLIDER_LABELS[state.colliderRenderMode]} collider`,
    `${state.cameraMode} camera`,
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
  state.transformScale = transform.scale;
  state.transformOffset = {
    x: Number(transform.offset.x.toFixed(6)),
    y: Number(transform.offset.y.toFixed(6)),
    z: Number(transform.offset.z.toFixed(6)),
  };

  visualSplat = new SplatMesh({
    fileBytes: bytes,
    fileName: asset.fileName,
    fileType: asset.fileType,
    lod: false,
    raycastable: false,
    onProgress: (event) => {
      if (!event.total) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      modeChip.textContent = `Spark decode ${pct}%`;
    },
  });
  visualSplat.name = "AnySplat bedroom_4 Gaussian visual proxy";
  visualSplat.raycast = () => {};
  visualSplat.scale.setScalar(transform.scale);
  visualSplat.position.copy(transform.offset);
  visualLayer.add(visualSplat);

  await visualSplat.initialized;
  visualSplat.updateMatrixWorld(true);
  state.visualReady = true;
  showToast("AnySplat Gaussian PLY visual layer loaded.");
  updateHud();
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
    new THREE.WireframeGeometry(parsed.geometry),
    new THREE.LineBasicMaterial({
      color: 0xefb35f,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  colliderWire.name = "semantic PLY collider wire overlay";
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

function frameCameraToBounds(bounds, force = false) {
  if (!bounds || bounds.isEmpty()) return;
  const center = boxCenter(bounds);
  const size = boxSize(bounds);
  const radius = Math.max(size.x, size.y, size.z, 1);
  const distance = radius * 0.95;
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(distance * 0.72, distance * 0.44, distance * 0.82));
  camera.near = Math.max(0.02, radius / 1200);
  camera.far = Math.max(220, radius * 12);
  camera.updateProjectionMatrix();
  controls.maxDistance = Math.max(80, radius * 5);
  controls.update();
  if (force) showToast("View reset to collider/visual proxy bounds.");
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

function inspectColliderAt(clientX, clientY, { focus = true } = {}) {
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
    const offset = camera.position.clone().sub(controls.target);
    controls.target.copy(hit.point);
    camera.position.copy(hit.point).add(offset);
    controls.update();
  }
  updateHud();
  const idText = state.lastHitInfo.objectId ?? "n/a";
  const probText = state.lastHitInfo.objectProbability ?? "n/a";
  showToast(`Collider hit face ${state.lastHitInfo.faceIndex}, object_id ${idText}, p=${probText}.`);
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
}

function onPointerUp(event) {
  if (event.button !== 0 || !pointerDown) return;
  const dx = event.clientX - pointerDown.x;
  const dy = event.clientY - pointerDown.y;
  const elapsed = performance.now() - pointerDown.time;
  pointerDown = null;
  if (Math.hypot(dx, dy) > 6 || elapsed > 480) return;
  inspectColliderAt(event.clientX, event.clientY);
}

function updateFlyCamera(dt) {
  if (state.cameraMode !== "fly") return;
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
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setLayerVisibility() {
  visualLayer.visible = state.showVisual;
  sparkRenderer.visible = state.showVisual && state.visualReady;
  if (visualSplat) visualSplat.visible = state.showVisual;
  document.querySelector("#toggleVisual").classList.toggle("is-active", state.showVisual);
  document.querySelector("#toggleCollider").classList.toggle("is-active", state.colliderRenderMode !== "hidden");
  document.querySelector("#toggleSemantic").classList.toggle("is-active", state.semanticColor);
  document.querySelector("#toggleCameraMode").classList.toggle("is-active", state.cameraMode === "fly");
  document.querySelector("#toggleCameraMode").textContent = state.cameraMode === "fly" ? "Fly Camera" : "Orbit Camera";
  controls.enabled = state.cameraMode === "orbit";
  applyColliderMode();
  updateHud();
}

function bindEvents() {
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    keyState.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  window.addEventListener("keyup", (event) => keyState.delete(event.code));
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointermove", onPointerMove);

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
    keyState.clear();
    setLayerVisibility();
    showToast(state.cameraMode === "fly" ? "Fly camera: drag to look, WASD move, Q/E down/up." : "Orbit camera enabled.");
  });
  document.querySelector("#resetView").addEventListener("click", () => frameCameraToBounds(colliderBounds, true));
}

async function init() {
  try {
    bindEvents();
    resize();
    updateHud();
    await loadManifest();
    const visualBox = boxFromMeta(manifest.assets.visual);
    const colliderBox = boxFromMeta(manifest.assets.collider);
    const transform = calculateVisualToColliderTransform(visualBox, colliderBox);
    await loadColliderMesh();
    frameCameraToBounds(colliderBounds);
    await loadVisualSplat(transform);
    applySemanticColorMode();
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
  if (state.cameraMode === "orbit") controls.update();
  sparkRenderer.render(scene, camera);

  frameCount += 1;
  const now = performance.now();
  if (now - lastFpsUpdate > 500) {
    fpsMetric.textContent = Math.round((frameCount * 1000) / (now - lastFpsUpdate || 1)).toString();
    frameCount = 0;
    lastFpsUpdate = now;
  }
  requestAnimationFrame(animate);
}

lastFpsUpdate = performance.now();
init();
animate();
