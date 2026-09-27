import { fabricFor } from '@/modules/catalog/catalog';
import {
  defaultSuitCustomizations,
  hasVest,
  optionFor,
} from '@/modules/catalog/suit-customization';
import type { Design } from '@/modules/configuration/types';

// Turns the saved design into drawing parameters for the 2D technical view.
// Everything here is derived from the accepted configuration; nothing is invented.

const DEFAULTS = defaultSuitCustomizations();
const STYLE = 'style.';
const ACCENTS = 'accents.';

export type SketchSpec = ReturnType<typeof sketchSpec>;

function key(values: Record<string, string>, path: string) {
  return values[path] ?? DEFAULTS[path] ?? '';
}

/** Supplied thumbnail for the chosen option, used as an illustrative texture. */
function asset(values: Record<string, string>, path: string) {
  return optionFor(path, values[path])?.asset ?? undefined;
}

const BUTTON_COLOURS: Record<string, string> = {
  '1': '#6b4a31',
  '2': '#4b4d50',
  '3': '#27344a',
  '4': '#a39574',
  '5': '#ece6d6',
  '6': '#3a3b3d',
  '50': '#c6a15a',
  '51': '#b08d4c',
  '52': '#c7c9cb',
  '53': '#9c9a92',
};

export function sketchSpec(design: Design) {
  const suit = design.product === 'suit';
  const values = suit ? { ...DEFAULTS, ...(design.customizations || {}) } : {};
  const s = (path: string) => key(values, STYLE + path);
  const a = (path: string) => key(values, ACCENTS + path);
  const fabric = fabricFor(design.fabricId);
  const fit = design.fit === 'Relaxed' ? 'relaxed' : design.fit === 'Classic' ? 'regular' : 'slim';

  const jacketStyle = suit
    ? s('jacket.jacket_style_combined.jacket-style-combined') || 'simple_2'
    : design.closure === 'One button'
      ? 'simple_1'
      : 'simple_2';
  const lapelType = suit
    ? s('jacket.jacket_lapel_type_combinated.jacket-lapel-type') || 'standard'
    : design.lapel === 'Peak'
      ? 'peak'
      : 'standard';
  const pockets = suit
    ? s('jacket.jacket_pockets_type.jacket-pockets-type') || '2'
    : design.pockets === 'Patch'
      ? '2b'
      : '2';
  const buttonsCustom = suit && a('jacket.buttons_color.buttons') === 'personalizado';
  const threadScope = suit ? a('jacket.button_holes_threads.button-threads-holes') : 'By default';
  const products = (group: string, toggle: string) =>
    suit && a(`${group}.${toggle}`) === 'personalizado'
      ? { on: true, asset: asset(values, `${ACCENTS}${group}.products`) }
      : { on: false, asset: undefined };

  return {
    product: design.product,
    skinTone: design.skinTone,
    fabric: {
      color: fabric?.color ?? '#4a4c50',
      pattern: fabric?.pattern ?? 'plain',
    },
    fit,
    jacket:
      design.product === 'shirt'
        ? null
        : {
            style: jacketStyle,
            lapelType,
            lapelWidth: suit
              ? s('jacket.jacket_lapel_type_combinated.jacket-wide-lapel')
              : 'standard',
            pockets,
            sleeveButtons: suit
              ? Number(s('jacket.jacket_sleeve_buttons_combinated.jacket-sleeve-buttons') || 3)
              : 3,
            sleeveHoles:
              suit &&
              s('jacket.jacket_sleeve_buttons_combinated.jacket-sleeve-buttonholes') === '1',
            vent: suit ? s('jacket.jacket_vent.jacket-vent') || '1' : '2',
            chestPocket: suit ? s('jacket.jacket_chest_pocket.jacket-chest-pocket') || '1' : '1',
            buttonColor: buttonsCustom
              ? (BUTTON_COLOURS[a('jacket.buttons_color.colors')] ?? '#2f2a25')
              : '#2f2a25',
            buttonAsset: buttonsCustom
              ? asset(values, `${ACCENTS}jacket.buttons_color.colors`)
              : undefined,
            threads:
              threadScope && threadScope !== 'By default'
                ? {
                    scope: threadScope as 'all' | 'cuff' | 'lapel',
                    holeAsset: asset(values, `${ACCENTS}jacket.button_holes_threads.button-holes`),
                    threadAsset: asset(
                      values,
                      `${ACCENTS}jacket.button_holes_threads.button-threads`,
                    ),
                  }
                : null,
            lining: suit ? a('jacket.lining.internal-lining') || 'default' : 'default',
            liningAsset:
              suit && a('jacket.lining.internal-lining') === 'personalizado'
                ? asset(values, `${ACCENTS}jacket.lining.lining-fabrics`)
                : undefined,
            halfCanvas: suit && a('jacket.half_canvas.canvas') === 'half_canvas',
            monogram: suit
              ? {
                  font: a('jacket.initials.font') || 'bold_script',
                  threadAsset: asset(values, `${ACCENTS}jacket.initials.thread-color`),
                }
              : null,
            elbowPatches:
              suit && a('jacket.patches.elbow-patches') === 'personalizado'
                ? { asset: asset(values, `${ACCENTS}jacket.patches.colors`) }
                : null,
            neckLining:
              suit && a('jacket.neck_lining.neck-lining') === 'personalizado'
                ? { asset: asset(values, `${ACCENTS}jacket.neck_lining.colors`) }
                : null,
            pocketSquare: products('jacket.panuelos', 'pocket-squares'),
          },
    trousers: {
      color: design.product === 'suit' ? null : '#56524b',
      fit: suit ? (s('pants.pants_fit.pants-fit') === 'fit' ? 'slim' : 'normal') : 'normal',
      length: suit ? s('pants.pants_length.pants-length') || 'long' : 'long',
      break: suit ? s('pants.pants_break.pants-break') || 'half' : 'half',
      pleats: suit ? Number(s('pants.pants_peg.pants-peg') || 0) : 0,
      fastening: suit ? s('pants.pants_belt.pants-belt') || '1' : '0',
      frontPocket: suit ? s('pants.pants_pockets.pants-front-pocket') || 'diagonal' : 'diagonal',
      backPocket: suit ? s('pants.pants_pockets.pants-back-pocket-combine') || 'A1' : 'A1',
      cuffs: suit && s('pants.pants_cuff.pants-cuff') === '1',
      suspenderButtons: suit && s('pants.suspender_buttons.suspender-buttons') === '1',
      waist: suit ? s('pants.active_waist.active-waist') || '0' : '0',
      belt: suit && a('pants.belt.belt') === 'personalizado',
      braces: suit && a('jacket.suspenders.braces') === 'personalizado',
    },
    vest:
      suit && hasVest(values)
        ? {
            style: s('vest.waistcoat_style_combined.waistcoat-style-combined') || 'simple_5',
            lapel: s('vest.waistcoat_lapel.waistcoat-lapel') || 'no',
            bottom: s('vest.waistcoat_bottom.waistcoat-bottom') || 'cut',
            chestPocket: s('vest.waistcoat_chest_pocket.waistcoat-chest-pocket') === '1',
            pockets: s('vest.waistcoat_pockets.waistcoat-pockets') || '2',
          }
        : null,
    shirt: {
      collar: design.collar,
      cuffs: design.cuffs,
    },
    tie: products('jacket.tie', 'necktie'),
    bowtie: products('jacket.bowtie', 'bowtie'),
    shoes: suit && a('jacket.shoes.shoes') === 'personalizado' ? a('jacket.shoes.products') : '',
    socks: products('pants.socks', 'socks'),
  };
}

/** Shoe colour and shape from the supplied product name. */
export function shoeStyle(productId: string) {
  const label = optionFor('accents.jacket.shoes.products', productId)?.label.toLowerCase() ?? '';
  return {
    color: label.includes('white') ? '#ece9e1' : label.includes('brown') ? '#5b3a24' : '#1f1d1b',
    boot: label.includes('boot'),
    sneaker: label.includes('sneaker'),
  };
}
