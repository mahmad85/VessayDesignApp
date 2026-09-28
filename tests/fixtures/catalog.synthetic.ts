import type {
  CatalogSnapshot,
  SnapshotAttribute,
  SnapshotGroup,
  SnapshotValue,
} from '../../src/modules/catalog/snapshot';

// SYNTHETIC catalog snapshot for tests. Every code, name, price and fabric fact
// here is invented for testing and must never be used as catalog data. It holds:
// - suit (jacket, trousers, optional vest), shirt and blazer (jacket with
//   product settings), sharing one jacket component;
// - every condition type: all, any, not, attr/in, attr/answered,
//   component/included, material codes, material lookup and product;
// - the PRICING.md E1–E7 fixture: band B, suit B = 79900, syn-navy in band B,
//   syn-unpriced without a band, vest 10000, lining group 1600, lining fabric
//   98 = 900, working buttonholes 1 = 1000, peak lapel 0.

export const SYN = {
  suit: 'suit',
  shirt: 'shirt',
  blazer: 'blazer',
  navy: 'syn-navy',
  unpriced: 'syn-unpriced',
  linen: 'syn-linen',
  poplin: 'syn-poplin',
  lapelGroup: 'style.jacket.jacket_lapel_type_combinated',
  lapel: 'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type',
  sleeveGroup: 'style.jacket.jacket_sleeve_buttons_combinated',
  buttonholes: 'style.jacket.jacket_sleeve_buttons_combinated.jacket-sleeve-buttonholes',
  ventGroup: 'style.jacket.jacket_vent',
  vent: 'style.jacket.jacket_vent.jacket-vent',
  liningGroup: 'accents.jacket.lining',
  lining: 'accents.jacket.lining.internal-lining',
  liningFabric: 'accents.jacket.lining.lining-fabrics',
  liningPiping: 'accents.jacket.lining.lining-piping',
  initialsGroup: 'accents.jacket.initials',
  initials: 'accents.jacket.initials.initials-text',
  thread: 'accents.jacket.initials.thread-colour',
  tieGroup: 'accents.jacket.tie',
  tie: 'accents.jacket.tie.necktie',
  cuffGroup: 'style.pants.pants_cuff',
  cuff: 'style.pants.pants_cuff.pants-cuff',
  vestBottomGroup: 'style.vest.waistcoat_bottom',
  vestBottom: 'style.vest.waistcoat_bottom.waistcoat-bottom',
  collarGroup: 'style.shirt.shirt_collar',
  collar: 'style.shirt.shirt_collar.shirt-collar',
  template: 'syn-wedding-navy',
} as const;

const value = (
  code: string,
  label: string,
  sort: number,
  extra: Partial<SnapshotValue> = {},
): SnapshotValue => ({
  code,
  label,
  description: '',
  imageMediaId: null,
  surchargeMinor: 0,
  supplierCode: `SYN-${code.toUpperCase()}`,
  visualToken: null,
  isOff: false,
  sort,
  metadata: {},
  referenceOnly: false,
  ...extra,
});
const attribute = (
  code: string,
  name: string,
  sort: number,
  values: SnapshotValue[],
  extra: Partial<SnapshotAttribute> = {},
): SnapshotAttribute => ({
  code,
  name,
  helpText: '',
  inputType: 'choice',
  required: true,
  textRules: null,
  visualSlot: null,
  surchargeMinor: 0,
  visibleWhen: null,
  sort,
  metadataFields: [],
  defaultValueCode: null,
  referenceOnly: false,
  legacyKey: null,
  values,
  ...extra,
});
const group = (
  code: string,
  name: string,
  kind: 'style' | 'accent',
  focusRegion: string,
  sort: number,
  attributes: SnapshotAttribute[],
  extra: Partial<SnapshotGroup> = {},
): SnapshotGroup => ({
  code,
  name,
  shortName: name,
  description: '',
  kind,
  lineKind: 'construction',
  iconMediaId: null,
  focusRegion,
  surchargeMinor: 0,
  visibleWhen: null,
  sort,
  referenceOnly: false,
  metadata: {},
  attributes,
  ...extra,
});
const media = (id: string, alt: string) => ({
  id,
  url: `/synthetic/${id}.png`,
  contentType: 'image/png' as const,
  width: 256,
  height: 256,
  alt,
  rightsStatus: 'owned' as const,
});
const material = (
  code: string,
  name: string,
  extra: Partial<CatalogSnapshot['materials'][number]>,
): CatalogSnapshot['materials'][number] => ({
  code,
  name,
  colourName: name,
  colourFamily: null,
  primaryHex: '#25374b',
  secondaryHex: null,
  pattern: 'solid',
  renderPattern: 'plain',
  weave: null,
  texture: null,
  sheen: null,
  finishes: [],
  composition: [],
  weightGsm: null,
  superNumber: null,
  yarnCount: null,
  widthCm: null,
  stretch: null,
  seasons: [],
  climates: [],
  occasions: [],
  formality: null,
  wrinkleResistance: null,
  breathability: null,
  opacity: null,
  drape: null,
  care: [],
  descriptionShort: 'SYNTHETIC test fabric.',
  story: '',
  tags: [],
  usages: ['shell'],
  productCodes: [SYN.blazer, SYN.suit],
  priceBand: 'B',
  priceOverrides: {},
  media: [{ mediaId: `media-${code}`, role: 'swatch', sort: 0 }],
  textureScaleCm: null,
  referenceOnly: false,
  supplier: { id: 'syn-supplier-1', name: 'SYNTHETIC Mill', articleCode: `ART-${code}` },
  millName: 'SYNTHETIC Mill',
  displayMillName: false,
  collection: null,
  seasonCode: null,
  ...extra,
});

export type SyntheticOptions = {
  /** E5: `material_price_overrides[syn-navy][suit]`. */
  navyOverrideForSuit?: number;
};

/** A fresh SYNTHETIC snapshot (safe to mutate in a test). */
export function syntheticSnapshot(options: SyntheticOptions = {}): CatalogSnapshot {
  const vestIncluded = { component: 'vest', included: true };
  return {
    schemaVersion: 1,
    version: 0,
    publishedAt: '',
    referenceOnly: false,
    currency: 'USD',
    settings: {
      shippingFlatMinor: 0,
      quoteTtlMinutes: 10080,
      orderNumberPrefix: 'VS',
      shipCountries: ['US'],
    },
    lookups: {
      occasion: [
        { code: 'office', label: 'Office', description: '', sort: 1, metadata: {} },
        { code: 'wedding', label: 'Wedding', description: '', sort: 2, metadata: {} },
      ],
      climate: [
        { code: 'warm', label: 'Warm', description: '', sort: 1, metadata: {} },
        { code: 'all_season', label: 'All season', description: '', sort: 2, metadata: {} },
        { code: 'cool', label: 'Cool', description: '', sort: 3, metadata: {} },
      ],
      colour_family: [
        { code: 'navy', label: 'Navy', description: '', sort: 1, metadata: { hex: '#1f2a44' } },
        { code: 'beige', label: 'Beige', description: '', sort: 2, metadata: { hex: '#d9c7a7' } },
        { code: 'white', label: 'White', description: '', sort: 3, metadata: { hex: '#ffffff' } },
        { code: 'grey', label: 'Grey', description: '', sort: 4, metadata: { hex: '#808080' } },
      ],
      pattern: [
        {
          code: 'solid',
          label: 'Solid',
          description: '',
          sort: 1,
          metadata: { renderPattern: 'plain' },
        },
        {
          code: 'twill',
          label: 'Twill',
          description: '',
          sort: 2,
          metadata: { renderPattern: 'twill' },
        },
        {
          code: 'windowpane',
          label: 'Windowpane',
          description: '',
          sort: 3,
          metadata: { renderPattern: 'check' },
        },
      ],
      weave: [
        { code: 'plain', label: 'Plain', description: '', sort: 1, metadata: {} },
        { code: 'twill', label: 'Twill', description: '', sort: 2, metadata: {} },
      ],
      fibre: [
        { code: 'wool', label: 'Wool', description: '', sort: 1, metadata: {} },
        { code: 'linen', label: 'Linen', description: '', sort: 2, metadata: {} },
        { code: 'cotton', label: 'Cotton', description: '', sort: 3, metadata: {} },
      ],
      stretch: [{ code: 'none', label: 'None', description: '', sort: 1, metadata: {} }],
    },
    priceBands: [{ code: 'B', name: 'Band B', sort: 2 }],
    media: Object.fromEntries(
      [
        media('media-syn-navy', 'SYNTHETIC navy swatch'),
        media('media-syn-unpriced', 'SYNTHETIC grey swatch'),
        media('media-syn-linen', 'SYNTHETIC linen swatch'),
        media('media-syn-poplin', 'SYNTHETIC poplin swatch'),
        media('media-template-hero', 'SYNTHETIC wedding look'),
        media('media-peak', 'SYNTHETIC peak lapel'),
      ].map((item) => [item.id, item]),
    ),
    components: [
      {
        code: 'jacket',
        name: 'Jacket',
        description: '',
        visualPart: 'jacket',
        sort: 1,
        referenceOnly: false,
        groups: [
          group('style.jacket.jacket_lapel_type_combinated', 'Lapels', 'style', 'collar', 1, [
            attribute(
              SYN.lapel,
              'Lapel style',
              1,
              [
                value('standard', 'Notch', 1, { visualToken: 'standard' }),
                value('peak', 'Peak', 2, { visualToken: 'peak', imageMediaId: 'media-peak' }),
              ],
              { defaultValueCode: 'standard', visualSlot: 'jacket.lapelType' },
            ),
          ]),
          group('style.jacket.jacket_sleeve_buttons_combinated', 'Sleeve', 'style', 'sleeve', 2, [
            attribute(
              SYN.buttonholes,
              'Buttonholes',
              1,
              [
                value('1', 'Working buttonholes', 1, { surchargeMinor: 1000, visualToken: '1' }),
                value('0', 'No', 2, { visualToken: '0' }),
              ],
              { defaultValueCode: '0', visualSlot: 'jacket.sleeveHoles' },
            ),
          ]),
          group(
            SYN.ventGroup,
            'Back',
            'style',
            'vent',
            3,
            [
              attribute(
                SYN.vent,
                'Back style',
                1,
                [
                  value('0', 'No vent', 1, { visualToken: '0' }),
                  value('1', 'Single vent', 2, { visualToken: '1' }),
                  value('2', 'Double vents', 3, { visualToken: '2' }),
                ],
                { defaultValueCode: '1', visualSlot: 'jacket.vent' },
              ),
            ],
            { visibleWhen: { product: [SYN.suit] } },
          ),
          group(
            SYN.liningGroup,
            'Lining',
            'accent',
            'inside',
            101,
            [
              attribute(
                SYN.lining,
                'Internal lining',
                1,
                [
                  value('default', 'Standard', 1, { isOff: true, visualToken: 'default' }),
                  value('personalizado', 'Custom', 2, { visualToken: 'personalizado' }),
                ],
                { defaultValueCode: 'default', visualSlot: 'jacket.lining' },
              ),
              attribute(
                SYN.liningFabric,
                'Lining fabrics',
                2,
                [
                  value('98', 'Berck', 1, {
                    surchargeMinor: 900,
                    metadata: { tone: 'blue', referencePrice: '20', sourceLabel: 'Berck' },
                  }),
                  value('116', 'Wall Street', 2, { metadata: { tone: 'blue' } }),
                ],
                {
                  visibleWhen: { attr: SYN.lining, in: ['personalizado'] },
                  metadataFields: [
                    { key: 'tone', label: 'Tone', type: 'text', lookupType: null, required: false },
                  ],
                },
              ),
              attribute(
                SYN.liningPiping,
                'Lining piping',
                3,
                [
                  value('none', 'None', 1, { isOff: true }),
                  value('contrast', 'Contrast piping', 2),
                ],
                {
                  defaultValueCode: 'none',
                  visibleWhen: {
                    all: [
                      { attr: SYN.lining, in: ['personalizado'] },
                      {
                        any: [
                          { material: { lookup: { field: 'colourFamily', in: ['navy'] } } },
                          { material: { codes: [SYN.linen] } },
                        ],
                      },
                    ],
                  },
                },
              ),
            ],
            { surchargeMinor: 1600 },
          ),
          group(SYN.initialsGroup, 'Monogram', 'accent', 'monogram', 102, [
            attribute(SYN.initials, 'Initials', 1, [], {
              inputType: 'text',
              required: false,
              surchargeMinor: 1000,
              textRules: {
                maxLength: 3,
                pattern: '^[A-Za-z.]*$',
                transform: 'upper',
                placeholder: 'ABC',
              },
            }),
            attribute(
              SYN.thread,
              'Thread colour',
              2,
              [value('navy', 'Navy thread', 1), value('gold', 'Gold thread', 2)],
              { defaultValueCode: 'navy', visibleWhen: { attr: SYN.initials, answered: true } },
            ),
          ]),
          group(
            SYN.tieGroup,
            'Necktie',
            'accent',
            'collar',
            103,
            [
              attribute(
                SYN.tie,
                'Necktie',
                1,
                [value('without', 'None', 1, { isOff: true }), value('personalizado', 'Added', 2)],
                { defaultValueCode: 'without' },
              ),
            ],
            {
              lineKind: 'accessory',
              visibleWhen: {
                not: { material: { lookup: { field: 'pattern', in: ['windowpane'] } } },
              },
            },
          ),
        ],
      },
      {
        code: 'trousers',
        name: 'Trousers',
        description: '',
        visualPart: 'trousers',
        sort: 2,
        referenceOnly: false,
        groups: [
          group(SYN.cuffGroup, 'Cuffs', 'style', 'hem', 1, [
            attribute(
              SYN.cuff,
              'Pant cuffs',
              1,
              [
                value('0', 'No cuffs', 1, { visualToken: '0' }),
                value('1', 'Cuffs', 2, { visualToken: '1' }),
              ],
              { defaultValueCode: '0', visualSlot: 'trousers.cuffs' },
            ),
          ]),
        ],
      },
      {
        code: 'vest',
        name: 'Vest',
        description: '',
        visualPart: 'vest',
        sort: 3,
        referenceOnly: false,
        groups: [
          group(
            SYN.vestBottomGroup,
            'Edge',
            'style',
            'vest',
            1,
            [
              attribute(
                SYN.vestBottom,
                'Edge',
                1,
                [
                  value('straight', 'Straight', 1, { visualToken: 'straight' }),
                  value('cut', 'Cut', 2, { visualToken: 'cut' }),
                ],
                { defaultValueCode: 'cut', visualSlot: 'vest.bottom' },
              ),
            ],
            { visibleWhen: vestIncluded },
          ),
        ],
      },
      {
        code: 'shirt',
        name: 'Shirt',
        description: '',
        visualPart: 'shirt',
        sort: 4,
        referenceOnly: false,
        groups: [
          group(SYN.collarGroup, 'Collar', 'style', 'collar', 1, [
            attribute(
              SYN.collar,
              'Collar',
              1,
              [
                value('spread', 'Spread', 1, { visualToken: 'spread' }),
                value('point', 'Point', 2, { visualToken: 'point' }),
              ],
              { defaultValueCode: 'spread', visualSlot: 'shirt.collar' },
            ),
          ]),
        ],
      },
    ],
    products: [
      {
        code: SYN.suit,
        name: 'SYNTHETIC two-piece suit',
        shortLabel: 'Suit',
        description: '',
        sort: 1,
        heroMediaId: null,
        measurementSet: 'suit',
        visualModel: 'suit',
        defaultMaterialCode: SYN.navy,
        referenceOnly: false,
        components: [
          {
            componentCode: 'jacket',
            required: true,
            defaultIncluded: true,
            surchargeMinor: 0,
            includeLabel: null,
            sort: 1,
            metadata: {},
          },
          {
            componentCode: 'trousers',
            required: true,
            defaultIncluded: true,
            surchargeMinor: 0,
            includeLabel: null,
            sort: 2,
            metadata: {},
          },
          {
            componentCode: 'vest',
            required: false,
            defaultIncluded: false,
            surchargeMinor: 10000,
            includeLabel: 'Add a vest',
            sort: 3,
            metadata: {},
          },
        ],
        bandPrices: { B: 79900 },
        settings: { groups: {}, attributes: {}, values: {} },
      },
      {
        code: SYN.shirt,
        name: 'SYNTHETIC dress shirt',
        shortLabel: 'Shirt',
        description: '',
        sort: 2,
        heroMediaId: null,
        measurementSet: 'shirt',
        visualModel: 'shirt',
        defaultMaterialCode: SYN.poplin,
        referenceOnly: false,
        components: [
          {
            componentCode: 'shirt',
            required: true,
            defaultIncluded: true,
            surchargeMinor: 0,
            includeLabel: null,
            sort: 1,
            metadata: {},
          },
        ],
        bandPrices: { B: 12900 },
        settings: { groups: {}, attributes: {}, values: {} },
      },
      {
        code: SYN.blazer,
        name: 'SYNTHETIC blazer',
        shortLabel: 'Blazer',
        description: '',
        sort: 3,
        heroMediaId: null,
        measurementSet: 'blazer',
        visualModel: 'blazer',
        defaultMaterialCode: SYN.navy,
        referenceOnly: false,
        components: [
          {
            componentCode: 'jacket',
            required: true,
            defaultIncluded: true,
            surchargeMinor: 0,
            includeLabel: null,
            sort: 1,
            metadata: {},
          },
        ],
        bandPrices: { B: 59900 },
        settings: {
          groups: {
            [SYN.liningGroup]: { available: false, surchargeOverrideMinor: null },
            [SYN.initialsGroup]: { available: false, surchargeOverrideMinor: null },
            [SYN.tieGroup]: { available: false, surchargeOverrideMinor: null },
          },
          attributes: {
            [SYN.buttonholes]: {
              available: true,
              defaultValueCode: '1',
              surchargeOverrideMinor: null,
            },
          },
          values: {
            [`${SYN.buttonholes}::1`]: { available: true, surchargeOverrideMinor: 500 },
          },
        },
      },
    ],
    materials: [
      material(SYN.linen, 'SYNTHETIC sand linen', {
        colourFamily: 'beige',
        primaryHex: '#b4a184',
        composition: [{ fibre: 'linen', percent: 100 }],
        climates: ['warm'],
        media: [{ mediaId: 'media-syn-linen', role: 'swatch', sort: 0 }],
      }),
      material(SYN.navy, 'SYNTHETIC midnight navy', {
        colourFamily: 'navy',
        pattern: 'twill',
        renderPattern: 'twill',
        weave: 'twill',
        composition: [{ fibre: 'wool', percent: 100 }],
        weightGsm: 260,
        superNumber: 120,
        climates: ['all_season', 'cool'],
        media: [{ mediaId: 'media-syn-navy', role: 'swatch', sort: 0 }],
        priceOverrides:
          options.navyOverrideForSuit === undefined
            ? {}
            : { [SYN.suit]: options.navyOverrideForSuit },
      }),
      material(SYN.poplin, 'SYNTHETIC white poplin', {
        colourFamily: 'white',
        primaryHex: '#f4f4f0',
        composition: [{ fibre: 'cotton', percent: 100 }],
        usages: ['shirting'],
        productCodes: [SYN.shirt],
        media: [{ mediaId: 'media-syn-poplin', role: 'swatch', sort: 0 }],
      }),
      material(SYN.unpriced, 'SYNTHETIC unpriced grey', {
        colourFamily: 'grey',
        primaryHex: '#808080',
        priceBand: null,
        media: [{ mediaId: 'media-syn-unpriced', role: 'swatch', sort: 0 }],
      }),
    ],
    rules: [
      {
        code: 'syn-no-peak-on-linen',
        name: 'SYNTHETIC: no peak lapels on linen',
        productCodes: [SYN.suit],
        when: { material: { codes: [SYN.linen] } },
        effect: 'forbid',
        attributeCode: SYN.lapel,
        valueCodes: ['peak'],
        message: 'Peak lapels are not offered on this linen.',
      },
      {
        code: 'syn-vest-cut-with-peak',
        name: 'SYNTHETIC: a vest with peak lapels has a cut edge',
        productCodes: [],
        when: {
          all: [
            { component: 'vest', included: true },
            { attr: SYN.lapel, in: ['peak'] },
          ],
        },
        effect: 'require',
        attributeCode: SYN.vestBottom,
        valueCodes: ['cut'],
        message: 'With peak lapels, the vest has a cut edge.',
      },
    ],
    templates: [
      {
        code: SYN.template,
        productCode: SYN.suit,
        name: 'SYNTHETIC wedding navy',
        subtitle: 'Three-piece with peak lapels',
        description: '',
        story: '',
        materialCode: SYN.navy,
        includedComponents: ['jacket', 'trousers', 'vest'],
        selections: { [SYN.lapel]: 'peak' },
        occasions: ['wedding'],
        climates: ['all_season'],
        featured: true,
        sort: 1,
        heroMediaId: 'media-template-hero',
        galleryMediaIds: [],
        asShownPriceMinor: null,
        referenceOnly: false,
      },
    ],
  };
}

/** A garment-like configuration for PRICING.md worked examples. */
export type PricingExample = {
  id: 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7';
  options: SyntheticOptions;
  materialCode: string;
  includedComponents: string[];
  selections: Record<string, string>;
  quantity: number;
  expected:
    | {
        status: 'priced';
        unitMinor: number;
        totalMinor: number;
        byCategory?: Record<string, number>;
      }
    | { status: 'unavailable'; reasons: string[] };
};

const suitDefaults = {
  [SYN.lapel]: 'standard',
  [SYN.buttonholes]: '0',
  [SYN.vent]: '1',
  [SYN.lining]: 'default',
  [SYN.liningPiping]: 'none',
  [SYN.thread]: 'navy',
  [SYN.tie]: 'without',
  [SYN.cuff]: '0',
  [SYN.vestBottom]: 'cut',
};
const e3Selections = {
  ...suitDefaults,
  [SYN.lining]: 'personalizado',
  [SYN.liningFabric]: '98',
  [SYN.buttonholes]: '1',
  [SYN.lapel]: 'peak',
};

export const PRICING_EXAMPLES: PricingExample[] = [
  {
    id: 'E1',
    options: {},
    materialCode: SYN.navy,
    includedComponents: ['jacket', 'trousers'],
    selections: suitDefaults,
    quantity: 1,
    expected: { status: 'priced', unitMinor: 79900, totalMinor: 79900 },
  },
  {
    id: 'E2',
    options: {},
    materialCode: SYN.navy,
    includedComponents: ['jacket', 'trousers', 'vest'],
    selections: suitDefaults,
    quantity: 1,
    expected: { status: 'priced', unitMinor: 89900, totalMinor: 89900 },
  },
  {
    id: 'E3',
    options: {},
    materialCode: SYN.navy,
    includedComponents: ['jacket', 'trousers', 'vest'],
    selections: e3Selections,
    quantity: 1,
    expected: {
      status: 'priced',
      unitMinor: 93400,
      totalMinor: 93400,
      byCategory: { base: 79900, vest: 10000, jacket: 1000, accents: 2500 },
    },
  },
  {
    id: 'E4',
    options: {},
    materialCode: SYN.navy,
    includedComponents: ['jacket', 'trousers', 'vest'],
    selections: { ...e3Selections, [SYN.lining]: 'default' },
    quantity: 1,
    expected: { status: 'priced', unitMinor: 90900, totalMinor: 90900 },
  },
  {
    id: 'E5',
    options: { navyOverrideForSuit: 129900 },
    materialCode: SYN.navy,
    includedComponents: ['jacket', 'trousers', 'vest'],
    selections: e3Selections,
    quantity: 1,
    expected: { status: 'priced', unitMinor: 143400, totalMinor: 143400 },
  },
  {
    id: 'E6',
    options: {},
    materialCode: SYN.unpriced,
    includedComponents: ['jacket', 'trousers'],
    selections: suitDefaults,
    quantity: 1,
    expected: { status: 'unavailable', reasons: ['base_price_missing'] },
  },
  {
    id: 'E7',
    options: {},
    materialCode: SYN.navy,
    includedComponents: ['jacket', 'trousers', 'vest'],
    selections: e3Selections,
    quantity: 2,
    expected: { status: 'priced', unitMinor: 93400, totalMinor: 186800 },
  },
];
