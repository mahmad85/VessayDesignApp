import * as THREE from 'three';
import type { SketchSpec } from '../sketch-spec';
import {
  ARM_LENGTH,
  armFrame,
  armRadius,
  legSection,
  torsoCenterZ,
  torsoRadius,
} from './body-profile';
import { buttonGeometry, grid, mirrorX, orientTo, slab, tube } from './mesh';

// Garments generated from body cross-sections. They are an illustrative
// visualizer: shapes follow the reference body with ease and simple drape,
// with no pattern drafting or cloth simulation.

export type Role =
  | 'cloth'
  | 'lining'
  | 'facing'
  | 'shirt'
  | 'trouser'
  | 'button'
  | 'shirtButton'
  | 'shoe'
  | 'sole'
  | 'seam'
  | 'metal';

export type GarmentPart = {
  key: string;
  role: Role;
  geometry: THREE.BufferGeometry;
  /** Instanced placements, for buttons. */
  matrices?: THREE.Matrix4[];
};

const TAU = Math.PI * 2;
const HEM = 1.53;
const TOP = 2.94;
const GORGE = 2.66;
const CHEST = 2.52;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

export type Fit = SketchSpec['fit'];

const EASE: Record<Fit, number> = { slim: 0.028, regular: 0.038, relaxed: 0.052 };
const SIDE_DRAPE: Record<Fit, number> = { slim: 0.9, regular: 0.94, relaxed: 0.99 };
const FRONT_DRAPE: Record<Fit, number> = { slim: 0.97, regular: 0.985, relaxed: 1 };

/** Jacket closure layout in scene heights. */
export function closure(style: string) {
  const rows: Record<string, number[]> = {
    simple_1: [2.06],
    simple_2: [2.12, 1.93],
    simple_3: [2.25, 2.08, 1.91],
    crossed_2: [2.02],
    crossed_4: [2.12, 1.93],
    crossed_6: [2.3, 2.12, 1.93],
    mao: [2.8, 2.58, 2.36, 2.14, 1.92],
  };
  const buttons = rows[style] ?? rows.simple_2;
  const db = style.startsWith('crossed');
  const mao = style === 'mao';
  const roll = mao ? TOP : style === 'crossed_6' ? 2.14 : buttons[0] + 0.02;
  return { buttons, db, mao, roll, lowest: buttons[buttons.length - 1] };
}

/** Radius field for a torso garment: body + ease, hanging straight from the chest. */
export class TorsoField {
  private rows: number[][] = [];
  private readonly step = 0.015;
  private readonly columns = 96;
  constructor(
    readonly bottom: number,
    readonly top: number,
    fit: Fit,
    options: { ease?: number; drape?: boolean; shoulderPad?: number; overTrousers?: boolean } = {},
  ) {
    const ease = options.ease ?? EASE[fit];
    const drape = options.drape ?? true;
    const count = Math.ceil((top - bottom) / this.step) + 1;
    for (let k = 0; k < count; k++) {
      const y = bottom + k * this.step;
      const row: number[] = [];
      for (let c = 0; c < this.columns; c++) {
        const angle = (c / this.columns) * TAU;
        const sin = Math.sin(angle),
          cos = Math.cos(angle);
        const nearNeck = smooth(2.84, 2.93, y);
        let r = torsoRadius(y, angle) + ease * (1 - 0.55 * nearNeck);
        // Outer layers clear the trouser waistband and seat.
        if (options.overTrousers) r += 0.032 * (1 - smooth(1.98, 2.14, y));
        // Structured shoulders.
        const pad = options.shoulderPad ?? 0;
        r += pad * Math.abs(sin) ** 6 * smooth(2.66, 2.76, y) * (1 - smooth(2.8, 2.9, y));
        if (drape && y < CHEST) {
          const rc = torsoRadius(CHEST, angle) + ease;
          const czc = torsoCenterZ(CHEST);
          const vx = SIDE_DRAPE[fit] * sin * rc;
          const vz = czc + FRONT_DRAPE[fit] * cos * rc - torsoCenterZ(y);
          const target = vx * sin + vz * cos;
          const strength = smooth(CHEST, CHEST - 0.3, y);
          if (target > r) r += (target - r) * strength;
        }
        if (drape && y < 1.74) r += (1.74 - y) * 0.05;
        row.push(r);
      }
      this.rows.push(row);
    }
    // Cloth bridges vertical hollows (small of the back, below the chest)
    // instead of following them: take the upper envelope of each column.
    if (drape)
      for (let c = 0; c < this.columns; c++) {
        const limit = this.rows.findIndex((_, k) => bottom + k * this.step > 2.62);
        const n = limit < 0 ? this.rows.length : limit;
        const hull: number[] = [];
        for (let k = 0; k < n; k++) {
          while (hull.length >= 2) {
            const [a, b] = [hull[hull.length - 2], hull[hull.length - 1]];
            const cross =
              (b - a) * (this.rows[k][c] - this.rows[a][c]) -
              (this.rows[b][c] - this.rows[a][c]) * (k - a);
            if (cross >= 0) hull.pop();
            else break;
          }
          hull.push(k);
        }
        for (let h = 0; h < hull.length - 1; h++) {
          const [a, b] = [hull[h], hull[h + 1]];
          for (let k = a + 1; k < b; k++)
            this.rows[k][c] = Math.max(
              this.rows[k][c],
              this.rows[a][c] + ((this.rows[b][c] - this.rows[a][c]) * (k - a)) / (b - a),
            );
        }
      }
    // Soften any remaining anatomy.
    for (let pass = 0; pass < 5; pass++) {
      this.rows = this.rows.map((row, k) =>
        row.map((v, c) => {
          const up = this.rows[Math.min(this.rows.length - 1, k + 1)][c];
          const down = this.rows[Math.max(0, k - 1)][c];
          const left = row[(c + this.columns - 1) % this.columns];
          const right = row[(c + 1) % this.columns];
          return v * 0.4 + (up + down) * 0.2 + (left + right) * 0.1;
        }),
      );
    }
  }
  radius(y: number, angle: number) {
    const f = THREE.MathUtils.clamp((y - this.bottom) / this.step, 0, this.rows.length - 1);
    const k = Math.min(this.rows.length - 2, Math.floor(f));
    const t = f - k;
    const g = ((((angle / TAU) % 1) + 1) % 1) * this.columns;
    const c = Math.floor(g) % this.columns;
    const s = g - Math.floor(g);
    const at = (row: number[]) => row[c] * (1 - s) + row[(c + 1) % this.columns] * s;
    return at(this.rows[k]) * (1 - t) + at(this.rows[k + 1]) * t;
  }
  point(y: number, angle: number, offset = 0) {
    const r = this.radius(y, angle) + offset;
    return new THREE.Vector3(Math.sin(angle) * r, y, torsoCenterZ(y) + Math.cos(angle) * r);
  }
  normal(y: number, angle: number) {
    const a = this.point(y, angle - 0.01),
      b = this.point(y, angle + 0.01),
      c = this.point(y - 0.01, angle),
      d = this.point(y + 0.01, angle);
    return b.sub(a).cross(d.sub(c)).normalize();
  }
  /** Angle from the centre front where the garment edge sits at a horizontal offset. */
  edgeAngle(y: number, x: number) {
    return Math.asin(THREE.MathUtils.clamp(x / this.radius(y, 0), 0, 0.97));
  }
  /** Place a local rectangle (arc-length x, height y) on the surface. */
  local(yc: number, ac: number, lx: number, ly: number, offset: number) {
    return this.point(yc + ly, ac + lx / this.radius(yc, ac), offset);
  }
}

const outwardFrom = () => (p: THREE.Vector3) =>
  new THREE.Vector3(p.x, 0, p.z - torsoCenterZ(p.y)).normalize();

function shell(
  field: TorsoField,
  key: string,
  role: Role,
  edge: (y: number) => number,
  bottom: (angle: number) => number = () => field.bottom,
  rows = 72,
) {
  const edges = new Map<number, number>();
  const edgeAt = (y: number) => {
    let a = edges.get(y);
    if (a === undefined) edges.set(y, (a = edge(y)));
    return a;
  };
  const geometry = grid(
    60,
    rows,
    (u, v) => {
      // Columns span between the two front edges; rows rise from the hem.
      const guess = edgeAt(field.bottom) + u * (TAU - 2 * edgeAt(field.bottom));
      const low = bottom(guess);
      const y = low + (field.top - low) * v;
      const a = edgeAt(y) + u * (TAU - 2 * edgeAt(y));
      return field.point(y, a);
    },
    (u, v, p) => [Math.atan2(p.x, p.z - torsoCenterZ(p.y)) * 0.3, p.y],
    outwardFrom(),
  );
  return { key, role, geometry } satisfies GarmentPart;
}

function edgeTube(field: TorsoField, edge: (y: number) => number, from: number, to: number) {
  const points: THREE.Vector3[] = [];
  for (let y = from; y <= to + 1e-6; y += 0.02) points.push(field.point(y, edge(y), 0.001));
  return tube(points, 0.0045);
}

function hemTube(field: TorsoField, y: number, a0: number) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) points.push(field.point(y, a0 + (i / 64) * (TAU - 2 * a0), 0.001));
  return tube(points, 0.0045);
}

function buttons(
  key: string,
  role: Role,
  radius: number,
  placements: { position: THREE.Vector3; normal: THREE.Vector3 }[],
): GarmentPart {
  return {
    key,
    role,
    geometry: buttonGeometry(radius),
    matrices: placements.map((p) => orientTo(p.position, p.normal)),
  };
}

export const jacketField = (fit: Fit) =>
  new TorsoField(HEM, TOP, fit, { shoulderPad: 0.016, overTrousers: true });
export const vestField = (fit: Fit) =>
  new TorsoField(1.76, 2.935, fit, { ease: 0.02, drape: false, overTrousers: true });
export const shirtField = (fit: Fit, drape: boolean) =>
  new TorsoField(1.84, 2.955, fit, { ease: 0.013, drape });
export const waistbandField = (slimTrousers: boolean) =>
  new TorsoField(1.93, 2.0, 'slim', { ease: (slimTrousers ? 0.022 : 0.032) + 0.012, drape: false });

export function jacketParts(spec: SketchSpec): GarmentPart[] {
  const jacket = spec.jacket!;
  const layout = closure(jacket.style);
  const field = jacketField(spec.fit);
  const neckX = 0.1;
  const edge = (y: number) => {
    let x = 0.0015;
    if (layout.mao) x = y > 2.87 ? 0.045 * ((y - 2.87) / (TOP - 2.87)) : 0.0015;
    else if (y >= layout.roll) x = neckX * ((y - layout.roll) / (TOP - layout.roll)) ** 1.05;
    else if (!layout.db && y < layout.lowest - 0.02)
      x = 0.085 * ((layout.lowest - 0.02 - y) / (layout.lowest - 0.02 - HEM)) ** 1.5;
    return field.edgeAngle(y, x);
  };
  const parts: GarmentPart[] = [];
  const body = shell(field, 'jacket', 'cloth', edge);
  parts.push(body, { key: 'jacket-lining', role: 'lining', geometry: body.geometry });
  const edges = edgeTube(field, edge, HEM, TOP);
  parts.push(
    { key: 'front-edge-left', role: 'cloth', geometry: edges },
    { key: 'front-edge-right', role: 'cloth', geometry: mirrorX(edges) },
    { key: 'hem', role: 'cloth', geometry: hemTube(field, HEM, edge(HEM)) },
  );
  // Back seam and vents.
  const seam: THREE.Vector3[] = [];
  const ventTop = 1.9;
  for (let y = jacket.vent === '1' ? ventTop : HEM; y <= TOP - 0.04; y += 0.03)
    seam.push(field.point(y, Math.PI, 0.001));
  parts.push({ key: 'back-seam', role: 'seam', geometry: tube(seam, 0.0022, 4) });
  if (jacket.vent === '1') parts.push(vent(field, Math.PI, ventTop));
  if (jacket.vent === '2')
    for (const a of [Math.PI * 0.64, Math.PI * 1.36]) parts.push(vent(field, a, ventTop));
  parts.push(...lapels(spec, field, edge, layout));
  parts.push(...pockets(spec, field));
  // Front buttons.
  const columns = layout.db ? [-0.3, 0.3] : [0];
  parts.push(
    buttons(
      'front-buttons',
      'button',
      0.019,
      layout.buttons.flatMap((y, row) =>
        columns.map((a) => {
          const spread = jacket.style === 'crossed_6' && row === 0 ? 1.35 : 1;
          const angle = (a * spread + TAU) % TAU;
          return {
            position: field.point(y, angle, layout.db ? 0.006 : 0.008),
            normal: field.normal(y, angle),
          };
        }),
      ),
    ),
  );
  parts.push(...sleeves(spec, 'cloth', EASE[spec.fit], jacket.sleeveButtons));
  return parts;
}

function vent(field: TorsoField, angle: number, top: number): GarmentPart {
  const geometry = slab(
    2,
    8,
    (u, v, layer) =>
      field.local(HEM + (top - HEM) * v, angle, (u - 0.5) * 0.03, 0, 0.001 + layer * 0.004),
    outwardFrom(),
  );
  return { key: `vent-${angle.toFixed(2)}`, role: 'cloth', geometry };
}

function lapels(
  spec: SketchSpec,
  field: TorsoField,
  edge: (y: number) => number,
  layout: ReturnType<typeof closure>,
): GarmentPart[] {
  const jacket = spec.jacket!;
  const outward = outwardFrom();
  if (layout.mao) {
    const collar = slab(
      64,
      4,
      (u, v, layer) => {
        const a = 0.05 + u * (TAU - 0.1);
        return field.point(TOP - 0.005 + v * 0.05, a, 0.004 + layer * 0.005 - v * 0.01);
      },
      outward,
    );
    return [{ key: 'mandarin-collar', role: 'cloth', geometry: collar }];
  }
  const width =
    jacket.lapelWidth === 'narrow' ? 0.058 : jacket.lapelWidth === 'width' ? 0.1 : 0.078;
  const shawl = jacket.lapelType === 'round';
  const peak = jacket.lapelType === 'peak';
  const gorge = shawl ? TOP - 0.015 : GORGE;
  const lapelPoint = (u: number, v: number, layer: number) => {
    const y0 = layout.roll + v * (gorge - layout.roll);
    const w = width * Math.min(1, v / 0.78) ** 0.85 * (shawl ? 1 - 0.35 * smooth(0.8, 1, v) : 1);
    const across = -0.12 + u * 1.12;
    const shape = shawl
      ? 0
      : peak
        ? 0.075 * Math.max(0, across) ** 2.2
        : -0.016 * Math.max(0, across);
    const y = y0 + v ** 6 * shape;
    const a = edge(y0) + (across * w) / field.radius(y0, 0.2);
    // Rolled towards the fold line, flatter at the outer edge.
    const lift = 0.004 + 0.011 * (1 - Math.max(0, across)) ** 2 * smooth(0.05, 0.4, v);
    return field.point(y, a, lift + layer * 0.0055);
  };
  const lapel = slab(10, 28, lapelPoint, outward);
  // Pick-stitch just inside the outer edge gives the lapel a tailored outline.
  const stitch: THREE.Vector3[] = [];
  for (let v = 0.12; v <= 1.0001; v += 0.04) stitch.push(lapelPoint(0.93, v, 1.2));
  const outline = tube(stitch, 0.0018, 4);
  const parts: GarmentPart[] = [
    { key: 'lapel-left', role: 'facing', geometry: lapel },
    { key: 'lapel-right', role: 'facing', geometry: mirrorX(lapel) },
    { key: 'lapel-stitch-left', role: 'seam', geometry: outline },
    { key: 'lapel-stitch-right', role: 'seam', geometry: mirrorX(outline) },
  ];
  // Collar from the gorge up the neckline and around the back.
  const start = shawl ? gorge : peak ? GORGE - 0.004 : GORGE + 0.02;
  const split = 0.3;
  const collar = slab(
    44,
    5,
    (t, u, layer) => {
      const tv = Math.min(t, split) / split;
      const yv = start + tv * (TOP - start);
      const aE = edge(yv);
      const front = {
        y: yv - u * 0.012,
        a: aE + (u * (shawl ? width * 0.62 : 0.043)) / field.radius(yv, aE),
        off: 0.006 + u * 0.006,
      };
      const tb = Math.max(0, t - split) / (1 - split);
      const aB = edge(TOP) + tb * (Math.PI - edge(TOP));
      const back = { y: TOP + 0.026 - u * 0.036, a: aB, off: 0.004 + u * 0.024 };
      const w = smooth(split - 0.08, split + 0.08, t);
      const y = front.y * (1 - w) + back.y * w;
      const a = front.a * (1 - w) + back.a * w;
      const off = front.off * (1 - w) + back.off * w;
      return field.point(y, a, off + layer * 0.005);
    },
    outward,
  );
  parts.push(
    { key: 'collar-left', role: 'facing', geometry: collar },
    { key: 'collar-right', role: 'facing', geometry: mirrorX(collar) },
  );
  return parts;
}

function pocketPiece(
  field: TorsoField,
  key: string,
  yc: number,
  ac: number,
  w: number,
  h: number,
  slant: number,
  offset = 0.002,
): GarmentPart {
  const geometry = slab(
    8,
    4,
    (u, v, layer) => {
      const lx = (u - 0.5) * w;
      const ly = (0.5 - v) * h;
      const rx = lx * Math.cos(slant) - ly * Math.sin(slant);
      const ry = lx * Math.sin(slant) + ly * Math.cos(slant);
      return field.local(yc, ac, rx, ry, offset + layer * 0.004);
    },
    outwardFrom(),
  );
  return { key, role: 'cloth', geometry };
}

function pockets(spec: SketchSpec, field: TorsoField): GarmentPart[] {
  const jacket = spec.jacket!;
  const parts: GarmentPart[] = [];
  const type = jacket.pockets;
  const both = (make: (side: 1 | -1) => GarmentPart | GarmentPart[]) =>
    ([1, -1] as const).flatMap((side) => make(side));
  const hip = 1.8;
  const angleFor = (side: 1 | -1, a: number) => (side > 0 ? a : TAU - a);
  const slant = type.endsWith('c') ? 0.14 : 0;
  const pocket = (side: 1 | -1, y: number, a: number, width: number, key: string) => {
    const angle = angleFor(side, a);
    const tilt = side * slant;
    if (type.endsWith('b'))
      return pocketPiece(field, key, y - 0.06, angle, width + 0.01, 0.16, 0, 0.0015);
    if (type.endsWith('a') || type.endsWith('d'))
      return [
        pocketPiece(field, `${key}-upper`, y + 0.007, angle, width, 0.011, tilt),
        pocketPiece(field, `${key}-lower`, y - 0.006, angle, width, 0.011, tilt),
      ];
    return pocketPiece(field, key, y - 0.02, angle, width, 0.052, tilt, 0.003);
  };
  if (type !== '0') {
    parts.push(...both((side) => pocket(side, hip, 0.98, 0.15, `pocket-${side}`)));
    if (type.startsWith('3')) parts.push(...[pocket(-1, hip + 0.1, 0.94, 0.115, 'ticket')].flat());
  }
  const chest = jacket.chestPocket;
  if (chest === '1')
    parts.push(pocketPiece(field, 'breast-pocket', 2.5, 0.6, 0.1, 0.024, -0.1, 0.003));
  if (chest.startsWith('patched'))
    for (const side of chest === 'patched_2' ? [1, -1] : [1])
      parts.push(
        pocketPiece(
          field,
          `breast-patch-${side}`,
          2.46,
          angleFor(side as 1 | -1, 0.6),
          0.1,
          0.11,
          0,
          0.003,
        ),
      );
  return parts;
}

/** Where the sleeve ends, just above the wrist. */
export function sleeveEnd() {
  let s = ARM_LENGTH;
  while (s > 0.5 && armFrame(s).center.y < 1.8) s -= 0.005;
  return s;
}

function sleeveTube(ease: number, from: number, to: number, taper: boolean) {
  const end = sleeveEnd();
  const cap = 0.07;
  const top = (angle: number) => armRadius(0.18, angle) + ease;
  const cuff = 0.058 + ease * 0.5;
  const frames = new Map<number, ReturnType<typeof armFrame>>();
  return grid(
    28,
    40,
    (u, v) => {
      const s = from + (to - from) * v;
      const angle = u * TAU;
      let frame = frames.get(s);
      if (!frame) frames.set(s, (frame = armFrame(s)));
      let r = armRadius(Math.max(0, s), angle) + ease;
      if (taper && s > 0.18) {
        const t = THREE.MathUtils.clamp((s - 0.18) / (end - 0.18), 0, 1);
        r = Math.max(r, top(angle) * 0.93 * (1 - t) + cuff * t);
      }
      if (s < 0) r *= Math.sqrt(Math.max(0.05, 1 - (s / cap) ** 2));
      return frame.center
        .clone()
        .addScaledVector(frame.side, Math.sin(angle) * r)
        .addScaledVector(frame.front, Math.cos(angle) * r);
    },
    (u, v, p) => [u * 0.4, p.y],
    (p) => {
      const f = armFrame(0.5);
      const d = p.clone().sub(f.center);
      return d.addScaledVector(f.tangent, -d.dot(f.tangent)).normalize();
    },
  );
}

function sleeves(spec: SketchSpec, role: Role, ease: number, buttonCount: number) {
  const end = sleeveEnd();
  const sleeve = sleeveTube(ease, -0.07, end, true);
  const parts: GarmentPart[] = [
    { key: 'sleeve-left', role, geometry: sleeve },
    { key: 'sleeve-right', role, geometry: mirrorX(sleeve) },
  ];
  const cuff = shirtCuff(spec);
  parts.push({ key: 'shirt-cuff-left', role: 'shirt', geometry: cuff });
  parts.push({ key: 'shirt-cuff-right', role: 'shirt', geometry: mirrorX(cuff) });
  const placements: { position: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  const angle = Math.PI * 1.3;
  for (let i = 0; i < buttonCount; i++) {
    const s = end - 0.04 - i * 0.024;
    const f = armFrame(s);
    const r = Math.max(armRadius(s, angle) + ease, 0.058 + ease * 0.5) + 0.002;
    const normal = f.side
      .clone()
      .multiplyScalar(Math.sin(angle))
      .addScaledVector(f.front, Math.cos(angle))
      .normalize();
    const position = f.center.clone().addScaledVector(normal, r);
    placements.push({ position, normal });
    placements.push({
      position: position.clone().setX(-position.x),
      normal: normal.clone().setX(-normal.x),
    });
  }
  if (placements.length) parts.push(buttons('sleeve-buttons', 'button', 0.011, placements));
  return parts;
}

function shirtCuff(spec: SketchSpec) {
  const end = sleeveEnd();
  const french = spec.shirt.cuffs === 'French';
  const r = 0.056;
  return grid(
    28,
    4,
    (u, v) => {
      const s = end - 0.02 + v * (french ? 0.06 : 0.045);
      const f = armFrame(s);
      const angle = u * TAU;
      return f.center
        .clone()
        .addScaledVector(f.side, Math.sin(angle) * r)
        .addScaledVector(f.front, Math.cos(angle) * r);
    },
    (u, v) => [u * 0.3, v * 0.05],
    (p) => {
      const f = armFrame(end);
      const d = p.clone().sub(f.center);
      return d.addScaledVector(f.tangent, -d.dot(f.tangent)).normalize();
    },
  );
}

export function shirtParts(spec: SketchSpec, visibleBody: boolean): GarmentPart[] {
  const field = shirtField(spec.fit, visibleBody);
  const parts: GarmentPart[] = [shell(field, 'shirt', 'shirt', () => 0.0005)];
  // Collar band and points.
  const outward = outwardFrom();
  const neck = new TorsoField(2.9, 3.0, 'slim', { ease: 0.016, drape: false });
  const band = slab(
    64,
    3,
    (u, v, layer) => {
      const a = 0.04 + u * (TAU - 0.08);
      return neck.point(2.94 + v * 0.05, a, layer * 0.004);
    },
    outward,
  );
  parts.push({ key: 'shirt-collar-band', role: 'shirt', geometry: band });
  const point = spec.shirt.collar === 'Point';
  const leaf = slab(
    6,
    8,
    (u, v, layer) => {
      // From the band front down onto the chest.
      const y = 2.985 - v * (point ? 0.11 : 0.085);
      const a =
        0.02 + u * (point ? 0.2 : 0.3) * (1 - v * (point ? 0.55 : 0.1)) + v * (point ? 0.14 : 0.3);
      return neck.point(Math.max(2.9, y), a, 0.005 + layer * 0.004 + v * 0.004);
    },
    outward,
  );
  parts.push(
    { key: 'shirt-collar-left', role: 'shirt', geometry: leaf },
    { key: 'shirt-collar-right', role: 'shirt', geometry: mirrorX(leaf) },
  );
  parts.push(
    buttons(
      'shirt-buttons',
      'shirtButton',
      0.008,
      [2.85, 2.69, 2.53, 2.37, 2.21, 2.05, 1.9].map((y) => ({
        position: field.point(y, 0, 0.003),
        normal: field.normal(y, 0),
      })),
    ),
  );
  if (visibleBody) {
    parts.push(...sleeves(spec, 'shirt', 0.02, 0));
    if (spec.shirt.cuffs === 'French') {
      const s = sleeveEnd() + 0.02;
      const f = armFrame(s);
      const link = new THREE.SphereGeometry(0.009, 12, 8);
      const p = f.center.clone().addScaledVector(f.side, -0.06);
      parts.push({
        key: 'cufflinks',
        role: 'metal',
        geometry: link,
        matrices: [
          new THREE.Matrix4().setPosition(p),
          new THREE.Matrix4().setPosition(p.clone().setX(-p.x)),
        ],
      });
    }
  }
  return parts;
}

export function vestParts(spec: SketchSpec): GarmentPart[] {
  const vest = spec.vest!;
  const field = vestField(spec.fit);
  const db = vest.style.startsWith('crossed');
  const roll = db ? 2.28 : 2.36;
  const edge = (y: number) =>
    field.edgeAngle(y, y > roll ? 0.1 * ((y - roll) / (2.935 - roll)) ** 0.9 : 0.0015);
  const bottom = (angle: number) => {
    // Pointed front for a diagonal edge.
    const front = Math.max(0, Math.cos(angle));
    return vest.bottom === 'cut' ? 1.86 - 0.07 * front ** 3 : 1.86;
  };
  const parts: GarmentPart[] = [shell(field, 'vest', 'cloth', edge, bottom)];
  const count = vest.style === 'simple_4' ? 4 : vest.style === 'simple_5' ? 5 : 3;
  const ys = Array.from({ length: count }, (_, i) => roll - 0.03 - i * ((roll - 1.92) / count));
  parts.push(
    buttons(
      'vest-buttons',
      'button',
      0.012,
      ys.flatMap((y) =>
        (db ? [0.22, TAU - 0.22] : [0]).map((a) => ({
          position: field.point(y, a, 0.004),
          normal: field.normal(y, a),
        })),
      ),
    ),
  );
  return parts;
}

export function trouserParts(spec: SketchSpec): GarmentPart[] {
  const t = spec.trousers;
  const bermuda = t.length === 'bermuda';
  const hem = bermuda ? 1.18 : t.break === 'no' ? 0.25 : t.break === 'full' ? 0.17 : 0.21;
  const ease = t.fit === 'slim' ? 0.022 : 0.032;
  const hemRadius = t.fit === 'slim' ? 0.098 : 0.114;
  const waist = 1.985;
  const top = legSection(1.58);
  const hemCenter = legSection(Math.max(0.3, hem));
  // Radius field: body + ease, never inside a straight taper from seat to hem.
  const rows = 90,
    columns = 48;
  const yAt = (k: number) => hem + ((waist - hem) * k) / rows;
  let field = Array.from({ length: rows + 1 }, (_, k) => {
    const y = yAt(k);
    const section = legSection(y);
    const t = THREE.MathUtils.clamp((y - hem) / (1.58 - hem), 0, 1);
    return Array.from({ length: columns }, (_, c) => {
      const angle = (c / columns) * TAU;
      const taper = hemRadius * (1 - t) + (top.radius(angle) + ease) * t;
      return Math.max(section.radius(angle) + ease, y < 1.58 ? taper : 0);
    });
  });
  for (let pass = 0; pass < 6; pass++)
    field = field.map((row, k) =>
      row.map((v, c) => {
        const up = field[Math.min(rows, k + 1)][c],
          down = field[Math.max(0, k - 1)][c];
        return (
          v * 0.4 +
          (up + down) * 0.2 +
          (row[(c + columns - 1) % columns] + row[(c + 1) % columns]) * 0.1
        );
      }),
    );
  const legPoint = (y: number, angle: number, extra = 0) => {
    const section = legSection(y);
    // A straight leg axis from the seat to the hem.
    const t = THREE.MathUtils.clamp((y - hem) / (1.58 - hem), 0, 1);
    const straight = y < 1.58 ? 1 : 1 - smooth(1.58, 1.7, y);
    const cx = (hemCenter.cx * (1 - t) + top.cx * t) * straight + section.cx * (1 - straight);
    const cz =
      (hemCenter.cz + 0.02) * (1 - t) * straight +
      top.cz * t * straight +
      section.cz * (1 - straight);
    const f = THREE.MathUtils.clamp(((y - hem) / (waist - hem)) * rows, 0, rows);
    const k = Math.min(rows - 1, Math.floor(f));
    const g = ((((angle / TAU) % 1) + 1) % 1) * columns;
    const c = Math.floor(g) % columns;
    const at = (row: number[]) => row[c] + (row[(c + 1) % columns] - row[c]) * (g - Math.floor(g));
    const r = at(field[k]) + (at(field[k + 1]) - at(field[k])) * (f - k) + extra;
    // The inner halves meet at the centre seam above the crotch.
    let x = cx + Math.sin(angle) * r;
    if (y > 1.62 && x < 0) x *= 0.2;
    return new THREE.Vector3(x, y, cz + Math.cos(angle) * r);
  };
  const leg = grid(
    columns,
    rows,
    (u, v) => legPoint(hem + (waist - hem) * v, u * TAU),
    (u, v, p) => [u * 0.7, p.y],
    (p) => {
      const s = legSection(p.y);
      return new THREE.Vector3(p.x - s.cx, 0, p.z - s.cz).normalize();
    },
  );
  const parts: GarmentPart[] = [
    { key: 'leg-left', role: 'trouser', geometry: leg },
    { key: 'leg-right', role: 'trouser', geometry: mirrorX(leg) },
  ];
  // Waistband, and turn-ups when chosen.
  const band = waistbandField(t.fit === 'slim');
  parts.push({
    key: 'waistband',
    role: 'trouser',
    geometry: slab(
      64,
      2,
      (u, v, layer) => band.point(1.94 + v * 0.05, u * TAU, layer * 0.004),
      outwardFrom(),
    ),
  });
  if (t.cuffs) {
    const turnUp = slab(
      40,
      2,
      (u, v, layer) => legPoint(hem + v * 0.05, u * TAU, 0.004 + layer * 0.004),
      (p) => {
        const s = legSection(p.y);
        return new THREE.Vector3(p.x - s.cx, 0, p.z - s.cz).normalize();
      },
    );
    parts.push(
      { key: 'turn-up-left', role: 'trouser', geometry: turnUp },
      { key: 'turn-up-right', role: 'trouser', geometry: mirrorX(turnUp) },
    );
  }
  // Pressed crease down each front.
  const crease: THREE.Vector3[] = [];
  for (let y = hem + 0.03; y < 1.55; y += 0.05) crease.push(legPoint(y, 0, 0.001));
  const creaseTube = tube(crease, 0.002, 4);
  parts.push(
    { key: 'crease-left', role: 'seam', geometry: creaseTube },
    { key: 'crease-right', role: 'seam', geometry: mirrorX(creaseTube) },
  );
  return parts;
}

export function shoeParts(): GarmentPart[] {
  const ankle = legSection(0.2);
  const cx = ankle.cx;
  const heel = -0.075,
    toe = 0.235,
    sole = 0.035;
  const upper = grid(
    28,
    24,
    (u, v) => {
      const z = heel + (toe - heel) * v;
      const w = 0.056 * Math.sin(Math.PI * Math.min(1, 0.18 + v * 0.95)) ** 0.55;
      const topY =
        sole +
        (v < 0.4 ? 0.13 : 0.13 - (v - 0.4) * 0.16) *
          Math.sin(Math.PI * Math.min(1, 0.12 + v)) ** 0.25;
      const angle = u * TAU;
      const y = Math.max(sole + 0.012, sole + (topY - sole) * (0.5 + 0.5 * Math.cos(angle)));
      return new THREE.Vector3(cx + Math.sin(angle) * w, y, z);
    },
    (u, v) => [u * 0.3, v * 0.3],
    (p) => new THREE.Vector3(p.x - cx, p.y - 0.08, 0).normalize(),
  );
  const soleGeometry = slab(
    12,
    20,
    (u, v, layer) => {
      const z = heel - 0.005 + (toe + 0.012 - heel) * v;
      const w = 0.06 * Math.sin(Math.PI * Math.min(1, 0.16 + v * 0.95)) ** 0.5;
      return new THREE.Vector3(cx + (u - 0.5) * 2 * w, 0.02 + layer * 0.018, z);
    },
    () => new THREE.Vector3(0, 1, 0),
  );
  return [
    { key: 'shoe-left', role: 'shoe', geometry: upper },
    { key: 'shoe-right', role: 'shoe', geometry: mirrorX(upper) },
    { key: 'sole-left', role: 'sole', geometry: soleGeometry },
    { key: 'sole-right', role: 'sole', geometry: mirrorX(soleGeometry) },
  ];
}

/** Everything drawn in 3D for the accepted design. */
export function outfitParts(spec: SketchSpec): GarmentPart[] {
  const parts: GarmentPart[] = [];
  const hasJacket = !!spec.jacket;
  parts.push(...shirtParts(spec, !hasJacket));
  if (spec.vest && hasJacket) parts.push(...vestParts(spec));
  if (hasJacket) parts.push(...jacketParts(spec));
  parts.push(...trouserParts(spec));
  parts.push(...shoeParts());
  return parts;
}
