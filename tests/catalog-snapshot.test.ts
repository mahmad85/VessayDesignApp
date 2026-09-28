import { describe, it, expect } from 'vitest';
import {
  CONDITION_MAX_DEPTH,
  CONDITION_MAX_NODES,
  conditionSchema,
  evaluateCondition,
  validateCondition,
  type Condition,
  type ConditionContext,
} from '../src/modules/catalog/conditions';
import {
  catalogSnapshotSchema,
  indexSnapshot,
  normalizeSnapshot,
  parseSnapshot,
  valueKey,
} from '../src/modules/catalog/snapshot';
import { checksum } from '../src/lib/canonical-json';
import { SYN, syntheticSnapshot } from './fixtures/catalog.synthetic';

// CATALOG-ADMIN.md §5.1 and ADMIN-BACKEND.md §5. SYNTHETIC fixture only.

const context = (overrides: Partial<ConditionContext> = {}): ConditionContext => ({
  productCode: SYN.suit,
  includedComponents: new Set(['jacket', 'trousers']),
  selections: { [SYN.lining]: 'personalizado', [SYN.initials]: '' },
  material: {
    code: SYN.navy,
    pattern: 'twill',
    weave: 'twill',
    colourFamily: 'navy',
    stretch: null,
  },
  ...overrides,
});
const yes: Condition = { product: [SYN.suit] };
const no: Condition = { product: [SYN.shirt] };

describe('the synthetic snapshot fixture', () => {
  it('parses against the snapshot contract and is already in canonical order', () => {
    const snapshot = parseSnapshot(syntheticSnapshot());
    expect(checksum(normalizeSnapshot(snapshot))).toBe(checksum(snapshot));
    expect(snapshot.products.map((product) => product.code)).toEqual(['suit', 'shirt', 'blazer']);
  });

  it('indexes every entity by code', () => {
    const index = indexSnapshot(syntheticSnapshot());
    expect(index.products.get(SYN.blazer)?.visualModel).toBe('blazer');
    expect(index.groups.get(SYN.liningGroup)?.component.code).toBe('jacket');
    expect(index.attributes.get(SYN.liningFabric)?.group.code).toBe(SYN.liningGroup);
    expect(index.values.get(valueKey(SYN.liningFabric, '98'))?.value.surchargeMinor).toBe(900);
    expect(index.materials.get(SYN.unpriced)?.priceBand).toBeNull();
    expect(index.lookups.get('pattern')?.get('windowpane')?.metadata.renderPattern).toBe('check');
    expect(index.media.get('media-peak')?.alt).toBe('SYNTHETIC peak lapel');
  });

  it('covers every condition type', () => {
    const kinds = new Set<string>();
    const visit = (condition: Condition) => {
      if ('all' in condition) {
        kinds.add('all');
        condition.all.forEach(visit);
      } else if ('any' in condition) {
        kinds.add('any');
        condition.any.forEach(visit);
      } else if ('not' in condition) {
        kinds.add('not');
        visit(condition.not);
      } else if ('attr' in condition) kinds.add('in' in condition ? 'attr.in' : 'attr.answered');
      else if ('component' in condition) kinds.add('component');
      else if ('material' in condition) {
        if (condition.material.codes) kinds.add('material.codes');
        if (condition.material.lookup) kinds.add('material.lookup');
      } else kinds.add('product');
    };
    const snapshot = syntheticSnapshot();
    for (const component of snapshot.components)
      for (const group of component.groups) {
        if (group.visibleWhen) visit(group.visibleWhen);
        for (const attribute of group.attributes)
          if (attribute.visibleWhen) visit(attribute.visibleWhen);
      }
    for (const rule of snapshot.rules) visit(rule.when);
    expect([...kinds].sort()).toEqual(
      [
        'all',
        'any',
        'attr.answered',
        'attr.in',
        'component',
        'material.codes',
        'material.lookup',
        'not',
        'product',
      ].sort(),
    );
  });

  it('rejects snapshots that break the contract', () => {
    const base = syntheticSnapshot();
    const bad = [
      { ...base, schemaVersion: 2 },
      { ...base, currency: 'usd' },
      { ...base, surprise: true },
      { ...base, priceBands: [{ code: 'band-b', name: 'x', sort: 1 }] },
    ];
    for (const snapshot of bad)
      expect(catalogSnapshotSchema.safeParse(snapshot).success).toBe(false);
    const negative = syntheticSnapshot();
    negative.products[0].bandPrices.B = -1;
    expect(catalogSnapshotSchema.safeParse(negative).success).toBe(false);
    const badValue = syntheticSnapshot();
    badValue.components[0].groups[0].attributes[0].values[0].code = ' bad';
    expect(catalogSnapshotSchema.safeParse(badValue).success).toBe(false);
  });
});

describe('evaluateCondition', () => {
  it('evaluates attr/in against effective selections only', () => {
    expect(evaluateCondition({ attr: SYN.lining, in: ['personalizado'] }, context())).toBe(true);
    expect(evaluateCondition({ attr: SYN.lining, in: ['default'] }, context())).toBe(false);
    expect(evaluateCondition({ attr: SYN.lapel, in: ['standard'] }, context())).toBe(false);
  });

  it('evaluates attr/answered, treating blank text as unanswered', () => {
    expect(evaluateCondition({ attr: SYN.lining, answered: true }, context())).toBe(true);
    expect(evaluateCondition({ attr: SYN.initials, answered: true }, context())).toBe(false);
    expect(evaluateCondition({ attr: SYN.initials, answered: false }, context())).toBe(true);
    expect(evaluateCondition({ attr: SYN.lapel, answered: false }, context())).toBe(true);
    const typed = context({ selections: { [SYN.initials]: '  AB ' } });
    expect(evaluateCondition({ attr: SYN.initials, answered: true }, typed)).toBe(true);
  });

  it('evaluates component inclusion', () => {
    expect(evaluateCondition({ component: 'vest', included: true }, context())).toBe(false);
    expect(evaluateCondition({ component: 'vest', included: false }, context())).toBe(true);
    const vest = context({ includedComponents: new Set(['jacket', 'trousers', 'vest']) });
    expect(evaluateCondition({ component: 'vest', included: true }, vest)).toBe(true);
  });

  it('evaluates material codes and lookups, together and apart', () => {
    expect(evaluateCondition({ material: { codes: [SYN.navy] } }, context())).toBe(true);
    expect(evaluateCondition({ material: { codes: [SYN.linen] } }, context())).toBe(false);
    for (const [field, value] of [
      ['pattern', 'twill'],
      ['weave', 'twill'],
      ['colourFamily', 'navy'],
    ] as const) {
      expect(evaluateCondition({ material: { lookup: { field, in: [value] } } }, context())).toBe(
        true,
      );
      expect(evaluateCondition({ material: { lookup: { field, in: ['zz'] } } }, context())).toBe(
        false,
      );
    }
    expect(
      evaluateCondition({ material: { lookup: { field: 'stretch', in: ['none'] } } }, context()),
    ).toBe(false);
    expect(
      evaluateCondition(
        { material: { codes: [SYN.navy], lookup: { field: 'pattern', in: ['solid'] } } },
        context(),
      ),
    ).toBe(false);
    expect(
      evaluateCondition({ material: { codes: [SYN.navy] } }, context({ material: null })),
    ).toBe(false);
  });

  it('evaluates product lists and the all / any / not operators with nesting', () => {
    expect(evaluateCondition(yes, context())).toBe(true);
    expect(evaluateCondition(no, context())).toBe(false);
    expect(evaluateCondition({ all: [yes, yes] }, context())).toBe(true);
    expect(evaluateCondition({ all: [yes, no] }, context())).toBe(false);
    expect(evaluateCondition({ any: [no, yes] }, context())).toBe(true);
    expect(evaluateCondition({ any: [no, no] }, context())).toBe(false);
    expect(evaluateCondition({ not: no }, context())).toBe(true);
    expect(evaluateCondition({ not: { not: yes } }, context())).toBe(true);
    const nested: Condition = {
      all: [
        { attr: SYN.lining, in: ['personalizado'] },
        {
          any: [
            { not: { material: { codes: [SYN.navy] } } },
            { component: 'jacket', included: true },
          ],
        },
      ],
    };
    // Navy fabric fails the `not`, so the jacket being included decides the `any`.
    expect(evaluateCondition(nested, context())).toBe(true);
    expect(evaluateCondition(nested, context({ includedComponents: new Set(['trousers']) }))).toBe(
      false,
    );
    expect(
      evaluateCondition(
        nested,
        context({ includedComponents: new Set(['trousers']), material: null }),
      ),
    ).toBe(true);
  });
});

describe('validateCondition', () => {
  const index = indexSnapshot(syntheticSnapshot());
  const deep = (levels: number): Condition => (levels <= 1 ? yes : { not: deep(levels - 1) });

  it('accepts every condition in the fixture', () => {
    const snapshot = syntheticSnapshot();
    const conditions = [
      ...snapshot.rules.map((rule) => rule.when),
      ...snapshot.components.flatMap((component) =>
        component.groups.flatMap((group) => [
          group.visibleWhen,
          ...group.attributes.map((attribute) => attribute.visibleWhen),
        ]),
      ),
    ].filter(Boolean);
    expect(conditions.length).toBeGreaterThan(5);
    for (const condition of conditions) expect(validateCondition(condition, index)).toEqual([]);
  });

  it('enforces the depth limit of 6 and the size limit of 50', () => {
    expect(validateCondition(deep(CONDITION_MAX_DEPTH), index)).toEqual([]);
    expect(validateCondition(deep(CONDITION_MAX_DEPTH + 1), index).map((i) => i.kind)).toEqual([
      'depth',
    ]);
    const wide = (n: number): Condition => ({ any: Array.from({ length: n - 1 }, () => yes) });
    expect(validateCondition(wide(CONDITION_MAX_NODES), index)).toEqual([]);
    expect(validateCondition(wide(CONDITION_MAX_NODES + 1), index).map((i) => i.kind)).toEqual([
      'size',
    ]);
  });

  it('reports unknown attribute, choice, part, product, fabric and lookup codes', () => {
    const kinds = (condition: Condition) => validateCondition(condition, index).map((i) => i.kind);
    expect(kinds({ attr: 'style.jacket.unknown', in: ['x'] })).toEqual(['unknown_attribute']);
    expect(kinds({ attr: SYN.lapel, in: ['standard', 'shawl'] })).toEqual(['unknown_value']);
    expect(kinds({ attr: SYN.lapel, answered: true })).toEqual([]);
    expect(kinds({ component: 'cape', included: true })).toEqual(['unknown_component']);
    expect(kinds({ product: ['suit', 'kilt'] })).toEqual(['unknown_product']);
    expect(kinds({ material: { codes: ['syn-velvet'] } })).toEqual(['unknown_material']);
    expect(kinds({ material: { lookup: { field: 'pattern', in: ['paisley'] } } })).toEqual([
      'unknown_lookup',
    ]);
    expect(kinds({ material: { lookup: { field: 'stretch', in: ['none'] } } })).toEqual([]);
    expect(kinds({ all: [{ not: { component: 'cape', included: false } }, yes] })).toEqual([
      'unknown_component',
    ]);
  });

  it('reports malformed conditions as schema issues', () => {
    for (const bad of [
      { attr: SYN.lapel },
      { attr: SYN.lapel, in: [] },
      { attr: SYN.lapel, in: ['peak'], answered: true },
      { material: {} },
      { all: [] },
      { product: 'suit' },
      { unknown: true },
      null,
    ]) {
      expect(conditionSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
      expect(validateCondition(bad, index)[0]?.kind, JSON.stringify(bad)).toBe('schema');
    }
  });
});
