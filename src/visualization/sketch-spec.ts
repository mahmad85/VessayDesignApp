import type { RenderInput } from './binding';
import type { SlotId } from './registry';

// Turns render values (binding.ts) into drawing parameters for the 2D technical
// view; the 3D garments are generated from the same specification. Everything
// is derived from the accepted configuration through registry tokens; nothing
// is invented. Defaults below are the drawing's own, used when a slot has no
// token (a product without that option).

export type SketchSpec = ReturnType<typeof sketchSpec>;

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

export function sketchSpec(render: RenderInput) {
  const t = (slot: SlotId) => render.tokens[slot] ?? '';
  const image = (slot: SlotId) => render.images[slot];
  const model = render.visualModel;
  const suit = model === 'suit';
  const fitToken = t('fit');
  const fit =
    fitToken === 'relaxed'
      ? 'relaxed'
      : fitToken === '0' || fitToken === 'classic'
        ? 'regular'
        : 'slim';
  const buttonsCustom = t('jacket.buttons') === 'personalizado';
  const threadScope = t('jacket.threads.scope');
  const accessory = (on: SlotId, product: SlotId) =>
    t(on) === 'personalizado'
      ? { on: true, asset: image(product) }
      : { on: false, asset: undefined };

  return {
    product: model,
    skinTone: render.skinTone,
    fabric: { color: render.material.color, pattern: render.material.pattern },
    fit,
    jacket:
      model === 'shirt'
        ? null
        : {
            style: t('jacket.style') || 'simple_2',
            lapelType: t('jacket.lapelType') || 'standard',
            lapelWidth: t('jacket.lapelWidth') || 'standard',
            pockets: t('jacket.pockets') || '2',
            sleeveButtons: Number(t('jacket.sleeveButtons') || 3),
            sleeveHoles: t('jacket.sleeveHoles') === '1',
            vent: t('jacket.vent') || (suit ? '1' : '2'),
            chestPocket: t('jacket.chestPocket') || '1',
            buttonColor: buttonsCustom
              ? (BUTTON_COLOURS[t('jacket.buttonColor')] ?? '#2f2a25')
              : '#2f2a25',
            buttonAsset: buttonsCustom ? image('jacket.buttonColor') : undefined,
            threads:
              threadScope && threadScope !== 'By default'
                ? {
                    scope: threadScope as 'all' | 'cuff' | 'lapel',
                    holeAsset: image('jacket.threads.hole'),
                    threadAsset: image('jacket.threads.thread'),
                  }
                : null,
            lining: t('jacket.lining') || 'default',
            liningAsset:
              t('jacket.lining') === 'personalizado' ? image('jacket.liningFabric') : undefined,
            halfCanvas: t('jacket.halfCanvas') === 'half_canvas',
            monogram: suit
              ? {
                  font: t('jacket.monogram.font') || 'bold_script',
                  threadAsset: image('jacket.monogram.thread'),
                }
              : null,
            elbowPatches:
              t('jacket.elbowPatches') === 'personalizado'
                ? { asset: image('jacket.elbowPatches.colour') }
                : null,
            neckLining:
              t('jacket.neckLining') === 'personalizado'
                ? { asset: image('jacket.neckLining.colour') }
                : null,
            pocketSquare: accessory('jacket.pocketSquare', 'jacket.pocketSquare.product'),
          },
    trousers: {
      color: suit ? null : '#56524b',
      fit: t('trousers.fit') === 'fit' ? 'slim' : 'normal',
      length: t('trousers.length') || 'long',
      break: t('trousers.break') || 'half',
      pleats: Number(t('trousers.pleats') || 0),
      fastening: t('trousers.fastening') || (suit ? '1' : '0'),
      frontPocket: t('trousers.frontPocket') || 'diagonal',
      backPocket: t('trousers.backPocket') || 'A1',
      cuffs: t('trousers.cuffs') === '1',
      suspenderButtons: t('trousers.suspenderButtons') === '1',
      waist: t('trousers.waist') || '0',
      belt: t('trousers.belt') === 'personalizado',
      braces: t('trousers.braces') === 'personalizado',
    },
    vest: render.parts.includes('vest')
      ? {
          style: t('vest.style') || 'simple_5',
          lapel: t('vest.lapel') || 'no',
          bottom: t('vest.bottom') || 'cut',
          chestPocket: t('vest.chestPocket') === '1',
          pockets: t('vest.pockets') || '2',
        }
      : null,
    shirt: {
      collar: t('shirt.collar') === 'point' ? ('Point' as const) : ('Spread' as const),
      cuffs: t('shirt.cuffs') === 'french' ? ('French' as const) : ('Button' as const),
    },
    tie: accessory('tie.on', 'tie.product'),
    bowtie: accessory('bowtie.on', 'bowtie.product'),
    shoes: t('shoes.on') === 'personalizado' ? t('shoes.product') : '',
    socks: accessory('socks.on', 'socks.product'),
  };
}

/**
 * Shoe colour and shape per `shoes.product` token, read from the supplied
 * product names (black oxford, brown loafer, white sneaker, Chelsea boot …).
 */
const SHOE_STYLES: Record<string, { color: string; boot: boolean; sneaker: boolean }> = {
  '145391': { color: '#1f1d1b', boot: false, sneaker: false },
  '275802': { color: '#1f1d1b', boot: false, sneaker: false },
  '300077': { color: '#5b3a24', boot: false, sneaker: false },
  '398342': { color: '#5b3a24', boot: false, sneaker: false },
  '876664': { color: '#ece9e1', boot: false, sneaker: true },
  '999484': { color: '#5b3a24', boot: false, sneaker: false },
  '1050838': { color: '#1f1d1b', boot: true, sneaker: false },
};
const DEFAULT_SHOE = { color: '#1f1d1b', boot: false, sneaker: false };

export function shoeStyle(token: string) {
  return SHOE_STYLES[token] ?? DEFAULT_SHOE;
}
