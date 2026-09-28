import { describe, it, expect } from 'vitest';
import {
  RELEASE_ERROR_CODES,
  RELEASE_WARNING_CODES,
  validateRelease,
  type ValidationOptions,
} from '../src/modules/catalog/validate-release';
import { toCustomerCatalog } from '../src/modules/catalog/projection';
import { diffSnapshots } from '../src/modules/catalog/diff';
import {
  customerCatalogSchema,
  indexSnapshot,
  valueKey,
  type CatalogSnapshot,
} from '../src/modules/catalog/snapshot';
import {
  defaultGarment,
  defaultsFor,
  effectiveSelections,
  ruleViolations,
} from '../src/modules/catalog/structure';
import { importLegacyCatalog } from '../src/modules/catalog/import-legacy';
import { SYN, syntheticSnapshot } from './fixtures/catalog.synthetic';

// CATALOG-ADMIN.md §5.2, §7.4, §7.5, §9. SYNTHETIC fixtures, plus the legacy
// import of the user-supplied reference seed.

type Mutation = (snapshot: CatalogSnapshot) => void;
const errorsOf = (snapshot: CatalogSnapshot, options?: ValidationOptions) =>
  new Set(validateRelease(snapshot, options).errors.map((issue) => issue.code));
const warningsOf = (snapshot: CatalogSnapshot, options?: ValidationOptions) =>
  new Set(validateRelease(snapshot, options).warnings.map((issue) => issue.code));
const mutate = (change: Mutation) => {
  const snapshot = syntheticSnapshot();
  change(snapshot);
  return snapshot;
};
const jacket = (s: CatalogSnapshot) => s.components.find((c) => c.code === 'jacket')!;
const group = (s: CatalogSnapshot, code: string) =>
  s.components.flatMap((c) => c.groups).find((g) => g.code === code)!;
const attribute = (s: CatalogSnapshot, code: string) =>
  s.components.flatMap((c) => c.groups.flatMap((g) => g.attributes)).find((a) => a.code === code)!;
const value = (s: CatalogSnapshot, attr: string, code: string) =>
  attribute(s, attr).values.find((v) => v.code === code)!;
const product = (s: CatalogSnapshot, code: string) => s.products.find((p) => p.code === code)!;
const material = (s: CatalogSnapshot, code: string) => s.materials.find((m) => m.code === code)!;

describe('validateRelease on valid catalogs', () => {
  it('finds no errors in the synthetic fixture, only expected warnings', () => {
    const report = validateRelease(syntheticSnapshot());
    expect(report.errors).toEqual([]);
    expect([...new Set(report.warnings.map((w) => w.code))].sort()).toEqual([
      'image_missing',
      'price_missing',
    ]);
    expect(report.warnings.filter((w) => w.code === 'price_missing')).toEqual([
      expect.objectContaining({
        entity: 'material',
        entityCode: SYN.unpriced,
        productCode: SYN.blazer,
      }),
      expect.objectContaining({
        entity: 'material',
        entityCode: SYN.unpriced,
        productCode: SYN.suit,
      }),
    ]);
  });

  it('finds no errors in the legacy import, only the expected reference-data warnings', () => {
    const report = validateRelease(importLegacyCatalog().snapshot);
    expect(report.errors).toEqual([]);
    expect([...new Set(report.warnings.map((w) => w.code))].sort()).toEqual(
      [
        'image_missing',
        'price_missing',
        'reference_only_present',
        'reference_price_unset',
        'rights_unconfirmed',
        'supplier_missing',
      ].sort(),
    );
    expect(report.warnings.filter((w) => w.code === 'supplier_missing')).toHaveLength(8);
    expect(
      report.warnings.filter((w) => w.code === 'price_missing' && w.entity === 'product'),
    ).toHaveLength(3);
  });

  it('checksums the warning list so a stale acknowledgement is detectable', () => {
    const a = validateRelease(syntheticSnapshot());
    expect(validateRelease(syntheticSnapshot()).warningsChecksum).toBe(a.warningsChecksum);
    const changed = validateRelease(mutate((s) => (material(s, SYN.navy).supplier = null)));
    expect(changed.warningsChecksum).not.toBe(a.warningsChecksum);
  });
});

describe('each error code blocks publishing', () => {
  const cases: Record<(typeof RELEASE_ERROR_CODES)[number], Mutation> = {
    product_no_components: (s) => (product(s, SYN.suit).components = []),
    product_invalid_registry: (s) => (product(s, SYN.suit).measurementSet = 'kilt' as never),
    product_default_material: (s) => (product(s, SYN.suit).defaultMaterialCode = SYN.poplin),
    attribute_no_values: (s) => {
      for (const code of ['standard', 'peak'])
        product(s, SYN.blazer).settings.values[valueKey(SYN.lapel, code)] = {
          available: false,
          surchargeOverrideMinor: null,
        };
    },
    default_invalid: (s) => (attribute(s, SYN.cuff).defaultValueCode = '2'),
    text_rules_missing: (s) => (attribute(s, SYN.initials).textRules = null),
    condition_invalid: (s) =>
      (attribute(s, SYN.liningFabric).visibleWhen = { attr: 'accents.jacket.unknown', in: ['x'] }),
    rule_violated_by_defaults: (s) =>
      s.rules.push({
        code: 'syn-no-notch',
        name: 'SYNTHETIC',
        productCodes: [SYN.suit],
        when: { product: [SYN.suit] },
        effect: 'forbid',
        attributeCode: SYN.lapel,
        valueCodes: ['standard'],
        message: 'SYNTHETIC: no notch lapels.',
      }),
    template_invalid: (s) => (s.templates[0].selections[SYN.lapel] = 'shawl'),
    material_incomplete: (s) => (material(s, SYN.navy).media = []),
    composition_sum: (s) => (material(s, SYN.navy).composition = [{ fibre: 'wool', percent: 90 }]),
    visual_token_unknown: (s) => (value(s, SYN.lapel, 'peak').visualToken = 'shawl'),
    focus_region_unknown: (s) => (group(s, SYN.lapelGroup).focusRegion = 'lapel'),
    metadata_invalid: (s) => (value(s, SYN.liningFabric, '116').metadata = { colour: 'blue' }),
    lookup_unknown: (s) => (material(s, SYN.navy).colourFamily = 'teal'),
    currency_invalid: (s) => (s.currency = 'JPY'),
    release_too_large: (s) => (material(s, SYN.navy).story = 'x'.repeat(5 * 1024 * 1024)),
  };
  const base = errorsOf(syntheticSnapshot());

  for (const [code, change] of Object.entries(cases))
    it(code, () => {
      expect(base.has(code as never)).toBe(false);
      expect(errorsOf(mutate(change))).toContain(code);
    });

  it('covers every error code', () => {
    expect(Object.keys(cases).sort()).toEqual([...RELEASE_ERROR_CODES].sort());
  });

  it('reports cyclic visibility as condition_invalid', () => {
    const cyclic = mutate((s) => {
      attribute(s, SYN.thread).visibleWhen = { attr: SYN.tie, answered: true };
      group(s, SYN.tieGroup).visibleWhen = null;
      attribute(s, SYN.tie).visibleWhen = { attr: SYN.thread, answered: false };
    });
    const issues = validateRelease(cyclic).errors.filter((e) => e.code === 'condition_invalid');
    expect(issues.some((issue) => /loop/.test(issue.message))).toBe(true);
  });

  it('names the entity and product of each issue', () => {
    const issue = validateRelease(
      mutate((s) => {
        for (const code of ['standard', 'peak'])
          product(s, SYN.blazer).settings.values[valueKey(SYN.lapel, code)] = {
            available: false,
            surchargeOverrideMinor: null,
          };
      }),
    ).errors.find((e) => e.code === 'attribute_no_values');
    expect(issue).toMatchObject({
      entity: 'attribute',
      entityCode: SYN.lapel,
      productCode: SYN.blazer,
    });
  });
});

describe('each warning code needs acknowledgement', () => {
  const cases: Record<(typeof RELEASE_WARNING_CODES)[number], [Mutation, ValidationOptions?]> = {
    price_missing: [(s) => (product(s, SYN.shirt).bandPrices = {})],
    reference_price_unset: [(s) => (value(s, SYN.liningFabric, '98').surchargeMinor = 0)],
    image_missing: [() => undefined],
    rights_unconfirmed: [(s) => (s.media['media-peak'].rightsStatus = 'unknown')],
    reference_only_present: [(s) => (s.referenceOnly = true)],
    not_illustrated: [(s) => (value(s, SYN.lapel, 'peak').visualToken = null)],
    supplier_missing: [(s) => (material(s, SYN.navy).supplier = null)],
    lookup_inactive_in_use: [
      (s) => (material(s, SYN.navy).colourFamily = 'teal'),
      { inactiveLookups: { colour_family: ['teal'] } },
    ],
  };
  const base = warningsOf(syntheticSnapshot());

  for (const [code, [change, options]] of Object.entries(cases))
    it(code, () => {
      if (code !== 'image_missing' && code !== 'price_missing')
        expect(base.has(code as never)).toBe(false);
      const snapshot = mutate(change);
      expect(warningsOf(snapshot, options)).toContain(code);
      if (code === 'lookup_inactive_in_use')
        expect(errorsOf(snapshot, options)).not.toContain('lookup_unknown');
    });

  it('covers every warning code', () => {
    expect(Object.keys(cases).sort()).toEqual([...RELEASE_WARNING_CODES].sort());
  });
});

describe('effective selections and rules', () => {
  const snapshot = syntheticSnapshot();
  const index = indexSnapshot(snapshot);
  const suit = product(snapshot, SYN.suit);

  it('fills defaults from the product, honouring product overrides and availability', () => {
    expect(defaultsFor(index, suit)).toMatchObject({
      [SYN.buttonholes]: '0',
      [SYN.lapel]: 'standard',
    });
    const blazer = defaultsFor(index, product(snapshot, SYN.blazer));
    expect(blazer[SYN.buttonholes]).toBe('1');
    expect(blazer[SYN.lining]).toBeUndefined();
    expect(defaultGarment(index, suit).includedComponents).toEqual(['jacket', 'trousers']);
  });

  it('keeps hidden selections inert and restores them when visible again', () => {
    const garment = {
      ...defaultGarment(index, suit),
      selections: { ...defaultsFor(index, suit), [SYN.liningFabric]: '98' },
    };
    const hidden = effectiveSelections(index, garment);
    expect(hidden.stable).toBe(true);
    expect(hidden.selections[SYN.liningFabric]).toBeUndefined();
    expect(garment.selections[SYN.liningFabric]).toBe('98');
    const shown = effectiveSelections(index, {
      ...garment,
      selections: { ...garment.selections, [SYN.lining]: 'personalizado' },
    });
    expect(shown.selections[SYN.liningFabric]).toBe('98');
    expect(shown.visibleAttributes.has(SYN.liningPiping)).toBe(true);
    const linen = effectiveSelections(index, {
      ...garment,
      materialCode: SYN.unpriced,
      selections: { ...garment.selections, [SYN.lining]: 'personalizado' },
    });
    expect(linen.visibleAttributes.has(SYN.liningPiping)).toBe(false);
  });

  it('shows part groups only when the part is included and product groups only for the product', () => {
    const plain = effectiveSelections(index, defaultGarment(index, suit));
    expect(plain.visibleGroups.has(SYN.vestBottomGroup)).toBe(false);
    expect(plain.visibleGroups.has(SYN.ventGroup)).toBe(true);
    const vest = effectiveSelections(index, {
      ...defaultGarment(index, suit),
      includedComponents: ['vest'],
    });
    expect(vest.visibleGroups.has(SYN.vestBottomGroup)).toBe(true);
    const blazer = effectiveSelections(index, defaultGarment(index, product(snapshot, SYN.blazer)));
    expect(blazer.visibleGroups.has(SYN.ventGroup)).toBe(false);
    expect(blazer.visibleGroups.has(SYN.liningGroup)).toBe(false);
  });

  it('evaluates forbid and require rules only on visible targets', () => {
    const base = defaultGarment(index, suit);
    const linenPeak = effectiveSelections(index, {
      ...base,
      materialCode: SYN.linen,
      selections: { ...base.selections, [SYN.lapel]: 'peak' },
    });
    expect(ruleViolations(index, linenPeak).map((v) => v.ruleCode)).toEqual([
      'syn-no-peak-on-linen',
    ]);
    const straight = { ...base.selections, [SYN.lapel]: 'peak', [SYN.vestBottom]: 'straight' };
    expect(
      ruleViolations(index, effectiveSelections(index, { ...base, selections: straight })),
    ).toEqual([]);
    const withVest = effectiveSelections(index, {
      ...base,
      includedComponents: ['vest'],
      selections: straight,
    });
    expect(ruleViolations(index, withVest).map((v) => v.ruleCode)).toEqual([
      'syn-vest-cut-with-peak',
    ]);
  });
});

describe('customer projection', () => {
  it('strips supplier data, source prices, provenance, rights and rule names', () => {
    for (const snapshot of [syntheticSnapshot(), importLegacyCatalog().snapshot]) {
      const customer = toCustomerCatalog(snapshot);
      expect(customerCatalogSchema.safeParse(customer).success).toBe(true);
      const text = JSON.stringify(customer);
      for (const hidden of [
        '"supplierCode"',
        '"referencePrice"',
        '"referenceMenuPrice"',
        '"sourceLabel"',
        '"sourcePrice',
        '"rightsStatus"',
        '"legacyKey"',
        'SYN-',
        'ART-',
        'SYNTHETIC Mill',
      ])
        expect(text, hidden).not.toContain(hidden);
      expect(customer.materials.every((m) => m.supplier === null)).toBe(true);
      expect(customer.rules.every((rule) => !('name' in rule))).toBe(true);
    }
  });

  it('keeps the mill name only when it may be shown, and keeps customer-facing metadata', () => {
    const shown = syntheticSnapshot();
    material(shown, SYN.navy).displayMillName = true;
    expect(toCustomerCatalog(shown).materials.find((m) => m.code === SYN.navy)?.millName).toBe(
      'SYNTHETIC Mill',
    );
    const imported = toCustomerCatalog(importLegacyCatalog().snapshot);
    expect(imported.materials.find((m) => m.code === 'navy-twill')?.metadata).toEqual({
      weightLabel: 'Medium weight',
      compositionLabel: 'Wool reference',
      toneLabel: 'Dark',
    });
    const lining = imported.components
      .flatMap((c) => c.groups.flatMap((g) => g.attributes))
      .find((a) => a.code === 'accents.jacket.lining.lining-fabrics')!;
    expect(lining.values[0].metadata).toEqual({
      tone: 'blue',
      material: 'poliester',
      brightness: 'mate',
      category: 'special',
      texture: 'shredded',
      composition: 'Polyester',
    });
  });

  it('stays small for the imported catalog and refuses an oversized one', () => {
    const bytes = Buffer.byteLength(
      JSON.stringify(toCustomerCatalog(importLegacyCatalog().snapshot)),
    );
    expect(bytes).toBeLessThan(1_000_000);
    const huge = mutate((s) => (material(s, SYN.navy).story = 'x'.repeat(5 * 1024 * 1024 + 1)));
    expect(() => toCustomerCatalog(huge)).toThrow(/5 MB/);
  });
});

describe('diffSnapshots', () => {
  it('finds nothing between equal snapshots', () => {
    expect(diffSnapshots(syntheticSnapshot(), syntheticSnapshot())).toEqual({
      added: [],
      removed: [],
      changed: [],
    });
  });

  it('reports additions, removals and changed fields keyed by code', () => {
    const after = mutate((s) => {
      s.materials.push({ ...material(s, SYN.navy), code: 'syn-new-fabric' });
      s.rules = s.rules.filter((rule) => rule.code !== 'syn-no-peak-on-linen');
      value(s, SYN.lapel, 'peak').label = 'Peaked';
      group(s, SYN.lapelGroup).name = 'Lapel styles';
      jacket(s).groups[0].attributes[0].values.push({
        ...value(s, SYN.lapel, 'peak'),
        code: 'shawl',
      });
      s.currency = 'EUR';
    });
    const diff = diffSnapshots(syntheticSnapshot(), after);
    expect(diff.added).toEqual([
      { entity: 'material', code: 'syn-new-fabric' },
      { entity: 'value', code: valueKey(SYN.lapel, 'shawl') },
    ]);
    expect(diff.removed).toEqual([{ entity: 'rule', code: 'syn-no-peak-on-linen' }]);
    expect(diff.changed).toEqual([
      { entity: 'group', code: SYN.lapelGroup, fields: ['name'] },
      { entity: 'settings', code: 'commerce', fields: ['currency'] },
      { entity: 'value', code: valueKey(SYN.lapel, 'peak'), fields: ['label'] },
    ]);
  });
});
