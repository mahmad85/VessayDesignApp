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
] as const;
export function definitionsFor(product: Product) {
  return MEASUREMENTS.filter((m) => (m.products as readonly string[]).includes(product));
}
export function displayValue(mm: number | undefined, unit: 'cm' | 'in') {
  return mm === undefined ? '' : String(Math.round((mm / (unit === 'cm' ? 10 : 25.4)) * 10) / 10);
}
export function toMillimeters(value: number, unit: 'cm' | 'in') {
  return Math.round(value * (unit === 'cm' ? 10 : 25.4) * 100) / 100;
}
