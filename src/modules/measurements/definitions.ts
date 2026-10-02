import type { Product } from '../catalog/catalog';
export const MEASUREMENTS = [
  {
    id: 'height',
    label: 'Height',
    hint: 'Stand upright without shoes. Measure from the floor to the top of your head.',
    tip: 'Stand with your back against a wall, rest a hardback book flat on your head, mark where it meets the wall, then measure to the mark.',
    region: 'full',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'neck',
    label: 'Neck',
    hint: 'Around the base of the neck. Record your body measurement without adding fit allowance.',
    tip: 'Slip one finger under the tape so it sits snug but not tight. That is the feel of a comfortable buttoned collar.',
    region: 'neck',
    products: ['shirt'],
  },
  {
    id: 'chest',
    label: 'Chest',
    hint: 'Around the fullest part of the chest, keeping the tape level and breathing naturally.',
    tip: 'Keep your arms relaxed at your sides and breathe out normally. Puffing your chest out adds centimetres you will not want.',
    region: 'chest',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'waist',
    label: 'Body waist',
    hint: 'Around your natural waist. This is different from where you wear your trousers.',
    tip: 'Find your natural waist by bending to one side. The crease that forms is where the tape goes, usually just above the navel.',
    region: 'waist',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'shoulder',
    label: 'Shoulder width',
    hint: 'Across the back between the shoulder points. A tailor should confirm the measurement method.',
    tip: 'This is easiest with a helper. Measure across the top of your back from one shoulder bone to the other, following the curve.',
    region: 'shoulder',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'sleeve',
    label: 'Sleeve length',
    hint: 'From the shoulder point along a gently bent arm to the wrist.',
    tip: 'Rest your hand on your hip so the elbow bends slightly. The tape follows the outside of the arm down to the wrist bone.',
    region: 'sleeve',
    products: ['suit', 'shirt', 'blazer'],
  },
  {
    id: 'hips',
    label: 'Seat / hips',
    hint: 'Around the fullest part of the seat, keeping the tape horizontal.',
    tip: 'Stand with your feet together and wrap the tape around the fullest part of your seat. Check in a mirror that it stays level.',
    region: 'hips',
    products: ['suit'],
  },
  {
    id: 'inseam',
    label: 'Inside leg',
    hint: 'From the crotch to the desired trouser hem. This requested length needs tailor confirmation.',
    tip: 'Measure a pair of trousers that fit you well, from the crotch seam to the hem along the inside leg.',
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
    tip: 'Let the arm hang loose. A flexed bicep reads larger than the sleeve needs to be.',
    region: 'sleeve',
    products: ['suit', 'shirt', 'blazer'],
    advanced: true,
  },
  {
    id: 'forearm',
    label: 'Forearm',
    hint: 'Around the fullest part of the forearm, just below the elbow.',
    tip: 'Keep the hand open and relaxed. A clenched fist tightens the muscle and adds width.',
    region: 'sleeve',
    products: ['shirt'],
    advanced: true,
  },
  {
    id: 'wrist',
    label: 'Wrist',
    hint: 'Around the wrist bone, where a cuff would sit.',
    tip: 'If you want the cuff to fit over your usual watch, measure with the watch on.',
    region: 'sleeve',
    products: ['shirt'],
    advanced: true,
  },
  {
    id: 'thigh',
    label: 'Thigh',
    hint: 'Around the fullest part of the upper thigh.',
    tip: 'Measure about 2 cm below the crotch, standing with your weight evenly on both feet.',
    region: 'leg',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'knee',
    label: 'Knee',
    hint: 'Around the knee, with the leg straight.',
    tip: 'Stand straight with the knee relaxed, not locked back. Wrap the tape around the middle of the kneecap.',
    region: 'leg',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'calf',
    label: 'Calf',
    hint: 'Around the fullest part of the calf.',
    tip: 'Stand with your weight on both feet and move the tape up and down to find the widest point.',
    region: 'leg',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'ankle',
    label: 'Ankle',
    hint: 'Around the ankle, just above the anklebone.',
    tip: 'Keep your foot flat on the floor. The tape sits just above the ankle bone, snug but not tight.',
    region: 'leg',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'jacketLength',
    label: 'Jacket length',
    hint: 'From the base of the collar at the back of the neck to the desired jacket hem.',
    tip: 'With your arm hanging naturally, your thumb knuckle is a classic guide to where a jacket hem should fall.',
    region: 'chest',
    products: ['suit', 'blazer'],
    advanced: true,
  },
  {
    id: 'frontRise',
    label: 'Front rise',
    hint: 'From the top of the waistband at the front to the crotch seam.',
    tip: 'Take it from trousers that sit where you like them, from the crotch seam up to the top of the front waistband.',
    region: 'waist',
    products: ['suit'],
    advanced: true,
  },
  {
    id: 'backRise',
    label: 'Back rise',
    hint: 'From the top of the waistband at the back to the crotch seam.',
    tip: 'Measure a well-fitting pair along the back seam, from the crotch seam to the top of the back waistband.',
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
