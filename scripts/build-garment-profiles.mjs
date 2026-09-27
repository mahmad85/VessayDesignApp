// Offline, deterministic garment profiles sampled from the posed CC0 reference body.
// Garments are generated from these cross-sections at runtime, so clothing follows
// the body without gaps. No network requests, paid tools or cloth simulation.
import fs from 'node:fs';
import * as THREE from 'three';
import { body, weights, landmarks } from './lib/human-body.mjs';

const out = 'src/visualization/body-profiles.json';
const round = (n) => Math.round(n * 10000) / 10000;

// Share of each vertex's skin weight that belongs to the arm.
const armShare = new Float32Array(body.vertices.length);
const total = new Float32Array(body.vertices.length);
for (const [bone, entries] of Object.entries(weights)) {
  const arm = /^(upperarm|lowerarm|wrist|finger|metacarpal)/.test(bone);
  for (const [i, w] of entries) {
    total[i] += w;
    if (arm) armShare[i] += w;
  }
}
for (let i = 0; i < armShare.length; i++) armShare[i] = total[i] ? armShare[i] / total[i] : 0;

const triangles = body.faces
  .filter((f) => f.group === 'body')
  .flatMap(({ corners }) =>
    corners.slice(1, -1).map((_, j) => [corners[0][0], corners[j + 1][0], corners[j + 2][0]]),
  );

/** Exact cross-section of the body with a plane: points with interpolated arm share. */
function section(normal, offset) {
  const points = [];
  const d = body.vertices.map((v) => v.dot(normal) - offset);
  for (const tri of triangles)
    for (let k = 0; k < 3; k++) {
      const a = tri[k],
        b = tri[(k + 1) % 3];
      if (d[a] > 0 === d[b] > 0) continue;
      const t = d[a] / (d[a] - d[b]);
      points.push({
        p: body.vertices[a].clone().lerp(body.vertices[b], t),
        arm: armShare[a] + (armShare[b] - armShare[a]) * t,
      });
    }
  return points;
}

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [],
    upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Distance from a centre to the hull boundary at each angle (0 = front, clockwise from above). */
function radii(polygon, center, count) {
  return Array.from({ length: count }, (_, j) => {
    const angle = (j / count) * Math.PI * 2;
    const dir = [Math.sin(angle), Math.cos(angle)];
    let best = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const e = [b[0] - a[0], b[1] - a[1]];
      const denom = dir[0] * e[1] - dir[1] * e[0];
      if (Math.abs(denom) < 1e-9) continue;
      const w = [a[0] - center[0], a[1] - center[1]];
      const t = (w[0] * e[1] - w[1] * e[0]) / denom;
      const u = (w[0] * dir[1] - w[1] * dir[0]) / denom;
      if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
    }
    return round(best);
  });
}

const centroid = (polygon) => [
  polygon.reduce((s, p) => s + p[0], 0) / polygon.length,
  polygon.reduce((s, p) => s + p[1], 0) / polygon.length,
];

// Torso: horizontal slices without arms, from below the seat to the neck.
const up = new THREE.Vector3(0, 1, 0);
const torso = [];
for (let y = 1.5; y <= 3.0001; y += 0.02) {
  const pts = section(up, y)
    .filter((q) => q.arm < 0.5)
    .map((q) => [q.p.x, q.p.z]);
  const poly = hull(pts);
  const cz = (Math.min(...poly.map((p) => p[1])) + Math.max(...poly.map((p) => p[1]))) / 2;
  const r = radii(poly, [0, cz], 64);
  // The reference body is symmetric; average both sides so garments are too.
  const sym = r.map((v, j) => round((v + r[(64 - j) % 64]) / 2));
  torso.push({ y: round(y), cz: round(cz), r: sym });
}

// Left arm: slices perpendicular to the posed shoulder → elbow → wrist axis.
const axis = [landmarks.shoulderL, landmarks.elbowL, landmarks.wristL].map(
  (p) => new THREE.Vector3(p.x, p.y, p.z),
);
const lengths = [axis[0].distanceTo(axis[1]), axis[1].distanceTo(axis[2])];
const armLength = lengths[0] + lengths[1];
const arm = [];
for (let k = 0; k <= 40; k++) {
  const s = (k / 40) * armLength;
  const segment = s <= lengths[0] ? 0 : 1;
  const local = segment ? (s - lengths[0]) / lengths[1] : s / lengths[0];
  const center = axis[segment].clone().lerp(axis[segment + 1], local);
  const a = axis[segment + 1].clone().sub(axis[segment]).normalize();
  const b = axis[Math.min(2, segment + 1)].clone().sub(axis[Math.max(0, segment)]).normalize();
  // Blend tangents around the elbow for a continuous sleeve.
  const tangent = a.clone().lerp(b, 0.5).normalize();
  const front = new THREE.Vector3(0, 0, 1).addScaledVector(tangent, -tangent.z).normalize();
  const side = new THREE.Vector3().crossVectors(tangent, front);
  const pts = section(tangent, center.dot(tangent))
    .filter((q) => q.arm >= 0.5 && q.p.distanceTo(center) < 0.2)
    .map((q) => {
      const v = q.p.clone().sub(center);
      return [v.dot(side), v.dot(front)];
    });
  const poly = hull(pts);
  const c = centroid(poly);
  arm.push({
    s: round(s),
    center: center
      .clone()
      .addScaledVector(side, c[0])
      .addScaledVector(front, c[1])
      .toArray()
      .map(round),
    tangent: tangent.toArray().map(round),
    r: radii(poly, c, 24),
  });
}

// Left leg: horizontal slices; above the crotch each leg takes its half of the pelvis.
const leg = [];
for (let y = 0.12; y <= 2.0001; y += 0.025) {
  const pts = section(up, y)
    .filter((q) => q.arm < 0.5 && q.p.x > -0.002)
    .map((q) => [Math.max(0, q.p.x), q.p.z]);
  const poly = hull(pts);
  const c = centroid(poly);
  leg.push({ y: round(y), cx: round(c[0]), cz: round(c[1]), r: radii(poly, c, 32) });
}

fs.writeFileSync(
  out,
  JSON.stringify({
    version: 1,
    source: 'Posed CC0 MakeHuman reference body; see assets/human-source/README.md',
    generator: 'scripts/build-garment-profiles.mjs',
    units: 'illustrative scene units; not customer measurements',
    angles: 'radii start at the front (+Z) and turn towards +X',
    crotch: 1.652,
    torso,
    arm,
    leg,
  }) + '\n',
);
console.log(
  JSON.stringify({ torsoRows: torso.length, armRows: arm.length, legRows: leg.length, out }),
);
