import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { importLegacyCatalog, nameBasedId } from '../src/modules/catalog/import-legacy';
import { indexSnapshot, valueKey } from '../src/modules/catalog/snapshot';
import { snapshotChecksum } from '../src/modules/catalog/snapshot-checksum';
import { SUIT_CUSTOMIZATION_SEED } from '../src/modules/catalog/suit-customization';
import { FABRICS, PRODUCTS } from '../src/modules/catalog/catalog';
import { LEGACY_KEYS } from '../src/modules/catalog/legacy-mapping';
import { LOOKUP_TYPES } from '../src/modules/catalog/lookup-seeds';
import { referenceSwatchPath, referenceSwatchSvg } from '../src/modules/catalog/reference-swatches';
import { isRegionId, isSlotId, isTokenOf, slotForKey } from '../src/visualization/registry';

// CATALOG-ADMIN.md §10. The imported data is the user-supplied reference seed
// (D-014), not synthetic; it stays reference-only.

const { snapshot, lookupTypes } = importLegacyCatalog();
const index = indexSnapshot(snapshot);
const seedSections = SUIT_CUSTOMIZATION_SEED.menus.flatMap((menu) =>
  menu.categories.flatMap((category) =>
    category.groups.flatMap((group) =>
      group.sections.map((section) => ({ menu, category, group, section })),
    ),
  ),
);
const ARCHIVED_GROUPS = new Set(['style.pants.pants_chinos', 'style.vest.waistcoat_wedding']);
const allValues = snapshot.components.flatMap((component) =>
  component.groups.flatMap((group) =>
    group.attributes.flatMap((attribute) =>
      attribute.values.map((value) => ({ attribute, value })),
    ),
  ),
);

describe('legacy catalog import', () => {
  it('is deterministic: two runs give identical snapshots and checksums', () => {
    const again = importLegacyCatalog();
    expect(snapshotChecksum(again.snapshot)).toBe(snapshotChecksum(snapshot));
    expect(again.snapshot).toEqual(snapshot);
    expect(snapshot.version).toBe(0);
    expect(snapshot.publishedAt).toBe('');
  });

  it('imports all 434 seed choices, less only the documented archived placeholders', () => {
    let archived = 0;
    for (const { menu, category, group, section } of seedSections) {
      const groupCode = `${menu.id}.${category.id}.${group.id}`;
      for (const option of section.options) {
        const imported = index.values.get(valueKey(section.selectionKey, option.value));
        if (ARCHIVED_GROUPS.has(groupCode) || section.selectionKey === LEGACY_KEYS.vest) {
          expect(imported, `${section.selectionKey}=${option.value}`).toBeUndefined();
          archived++;
        } else expect(imported, `${section.selectionKey}=${option.value}`).toBeDefined();
      }
    }
    expect(SUIT_CUSTOMIZATION_SEED.optionCount).toBe(434);
    expect(archived).toBe(6);
    // 428 seed choices + shirt fit (3), collar (2) and cuffs (2) + the relaxed jacket fit.
    expect(allValues).toHaveLength(428 + 7 + 1);
    expect(index.values.get(valueKey(LEGACY_KEYS.jacketFit, 'relaxed'))?.value).toMatchObject({
      label: 'Relaxed',
      visualToken: 'relaxed',
    });
  });

  it('keeps every seed selection key as the option code and legacy key', () => {
    const seedKeys = new Set(seedSections.map(({ section }) => section.selectionKey));
    for (const [code, { attribute }] of index.attributes) {
      if (code.startsWith('style.shirt.')) {
        expect(attribute.legacyKey, code).toBeNull();
        continue;
      }
      expect(seedKeys.has(code), code).toBe(true);
      expect(attribute.legacyKey, code).toBe(code);
    }
    expect(index.attributes.size).toBe(66 - 3 + 3);
  });

  it('keeps today’s group ids, readable names, focus regions and line kinds', () => {
    expect(index.groups.get('style.jacket.jacket_fit')?.group).toMatchObject({
      name: 'Fit',
      kind: 'style',
      focusRegion: 'torso',
      lineKind: 'construction',
    });
    expect(index.groups.get('accents.jacket.lining')?.group).toMatchObject({
      name: 'Internal lining',
      shortName: 'Lining',
      kind: 'accent',
      focusRegion: 'inside',
      metadata: { referenceMenuPrice: '+$16' },
    });
    for (const [code, { group }] of index.groups) {
      expect(isRegionId(group.focusRegion), code).toBe(true);
      expect(group.surchargeMinor, code).toBe(0);
    }
    const accessories = [...index.groups.values()]
      .filter(({ group }) => group.lineKind === 'accessory')
      .map(({ group }) => group.code)
      .sort();
    expect(accessories).toEqual(
      [
        'accents.jacket.bowtie',
        'accents.jacket.panuelos',
        'accents.jacket.shoes',
        'accents.jacket.suspenders',
        'accents.jacket.tie',
        'accents.pants.belt',
        'accents.pants.socks',
      ].sort(),
    );
    for (const code of ARCHIVED_GROUPS) expect(index.groups.has(code), code).toBe(false);
  });

  it('cleans choice labels and keeps the source label, reference price and defaults', () => {
    const tie = index.values.get(valueKey('accents.jacket.tie.necktie', 'personalizado'))!;
    expect(tie.value).toMatchObject({
      label: 'Added',
      metadata: { sourceLabel: 'add' },
    });
    const none = index.values.get(valueKey('accents.jacket.tie.necktie', 'without'))!;
    expect(none.value).toMatchObject({ label: 'None', isOff: true });
    const thread = index.values.get(valueKey('accents.jacket.initials.thread-color', '41'))!;
    expect(thread.value.label).toBe('Colour 41');
    expect(
      index.attributes.get('accents.jacket.lining.lining-fabrics')?.attribute.defaultValueCode,
    ).toBeNull();
    expect(
      index.attributes.get('style.jacket.jacket_pockets_type.jacket-pockets-type')?.attribute
        .defaultValueCode,
    ).toBe('2b');
    for (const { attribute, value } of allValues) {
      expect(value.surchargeMinor, `${attribute.code}=${value.code}`).toBe(0);
      expect(value.supplierCode).toBeNull();
      expect(value.referenceOnly).toBe(true);
      for (const key of Object.keys(value.metadata)) expect(key).not.toMatch(/^price_/);
    }
    const berck = index.values.get(valueKey('accents.jacket.lining.lining-fabrics', '98'))!;
    expect(berck.value.metadata).toMatchObject({
      sourceLabel: 'Berck',
      referencePrice: '20',
      tone: 'blue',
      composition: 'Polyester',
      sourcePriceLining: '20',
      sourcePricePiping: '12',
      sourcePriceUnlined: '47',
    });
    expect(berck.attribute.metadataFields.map((field) => field.key)).toEqual([
      'tone',
      'material',
      'brightness',
      'category',
      'texture',
      'composition',
    ]);
    expect(berck.attribute.metadataFields.every((field) => field.type === 'text')).toBe(true);
  });

  it('turns section gating into visibility conditions', () => {
    const condition = (code: string) => index.attributes.get(code)?.attribute.visibleWhen;
    expect(condition('accents.jacket.lining.lining-fabrics')).toEqual({
      attr: 'accents.jacket.lining.internal-lining',
      in: ['personalizado'],
    });
    expect(condition('accents.jacket.button_holes_threads.button-holes')).toEqual({
      not: { attr: 'accents.jacket.button_holes_threads.button-threads-holes', in: ['By default'] },
    });
    expect(condition('accents.jacket.lining.internal-lining')).toBeNull();
    expect(condition('style.jacket.jacket_style_combined.personalize-fabrics-split')).toBeNull();
    expect(condition('accents.jacket.initials.thread-color')).toBeNull();
  });

  it('replaces the waistcoat option with an optional vest part', () => {
    expect(index.attributes.has(LEGACY_KEYS.vest)).toBe(false);
    expect(index.groups.get('style.vest.waistcoat')?.group).toMatchObject({
      attributes: [],
      visibleWhen: null,
      focusRegion: 'vest',
    });
    for (const [code, { group, component }] of index.groups)
      if (component.code === 'vest' && code !== 'style.vest.waistcoat')
        expect(group.visibleWhen, code).toEqual({ component: 'vest', included: true });
    expect(index.products.get('suit')?.components).toEqual([
      expect.objectContaining({ componentCode: 'jacket', required: true, defaultIncluded: true }),
      expect.objectContaining({ componentCode: 'trousers', required: true, defaultIncluded: true }),
      {
        componentCode: 'vest',
        required: false,
        defaultIncluded: false,
        surchargeMinor: 0,
        includeLabel: 'Add a vest',
        sort: 3,
        metadata: { referencePrice: '100.00' },
      },
    ]);
  });

  it('imports products with today’s names, defaults and registry-backed sets', () => {
    expect(snapshot.products.map((product) => product.code)).toEqual(['suit', 'shirt', 'blazer']);
    for (const product of snapshot.products) {
      const legacy = PRODUCTS[product.code as keyof typeof PRODUCTS];
      expect(product).toMatchObject({
        name: legacy.name,
        shortLabel: legacy.label,
        description: legacy.description,
        measurementSet: product.code,
        visualModel: product.code,
        referenceOnly: true,
        bandPrices: {},
        heroMediaId: null,
      });
    }
    expect(index.products.get('suit')?.defaultMaterialCode).toBe('navy-twill');
    expect(index.products.get('blazer')?.defaultMaterialCode).toBe('navy-twill');
    expect(index.products.get('shirt')?.defaultMaterialCode).toBe('ivory');
  });

  it('restricts the blazer’s jacket to today’s blazer choices', () => {
    const blazer = index.products.get('blazer')!;
    expect(blazer.components.map((link) => link.componentCode)).toEqual(['jacket']);
    const available = (code: string) =>
      index.attributes
        .get(code)!
        .attribute.values.filter(
          (value) => blazer.settings.values[valueKey(code, value.code)]?.available !== false,
        )
        .map((value) => value.code);
    expect(available(LEGACY_KEYS.jacketStyle)).toEqual(['simple_1', 'simple_2']);
    expect(available(LEGACY_KEYS.lapelType)).toEqual(['standard', 'peak']);
    expect(available(LEGACY_KEYS.pocketsType).sort()).toEqual(['2', '2b']);
    expect(available(LEGACY_KEYS.jacketFit)).toEqual(['1', '0', 'relaxed']);
    const openGroups = snapshot.components
      .find((component) => component.code === 'jacket')!
      .groups.filter((group) => blazer.settings.groups[group.code]?.available !== false)
      .map((group) => group.code);
    expect(openGroups).toEqual([
      'style.jacket.jacket_style_combined',
      'style.jacket.jacket_fit',
      'style.jacket.jacket_lapel_type_combinated',
      'style.jacket.jacket_pockets_type',
    ]);
    expect(blazer.settings.attributes).toEqual({
      'style.jacket.jacket_style_combined.personalize-fabrics-split': expect.objectContaining({
        available: false,
      }),
      'style.jacket.jacket_lapel_type_combinated.jacket-wide-lapel': expect.objectContaining({
        available: false,
      }),
    });
    // Seed defaults stay valid for the blazer: two buttons, notch, patch pockets, slim fit.
    for (const key of [
      LEGACY_KEYS.jacketStyle,
      LEGACY_KEYS.lapelType,
      LEGACY_KEYS.pocketsType,
      LEGACY_KEYS.jacketFit,
    ])
      expect(available(key)).toContain(index.attributes.get(key)!.attribute.defaultValueCode);
  });

  it('adds the shirt component from the legacy shirt fields', () => {
    const shirt = snapshot.components.find((component) => component.code === 'shirt')!;
    expect(
      shirt.groups.map((group) => [
        group.code,
        group.focusRegion,
        group.attributes[0].code,
        group.attributes[0].defaultValueCode,
        group.attributes[0].values.map((value) => value.code),
      ]),
    ).toEqual([
      [
        'style.shirt.shirt_fit',
        'torso',
        LEGACY_KEYS.shirtFit,
        'tailored',
        ['tailored', 'classic', 'relaxed'],
      ],
      [
        'style.shirt.shirt_collar',
        'collar',
        LEGACY_KEYS.shirtCollar,
        'spread',
        ['spread', 'point'],
      ],
      ['style.shirt.shirt_cuffs', 'sleeve', LEGACY_KEYS.shirtCuffs, 'button', ['button', 'french']],
    ]);
    expect(index.products.get('shirt')?.components).toEqual([
      expect.objectContaining({ componentCode: 'shirt', required: true }),
    ]);
  });

  it('binds every drawn option to a registry slot and every choice to a token', () => {
    let bound = 0;
    for (const [code, { attribute }] of index.attributes) {
      expect(attribute.visualSlot, code).toBe(slotForKey(code) ?? null);
      if (!attribute.visualSlot) {
        expect(
          attribute.values.every((value) => value.visualToken === null),
          code,
        ).toBe(true);
        continue;
      }
      bound++;
      expect(isSlotId(attribute.visualSlot), code).toBe(true);
      for (const value of attribute.values) {
        expect(value.visualToken, `${code}=${value.code}`).toBe(value.code);
        expect(
          isTokenOf(attribute.visualSlot as never, value.visualToken!),
          `${code}=${value.code}`,
        ).toBe(true);
      }
    }
    expect(bound).toBe(53);
  });

  it('imports the eight reference fabrics without inventing supplier facts', () => {
    expect(snapshot.materials.map((material) => material.code).sort()).toEqual(
      FABRICS.map((fabric) => fabric.id).sort(),
    );
    for (const fabric of FABRICS) {
      const material = index.materials.get(fabric.id)!;
      expect(material).toMatchObject({
        name: fabric.name,
        colourName: fabric.name,
        primaryHex: fabric.color,
        renderPattern: fabric.pattern,
        descriptionShort: fabric.description,
        productCodes: [...fabric.products].sort(),
        usages: fabric.products.includes('shirt') ? ['shirting'] : ['shell'],
        weightGsm: null,
        superNumber: null,
        composition: [],
        colourFamily: null,
        priceBand: null,
        priceOverrides: {},
        supplier: null,
        millName: null,
        referenceOnly: true,
        metadata: {
          weightLabel: fabric.weight,
          compositionLabel: fabric.composition,
          toneLabel: fabric.tone,
        },
      });
      expect(material.media).toEqual([
        {
          mediaId: nameBasedId(`static:${referenceSwatchPath(fabric.id)}`),
          role: 'swatch',
          sort: 0,
        },
      ]);
    }
    expect(index.materials.get('navy-twill')?.pattern).toBe('twill');
    expect(index.materials.get('charcoal')?.pattern).toBe('solid');
    expect(index.materials.get('blue-check')?.pattern).toBe('windowpane');
    expect(index.materials.get('blue-stripe')?.pattern).toBe('pinstripe');
    expect(index.materials.get('sand-linen')?.climates).toEqual(['warm']);
    expect(index.materials.get('navy-twill')?.climates).toEqual(['all_season', 'cool']);
  });

  it('records every imported image as reference-only static media that exists', () => {
    const media = Object.values(snapshot.media);
    const seedAssets = new Set(
      seedSections.flatMap(({ menu, category, group, section }) =>
        ARCHIVED_GROUPS.has(`${menu.id}.${category.id}.${group.id}`)
          ? []
          : [
              group.asset,
              ...(section.selectionKey === LEGACY_KEYS.vest
                ? []
                : section.options.map((option) => option.asset)),
            ].filter((asset): asset is string => !!asset),
      ),
    );
    expect(seedAssets.size).toBeGreaterThan(450);
    expect(media.map((item) => item.url).sort()).toEqual(
      [...seedAssets, ...FABRICS.map((fabric) => referenceSwatchPath(fabric.id))].sort(),
    );
    for (const item of media) {
      expect(existsSync(path.join('public', item.url)), item.url).toBe(true);
      expect(item.alt.trim(), item.url).not.toBe('');
      expect(item.id).toBe(nameBasedId(`static:${item.url}`));
      expect(item.rightsStatus).toBe(
        item.url.startsWith('/reference-assets/fabrics/') ? 'owned' : 'reference_only',
      );
    }
    for (const fabric of FABRICS)
      expect(
        readFileSync(path.join('public', referenceSwatchPath(fabric.id)), 'utf8').replace(
          /\r\n/g,
          '\n',
        ),
      ).toBe(referenceSwatchSvg(fabric));
  });

  it('seeds every system lookup type with the §3.8 starting values', () => {
    expect(lookupTypes.map((type) => type.code)).toEqual(LOOKUP_TYPES.map((type) => type.code));
    // `tag` is seeded as a type but has no values yet, so the release omits it.
    expect(Object.keys(snapshot.lookups).sort()).toEqual(
      lookupTypes
        .map((type) => type.code)
        .filter((code) => code !== 'tag')
        .sort(),
    );
    expect(snapshot.lookups.occasion.map((value) => [value.code, value.label])).toEqual([
      ['office', 'Office'],
      ['wedding', 'Wedding'],
      ['formal_event', 'Formal event'],
      ['everyday', 'Everyday'],
    ]);
    expect(snapshot.lookups.climate.map((value) => [value.code, value.label])).toEqual([
      ['warm', 'Warm'],
      ['all_season', 'All season'],
      ['cool', 'Cool'],
    ]);
    const counts = Object.fromEntries(
      Object.entries(snapshot.lookups).map(([type, values]) => [type, values.length]),
    );
    expect(counts).toEqual({
      occasion: 4,
      climate: 3,
      colour_family: 20,
      pattern: 17,
      weave: 14,
      fibre: 13,
      finish: 6,
      texture: 6,
      sheen: 3,
      season: 4,
      stretch: 3,
      care: 6,
    });
    for (const value of snapshot.lookups.colour_family)
      expect(value.metadata.hex).toMatch(/^#[0-9a-f]{6}$/);
    for (const value of snapshot.lookups.pattern)
      expect(['plain', 'twill', 'check', 'stripe']).toContain(value.metadata.renderPattern);
  });

  it('is reference-only throughout, with no prices and a modest size', () => {
    expect(snapshot.referenceOnly).toBe(true);
    for (const item of [...snapshot.components, ...snapshot.products, ...snapshot.materials])
      expect(item.referenceOnly, item.code).toBe(true);
    for (const { group, attribute } of index.attributes.values()) {
      expect(group.referenceOnly && attribute.referenceOnly).toBe(true);
      expect(attribute.surchargeMinor).toBe(0);
    }
    expect(snapshot.priceBands).toEqual([]);
    expect(snapshot.rules).toEqual([]);
    expect(snapshot.templates).toEqual([]);
    expect(snapshot.currency).toBe('USD');
    const bytes = Buffer.byteLength(JSON.stringify(snapshot));
    expect(bytes).toBeLessThan(1_000_000);
  });
});
