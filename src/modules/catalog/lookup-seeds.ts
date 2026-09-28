import { LEGACY_CLIMATES, LEGACY_OCCASIONS } from './legacy-mapping';

// System lookup types and their starting values (CATALOG-ADMIN.md §3.8). They
// are a curated starting vocabulary, not supplier facts. Admins may add,
// rename, reorder and deactivate values; system types cannot be deleted.
// `colour_family` hex values and `pattern` render patterns are the required
// value metadata: swatch-chip colours and the 2D/3D pattern family.

export type LookupMetadataField = {
  key: string;
  label: string;
  type: 'text';
  required: boolean;
  allowed?: string[];
};
export type LookupTypeSeed = {
  code: string;
  label: string;
  description: string;
  system: true;
  valueMetadataSchema: LookupMetadataField[];
};
export type LookupValueSeed = { code: string; label: string; metadata?: Record<string, string> };

const type = (
  code: string,
  label: string,
  description: string,
  valueMetadataSchema: LookupMetadataField[] = [],
): LookupTypeSeed => ({ code, label, description, system: true, valueMetadataSchema });

export const LOOKUP_TYPES: LookupTypeSeed[] = [
  type('occasion', 'Occasion', 'What the garment is for; a customer preference.'),
  type('climate', 'Climate', 'The weather the garment is for; a customer preference.'),
  type('colour_family', 'Colour family', 'Broad colour groups for filters and advice.', [
    { key: 'hex', label: 'Chip colour (#RRGGBB)', type: 'text', required: true },
  ]),
  type('pattern', 'Pattern', 'The visible pattern of a fabric.', [
    {
      key: 'renderPattern',
      label: 'Drawn as',
      type: 'text',
      required: true,
      allowed: ['plain', 'twill', 'check', 'stripe'],
    },
  ]),
  type('weave', 'Weave', 'How the cloth is woven.'),
  type('fibre', 'Fibre', 'Fibres used in a fabric composition.'),
  type('finish', 'Finish', 'Treatments applied to the cloth.'),
  type('texture', 'Texture', 'How the cloth feels.'),
  type('sheen', 'Sheen', 'How much the cloth reflects light.'),
  type('season', 'Season', 'Seasons the cloth suits.'),
  type('stretch', 'Stretch', 'Whether and how the cloth stretches.'),
  type('care', 'Care', 'Care label instructions.'),
  type('tag', 'Tag', 'Curated words for search and advice.'),
];

const hex = (code: string, label: string, value: string): LookupValueSeed => ({
  code,
  label,
  metadata: { hex: value },
});
const pattern = (code: string, label: string, renderPattern: string): LookupValueSeed => ({
  code,
  label,
  metadata: { renderPattern },
});
const labelsOf = (values: Record<string, string>) =>
  Object.entries(values).map(([label, code]) => ({ code, label }));

export const LOOKUP_VALUES: Record<string, LookupValueSeed[]> = {
  occasion: labelsOf(LEGACY_OCCASIONS),
  climate: labelsOf(LEGACY_CLIMATES),
  colour_family: [
    hex('black', 'Black', '#1a1a1a'),
    hex('charcoal', 'Charcoal', '#36393d'),
    hex('grey', 'Grey', '#8a8d91'),
    hex('navy', 'Navy', '#1f2a44'),
    hex('blue', 'Blue', '#2f5d9e'),
    hex('light_blue', 'Light blue', '#a9c7e4'),
    hex('green', 'Green', '#2f5e3d'),
    hex('olive', 'Olive', '#6b6a3a'),
    hex('brown', 'Brown', '#5b3a24'),
    hex('tan', 'Tan', '#b58b5e'),
    hex('beige', 'Beige', '#d6c6a8'),
    hex('cream', 'Cream', '#efe6cf'),
    hex('white', 'White', '#f7f7f4'),
    hex('burgundy', 'Burgundy', '#6a1f2e'),
    hex('red', 'Red', '#b3262e'),
    hex('pink', 'Pink', '#e3a6b4'),
    hex('purple', 'Purple', '#5a3d78'),
    hex('yellow', 'Yellow', '#e2c14b'),
    hex('orange', 'Orange', '#d9772b'),
    hex('multi', 'Multicolour', '#9a9a9a'),
  ],
  pattern: [
    pattern('solid', 'Solid', 'plain'),
    pattern('twill', 'Twill', 'twill'),
    pattern('herringbone', 'Herringbone', 'twill'),
    pattern('birdseye', 'Birdseye', 'plain'),
    pattern('sharkskin', 'Sharkskin', 'plain'),
    pattern('nailhead', 'Nailhead', 'plain'),
    pattern('pinstripe', 'Pinstripe', 'stripe'),
    pattern('chalk_stripe', 'Chalk stripe', 'stripe'),
    pattern('bengal_stripe', 'Bengal stripe', 'stripe'),
    pattern('check', 'Check', 'check'),
    pattern('windowpane', 'Windowpane', 'check'),
    pattern('glen_check', 'Glen check', 'check'),
    pattern('houndstooth', 'Houndstooth', 'check'),
    pattern('gingham', 'Gingham', 'check'),
    pattern('tartan', 'Tartan', 'check'),
    pattern('micro_pattern', 'Micro pattern', 'plain'),
    pattern('textured', 'Textured', 'plain'),
  ],
  weave: [
    { code: 'plain', label: 'Plain' },
    { code: 'twill', label: 'Twill' },
    { code: 'herringbone', label: 'Herringbone' },
    { code: 'hopsack', label: 'Hopsack' },
    { code: 'basketweave', label: 'Basketweave' },
    { code: 'satin', label: 'Satin' },
    { code: 'oxford', label: 'Oxford' },
    { code: 'royal_oxford', label: 'Royal Oxford' },
    { code: 'pinpoint', label: 'Pinpoint' },
    { code: 'poplin', label: 'Poplin' },
    { code: 'end_on_end', label: 'End-on-end' },
    { code: 'dobby', label: 'Dobby' },
    { code: 'jacquard', label: 'Jacquard' },
    { code: 'seersucker', label: 'Seersucker' },
  ],
  fibre: [
    { code: 'wool', label: 'Wool' },
    { code: 'cashmere', label: 'Cashmere' },
    { code: 'mohair', label: 'Mohair' },
    { code: 'alpaca', label: 'Alpaca' },
    { code: 'silk', label: 'Silk' },
    { code: 'linen', label: 'Linen' },
    { code: 'cotton', label: 'Cotton' },
    { code: 'polyester', label: 'Polyester' },
    { code: 'viscose', label: 'Viscose' },
    { code: 'cupro', label: 'Cupro' },
    { code: 'polyamide', label: 'Polyamide' },
    { code: 'elastane', label: 'Elastane' },
    { code: 'other', label: 'Other' },
  ],
  finish: [
    { code: 'brushed', label: 'Brushed' },
    { code: 'milled', label: 'Milled' },
    { code: 'mercerised', label: 'Mercerised' },
    { code: 'easy_iron', label: 'Easy-iron' },
    { code: 'water_repellent', label: 'Water-repellent' },
    { code: 'natural_stretch', label: 'Natural stretch' },
  ],
  texture: [
    { code: 'smooth', label: 'Smooth' },
    { code: 'crisp', label: 'Crisp' },
    { code: 'soft', label: 'Soft' },
    { code: 'textured', label: 'Textured' },
    { code: 'slubby', label: 'Slubby' },
    { code: 'lustrous', label: 'Lustrous' },
  ],
  sheen: [
    { code: 'matte', label: 'Matte' },
    { code: 'subtle', label: 'Subtle' },
    { code: 'lustrous', label: 'Lustrous' },
  ],
  season: [
    { code: 'spring', label: 'Spring' },
    { code: 'summer', label: 'Summer' },
    { code: 'autumn', label: 'Autumn' },
    { code: 'winter', label: 'Winter' },
  ],
  stretch: [
    { code: 'none', label: 'None' },
    { code: 'mechanical', label: 'Mechanical' },
    { code: 'elastane', label: 'Elastane' },
  ],
  care: [
    { code: 'dry_clean_only', label: 'Dry clean only' },
    { code: 'machine_wash_cold', label: 'Machine wash cold' },
    { code: 'hand_wash', label: 'Hand wash' },
    { code: 'iron_low', label: 'Iron low' },
    { code: 'iron_medium', label: 'Iron medium' },
    { code: 'do_not_tumble', label: 'Do not tumble dry' },
  ],
  tag: [],
};
