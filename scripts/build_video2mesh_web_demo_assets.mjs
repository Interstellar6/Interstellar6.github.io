#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TYPE_READERS = {
  char: { size: 1, read: "readInt8" },
  int8: { size: 1, read: "readInt8" },
  uchar: { size: 1, read: "readUInt8" },
  uint8: { size: 1, read: "readUInt8" },
  short: { size: 2, read: "readInt16LE" },
  int16: { size: 2, read: "readInt16LE" },
  ushort: { size: 2, read: "readUInt16LE" },
  uint16: { size: 2, read: "readUInt16LE" },
  int: { size: 4, read: "readInt32LE" },
  int32: { size: 4, read: "readInt32LE" },
  uint: { size: 4, read: "readUInt32LE" },
  uint32: { size: 4, read: "readUInt32LE" },
  float: { size: 4, read: "readFloatLE" },
  float32: { size: 4, read: "readFloatLE" },
  double: { size: 8, read: "readDoubleLE" },
  float64: { size: 8, read: "readDoubleLE" },
};

const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function requireOption(options, key) {
  if (!options[key]) throw new Error(`Missing required option --${key}`);
  return options[key];
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readPly(filePath) {
  const bytes = fs.readFileSync(filePath);
  const marker = Buffer.from("end_header");
  const markerOffset = bytes.indexOf(marker);
  if (markerOffset < 0) throw new Error(`${filePath}: missing PLY end_header`);
  let dataOffset = markerOffset + marker.length;
  while (bytes[dataOffset] === 10 || bytes[dataOffset] === 13) dataOffset += 1;

  const headerText = bytes.subarray(0, dataOffset).toString("ascii");
  if (!headerText.includes("format binary_little_endian 1.0")) {
    throw new Error(`${filePath}: only binary_little_endian PLY is supported`);
  }

  const elements = [];
  let currentElement = null;
  for (const rawLine of headerText.split(/\r?\n/)) {
    const fields = rawLine.trim().split(/\s+/);
    if (fields[0] === "element") {
      currentElement = { name: fields[1], count: Number(fields[2]), properties: [] };
      elements.push(currentElement);
    } else if (fields[0] === "property" && currentElement) {
      if (fields[1] === "list") {
        currentElement.properties.push({
          list: true,
          countType: fields[2],
          itemType: fields[3],
          name: fields[4],
        });
      } else {
        currentElement.properties.push({ list: false, type: fields[1], name: fields[2] });
      }
    }
  }

  const vertex = elements.find((element) => element.name === "vertex");
  if (!vertex?.count) throw new Error(`${filePath}: missing vertex element`);
  if (vertex.properties.some((property) => property.list)) {
    throw new Error(`${filePath}: list-valued vertex properties are not supported`);
  }

  let vertexStride = 0;
  const propertyOffsets = new Map();
  for (const property of vertex.properties) {
    const type = TYPE_READERS[property.type];
    if (!type) throw new Error(`${filePath}: unsupported PLY type ${property.type}`);
    propertyOffsets.set(property.name, vertexStride);
    vertexStride += type.size;
  }

  const positionProperties = ["x", "y", "z"].map((name) => {
    const property = vertex.properties.find((candidate) => candidate.name === name);
    if (!property) throw new Error(`${filePath}: missing vertex property ${name}`);
    return { ...property, offset: propertyOffsets.get(name), reader: TYPE_READERS[property.type] };
  });
  const bbox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (let vertexIndex = 0; vertexIndex < vertex.count; vertexIndex += 1) {
    const base = dataOffset + vertexIndex * vertexStride;
    for (let axis = 0; axis < 3; axis += 1) {
      const property = positionProperties[axis];
      const value = bytes[property.reader.read](base + property.offset);
      bbox.min[axis] = Math.min(bbox.min[axis], value);
      bbox.max[axis] = Math.max(bbox.max[axis], value);
    }
  }

  const face = elements.find((element) => element.name === "face");
  let faceCount = 0;
  let triangleCount = 0;
  if (face?.count) {
    const listProperty = face.properties.find((property) => property.list);
    if (!listProperty || face.properties.length !== 1) {
      throw new Error(`${filePath}: expected one list-valued face property`);
    }
    const countReader = TYPE_READERS[listProperty.countType];
    const itemReader = TYPE_READERS[listProperty.itemType];
    if (!countReader || !itemReader) throw new Error(`${filePath}: unsupported face index types`);
    let offset = dataOffset + vertex.count * vertexStride;
    for (let faceIndex = 0; faceIndex < face.count; faceIndex += 1) {
      const polygonSize = bytes[countReader.read](offset);
      offset += countReader.size;
      if (polygonSize !== 3) {
        throw new Error(`${filePath}: face ${faceIndex} has ${polygonSize} vertices; triangles required`);
      }
      for (let corner = 0; corner < polygonSize; corner += 1) {
        const vertexIndex = bytes[itemReader.read](offset);
        if (vertexIndex >= vertex.count) {
          throw new Error(`${filePath}: face ${faceIndex} references vertex ${vertexIndex}`);
        }
        offset += itemReader.size;
      }
      triangleCount += 1;
    }
    if (offset !== bytes.length) {
      throw new Error(`${filePath}: ${bytes.length - offset} unexpected trailing bytes`);
    }
    faceCount = face.count;
  } else if (dataOffset + vertex.count * vertexStride !== bytes.length) {
    throw new Error(`${filePath}: vertex payload size does not match file size`);
  }

  return {
    bytes,
    metadata: {
      dataOffset,
      vertexCount: vertex.count,
      vertexStride,
      vertexProperties: vertex.properties.map((property) => property.name),
      bbox,
      faceCount,
      triangleCount,
    },
  };
}

function writeChunks(bytes, prefix, tempChunkDir, chunkSize) {
  const parts = [];
  for (let offset = 0, index = 0; offset < bytes.length; offset += chunkSize, index += 1) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    const chunkName = `${prefix}.chunk${String(index).padStart(3, "0")}`;
    fs.writeFileSync(path.join(tempChunkDir, chunkName), chunk);
    parts.push({
      url: `./assets/chunks/${chunkName}`,
      size: chunk.length,
      sha256: sha256(chunk),
    });
  }
  return parts;
}

function buildAsset({ filePath, prefix, tempChunkDir, chunkSize, manifestFields }) {
  const { bytes, metadata } = readPly(filePath);
  const parts = writeChunks(bytes, prefix, tempChunkDir, chunkSize);
  return {
    ...manifestFields,
    vertexCount: metadata.vertexCount,
    ...(metadata.faceCount ? { faceCount: metadata.faceCount } : {}),
    bbox: metadata.bbox,
    sourcePath: filePath,
    size: bytes.length,
    sha256: sha256(bytes),
    headerByteLength: metadata.dataOffset,
    vertexStride: metadata.vertexStride,
    vertexProperties: metadata.vertexProperties,
    parts,
    chunkSize,
  };
}

function readCameraPreset(filePath, frameName) {
  const cameras = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(cameras)) throw new Error(`${filePath}: expected a camera array`);
  const camera = cameras.find((entry) => String(entry.img_name) === String(frameName));
  if (!camera) throw new Error(`${filePath}: camera frame ${frameName} not found`);
  if (!Array.isArray(camera.position) || camera.position.length !== 3) {
    throw new Error(`${filePath}: camera ${frameName} has no 3D position`);
  }
  if (!Array.isArray(camera.rotation) || camera.rotation.length !== 3) {
    throw new Error(`${filePath}: camera ${frameName} has no 3x3 rotation`);
  }
  const forward = camera.rotation.map((row) => Number(row?.[2]));
  const up = camera.rotation.map((row) => Number(row?.[1]));
  if ([...camera.position, ...forward, ...up].some((value) => !Number.isFinite(Number(value)))) {
    throw new Error(`${filePath}: camera ${frameName} contains non-finite pose values`);
  }
  const verticalFovDeg = 2 * Math.atan(Number(camera.height) / (2 * Number(camera.fy))) * 180 / Math.PI;
  return {
    id: `pgsr_input_camera_${frameName}`,
    label: "Doorway entry",
    sourcePath: filePath,
    sourceFrame: String(frameName),
    coordinateFrame: "visual_native",
    eye: camera.position.map(Number),
    forward,
    up,
    targetDistance: 6,
    verticalFovDeg: Number(verticalFovDeg.toFixed(6)),
  };
}

function dominantWorldUp(cameraPreset) {
  const imageUp = cameraPreset.up.map((value) => -Number(value));
  let axis = 0;
  for (let index = 1; index < 3; index += 1) {
    if (Math.abs(imageUp[index]) > Math.abs(imageUp[axis])) axis = index;
  }
  const worldUp = [0, 0, 0];
  worldUp[axis] = imageUp[axis] < 0 ? -1 : 1;
  return worldUp;
}

function replaceChunks(tempChunkDir, chunkDir) {
  fs.mkdirSync(chunkDir, { recursive: true });
  for (const name of fs.readdirSync(chunkDir)) {
    if (/\.chunk\d+$/.test(name)) fs.unlinkSync(path.join(chunkDir, name));
  }
  for (const name of fs.readdirSync(tempChunkDir)) {
    fs.renameSync(path.join(tempChunkDir, name), path.join(chunkDir, name));
  }
}

const options = parseArgs(process.argv.slice(2));
const visualPath = path.resolve(requireOption(options, "visual"));
const colliderPath = path.resolve(requireOption(options, "collider"));
const version = requireOption(options, "version");
const inferredCamerasPath = path.resolve(path.dirname(visualPath), "../..", "cameras.json");
const camerasPath = path.resolve(options.cameras || inferredCamerasPath);
const doorwayFrame = options["doorway-frame"] || "000000";
const chunkSize = Number(options["chunk-size"] || DEFAULT_CHUNK_SIZE);
if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error("--chunk-size must be a positive integer");

const assetDir = path.resolve(options["asset-dir"] || path.join(repoRoot, "static/video2mesh/web-demo/assets"));
const chunkDir = path.join(assetDir, "chunks");
const tempChunkDir = path.join(assetDir, `.chunks-next-${process.pid}`);
fs.rmSync(tempChunkDir, { recursive: true, force: true });
fs.mkdirSync(tempChunkDir, { recursive: true });

try {
  const cameraPresets = {
    doorway: readCameraPreset(camerasPath, doorwayFrame),
  };
  const coordinateSystem = {
    worldUp: dominantWorldUp(cameraPresets.doorway),
    source: `${cameraPresets.doorway.id}_image_up`,
  };
  const initialState = {
    cameraPreset: "doorway",
    robotObstacleCollision: true,
    robotSpawn: {
      id: "fixed-user-approved-doorway-20260716",
      coordinateFrame: "visual_native",
      groundPoint: [5.968559, 6.051313, 7.851893],
      forward: [0.21489584373036277, 0, 0.976636482087327],
    },
  };
  const visual = buildAsset({
    filePath: visualPath,
    prefix: "visual_bedroom_4_pgsr_iteration_30000_point_cloud_ply",
    tempChunkDir,
    chunkSize,
    manifestFields: {
      id: "bedroom_4_pgsr_scannetppv2_iteration_30000_point_cloud_ply",
      label: "Bedroom 4 PGSR Gaussian PLY",
      fileName: "bedroom_4_pgsr_iteration_30000_point_cloud.ply",
      fileType: "ply",
      format: "graphdeco-gaussian-ply",
      shDegree: 3,
    },
  });
  const collider = buildAsset({
    filePath: colliderPath,
    prefix: "collider_bedroom_4_pgsr_tsdf_fusion_post_ply",
    tempChunkDir,
    chunkSize,
    manifestFields: {
      id: "bedroom_4_pgsr_tsdf_fusion_post_ply",
      label: "Bedroom 4 PGSR TSDF mesh collider PLY",
      fileName: "bedroom_4_pgsr_tsdf_fusion_post.ply",
      fileType: "ply",
      format: "open3d-binary-little-endian-triangle-mesh-ply",
      hasSemantics: false,
      vertexPositionType: "float64",
      faceIndexType: "uint32",
    },
  });

  const manifest = {
    version,
    chunkSize,
    cameraPresets,
    coordinateSystem,
    initialState,
    alignment: {
      id: "pgsr_native_shared_frame_20260714",
      method: "identity_same_pgsr_coordinate_frame",
      note: "The TSDF mesh was fused from this PGSR reconstruction and remains in the same native coordinate frame as the Gaussian centers. No fitted Sim(3) or viewer center offset is applied.",
      scale: 1,
      rotationMatrix: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      translation: [0, 0, 0],
    },
    assets: { visual, collider },
  };

  replaceChunks(tempChunkDir, chunkDir);
  fs.writeFileSync(path.join(assetDir, "web-demo-assets.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`visual: ${visual.vertexCount} vertices, ${visual.parts.length} chunks, ${visual.size} bytes`);
  console.log(`collider: ${collider.vertexCount} vertices, ${collider.faceCount} faces, ${collider.parts.length} chunks, ${collider.size} bytes`);
  console.log(`manifest: ${path.join(assetDir, "web-demo-assets.json")}`);
} finally {
  fs.rmSync(tempChunkDir, { recursive: true, force: true });
}
