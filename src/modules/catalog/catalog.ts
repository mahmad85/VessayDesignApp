export type Product = 'suit' | 'shirt' | 'blazer';
export type Fabric = {
  id: string;
  name: string;
  color: string;
  tone: string;
  description: string;
  pattern: 'plain' | 'twill' | 'check' | 'stripe';
  products: Product[];
  climates: string[];
  weight: string;
  composition: string;
  sample: true;
};
export const PRODUCTS: Record<Product, { name: string; label: string; description: string }> = {
  suit: {
    name: 'Two-piece suit',
    label: 'Suit',
    description: 'A coordinated jacket and trousers.',
  },
  shirt: {
    name: 'Dress shirt',
    label: 'Shirt',
    description: 'The foundation of a considered wardrobe.',
  },
  blazer: { name: 'Blazer', label: 'Blazer', description: 'A versatile jacket, made your own.' },
};
export const FABRICS: Fabric[] = [
  {
    id: 'navy-twill',
    name: 'Midnight navy',
    color: '#25374b',
    tone: 'Dark',
    description: 'A subtle diagonal weave with a clean, understated finish.',
    pattern: 'twill',
    products: ['suit', 'blazer'],
    climates: ['All season', 'Cool'],
    weight: 'Medium weight',
    composition: 'Wool reference',
    sample: true,
  },
  {
    id: 'charcoal',
    name: 'Charcoal grey',
    color: '#4a4c50',
    tone: 'Dark',
    description: 'A textured neutral for a versatile formal wardrobe.',
    pattern: 'plain',
    products: ['suit', 'blazer'],
    climates: ['All season', 'Cool'],
    weight: 'Medium weight',
    composition: 'Wool reference',
    sample: true,
  },
  {
    id: 'sand-linen',
    name: 'Sand linen',
    color: '#b4a184',
    tone: 'Light',
    description: 'A relaxed, open-textured reference for warmer days.',
    pattern: 'plain',
    products: ['suit', 'blazer'],
    climates: ['Warm'],
    weight: 'Lightweight',
    composition: 'Linen reference',
    sample: true,
  },
  {
    id: 'forest',
    name: 'Forest green',
    color: '#34463d',
    tone: 'Dark',
    description: 'A deep green alternative to familiar tailoring neutrals.',
    pattern: 'twill',
    products: ['suit', 'blazer'],
    climates: ['All season', 'Cool'],
    weight: 'Medium weight',
    composition: 'Wool reference',
    sample: true,
  },
  {
    id: 'blue-check',
    name: 'Slate windowpane',
    color: '#4a6178',
    tone: 'Mid',
    description: 'A fine windowpane detail with a soft blue-grey base.',
    pattern: 'check',
    products: ['suit', 'blazer'],
    climates: ['All season'],
    weight: 'Medium weight',
    composition: 'Wool reference',
    sample: true,
  },
  {
    id: 'ivory',
    name: 'Ivory cotton',
    color: '#e8e6dc',
    tone: 'Light',
    description: 'A softly textured white for everyday and formal occasions.',
    pattern: 'plain',
    products: ['shirt'],
    climates: ['All season', 'Warm'],
    weight: 'Lightweight',
    composition: 'Cotton reference',
    sample: true,
  },
  {
    id: 'sky',
    name: 'Sky blue',
    color: '#9db8cf',
    tone: 'Light',
    description: 'A light blue weave with a crisp, simple finish.',
    pattern: 'twill',
    products: ['shirt'],
    climates: ['All season', 'Warm'],
    weight: 'Lightweight',
    composition: 'Cotton reference',
    sample: true,
  },
  {
    id: 'blue-stripe',
    name: 'Blue fine stripe',
    color: '#b2c2d3',
    tone: 'Light',
    description: 'Fine vertical stripes for a classic shirt.',
    pattern: 'stripe',
    products: ['shirt'],
    climates: ['All season'],
    weight: 'Lightweight',
    composition: 'Cotton reference',
    sample: true,
  },
];
export function fabricFor(id: string) {
  return FABRICS.find((f) => f.id === id);
}
export function availableFabrics(product: Product) {
  return FABRICS.filter((f) => f.products.includes(product));
}
export const OCCASIONS = ['Office', 'Wedding', 'Formal event', 'Everyday'] as const;
export const CLIMATES = ['Warm', 'All season', 'Cool'] as const;
export const FITS = ['Tailored', 'Classic', 'Relaxed'] as const;
export const DETAIL_OPTIONS = {
  lapel: ['Notch', 'Peak'],
  pockets: ['Flap', 'Patch'],
  closure: ['One button', 'Two buttons'],
  collar: ['Spread', 'Point'],
  cuffs: ['Button', 'French'],
} as const;
