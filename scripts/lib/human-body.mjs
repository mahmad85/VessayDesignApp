// Shared, deterministic preparation of the posed CC0 MakeHuman reference body.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

export const source = 'assets/human-source';
export const read = (file) => fs.readFileSync(path.join(source, file), 'utf8');
export function obj(text) {
  const vertices = [],
    uv = [],
    faces = [],
    groups = {};
  let group = 'body';
  for (const line of text.split(/\r?\n/)) {
    const [kind, ...values] = line.trim().split(/\s+/);
    if (kind === 'v') vertices.push(new THREE.Vector3(...values.map(Number)));
    if (kind === 'vt') uv.push(values.map(Number));
    if (kind === 'g') group = values[0];
    if (kind === 'f') {
      const corners = values.map((v) => v.split('/').map((n) => Number(n) - 1));
      faces.push({ group, corners });
      groups[group] ??= new Set();
      corners.forEach(([v]) => groups[group].add(v));
    }
  }
  return { vertices, uv, faces, groups };
}
export const body = obj(read('base.obj'));
for (const [name, weight] of [
  ['african-male-young', 1 / 3],
  ['asian-male-young', 1 / 3],
  ['caucasian-male-young', 1 / 3],
  ['universal-male-young-averagemuscle-averageweight', 1],
]) {
  for (const line of read(name + '.target').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [index, x, y, z] = line.trim().split(/\s+/).map(Number);
    body.vertices[index].addScaledVector(new THREE.Vector3(x, y, z), weight);
  }
}
export const rig = JSON.parse(read('default.mhskel'));
export const weights = JSON.parse(read('default_weights.mhw')).weights;
const average = (indices) =>
  indices
    .reduce((p, i) => p.add(body.vertices[i]), new THREE.Vector3())
    .divideScalar(indices.length);
const joint = (name) => average(rig.joints[name]);
const transforms = {};
export const landmarks = {};
for (const side of ['L', 'R']) {
  const sign = side === 'L' ? 1 : -1;
  const shoulder = joint(`upperarm01.${side}____head`);
  const elbow = joint(`lowerarm01.${side}____head`);
  const wrist = joint(`wrist.${side}____head`);
  const upperDirection = new THREE.Vector3(sign * 0.24, -0.97, 0).normalize();
  const lowerDirection = new THREE.Vector3(sign * 0.11, -0.99, 0.045).normalize();
  const posedElbow = shoulder.clone().addScaledVector(upperDirection, shoulder.distanceTo(elbow));
  const posedWrist = posedElbow.clone().addScaledVector(lowerDirection, elbow.distanceTo(wrist));
  transforms[`upperarm.${side}`] = {
    origin: shoulder,
    target: shoulder,
    q: new THREE.Quaternion().setFromUnitVectors(
      elbow.clone().sub(shoulder).normalize(),
      upperDirection,
    ),
  };
  transforms[`lowerarm.${side}`] = {
    origin: elbow,
    target: posedElbow,
    q: new THREE.Quaternion().setFromUnitVectors(
      wrist.clone().sub(elbow).normalize(),
      lowerDirection,
    ),
  };
  const hip = joint(`upperleg01.${side}____head`);
  const ankle = joint(`foot.${side}____head`);
  const legDirection = new THREE.Vector3(sign * 0.018, -1, 0).normalize();
  transforms[`leg.${side}`] = {
    origin: hip,
    target: hip,
    q: new THREE.Quaternion().setFromUnitVectors(ankle.clone().sub(hip).normalize(), legDirection),
  };
  landmarks[`shoulder${side}`] = shoulder;
  landmarks[`elbow${side}`] = posedElbow;
  landmarks[`wrist${side}`] = posedWrist;
  landmarks[`ankle${side}`] = hip.clone().addScaledVector(legDirection, hip.distanceTo(ankle));
}
const posed = body.vertices.map(() => new THREE.Vector3());
const totals = body.vertices.map(() => 0);
for (const [bone, entries] of Object.entries(weights)) {
  const side = bone.endsWith('.L') ? 'L' : 'R';
  const family = /^upperarm/.test(bone)
    ? 'upperarm'
    : /^(lowerarm|wrist|finger|metacarpal)/.test(bone)
      ? 'lowerarm'
      : /^(upperleg|lowerleg|foot|toe)/.test(bone)
        ? 'leg'
        : null;
  const transform = family && transforms[`${family}.${side}`];
  for (const [i, weight] of entries) {
    const point = body.vertices[i].clone();
    if (transform) point.sub(transform.origin).applyQuaternion(transform.q).add(transform.target);
    posed[i].addScaledVector(point, weight);
    totals[i] += weight;
  }
}
body.vertices = posed.map((p, i) => (totals[i] ? p.divideScalar(totals[i]) : body.vertices[i]));
const bodyIndices = [...body.groups.body];
const floor = Math.min(...bodyIndices.map((i) => body.vertices[i].y));
const top = Math.max(...bodyIndices.map((i) => body.vertices[i].y));
const scale = 3.4 / (top - floor);
const normalize = (v) => v.set(v.x * scale, (v.y - floor) * scale + 0.035, v.z * scale);
body.vertices.forEach(normalize);
Object.values(landmarks).forEach(normalize);
// Eye proxy vertices follow their source indices, including the chosen morphs.
export const eyes = obj(read('eyes.obj'));
const eyeIndices = read('eyes.mhclo').split('verts 0')[1].trim().split(/\s+/).map(Number);
eyes.vertices = eyes.vertices.map((_, i) => body.vertices[eyeIndices[i]].clone());
