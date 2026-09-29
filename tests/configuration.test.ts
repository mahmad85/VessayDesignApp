import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  applyCommand,
  catalogUpdates,
  createDraft,
  type EngineContext,
} from '../src/modules/configuration/engine';
import {
  DomainError,
  commandEnvelopeV2,
  type CommandV2,
  type DraftV2,
} from '../src/modules/configuration/types';
import {
  definitionsFor,
  displayValue,
  requiredDefinitionsForProducts,
  toMillimeters,
} from '../src/modules/measurements/definitions';
import { orderFindings } from '../src/modules/orders/check-policy';
import { guidedReply } from '../src/integrations/assistant';
import {
  SUIT_CUSTOMIZATION_SEED,
  defaultSuitCustomizations,
  validateSuitCustomizations,
} from '../src/modules/catalog/suit-customization';
import { importLegacyCatalog } from '../src/modules/catalog/import-legacy';
import { indexSnapshot, type CatalogSnapshot } from '../src/modules/catalog/snapshot';

// The v2 draft engine (ADMIN-BACKEND §7.1) over the imported reference catalog
// as release 1. Ported from the v1 engine tests (WP-12); every v1 assertion
// keeps a v2 equivalent. SYNTHETIC drafts only.

const LAPEL = 'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type';
const FIT = 'style.jacket.jacket_fit.jacket-fit';
const reference = () => ({ ...importLegacyCatalog().snapshot, version: 1 });
function contextFor(...snapshots: CatalogSnapshot[]): EngineContext {
  const indexes = snapshots.map(indexSnapshot);
  return {
    current: indexes.at(-1)!,
    releases: new Map(indexes.map((index) => [index.catalog.version, index])),
  };
}
const ctx = contextFor(reference());
const run = (draft: DraftV2, ...commands: CommandV2[]) =>
  commands.reduce((d, command) => applyCommand(d, command, ctx), draft);
const withSuit = () => run(createDraft(), { type: 'add_garment', productCode: 'suit' });
const active = (draft: DraftV2) => draft.garments.find((g) => g.id === draft.activeGarmentId)!;
function failure(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof DomainError) return e;
    throw e;
  }
  throw new Error('Expected a DomainError');
}

describe('catalog and design invariants', () => {
  it('does not confirm suggested defaults before customer acceptance', () => {
    // v1: createDraft().design.confirmed was []; now only the chosen product is confirmed.
    expect(createDraft().garments).toEqual([]);
    expect(active(withSuit()).confirmed).toEqual(['product']);
    expect(() => run(withSuit(), { type: 'accept_design' })).toThrow('occasion');
  });

  it('rejects unknown or incompatible fabric IDs', () => {
    for (const materialCode of ['invented', 'ivory'])
      expect(() => run(withSuit(), { type: 'design', patch: { materialCode } })).toThrow(
        'not available',
      );
  });

  it('requires consent before a category reset, keeps preferences and invalidates measurements', () => {
    const first = run(withSuit(), {
      type: 'design',
      patch: { preferences: { occasion: 'wedding', climate: 'warm' }, materialCode: 'sand-linen' },
    });
    first.measurements.confirmed = true;
    expect(() => run(first, { type: 'design', patch: { productCode: 'shirt' } })).toThrow('resets');
    const next = run(first, {
      type: 'design',
      patch: { productCode: 'shirt' },
      confirmCategoryChange: true,
    });
    expect(active(next)).toMatchObject({
      id: active(first).id,
      productCode: 'shirt',
      materialCode: 'ivory',
      preferences: { occasion: 'wedding', climate: 'warm' },
    });
    expect(next.measurements.confirmed).toBe(false);
    expect(active(first).productCode).toBe('suit');
  });

  it('invalidates review on changes and preserves the original snapshot', () => {
    const checked = withSuit();
    checked.review = {
      id: crypto.randomUUID(),
      inputRevision: checked.revision,
      policyVersion: 'check-policy-v1',
      status: 'correction_required',
      findings: orderFindings(checked, ctx),
      aiAdvisory: 'not_configured',
      createdAt: new Date().toISOString(),
    };
    const edited = run(checked, { type: 'design', patch: { selections: { [FIT]: '0' } } });
    expect(checked.review).not.toBeNull();
    expect(edited.review).toBeNull();
    expect(edited.revision).toBe(checked.revision + 1);
  });

  it('rejects arbitrary command fields and unsafe measurement values at the boundary', () => {
    const envelope = (command: unknown) =>
      commandEnvelopeV2.safeParse({ actionId: crypto.randomUUID(), expectedRevision: 0, command })
        .success;
    for (const values of [{ chest: -1 }, { chest: 3001 }, { chest: NaN }])
      expect(envelope({ type: 'measurements', values, confirm: true })).toBe(false);
    // Legacy design fields, invented fields, bad ids and quantities are refused.
    expect(envelope({ type: 'design', patch: { fabricId: 'forest' } })).toBe(false);
    expect(envelope({ type: 'design', patch: { materialCode: 'forest', price: 0 } })).toBe(false);
    expect(envelope({ type: 'select_garment', garmentId: 'not-a-uuid' })).toBe(false);
    expect(envelope({ type: 'set_quantity', garmentId: crypto.randomUUID(), quantity: 6 })).toBe(
      false,
    );
    expect(envelope({ type: 'add_garment', productCode: 'Suit!' })).toBe(false);
    expect(envelope({ type: 'design', patch: { materialCode: 'forest' } })).toBe(true);
  });

  it('normalizes the supplied suit Style and Accents seed with valid local assets', () => {
    const options = SUIT_CUSTOMIZATION_SEED.menus.flatMap((menu) =>
      menu.categories.flatMap((category) =>
        category.groups.flatMap((group) => group.sections.flatMap((section) => section.options)),
      ),
    );
    expect(SUIT_CUSTOMIZATION_SEED.menus.map((menu) => menu.id)).toEqual(['style', 'accents']);
    expect(SUIT_CUSTOMIZATION_SEED.optionCount).toBe(434);
    expect(options).toHaveLength(434);
    expect(new Set(options.map((option) => option.id)).size).toBe(434);
    expect(options.every((option) => !option.asset || existsSync(`public${option.asset}`))).toBe(
      true,
    );
    expect(validateSuitCustomizations(defaultSuitCustomizations())).toBe(true);
  });

  it('validates choice codes server-side against the release', () => {
    // v1 also mirrored lapel/pockets/closure into legacy fields; v2 has one source of truth.
    const peak = run(withSuit(), { type: 'design', patch: { selections: { [LAPEL]: 'peak' } } });
    expect(active(peak).selections[LAPEL]).toBe('peak');
    expect(() =>
      run(withSuit(), {
        type: 'design',
        patch: { selections: { 'style.jacket.unknown': 'invented' } },
      }),
    ).toThrow('not available');
    expect(
      failure(() =>
        run(withSuit(), { type: 'design', patch: { selections: { [LAPEL]: 'invented' } } }),
      ),
    ).toMatchObject({ code: 'unavailable_option', details: { attributeCode: LAPEL } });
  });
});

describe('measurement provenance and checkout', () => {
  it('rejects unsupported fields and incomplete confirmation', () => {
    expect(() =>
      run(withSuit(), { type: 'measurements', values: { unknown: 100 }, confirm: false }),
    ).toThrow('not valid');
    expect(() =>
      run(withSuit(), { type: 'measurements', values: { chest: 1000 }, confirm: true }),
    ).toThrow('required');
    expect(
      failure(() =>
        run(createDraft(), { type: 'measurements', values: { chest: 1000 }, confirm: false }),
      ).code,
    ).toBe('cart_empty');
  });

  it('creates a manual measurement version without claiming verification', () => {
    const d = withSuit();
    const values = Object.fromEntries(
      definitionsFor('suit').map((m) => [m.id, m.id === 'height' ? 1800 : 900]),
    );
    const next = run(d, { type: 'measurements', values, confirm: true });
    expect(next.measurements).toMatchObject({ version: 1, confirmed: true, source: 'customer' });
    expect(d.measurements.version).toBe(0);
  });

  it('formats units without mutating canonical values', () => {
    const mm = 1012.75;
    for (let i = 0; i < 100; i++) {
      displayValue(mm, 'cm');
      displayValue(mm, 'in');
    }
    expect(mm).toBe(1012.75);
    expect(toMillimeters(40, 'in')).toBe(1016);
  });

  it('blocks production reference ordering and removes the pre-payment review command', () => {
    expect(orderFindings(withSuit(), ctx, true)).toContainEqual(
      expect.objectContaining({ id: 'catalog_not_orderable', severity: 'blocker' }),
    );
    expect(
      commandEnvelopeV2.safeParse({
        actionId: crypto.randomUUID(),
        expectedRevision: 0,
        command: { type: 'review', mode: 'human' },
      }).success,
    ).toBe(false);
  });

  it('guided suggestions are proposals and use category-compatible IDs', () => {
    const d = withSuit();
    const suggestion = guidedReply(d, 'I need a shirt for a summer wedding', ctx);
    expect(suggestion).toMatchObject({
      mode: 'guided',
      suggestion: {
        garmentId: active(d).id,
        patch: {
          productCode: 'shirt',
          preferences: { occasion: 'wedding', climate: 'warm' },
          materialCode: 'ivory',
        },
      },
    });
    expect(active(d).productCode).toBe('suit');
    expect(guidedReply(createDraft(), 'a suit please', ctx).suggestion).toEqual({
      garmentId: null,
      patch: { productCode: 'suit' },
    });
  });
});

describe('the multi-garment draft (CRT-001 – CRT-004)', () => {
  it('adds garments from the current release and makes each one active', () => {
    const d = run(withSuit(), { type: 'add_garment', productCode: 'shirt' });
    expect(d.garments.map((g) => g.productCode)).toEqual(['suit', 'shirt']);
    expect(active(d).productCode).toBe('shirt');
    expect(d.garments.every((g) => g.catalogVersion === 1 && g.quantity === 1)).toBe(true);
    expect(
      failure(() => run(createDraft(), { type: 'add_garment', productCode: 'kilt' })),
    ).toMatchObject({
      code: 'product_unavailable',
      status: 422,
    });
  });

  it('keeps garments isolated when switching between them', () => {
    const d = run(
      withSuit(),
      { type: 'add_garment', productCode: 'suit' },
      { type: 'design', patch: { selections: { [LAPEL]: 'peak' }, materialCode: 'forest' } },
    );
    const [first, second] = d.garments;
    expect(first.selections[LAPEL]).toBe('standard');
    expect(first.materialCode).toBe('navy-twill');
    expect(second.selections[LAPEL]).toBe('peak');
    const back = run(d, { type: 'select_garment', garmentId: first.id });
    expect(active(back).id).toBe(first.id);
    const edited = run(back, { type: 'design', patch: { selections: { [FIT]: '0' } } });
    expect(edited.garments[1]).toEqual(second);
    expect(edited.garments[0].selections[FIT]).toBe('0');
    // A named garment is targeted even when it is not active.
    const named = run(back, {
      type: 'design',
      garmentId: second.id,
      patch: { selections: { [FIT]: 'relaxed' } },
    });
    expect(named.garments[1].selections[FIT]).toBe('relaxed');
    expect(named.activeGarmentId).toBe(first.id);
  });

  it('asks before removing a garment with confirmed choices (CRT-003)', () => {
    const d = run(
      withSuit(),
      { type: 'add_garment', productCode: 'shirt' },
      { type: 'design', patch: { materialCode: 'sky' } },
    );
    const shirt = active(d);
    expect(failure(() => run(d, { type: 'remove_garment', garmentId: shirt.id }))).toMatchObject({
      code: 'garment_removal_confirmation_required',
      status: 409,
    });
    const removed = run(d, { type: 'remove_garment', garmentId: shirt.id, confirm: true });
    expect(removed.garments.map((g) => g.productCode)).toEqual(['suit']);
    expect(removed.activeGarmentId).toBe(removed.garments[0].id);
    // An untouched garment goes without asking; the last one leaves an empty cart.
    const empty = run(removed, { type: 'remove_garment', garmentId: removed.garments[0].id });
    expect(empty.garments).toEqual([]);
    expect(empty.activeGarmentId).toBeNull();
    expect(failure(() => run(empty, { type: 'accept_design' }))).toMatchObject({
      code: 'garment_not_found',
      status: 422,
    });
    expect(
      failure(() => run(empty, { type: 'select_garment', garmentId: shirt.id })),
    ).toMatchObject({ code: 'garment_not_found', status: 404 });
  });

  it('limits the cart to ten garments and quantities to one to five', () => {
    let d = createDraft();
    for (let i = 0; i < 10; i++) d = run(d, { type: 'add_garment', productCode: 'shirt' });
    expect(failure(() => run(d, { type: 'add_garment', productCode: 'shirt' }))).toMatchObject({
      code: 'garment_limit_reached',
      status: 422,
    });
    const three = run(d, { type: 'set_quantity', garmentId: d.garments[0].id, quantity: 3 });
    expect(three.garments[0].quantity).toBe(3);
  });

  it('unconfirms measurements when a new garment needs fields the profile lacks (CRT-004)', () => {
    const values = Object.fromEntries(
      requiredDefinitionsForProducts(['suit']).map((m) => [m.id, 900]),
    );
    const measured = run(withSuit(), { type: 'measurements', values, confirm: true });
    const blazer = run(measured, { type: 'add_garment', productCode: 'blazer' });
    expect(blazer.measurements.confirmed).toBe(true);
    const shirt = run(measured, { type: 'add_garment', productCode: 'shirt' });
    expect(shirt.measurements.confirmed).toBe(false);
    expect(
      requiredDefinitionsForProducts(['suit', 'shirt'])
        .map((m) => m.id)
        .filter((id) => !shirt.measurements.values[id]),
    ).toEqual(['neck']);
  });

  it('accepts a design only when every visible required option is answered', () => {
    const vest = run(withSuit(), {
      type: 'design',
      patch: { preferences: { occasion: 'office', climate: 'cool' }, components: { vest: true } },
    });
    expect(failure(() => run(vest, { type: 'accept_design' }))).toMatchObject({
      code: 'design_incomplete',
      message: 'Complete these choices before confirming: Style.',
      details: {
        garmentId: active(vest).id,
        missing: ['style.vest.waistcoat_style_combined.waistcoat-style-combined'],
      },
    });
    const accepted = run(
      vest,
      {
        type: 'design',
        patch: {
          selections: {
            'style.vest.waistcoat_style_combined.waistcoat-style-combined': 'simple_5',
          },
        },
      },
      { type: 'accept_design' },
    );
    expect(active(accepted).confirmed).toEqual(['product', 'material', 'preferences', 'details']);
  });

  it('keeps the skin tone on the draft', () => {
    expect(run(createDraft(), { type: 'appearance', skinTone: 'deep' }).skinTone).toBe('deep');
  });
});

describe('catalog updates (CATALOG-ADMIN §7.8)', () => {
  const v1 = reference();
  const v2 = { ...reference(), version: 2 };
  const withoutPeak = {
    ...reference(),
    version: 3,
    components: v1.components.map((component) => ({
      ...component,
      groups: component.groups.map((group) => ({
        ...group,
        attributes: group.attributes.map((attribute) =>
          attribute.code === LAPEL
            ? { ...attribute, values: attribute.values.filter((value) => value.code !== 'peak') }
            : attribute,
        ),
      })),
    })),
  };
  const pinned = (draft: DraftV2, commands: CommandV2[]) =>
    commands.reduce((d, command) => applyCommand(d, command, contextFor(v1)), draft);

  it('moves a garment silently when the new release loses none of its choices', () => {
    const d = pinned(createDraft(), [{ type: 'add_garment', productCode: 'suit' }]);
    const context = contextFor(v1, v2);
    expect(catalogUpdates(context, d)).toEqual([]);
    const next = applyCommand(
      d,
      { type: 'design', patch: { selections: { [FIT]: '0' } } },
      context,
    );
    expect(active(next).catalogVersion).toBe(2);
  });

  it('asks the customer to review an update that changes a choice', () => {
    const d = pinned(createDraft(), [
      { type: 'add_garment', productCode: 'suit' },
      { type: 'design', patch: { selections: { [LAPEL]: 'peak' } } },
    ]);
    const context = contextFor(v1, withoutPeak);
    const garmentId = active(d).id;
    const impact = [
      {
        garmentId,
        kind: 'selection_replaced',
        attributeCode: LAPEL,
        from: 'peak',
        to: 'standard',
        message: 'Lapel style: Peak is no longer offered and changes to Notch.',
      },
    ];
    expect(catalogUpdates(context, d)).toEqual([{ garmentId, impact }]);
    expect(
      failure(() =>
        applyCommand(d, { type: 'design', patch: { selections: { [FIT]: '0' } } }, context),
      ),
    ).toMatchObject({ code: 'catalog_update_required', status: 409, details: { impact } });
    expect(
      failure(() =>
        applyCommand(d, { type: 'rebase_catalog', garmentId, confirmImpact: false }, context),
      ),
    ).toMatchObject({ code: 'impact_confirmation_required', details: { impact } });
    const rebased = applyCommand(
      d,
      { type: 'rebase_catalog', garmentId, confirmImpact: true },
      context,
    );
    expect(active(rebased)).toMatchObject({
      catalogVersion: 3,
      selections: { [LAPEL]: 'standard' },
    });
    expect(catalogUpdates(context, rebased)).toEqual([]);
  });
});
