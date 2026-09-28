import type { RuntimeIndex } from '@/modules/catalog/snapshot';

// Maps outline leaves to the area of the 2D technical drawing that shows them.
// Coordinates are in the drawing's 400 × 800 viewBox.

export type SketchView = 'front' | 'back' | 'inside';
/** Layers faded so the focused garment is visible underneath the jacket. */
export type Reveal = 'none' | 'vest' | 'trousers';

export type RegionId =
  | 'full'
  | 'torso'
  | 'collar'
  | 'chest'
  | 'buttons'
  | 'pockets'
  | 'sleeve'
  | 'waist'
  | 'legs'
  | 'hem'
  | 'vest'
  | 'vest-buttons'
  | 'back'
  | 'vent'
  | 'neck-back'
  | 'elbow'
  | 'back-pockets'
  | 'inside'
  | 'canvas'
  | 'monogram';

export type Region = {
  label: string;
  view: SketchView;
  box: [x: number, y: number, width: number, height: number];
  reveal: Reveal;
  /** Where the edit marker sits, beside the feature rather than on top of it. */
  anchor: [x: number, y: number];
};

export const REGIONS: Record<RegionId, Region> = {
  full: {
    label: 'Full look',
    view: 'front',
    box: [0, 0, 400, 800],
    reveal: 'none',
    anchor: [200, 400],
  },
  torso: {
    label: 'Jacket',
    view: 'front',
    box: [50, 100, 300, 420],
    reveal: 'none',
    anchor: [200, 300],
  },
  collar: {
    label: 'Collar & lapels',
    view: 'front',
    box: [118, 112, 164, 170],
    reveal: 'none',
    anchor: [262, 190],
  },
  chest: {
    label: 'Breast pocket',
    view: 'front',
    box: [185, 180, 130, 130],
    reveal: 'none',
    anchor: [276, 222],
  },
  buttons: {
    label: 'Buttons',
    view: 'front',
    box: [120, 245, 160, 210],
    reveal: 'none',
    anchor: [216, 352],
  },
  pockets: {
    label: 'Pockets',
    view: 'front',
    box: [96, 350, 208, 150],
    reveal: 'none',
    anchor: [292, 410],
  },
  sleeve: {
    label: 'Sleeve cuff',
    view: 'front',
    box: [40, 370, 124, 124],
    reveal: 'none',
    anchor: [64, 414],
  },
  waist: {
    label: 'Waistband',
    view: 'front',
    box: [104, 360, 192, 170],
    reveal: 'trousers',
    anchor: [272, 398],
  },
  legs: {
    label: 'Trousers',
    view: 'front',
    box: [70, 390, 260, 410],
    reveal: 'trousers',
    anchor: [252, 600],
  },
  hem: {
    label: 'Trouser hem & shoes',
    view: 'front',
    box: [104, 640, 192, 160],
    reveal: 'none',
    anchor: [276, 742],
  },
  vest: {
    label: 'Vest',
    view: 'front',
    box: [110, 130, 180, 340],
    reveal: 'vest',
    anchor: [226, 300],
  },
  'vest-buttons': {
    label: 'Vest buttons',
    view: 'front',
    box: [135, 230, 130, 190],
    reveal: 'vest',
    anchor: [186, 300],
  },
  back: {
    label: 'Back',
    view: 'back',
    box: [50, 100, 300, 420],
    reveal: 'none',
    anchor: [200, 300],
  },
  vent: {
    label: 'Back vent',
    view: 'back',
    box: [110, 340, 180, 170],
    reveal: 'none',
    anchor: [216, 452],
  },
  'neck-back': {
    label: 'Neck lining',
    view: 'back',
    box: [130, 115, 140, 110],
    reveal: 'none',
    anchor: [240, 140],
  },
  elbow: {
    label: 'Elbow patches',
    view: 'back',
    box: [44, 240, 124, 170],
    reveal: 'none',
    anchor: [66, 300],
  },
  'back-pockets': {
    label: 'Back pockets',
    view: 'back',
    box: [110, 400, 180, 150],
    reveal: 'trousers',
    anchor: [264, 428],
  },
  inside: {
    label: 'Inside the jacket',
    view: 'inside',
    box: [40, 100, 320, 420],
    reveal: 'none',
    anchor: [118, 380],
  },
  canvas: {
    label: 'Construction',
    view: 'inside',
    box: [110, 140, 200, 250],
    reveal: 'none',
    anchor: [150, 196],
  },
  monogram: {
    label: 'Monogram',
    view: 'inside',
    box: [175, 270, 170, 140],
    reveal: 'none',
    anchor: [300, 334],
  },
};

/**
 * Focus regions of the pre-catalog outline leaves. They are import source data
 * (CATALOG-ADMIN §10: `focus_region` of the imported groups); the runtime reads
 * `option_groups.focus_region` from the release.
 */
export const LEAF_REGIONS: Record<string, RegionId> = {
  product: 'full',
  occasion: 'full',
  climate: 'full',
  fabricId: 'torso',
  fit: 'torso',
  lapel: 'collar',
  pockets: 'pockets',
  closure: 'buttons',
  collar: 'collar',
  cuffs: 'sleeve',
  'style.jacket.jacket_style_combined': 'buttons',
  'style.jacket.jacket_fit': 'torso',
  'style.jacket.jacket_lapel_type_combinated': 'collar',
  'style.jacket.jacket_pockets_type': 'pockets',
  'style.jacket.jacket_sleeve_buttons_combinated': 'sleeve',
  'style.jacket.jacket_vent': 'vent',
  'style.jacket.jacket_chest_pocket': 'chest',
  'style.pants.pants_fit': 'legs',
  'style.pants.pants_length': 'legs',
  'style.pants.pants_break': 'hem',
  'style.pants.pants_peg': 'waist',
  'style.pants.pants_belt': 'waist',
  'style.pants.pants_pockets': 'waist',
  'style.pants.pants_cuff': 'hem',
  'style.pants.suspender_buttons': 'waist',
  'style.pants.active_waist': 'waist',
  'style.vest.waistcoat': 'vest',
  'style.vest.waistcoat_style_combined': 'vest-buttons',
  'style.vest.waistcoat_lapel': 'vest',
  'style.vest.waistcoat_lapel_width': 'vest',
  'style.vest.waistcoat_bottom': 'vest',
  'style.vest.waistcoat_chest_pocket': 'vest',
  'style.vest.waistcoat_pockets': 'vest',
  'accents.jacket.half_canvas': 'canvas',
  'accents.jacket.lining': 'inside',
  'accents.jacket.initials': 'monogram',
  'accents.jacket.panuelos': 'chest',
  'accents.jacket.buttons_color': 'buttons',
  'accents.jacket.button_holes_threads': 'buttons',
  'accents.jacket.patches': 'elbow',
  'accents.jacket.neck_lining': 'neck-back',
  'accents.jacket.bowtie': 'collar',
  'accents.jacket.tie': 'collar',
  'accents.jacket.suspenders': 'waist',
  'accents.jacket.shoes': 'hem',
  'accents.pants.belt': 'waist',
  'accents.pants.socks': 'hem',
  'accents.vest.waistcoat_lining': 'inside',
  'accents.vest.waistcoat_lining_back': 'inside',
  'accents.vest.waistcoat_initials': 'monogram',
  'accents.vest.waistcoat_metal_buttons': 'vest-buttons',
  'accents.vest.waistcoat_button_holes_threads': 'vest-buttons',
};

/** Fixed Essentials leaves, which are not catalog groups. */
const FIXED_REGIONS: Record<string, RegionId> = {
  product: 'full',
  occasion: 'full',
  climate: 'full',
  fabric: 'torso',
  fabricId: 'torso',
};
/** Where each visual part is drawn, for its include toggle (`include:<component>`). */
const PART_REGIONS: Record<string, RegionId> = {
  jacket: 'torso',
  trousers: 'legs',
  vest: 'vest',
  shirt: 'torso',
};
const isRegion = (value: string): value is RegionId => Object.hasOwn(REGIONS, value);

export type FocusContext = {
  /** The garment's release. Without it only the imported table is used (the v1 UI until WP-15). */
  index?: RuntimeIndex;
  product?: 'suit' | 'shirt' | 'blazer';
  /** Render tokens of the garment (binding.ts), for choices that move the focus. */
  tokens?: Partial<Record<string, string>>;
  /** The option (attribute code) that just changed. */
  changedKey?: string;
};

/**
 * Region for an outline leaf: the group's `focus_region` from the catalog
 * (CATALOG-ADMIN §6). A few drawing details move the focus, such as a changed
 * back-pocket choice or thread colours applied only to cuffs; these read
 * registry slots, not catalog codes.
 */
export function regionForLeaf(leafId: string, context: FocusContext = {}): RegionId {
  const { product = 'suit', tokens = {}, changedKey, index } = context;
  if (product === 'shirt' && (leafId === 'fabric' || leafId === 'fabricId')) return 'full';
  if (FIXED_REGIONS[leafId]) return FIXED_REGIONS[leafId];
  if (!index) return LEAF_REGIONS[leafId] ?? 'full';
  const include = /^include:(.+)$/.exec(leafId);
  if (include) {
    const part = index.components.get(include[1])?.visualPart;
    return (part && PART_REGIONS[part]) ?? 'full';
  }
  const group = index.groups.get(leafId)?.group;
  if (!group) return 'full';
  const changed = changedKey ? index.attributes.get(changedKey)?.attribute : undefined;
  if (changed?.visualSlot === 'trousers.backPocket') return 'back-pockets';
  if (group.attributes.some((attribute) => attribute.visualSlot === 'jacket.threads.scope')) {
    const scope = tokens['jacket.threads.scope'];
    if (scope === 'cuff') return 'sleeve';
    if (scope === 'lapel') return 'collar';
  }
  return isRegion(group.focusRegion) ? group.focusRegion : 'full';
}
