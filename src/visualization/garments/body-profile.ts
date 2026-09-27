import * as THREE from 'three';
import profiles from '../body-profiles.json';

// Interpolated access to cross-sections sampled from the reference body by
// scripts/build-garment-profiles.mjs. Angles start at the front (+Z) and turn
// towards +X, the wearer's left.

type TorsoRow = { y: number; cz: number; r: number[] };
type ArmRow = { s: number; center: number[]; tangent: number[]; r: number[] };
type LegRow = { y: number; cx: number; cz: number; r: number[] };

const TORSO = profiles.torso as TorsoRow[];
const ARM = profiles.arm as ArmRow[];
const LEG = profiles.leg as LegRow[];
const TAU = Math.PI * 2;

export const CROTCH_Y = profiles.crotch;
export const ARM_LENGTH = ARM[ARM.length - 1].s;

function around(r: number[], angle: number) {
  const f = ((((angle / TAU) % 1) + 1) % 1) * r.length;
  const i = Math.floor(f) % r.length;
  const t = f - Math.floor(f);
  return r[i] + (r[(i + 1) % r.length] - r[i]) * t;
}

function rowAt<T extends { y: number }>(rows: T[], y: number) {
  const step = rows[1].y - rows[0].y;
  const f = THREE.MathUtils.clamp((y - rows[0].y) / step, 0, rows.length - 1);
  const i = Math.min(rows.length - 2, Math.floor(f));
  return { a: rows[i], b: rows[i + 1], t: f - i };
}

/** Horizontal body radius without the arms. */
export function torsoRadius(y: number, angle: number) {
  const { a, b, t } = rowAt(TORSO, y);
  return around(a.r, angle) * (1 - t) + around(b.r, angle) * t;
}

export function torsoCenterZ(y: number) {
  const { a, b, t } = rowAt(TORSO, y);
  return a.cz * (1 - t) + b.cz * t;
}

export type ArmFrame = {
  center: THREE.Vector3;
  tangent: THREE.Vector3;
  front: THREE.Vector3;
  side: THREE.Vector3;
};

/** Left-arm frame at a distance along the posed shoulder → wrist axis. */
export function armFrame(s: number): ArmFrame {
  const step = ARM[1].s - ARM[0].s;
  const f = THREE.MathUtils.clamp(s / step, 0, ARM.length - 1);
  const i = Math.min(ARM.length - 2, Math.floor(f));
  const t = f - i;
  const center = new THREE.Vector3()
    .fromArray(ARM[i].center)
    .lerp(new THREE.Vector3().fromArray(ARM[i + 1].center), t);
  const tangent = new THREE.Vector3()
    .fromArray(ARM[i].tangent)
    .lerp(new THREE.Vector3().fromArray(ARM[i + 1].tangent), t)
    .normalize();
  // Beyond the ends, continue straight along the axis.
  if (s < 0) center.addScaledVector(tangent, s);
  if (s > ARM_LENGTH) center.addScaledVector(tangent, s - ARM_LENGTH);
  const front = new THREE.Vector3(0, 0, 1).addScaledVector(tangent, -tangent.z).normalize();
  const side = new THREE.Vector3().crossVectors(tangent, front);
  return { center, tangent, front, side };
}

export function armRadius(s: number, angle: number) {
  const step = ARM[1].s - ARM[0].s;
  const f = THREE.MathUtils.clamp(s / step, 0, ARM.length - 1);
  const i = Math.min(ARM.length - 2, Math.floor(f));
  const t = f - i;
  return around(ARM[i].r, angle) * (1 - t) + around(ARM[i + 1].r, angle) * t;
}

/** Left-leg cross-section. Above the crotch it is that side's half of the pelvis. */
export function legSection(y: number) {
  const { a, b, t } = rowAt(LEG, y);
  return {
    cx: a.cx * (1 - t) + b.cx * t,
    cz: a.cz * (1 - t) + b.cz * t,
    radius: (angle: number) => around(a.r, angle) * (1 - t) + around(b.r, angle) * t,
  };
}
