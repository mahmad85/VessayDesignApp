// Builds the Lawrencepur unstitched-fabric seed from the saved storefront
// snapshot (assets/catalog-source/lawrencepur/storefront-*.json):
//   - assets/catalog-source/lawrencepur/fabrics.json  (materialInput-shaped records)
//   - migrations/0007_lawrencepur_fabrics.sql          (idempotent seed migration)
// Shalwar kameez cloth is left out: the app has no product for it. A value the
// listing states wins. Every other field gets a best-guess value from the
// per-collection PROFILES so the admin form is complete and editable. Price
// bands are a US made-to-measure positioning guess. primaryHex is the median
// colour of the cloth in the supplier's photo (measured-hex.json). Images are
// not imported. Every material stays an unpublished draft.
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'assets/catalog-source/lawrencepur';
const SOURCE = `${DIR}/storefront-2026-10-02.json`;
const source = JSON.parse(readFileSync(SOURCE, 'utf8'));
const MEASURED_HEX = JSON.parse(readFileSync(`${DIR}/measured-hex.json`, 'utf8'));

// US made-to-measure positioning. The indicative suit prices guide the admin
// who sets product band prices. This seed sets no product prices.
const BANDS = [
  ['ESS', 'Essential', 'Polyester-rich blends. Indicative US suit price about $450-550.', 1],
  [
    'CLS',
    'Classic',
    'Wool-rich blends and cotton shirting. Indicative US suit price about $600-750.',
    2,
  ],
  [
    'PRM',
    'Premium',
    'Pure wool up to Super 120s and wool-linen. Indicative US suit price about $850-1000.',
    3,
  ],
  [
    'LUX',
    'Luxury',
    'Super 140s and finer pure wool. Indicative US suit price about $1100-1400.',
    4,
  ],
];

const c = (...pairs) => pairs.map(([fibre, percent]) => ({ fibre, percent }));
const ALL = ['spring', 'summer', 'autumn', 'winter'];
const COOL = ['autumn', 'winter'];
const WARM = ['spring', 'summer'];
const SUIT = { opacity: 'high', widthCm: 150, careCodes: ['dry_clean_only', 'iron_medium'] };
const SHIRT = { opacity: 'medium', widthCm: 150, careCodes: ['machine_wash_cold', 'iron_medium'] };
// Per-collection estimates from the listing's blend name and description.
// prettier-ignore
const PROFILES = {
  Florence: { ...SUIT, composition: c(['wool', 100]), weightGsm: 250, superNumber: 140, band: 'LUX', texture: 'soft', sheen: 'subtle', drape: 'fluid', formality: 5, breathability: 'high', wrinkle: 'medium', weave: 'twill', seasons: ALL },
  Bellini: { ...SUIT, composition: c(['wool', 100]), weightGsm: 290, superNumber: 100, band: 'PRM', texture: 'smooth', sheen: 'subtle', drape: 'balanced', formality: 5, breathability: 'medium', wrinkle: 'medium', weave: 'twill', seasons: COOL },
  Gaberdine: { ...SUIT, composition: c(['wool', 100]), weightGsm: 320, superNumber: 100, band: 'PRM', texture: 'smooth', sheen: 'subtle', drape: 'structured', formality: 4, breathability: 'medium', wrinkle: 'high', weave: 'twill', seasons: ALL },
  'Exotic Black Featherlite': { ...SUIT, composition: c(['wool', 90], ['polyester', 10]), weightGsm: 260, superNumber: 100, band: 'PRM', texture: 'smooth', sheen: 'subtle', drape: 'balanced', formality: 5, breathability: 'medium', wrinkle: 'medium', weave: 'plain', seasons: ALL },
  'Ivory Premium': { ...SUIT, composition: c(['wool', 70], ['polyester', 30]), weightGsm: 270, band: 'PRM', texture: 'smooth', sheen: 'lustrous', drape: 'balanced', formality: 5, breathability: 'medium', wrinkle: 'high', weave: 'twill', seasons: ALL },
  'Superior Serge': { ...SUIT, composition: c(['wool', 100]), weightGsm: 340, superNumber: 70, band: 'PRM', texture: 'smooth', sheen: 'matte', drape: 'structured', formality: 4, breathability: 'medium', wrinkle: 'high', weave: 'twill', seasons: COOL },
  Linwool: { ...SUIT, composition: c(['wool', 55], ['linen', 45]), weightGsm: 260, band: 'PRM', texture: 'slubby', sheen: 'matte', drape: 'balanced', formality: 3, breathability: 'high', wrinkle: 'low', weave: 'plain', seasons: WARM },
  Dedum: { ...SUIT, composition: c(['wool', 50], ['polyester', 47], ['elastane', 3]), weightGsm: 280, band: 'CLS', texture: 'soft', sheen: 'matte', drape: 'balanced', formality: 4, breathability: 'medium', wrinkle: 'high', weave: 'twill', seasons: ALL, stretch: 'elastane', finishes: ['natural_stretch'] },
  'Worsted Tweed': { ...SUIT, composition: c(['wool', 55], ['polyester', 45]), weightGsm: 340, band: 'CLS', texture: 'textured', sheen: 'matte', drape: 'structured', formality: 3, breathability: 'medium', wrinkle: 'high', weave: 'twill', seasons: COOL },
  'Worsted Flannel': { ...SUIT, composition: c(['wool', 45], ['polyester', 55]), weightGsm: 320, band: 'CLS', texture: 'soft', sheen: 'matte', drape: 'structured', formality: 4, breathability: 'medium', wrinkle: 'high', weave: 'twill', seasons: COOL, finishes: ['brushed', 'milled'] },
  'Tropical Exclusive': { ...SUIT, composition: c(['wool', 45], ['polyester', 55]), weightGsm: 250, band: 'CLS', texture: 'smooth', sheen: 'subtle', drape: 'balanced', formality: 4, breathability: 'high', wrinkle: 'high', weave: 'plain', seasons: ALL },
  'Super Fine': { ...SUIT, composition: c(['wool', 55], ['polyester', 45]), weightGsm: 260, band: 'CLS', texture: 'smooth', sheen: 'subtle', drape: 'balanced', formality: 4, breathability: 'medium', wrinkle: 'high', weave: 'plain', seasons: ALL },
  Vicunna: { ...SUIT, composition: c(['wool', 40], ['polyester', 60]), weightGsm: 360, band: 'CLS', texture: 'smooth', sheen: 'matte', drape: 'structured', formality: 4, breathability: 'low', wrinkle: 'high', weave: 'twill', seasons: COOL },
  'Tropical Classic': { ...SUIT, composition: c(['wool', 35], ['polyester', 65]), weightGsm: 260, band: 'ESS', texture: 'smooth', sheen: 'subtle', drape: 'balanced', formality: 3, breathability: 'medium', wrinkle: 'high', weave: 'plain', seasons: ALL },
  'Centurian Classic': { ...SUIT, composition: c(['wool', 35], ['polyester', 65]), weightGsm: 280, band: 'ESS', texture: 'smooth', sheen: 'subtle', drape: 'balanced', formality: 3, breathability: 'medium', wrinkle: 'high', weave: 'plain', seasons: ALL },
  Featherlight: { ...SUIT, composition: c(['wool', 30], ['polyester', 70]), weightGsm: 220, band: 'ESS', texture: 'smooth', sheen: 'subtle', drape: 'fluid', formality: 3, breathability: 'high', wrinkle: 'high', weave: 'plain', seasons: ['spring', 'summer', 'autumn'] },
  'Panama Classic': { ...SUIT, composition: c(['wool', 30], ['polyester', 70]), weightGsm: 280, band: 'ESS', texture: 'smooth', sheen: 'subtle', drape: 'balanced', formality: 3, breathability: 'medium', wrinkle: 'high', weave: 'plain', seasons: ALL },
  Riviera: { ...SUIT, composition: c(['wool', 30], ['polyester', 70]), weightGsm: 260, band: 'ESS', texture: 'smooth', sheen: 'subtle', drape: 'balanced', formality: 4, breathability: 'medium', wrinkle: 'high', weave: 'plain', seasons: ALL },
  Estash: { ...SUIT, composition: c(['polyester', 60], ['viscose', 30], ['wool', 10]), weightGsm: 250, band: 'ESS', texture: 'soft', sheen: 'subtle', drape: 'fluid', formality: 3, breathability: 'medium', wrinkle: 'medium', weave: 'plain', seasons: ALL },
  Lyla: { ...SUIT, composition: c(['polyester', 80], ['wool', 20]), weightGsm: 300, band: 'ESS', texture: 'soft', sheen: 'matte', drape: 'balanced', formality: 2, breathability: 'low', wrinkle: 'high', weave: 'plain', seasons: COOL },
  Alpha: { ...SHIRT, composition: c(['cotton', 100]), weightGsm: 115, band: 'CLS', texture: 'crisp', sheen: 'subtle', drape: 'fluid', formality: 4, breathability: 'high', wrinkle: 'low', weave: 'poplin', seasons: ALL },
  Bravo: { ...SHIRT, composition: c(['cotton', 100]), weightGsm: 120, band: 'CLS', texture: 'crisp', sheen: 'subtle', drape: 'fluid', formality: 4, breathability: 'high', wrinkle: 'low', weave: 'dobby', seasons: ALL },
};
// Listings that name no colour, identified by looking at their supplier photos.
const PHOTO_OVERRIDES = {
  9366662676737: { colourName: 'Navy Blue', colourFamilyCode: 'navy', patternCode: 'windowpane' },
  9366662578433: { colourName: 'Black', colourFamilyCode: 'black', patternCode: 'solid' },
  9366662512897: {
    colourName: 'Charcoal Grey',
    colourFamilyCode: 'charcoal',
    patternCode: 'solid',
  },
};
const OCCASIONS = {
  5: ['office', 'wedding', 'formal_event'],
  4: ['office', 'formal_event', 'wedding'],
  3: ['office', 'everyday'],
  2: ['everyday'],
};
const climateFor = (seasons) =>
  seasons.length === 4 ? ['all_season'] : seasons.includes('summer') ? ['warm'] : ['cool'];

const FAMILY_HEX = {
  black: '#1a1a1a',
  charcoal: '#36393d',
  grey: '#8a8d91',
  navy: '#1f2a44',
  blue: '#2f5d9e',
  light_blue: '#a9c7e4',
  green: '#2f5e3d',
  olive: '#6b6a3a',
  brown: '#5b3a24',
  tan: '#b58b5e',
  beige: '#d6c6a8',
  cream: '#efe6cf',
  white: '#f7f7f4',
  burgundy: '#6a1f2e',
  red: '#b3262e',
  pink: '#e3a6b4',
  purple: '#5a3d78',
  yellow: '#e2c14b',
  orange: '#d9772b',
  multi: '#9a9a9a',
};
// First match wins, so specific phrases precede the single words they contain.
const COLOURS = [
  [/multi ?colou?r|multi/, 'multi'],
  [/charcoal/, 'charcoal'],
  [/navy|midnight blue|prussian blue|admiral blue/, 'navy'],
  [/sky blue|light blue|ice blue|powder blue/, 'light_blue'],
  [/ferozi|turquoise|teal|peacock blue/, 'blue'],
  [/blue/, 'blue'],
  [/sage|olive/, 'olive'],
  [/green/, 'green'],
  [/off ?white|cream|ivory/, 'cream'],
  [/white/, 'white'],
  [/beige|fawn|khaki|sand|almond|ecr[ou]/, 'beige'],
  [/camel|tan|golden brown|biscuit/, 'tan'],
  [/brown|chocolate|coffee|walnut|cedar|rust|cherrywood|copper|mocha|taupe/, 'brown'],
  [/maroon|burgundy|wine/, 'burgundy'],
  [/tea pink|pink|rose/, 'pink'],
  [/red/, 'red'],
  [/purple|lilac|mauve|plum/, 'purple'],
  [/gold|yellow|mustard/, 'yellow'],
  [/orange/, 'orange'],
  [/black/, 'black'],
  [/grey|gray|slate|silver|melange|coin|iron|ash/, 'grey'],
];
const PATTERNS = [
  [/glen ?plaid|glen check|prince of wales/, 'glen_check'],
  [/houndstooth/, 'houndstooth'],
  [/herringbone/, 'herringbone'],
  [/bird ?s? ?eye/, 'birdseye'],
  [/windowpane/, 'windowpane'],
  [/pin ?stripe/, 'pinstripe'],
  [/chalk ?stripe/, 'chalk_stripe'],
  [/stripe/, 'pinstripe'],
  [/check|plaid/, 'check'],
  [/end on end|criss cross|dobby|textured|melange/, 'textured'],
  [/twill|serge|gaberdine|flannel/, 'twill'],
  [/plain/, 'solid'],
];
const COLOUR_WORDS =
  /\b(fabric|plain|checks?|checked|stripes?|striped|self|textured|twill|herringbone|bird eye|glen plaid|abstract|big|criss cross|end on end|dobby|melange|overcheck|winter|unstitched|for women|suiting|jacketing|trousering|shirting|blazer)\b/g;

const clean = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/;/g, ',')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const firstMatch = (table, text) => table.find(([re]) => re.test(text))?.[1] ?? null;
// Colour words must match whole words: 'textured' contains 'red', 'wash' contains 'ash'.
const word = (re) => new RegExp(`\\b(?:${re.source})\\b`);
const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…');
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function lineOf(vendor) {
  const [name, blend] = vendor.split(' - ');
  return { line: name.trim(), blend: blend?.trim() ?? null };
}
function category(p) {
  const t = `${p.productType} ${p.tags.join(' ')} ${p.title}`.toLowerCase();
  if (/women/.test(t)) return 'womenswear';
  if (/jacketing|blazer|tweed|serge|vicun/.test(t)) return 'jacketing';
  if (/trousering/.test(t)) return 'trousering';
  if (/shirting/.test(p.productType.toLowerCase()) || /shirting fabric/.test(t)) return 'shirting';
  if (/shalwar/.test(t)) return 'shalwar_kameez';
  return 'suiting';
}
// The app's products are suit, blazer and shirt. Womenswear has no product yet.
const PRODUCTS = {
  suiting: ['suit', 'blazer'],
  jacketing: ['blazer'],
  trousering: ['suit'],
  shirting: ['shirt'],
  womenswear: [],
};
const USAGES = {
  suiting: ['shell'],
  jacketing: ['shell'],
  trousering: ['shell'],
  shirting: ['shirting'],
  womenswear: ['shell'],
};
/** Percentages the listing states, or [] when it does not. */
function statedComposition(text, blend) {
  const pairs = [
    ...text.matchAll(
      /(\d{1,3})\s*%\s*(wool|polyester|polyster|lycra|spandex|elastane|viscose|cotton|linen|silk|cashmere|nylon|polyamide)/gi,
    ),
  ].map(([, n, f]) => ({ fibre: f.toLowerCase(), percent: Number(n) }));
  const alias = {
    polyster: 'polyester',
    lycra: 'elastane',
    spandex: 'elastane',
    nylon: 'polyamide',
  };
  if (pairs.length) {
    const merged = {};
    for (const { fibre, percent } of pairs) merged[alias[fibre] ?? fibre] = percent;
    const list = Object.entries(merged).map(([fibre, percent]) => ({ fibre, percent }));
    return list.reduce((s, x) => s + x.percent, 0) === 100 ? list : [];
  }
  if (/pure wool|100% wool/i.test(`${blend} ${text}`)) return [{ fibre: 'wool', percent: 100 }];
  if (/100% (pure )?cotton/i.test(text) || /^cotton$/i.test(blend ?? ''))
    return [{ fibre: 'cotton', percent: 100 }];
  return [];
}
function statedSeasons(text) {
  const t = text.toLowerCase();
  if (/all[- ]season|all[- ]weather|year-round|all seasons/.test(t)) return ALL;
  if (/winter|warm choice/.test(t)) return COOL;
  if (/summer|warm weather/.test(t)) return WARM;
  return [];
}
function colourName(title, line) {
  const t = title
    .toLowerCase()
    .replace(line.toLowerCase(), ' ')
    .replace(
      /s[- ]?\d{2,3}'?s?|super \d+'?s?|pure wool|wool blend|wool rich|merino wool|poly ?wool|lawrencepur|premium|exclusive|classic|tropical|royal hudson|exotic black|vicuna|\bblend\b|\bmini\b|windowpane|\(d\)|- unstitched/g,
      ' ',
    )
    .replace(COLOUR_WORDS, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t ? t.replace(/\b\w/g, (ch) => ch.toUpperCase()) : null;
}

const seen = new Set();
const fabrics = source.products
  .filter((p) => category(p) !== 'shalwar_kameez')
  .map((p) => {
    const text = clean(p.bodyHtml);
    const { line, blend } = lineOf(p.vendor);
    const profile = PROFILES[line];
    if (!profile) throw new Error(`No profile for collection ${line}`);
    const cat = category(p);
    const title = p.title.toLowerCase();
    const override = PHOTO_OVERRIDES[p.id] ?? {};
    // A value the listing states wins. Otherwise use the collection's estimate.
    const pick = (field, stated, estimate) =>
      stated === null || (Array.isArray(stated) && !stated.length) ? (estimate ?? null) : stated;
    const family =
      override.colourFamilyCode ??
      firstMatch(
        COLOURS.map(([re, f]) => [word(re), f]),
        title.replace(line.toLowerCase(), ' '),
      );
    const weave = /end on end/.test(title)
      ? 'end_on_end'
      : /dobby/.test(title)
        ? 'dobby'
        : /herringbone/.test(title)
          ? 'herringbone'
          : /twill|serge|gaberdine|flannel/i.test(`${title} ${text}`)
            ? 'twill'
            : /plain weave/i.test(text)
              ? 'plain'
              : null;
    const sup = `${text} ${title}`.match(/super\s*(\d{2,3})|s[- ]?(\d{2,3})'?s/i);
    const superNumber = sup ? Number(sup[1] ?? sup[2]) : null;
    const gsm = Number(text.match(/(\d{2,3})\s*gsm/i)?.[1] ?? NaN);
    const seasonCodes = pick('seasonCodes', statedSeasons(text), profile.seasons);
    const meter = p.variants.find((v) => /per met(er|re)/i.test(v.title)) ?? p.variants[0];
    let code = `lawrencepur.${slug(p.handle)}`;
    while (seen.has(code)) code += '-2';
    seen.add(code);
    return {
      id: `mat-lawrencepur-${p.id}`,
      code,
      name: p.title.replace(/\s+/g, ' ').trim(),
      status: 'draft',
      referenceOnly: true,
      supplierCode: 'lawrencepur',
      supplierArticleCode: meter.sku || null,
      millName: 'Lawrencepur',
      displayMillName: true,
      collectionName: line,
      colourName: override.colourName ?? colourName(p.title, line),
      colourFamilyCode: family,
      primaryHex: MEASURED_HEX[p.id] ?? (family ? FAMILY_HEX[family] : null),
      patternCode:
        override.patternCode ?? pick('patternCode', firstMatch(PATTERNS, title), 'solid'),
      weaveCode: pick('weaveCode', weave, profile.weave),
      textureCode: profile.texture,
      sheenCode: profile.sheen,
      finishCodes: profile.finishes ?? [],
      composition: pick('composition', statedComposition(text, blend), profile.composition),
      weightGsm: pick('weightGsm', gsm >= 60 && gsm <= 700 ? gsm : null, profile.weightGsm),
      superNumber: pick(
        'superNumber',
        superNumber >= 60 && superNumber <= 250 && superNumber % 10 === 0 ? superNumber : null,
        profile.superNumber,
      ),
      widthCm: profile.widthCm,
      stretchCode: /lycra|spandex|elastane/i.test(text) ? 'elastane' : (profile.stretch ?? 'none'),
      seasonCodes,
      climateCodes: climateFor(seasonCodes),
      occasionCodes: OCCASIONS[profile.formality],
      formality: profile.formality,
      wrinkleResistance: profile.wrinkle,
      breathability: profile.breathability,
      opacity: profile.opacity,
      drape: profile.drape,
      careCodes: /dry clean/i.test(text) ? ['dry_clean_only'] : profile.careCodes,
      descriptionShort: clip(text, 160),
      story: clip(text, 2000),
      usages: USAGES[cat],
      productCodes: PRODUCTS[cat],
      priceBandCode: profile.band,
      availability: 'unknown',
      metadata: {},
    };
  });

writeFileSync(
  `${DIR}/fabrics.json`,
  JSON.stringify(
    {
      generatedFrom: SOURCE,
      supplier: {
        code: 'lawrencepur',
        name: 'Lawrencepur',
        kind: 'fabric_mill',
        countryCode: 'PK',
        website: 'https://lawrencepur.com',
      },
      priceBands: BANDS.map(([code, name, description, sort]) => ({
        code,
        name,
        description,
        sort,
      })),
      materials: fabrics,
    },
    null,
    2,
  ) + '\n',
);

// The migration runner splits on ';', so literals must not contain one (clean() removes them).
const lit = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v === null || v === undefined ? 'NULL' : String(v));
const arr = (a) => `ARRAY[${a.map(lit).join(',')}]::text[]`;
const json = (o) => `${lit(JSON.stringify(o))}::jsonb`;
for (const f of fabrics)
  if (/;|--|\$\$|\/\*/.test(JSON.stringify(f))) throw new Error(`Unsafe SQL text in ${f.code}`);

const COLUMNS = [
  ['id', (f) => lit(f.id)],
  ['code', (f) => lit(f.code)],
  ['name', (f) => lit(f.name)],
  ['status', () => "'draft'"],
  ['supplier_article_code', (f) => lit(f.supplierArticleCode)],
  ['mill_name', (f) => lit(f.millName)],
  ['display_mill_name', () => 'true'],
  ['collection_name', (f) => lit(f.collectionName)],
  ['colour_name', (f) => lit(f.colourName)],
  ['colour_family_code', (f) => lit(f.colourFamilyCode)],
  ['primary_hex', (f) => lit(f.primaryHex)],
  ['pattern_code', (f) => lit(f.patternCode)],
  ['weave_code', (f) => lit(f.weaveCode)],
  ['texture_code', (f) => lit(f.textureCode)],
  ['sheen_code', (f) => lit(f.sheenCode)],
  ['finish_codes', (f) => arr(f.finishCodes)],
  ['composition', (f) => json(f.composition)],
  ['weight_gsm', (f) => num(f.weightGsm), 'integer'],
  ['super_number', (f) => num(f.superNumber), 'integer'],
  ['width_cm', (f) => num(f.widthCm), 'integer'],
  ['stretch_code', (f) => lit(f.stretchCode)],
  ['season_codes', (f) => arr(f.seasonCodes)],
  ['climate_codes', (f) => arr(f.climateCodes)],
  ['occasion_codes', (f) => arr(f.occasionCodes)],
  ['formality', (f) => num(f.formality), 'integer'],
  ['wrinkle_resistance', (f) => lit(f.wrinkleResistance)],
  ['breathability', (f) => lit(f.breathability)],
  ['opacity', (f) => lit(f.opacity)],
  ['drape', (f) => lit(f.drape)],
  ['care_codes', (f) => arr(f.careCodes)],
  ['description_short', (f) => lit(f.descriptionShort)],
  ['story', (f) => lit(f.story)],
  ['usages', (f) => arr(f.usages)],
  ['price_band_code', (f) => lit(f.priceBandCode)],
  ['availability', () => "'unknown'"],
  ['metadata', (f) => json(f.metadata)],
  ['reference_only', () => 'true'],
];
const names = COLUMNS.map(([name]) => name).join(', ');
const selected = COLUMNS.map(([name, , cast]) => (cast ? `${name}::${cast}` : name)).join(', ');
const rows = fabrics.map((f) => `(${COLUMNS.map(([, value]) => value(f)).join(',')})`);
const bands = BANDS.map(
  ([code, name, description, sort]) =>
    `(${[lit(code), lit(name), lit(description), sort].join(',')})`,
);
const links = fabrics.flatMap((f) => f.productCodes.map((p) => `(${lit(f.id)},${lit(p)})`));

// Reference-only drafts with a band but no product band prices. Idempotent
// (PGlite reruns every file on start): existing rows, including admin-edited
// ones with the same code, are kept. Migration files may not contain comments
// (tests/migrations.test.ts).
const sql = `INSERT INTO suppliers (id, code, name, kind, status, website, country_code, capabilities, notes) VALUES ('sup-lawrencepur', 'lawrencepur', 'Lawrencepur', 'fabric_mill', 'active', 'https://lawrencepur.com', 'PK', ARRAY['suiting','shirting','jacketing']::text[], 'Commercial terms not agreed yet.') ON CONFLICT (code) DO NOTHING;
INSERT INTO price_bands (code, name, description, sort) VALUES
${bands.join(',\n')}
ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (${names}, supplier_id)
SELECT ${selected}, (SELECT id FROM suppliers WHERE code = 'lawrencepur') FROM (VALUES
${rows.join(',\n')}
) AS v(${names}) ON CONFLICT DO NOTHING;
INSERT INTO material_products (material_id, product_id)
SELECT l.material_id, p.id FROM (VALUES
${links.join(',\n')}
) AS l(material_id, product_code) JOIN products p ON p.code = l.product_code JOIN materials m ON m.id = l.material_id ON CONFLICT DO NOTHING;
INSERT INTO audit_events (id, actor, action, entity_type, entity_id, summary) VALUES ('audit-0007-lawrencepur-fabrics', 'system:migration', 'materials.imported', 'supplier', 'sup-lawrencepur', '{"migration":"0007_lawrencepur_fabrics","materials":${fabrics.length},"referenceOnly":true}'::jsonb) ON CONFLICT (id) DO NOTHING;
`;
writeFileSync('migrations/0007_lawrencepur_fabrics.sql', sql);
console.log(`Wrote ${fabrics.length} materials, ${links.length} product links.`);
