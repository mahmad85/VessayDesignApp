import { describe, it, expect } from 'vitest';
import { createDraft, applyCommand } from '../src/modules/configuration/engine';
import { commandEnvelope } from '../src/modules/configuration/types';
import {
  definitionsFor,
  displayValue,
  toMillimeters,
} from '../src/modules/measurements/definitions';
import { beginCheckout } from '../src/integrations/checkout';
import { guidedReply } from '../src/integrations/assistant';
import {
  SUIT_CUSTOMIZATION_SEED,
  defaultSuitCustomizations,
  validateSuitCustomizations,
} from '../src/modules/catalog/suit-customization';
import { existsSync } from 'node:fs';
describe('catalog and design invariants', () => {
  it('does not confirm suggested defaults before customer acceptance', () => {
    expect(createDraft().design.confirmed).toEqual([]);
    expect(() => applyCommand(createDraft(), { type: 'accept_design' })).toThrow('occasion');
  });
  it('rejects unknown or incompatible fabric IDs', () => {
    for (const id of ['invented', 'ivory'])
      expect(() =>
        applyCommand(createDraft(), { type: 'design', patch: { fabricId: id } }),
      ).toThrow('not available');
  });
  it('requires consent before a category reset, keeps preferences and invalidates measurements', () => {
    const first = applyCommand(createDraft(), {
      type: 'design',
      patch: { occasion: 'Wedding', climate: 'Warm', fabricId: 'sand-linen' },
    });
    first.measurements.confirmed = true;
    expect(() => applyCommand(first, { type: 'design', patch: { product: 'shirt' } })).toThrow(
      'resets',
    );
    const next = applyCommand(first, {
      type: 'design',
      patch: { product: 'shirt' },
      confirmCategoryChange: true,
    });
    expect(next.design).toMatchObject({
      product: 'shirt',
      fabricId: 'ivory',
      occasion: 'Wedding',
      climate: 'Warm',
    });
    expect(next.measurements.confirmed).toBe(false);
    expect(first.design.product).toBe('suit');
  });
  it('invalidates review on changes and preserves the original snapshot', () => {
    const checked = applyCommand(createDraft(), { type: 'review', mode: 'automated' });
    const edited = applyCommand(checked, { type: 'design', patch: { fit: 'Classic' } });
    expect(checked.review).not.toBeNull();
    expect(edited.review).toBeNull();
    expect(edited.revision).toBe(checked.revision + 1);
  });
  it('rejects arbitrary command fields and unsafe measurement values at the boundary', () => {
    for (const values of [{ chest: -1 }, { chest: 3001 }, { chest: NaN }])
      expect(
        commandEnvelope.safeParse({
          actionId: crypto.randomUUID(),
          expectedRevision: 0,
          command: { type: 'measurements', values, confirm: true },
        }).success,
      ).toBe(false);
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
  it('validates suit customization IDs server-side and synchronizes mapped preview fields', () => {
    const peak = applyCommand(createDraft(), {
      type: 'design',
      patch: {
        customizations: {
          'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type': 'peak',
        },
      },
    });
    expect(peak.design.lapel).toBe('Peak');
    expect(peak.design.customizations).toMatchObject({
      'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type': 'peak',
    });
    const notch = applyCommand(peak, {
      type: 'design',
      patch: { lapel: 'Notch', pockets: 'Flap', closure: 'One button' },
    });
    expect(notch.design.customizations).toMatchObject({
      'style.jacket.jacket_lapel_type_combinated.jacket-lapel-type': 'standard',
      'style.jacket.jacket_pockets_type.jacket-pockets-type': '2',
      'style.jacket.jacket_style_combined.jacket-style-combined': 'simple_1',
    });
    expect(() =>
      applyCommand(createDraft(), {
        type: 'design',
        patch: { customizations: { 'style.jacket.unknown': 'invented' } },
      }),
    ).toThrow('not available');
  });
});
describe('measurement provenance and checkout', () => {
  it('rejects unsupported fields and incomplete confirmation', () => {
    expect(() =>
      applyCommand(createDraft(), {
        type: 'measurements',
        values: { unknown: 100 },
        confirm: false,
      }),
    ).toThrow('not valid');
    expect(() =>
      applyCommand(createDraft(), { type: 'measurements', values: { chest: 1000 }, confirm: true }),
    ).toThrow('required');
  });
  it('creates a manual measurement version without claiming verification', () => {
    const d = createDraft();
    const values = Object.fromEntries(
      definitionsFor('suit').map((m) => [m.id, m.id === 'height' ? 1800 : 900]),
    );
    const next = applyCommand(d, { type: 'measurements', values, confirm: true });
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
  it('never enables payment or claims a submitted human review for the reference catalog', async () => {
    for (const mode of ['automated', 'human'] as const) {
      const d = applyCommand(createDraft(), { type: 'review', mode });
      expect(d.review?.checkoutEligible).toBe(false);
      await expect(beginCheckout(d)).rejects.toThrow('not eligible');
      if (mode === 'human') expect(d.review?.status).toBe('not_submitted');
    }
  });
  it('guided suggestions are proposals and use category-compatible IDs', () => {
    const d = createDraft();
    const suggestion = guidedReply(d, 'I need a shirt for a summer wedding');
    expect(suggestion).toMatchObject({
      mode: 'guided',
      suggestion: { product: 'shirt', climate: 'Warm', occasion: 'Wedding', fabricId: 'ivory' },
    });
    expect(d.design.product).toBe('suit');
  });
});
