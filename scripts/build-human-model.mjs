// Offline, deterministic asset preparation. No network requests or paid services.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { body, eyes, landmarks, source } from './lib/human-body.mjs';

const out = 'public/models';
function geometry(model, filter, offset = 0) {
  const faces = model.faces.filter(filter);
  const positions = model.vertices.flatMap((p) => p.toArray());
  const indices = faces.flatMap(({ corners }) =>
    corners.slice(1, -1).flatMap((_, i) => [corners[0][0], corners[i + 1][0], corners[i + 2][0]]),
  );
  const smooth = new THREE.BufferGeometry();
  smooth.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  smooth.setIndex(indices);
  smooth.computeVertexNormals();
  const normals = smooth.getAttribute('normal');
  const p = [],
    n = [],
    u = [],
    colors = [],
    index = [],
    unique = new Map();
  for (const face of faces)
    for (let j = 1; j < face.corners.length - 1; j++) {
      for (const [index, uv] of [face.corners[0], face.corners[j], face.corners[j + 1]]) {
        const key = `${index}/${uv}`;
        if (unique.has(key)) continue;
        unique.set(key, p.length / 3);
        const v = model.vertices[index];
        const normal = new THREE.Vector3().fromBufferAttribute(normals, index);
        p.push(...v.clone().addScaledVector(normal, offset).toArray());
        n.push(...normal.toArray());
        u.push(...(model.uv[uv]?.slice(0, 2) || [0, 0]));
        // Small warm variation retains the user-selected skin material, without a photo texture.
        const lip = v.y > 3.045 && v.y < 3.085 && Math.abs(v.x) < 0.067 && v.z > 0.284;
        colors.push(...(lip ? [0.82, 0.61, 0.59] : [1, 0.98, 0.96]));
      }
    }
  for (const face of faces)
    for (let j = 1; j < face.corners.length - 1; j++) {
      for (const [v, uv] of [face.corners[0], face.corners[j], face.corners[j + 1]])
        index.push(unique.get(`${v}/${uv}`));
    }
  return {
    POSITION: new Float32Array(p),
    NORMAL: new Float32Array(n),
    TEXCOORD_0: new Float32Array(u),
    COLOR_0: new Float32Array(colors),
    INDICES: new Uint32Array(index),
  };
}
const isBody = (f) => f.group === 'body';
const exposed = (f) =>
  isBody(f) &&
  f.corners.every(([i]) => {
    const p = body.vertices[i];
    return p.y > 2.934 || (Math.abs(p.x) > 0.46 && p.y < 1.8 && p.y > 1.1);
  });
const scalp = (f) =>
  isBody(f) &&
  f.corners.every(([i]) => {
    const p = body.vertices[i];
    const front = Math.max(0, Math.min(1, (p.z - 0.045) / 0.2));
    const hairline = 3.1 + 0.19 * front + 0.012 * Math.sin(p.x * 25);
    return p.y > hairline;
  });

function clothing(kind) {
  const low = kind === 'shorts' ? 1.34 : 0.19;
  const high = 1.94;
  const model = { vertices: [], uv: [], faces: [] };
  const profile = [
    [0.19, 0.24, 0.108, 0.125],
    [0.45, 0.237, 0.112, 0.131],
    [0.9, 0.225, 0.133, 0.149],
    [1.3, 0.203, 0.163, 0.18],
    [1.62, 0.184, 0.184, 0.217],
  ];
  const remap = (p) => {
    const v = p.clone(),
      sign = Math.sign(p.x) || 1;
    if (kind === 'shorts') {
      v.x += sign * 0.018;
      v.z += Math.sign(p.z - 0.04) * 0.022;
      return v;
    }
    const segment = profile.findIndex(
      (row, i) => i < profile.length - 1 && p.y <= profile[i + 1][0],
    );
    const section = segment < 0 ? profile.length - 2 : segment;
    const start = profile[section],
      end = profile[section + 1];
    const t = THREE.MathUtils.clamp((p.y - start[0]) / (end[0] - start[0]), 0, 1);
    const [cx, rx, rz] = [1, 2, 3].map((d) => THREE.MathUtils.lerp(start[d], end[d], t));
    const legAngle = Math.atan2((p.x - sign * cx) / rx, (p.z - 0.03) / rz);
    const leg = new THREE.Vector3(
      sign * cx + Math.sin(legAngle) * rx,
      p.y,
      0.03 + Math.cos(legAngle) * rz,
    );
    const waistAngle = Math.atan2(p.x / 0.33, (p.z - 0.035) / 0.235);
    const waistWidth = THREE.MathUtils.lerp(
      0.36,
      0.305,
      THREE.MathUtils.clamp((p.y - 1.7) / 0.24, 0, 1),
    );
    const waist = new THREE.Vector3(
      Math.sin(waistAngle) * waistWidth,
      p.y,
      0.035 + Math.cos(waistAngle) * 0.235,
    );
    return leg.lerp(waist, THREE.MathUtils.smoothstep(p.y, 1.58, 1.79));
  };
  const cache = new Map();
  const add = (point) => {
    const p = remap(point),
      key = p
        .toArray()
        .map((n) => n.toFixed(6))
        .join('/');
    if (cache.has(key)) return cache.get(key);
    const i = model.vertices.length;
    cache.set(key, i);
    model.vertices.push(p);
    const cx = p.y < 1.65 ? Math.sign(p.x) * 0.21 : 0;
    model.uv.push([(Math.atan2(p.x - cx, p.z - 0.035) + Math.PI) / (2 * Math.PI), p.y / 1.25]);
    return i;
  };
  for (const face of body.faces.filter(isBody)) {
    let points = face.corners.map(([i]) => body.vertices[i]);
    if (points.some((p) => Math.abs(p.x) > 0.445)) continue;
    for (const [plane, sign] of [
      [low, 1],
      [high, -1],
    ]) {
      const clipped = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length];
        const insideA = sign * (a.y - plane) >= 0,
          insideB = sign * (b.y - plane) >= 0;
        if (insideA) clipped.push(a);
        if (insideA !== insideB) clipped.push(a.clone().lerp(b, (plane - a.y) / (b.y - a.y)));
      }
      points = clipped;
    }
    if (points.length > 2)
      model.faces.push({
        group: kind,
        corners: points.map((p) => {
          const i = add(p);
          return [i, i];
        }),
      });
  }
  return geometry(model, () => true);
}
const meshes = [
  { name: 'Body', attributes: geometry(body, isBody) },
  { name: 'ExposedSkin', attributes: geometry(body, exposed) },
  { name: 'Hair', attributes: geometry(body, scalp, 0.008) },
  { name: 'Eyes', attributes: geometry(eyes, () => true) },
  { name: 'Trousers', attributes: clothing('trousers') },
  { name: 'Shorts', attributes: clothing('shorts') },
];
// Minimal standard GLB writer: one buffer, tightly packed float attributes.
const chunks = [],
  bufferViews = [],
  accessors = [];
let byteLength = 0;
const gltfMeshes = meshes.map(({ name, attributes }) => {
  const refs = {};
  let indices;
  for (const [semantic, data] of Object.entries(attributes)) {
    const isIndex = semantic === 'INDICES';
    const components = isIndex ? 1 : semantic === 'TEXCOORD_0' ? 2 : 3;
    if (isIndex) indices = accessors.length;
    else refs[semantic] = accessors.length;
    const accessor = {
      bufferView: bufferViews.length,
      componentType: isIndex ? 5125 : 5126,
      count: data.length / components,
      type: isIndex ? 'SCALAR' : components === 2 ? 'VEC2' : 'VEC3',
    };
    if (semantic === 'POSITION') {
      accessor.min = [Infinity, Infinity, Infinity];
      accessor.max = [-Infinity, -Infinity, -Infinity];
      data.forEach((value, i) => {
        const d = i % 3;
        accessor.min[d] = Math.min(accessor.min[d], value);
        accessor.max[d] = Math.max(accessor.max[d], value);
      });
    }
    accessors.push(accessor);
    bufferViews.push({
      buffer: 0,
      byteOffset: byteLength,
      byteLength: data.byteLength,
      target: isIndex ? 34963 : 34962,
    });
    chunks.push(Buffer.from(data.buffer));
    byteLength += data.byteLength;
  }
  return { name, primitives: [{ attributes: refs, indices }] };
});
const json = Buffer.from(
  JSON.stringify({
    asset: {
      version: '2.0',
      generator: 'Vessy offline human preparation v1',
      copyright: 'MakeHuman CC0; adapted for Vessy',
    },
    scene: 0,
    scenes: [{ nodes: meshes.map((_, i) => i) }],
    nodes: meshes.map((m, i) => ({ name: m.name, mesh: i })),
    meshes: gltfMeshes,
    buffers: [{ byteLength }],
    bufferViews,
    accessors,
  }),
);
const padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + padded.length + byteLength, 8);
header.writeUInt32LE(padded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(byteLength);
binHeader.writeUInt32LE(0x004e4942, 4);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, 'human-reference-v1.glb'),
  Buffer.concat([header, padded, binHeader, ...chunks]),
);
fs.copyFileSync(path.join(source, 'brown-eye.png'), path.join(out, 'brown-eye.png'));
fs.copyFileSync(path.join(source, 'LICENSE.md'), path.join(out, 'LICENSE-CC0.md'));
fs.writeFileSync(
  path.join(out, 'human-reference-v1.manifest.json'),
  JSON.stringify(
    {
      version: 1,
      source: 'https://github.com/makehumancommunity/makehuman',
      sourceCommit: 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482',
      license: 'CC0-1.0',
      runtimeServices: [],
      units: 'illustrative scene units; not customer measurements',
      axes: '+Y up; +Z front',
      height: 3.4,
      landmarks,
      meshes: meshes.map((m) => ({ name: m.name, triangles: m.attributes.INDICES.length / 3 })),
      limitation:
        'Generic adult reference. No personalized body reconstruction or cloth simulation.',
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      bytes: 28 + padded.length + byteLength,
      triangles: meshes.map((m) => [m.name, m.attributes.INDICES.length / 3]),
    },
    null,
    2,
  ),
);
