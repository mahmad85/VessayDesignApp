import * as THREE from 'three';

// Small geometry helpers for parametric garment surfaces.

export type Point = (u: number, v: number) => THREE.Vector3;

/**
 * Grid surface over u (columns) and v (rows). `uv` maps to texture space in
 * scene units, so fabric patterns keep a consistent physical scale.
 */
export function grid(
  columns: number,
  rows: number,
  point: Point,
  uv: (u: number, v: number, p: THREE.Vector3) => [number, number],
  outward?: (p: THREE.Vector3) => THREE.Vector3,
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= columns; i++) {
      const u = i / columns,
        v = j / rows;
      const p = point(u, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(...uv(u, v, p));
    }
  const w = columns + 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++) {
      const a = j * w + i,
        b = a + 1,
        d = a + w,
        e = d + 1;
      index.push(a, b, d, b, e, d);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  if (outward) orient(geometry, outward);
  return geometry;
}

/** Flip triangle winding if the surface faces inwards. */
function orient(geometry: THREE.BufferGeometry, outward: (p: THREE.Vector3) => THREE.Vector3) {
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  let score = 0;
  const p = new THREE.Vector3(),
    n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 64))) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    score += n.dot(outward(p));
  }
  if (score < 0) flip(geometry);
}

export function flip(geometry: THREE.BufferGeometry) {
  const index = geometry.getIndex()!;
  const array = index.array as Uint16Array | Uint32Array;
  for (let i = 0; i < array.length; i += 3) {
    const t = array[i + 1];
    array[i + 1] = array[i + 2];
    array[i + 2] = t;
  }
  index.needsUpdate = true;
  geometry.computeVertexNormals();
}

/** Mirror across the body's centre plane (x = 0), keeping outward faces. */
export function mirrorX(geometry: THREE.BufferGeometry) {
  const copy = geometry.clone();
  const pos = copy.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setX(i, -pos.getX(i));
  pos.needsUpdate = true;
  flip(copy);
  return copy;
}

/**
 * A thin solid piece lying on a surface: top and bottom layers joined by
 * rounded side walls, so lapels, pockets and collars have visible thickness.
 */
export function slab(
  columns: number,
  rows: number,
  point: (u: number, v: number, layer: number) => THREE.Vector3,
  outward: (p: THREE.Vector3) => THREE.Vector3,
  scale = 1,
) {
  // Choose the winding from the parameter directions so the top layer faces out.
  const o = point(0.5, 0.5, 1);
  const du = point(0.6, 0.5, 1).sub(o);
  const dv = point(0.5, 0.6, 1).sub(o);
  const reversed = du.cross(dv).dot(outward(o)) < 0;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const w = columns + 1;
  const layerSize = w * (rows + 1);
  for (const layer of [0, 1])
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= columns; i++) {
        const p = point(i / columns, j / rows, layer);
        positions.push(p.x, p.y, p.z);
        uvs.push(p.x * scale + p.z * scale, p.y * scale);
      }
  const at = (layer: number, i: number, j: number) => layer * layerSize + j * w + i;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++) {
      // Top faces out, bottom faces in.
      index.push(at(1, i, j), at(1, i + 1, j), at(1, i, j + 1));
      index.push(at(1, i + 1, j), at(1, i + 1, j + 1), at(1, i, j + 1));
      index.push(at(0, i, j), at(0, i, j + 1), at(0, i + 1, j));
      index.push(at(0, i + 1, j), at(0, i, j + 1), at(0, i + 1, j + 1));
    }
  const wall = (a0: number, a1: number, b0: number, b1: number) =>
    index.push(a0, b0, a1, a1, b0, b1);
  for (let i = 0; i < columns; i++) {
    wall(at(1, i, 0), at(1, i + 1, 0), at(0, i, 0), at(0, i + 1, 0));
    wall(at(1, i + 1, rows), at(1, i, rows), at(0, i + 1, rows), at(0, i, rows));
  }
  for (let j = 0; j < rows; j++) {
    wall(at(1, 0, j + 1), at(1, 0, j), at(0, 0, j + 1), at(0, 0, j));
    wall(at(1, columns, j), at(1, columns, j + 1), at(0, columns, j), at(0, columns, j + 1));
  }
  if (reversed)
    for (let i = 0; i < index.length; i += 3)
      [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Rolled edge or stitched seam following a path. */
export function tube(points: THREE.Vector3[], radius: number, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, Math.max(8, points.length * 2), radius, radial, false);
}

/** Domed coat button with a rim, lying along +Y; placed with `orientTo`. */
export function buttonGeometry(radius: number) {
  const r = radius;
  const profile = [
    [0, 0.34],
    [r * 0.55, 0.3],
    [r * 0.8, 0.38],
    [r * 0.97, 0.3],
    [r, 0.12],
    [r * 0.9, 0],
    [0, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y * r));
  return new THREE.LatheGeometry(profile, 20);
}

export function orientTo(position: THREE.Vector3, normal: THREE.Vector3) {
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  matrix.compose(position, q, new THREE.Vector3(1, 1, 1));
  return matrix;
}
