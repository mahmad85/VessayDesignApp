import type { Product } from '../catalog/catalog';
export const MEASUREMENTS = [
  {
    id: 'height',
    label: 'Height',
    hint: 'Stand upright without shoes. Measure from the floor to the top of your head.',
    region: 'full',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'neck',
    label: 'Neck',
    hint: 'Around the base of the neck. Record your body measurement without adding fit allowance.',
    region: 'neck',
    products: ['shirt'],
  },
  {
    id: 'chest',
    label: 'Chest',
    hint: 'Around the fullest part of the chest, keeping the tape level and breathing naturally.',
    region: 'chest',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'waist',
    label: 'Body waist',
    hint: 'Around your natural waist. This is different from where you wear your trousers.',
    region: 'waist',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'shoulder',
    label: 'Shoulder width',
    hint: 'Across the back between the shoulder points. A tailor should confirm the measurement method.',
    region: 'shoulder',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'sleeve',
    label: 'Sleeve length',
    hint: 'From the shoulder point along a gently bent arm to the wrist.',
    region: 'sleeve',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'hips',
    label: 'Seat / hips',
    hint: 'Around the fullest part of the seat, keeping the tape horizontal.',
    region: 'hips',
    products: ['suit'],
  },
  {
    id: 'inseam',
    label: 'Inside leg',
    hint: 'From the crotch to the desired trouser hem. This requested length needs tailor confirmation.',
    region: 'leg',
    products: ['suit'],
  },
  // Additional-accuracy fields: less commonly asked for by tailors than the
  // set above, but supported when a 3DLOOK scan (or the customer) supplies
  // them. Never required to confirm measurements — see `advanced` below.
  {
    id: 'bicep',
    label: 'Bicep',
    hint: 'Around the fullest part of the upper arm, with the arm relaxed at your side.',
    region: 'sleeve',
    products: ['suit', 'shirt', 'blazer'],
    advanced: true,
  },
  {
    id: 'forearm',
    label: 'Forearm',
    hint: 'Around the fullest part of the forearm, just below the elbow.',
    region: 'sleeve',
    products: ['shirt'],
    advanced: true,
  },
  {
    id: 'wrist',
    label: 'Wrist',
    hint: 'Around the wrist bone, where a cuff would sit.',
    region: 'sleeve',
    products: ['shirt'],
    advanced: true,
  },
  {
    id: 'thigh',
    label: 'Thigh',
    hint: 'Around the fullest part of the upper thigh.',
    region: 'leg',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'knee',
    label: 'Knee',
    hint: 'Around the knee, with the leg straight.',
    region: 'leg',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'calf',
    label: 'Calf',
    hint: 'Around the fullest part of the calf.',
    region: 'leg',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'ankle',
    label: 'Ankle',
    hint: 'Around the ankle, just above the anklebone.',
    region: 'leg',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'jacketLength',
    label: 'Jacket length',
    hint: 'From the base of the collar at the back of the neck to the desired jacket hem.',
    region: 'chest',
    products: ['suit', 'blazer'],
    advanced: true,
  },
  {
    id: 'frontRise',
    label: 'Front rise',
    hint: 'From the top of the waistband at the front to the crotch seam.',
    region: 'waist',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'backRise',
    label: 'Back rise',
    hint: 'From the top of the waistband at the back to the crotch seam.',
    region: 'waist',
    products: ['suit'],
    advanced: true,
  },
] as const;
export function definitionsFor(product: Product) {
  return MEASUREMENTS.filter((m) => (m.products as readonly string[]).includes(product));
}
export function requiredDefinitionsFor(product: Product) {
  return definitionsFor(product).filter((m) => !('advanced' in m && m.advanced));
}
export function displayValue(mm: number | undefined, unit: 'cm' | 'in') {
  return mm === undefined ? '' : String(Math.round((mm / (unit === 'cm' ? 10 : 25.4)) * 10) / 10);
}
export function toMillimeters(value: number, unit: 'cm' | 'in') {
  return Math.round(value * (unit === 'cm' ? 10 : 25.4) * 100) / 100;
}
/** The code-owned measurement sets products reference (CATALOG-ADMIN §3.1). */
export type MeasurementSet = Product;
function union(
  sets: readonly MeasurementSet[],
  pick: (set: MeasurementSet) => readonly Definition[],
) {
  const ids = new Set(sets.flatMap((set) => pick(set).map((m) => m.id as string)));
  return MEASUREMENTS.filter((m) => ids.has(m.id));
}
type Definition = (typeof MEASUREMENTS)[number];
/** Fields any garment in the cart accepts (CRT-004: one profile per draft). */
export function definitionsForProducts(sets: readonly MeasurementSet[]) {
  return union(sets, definitionsFor);
}
/** The union of the required fields over every garment in the cart (CRT-004). */
export function requiredDefinitionsForProducts(sets: readonly MeasurementSet[]) {
  return union(sets, requiredDefinitionsFor);
}
