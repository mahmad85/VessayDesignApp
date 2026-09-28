import { fabricFor } from '@/modules/catalog/catalog';
import {
  defaultSuitCustomizations,
  hasVest,
  optionFor,
} from '@/modules/catalog/suit-customization';
import type { Design, DesignPatch } from '@/modules/configuration/types';
import { garmentPatchFromLegacy } from '@/modules/configuration/upgrade';
import type { RenderInput } from './binding';
import { slotForKey } from './registry';

/**
 * @deprecated Temporary (WP-14 → WP-15): render values for the v1 studio UI
 * until it reads the catalog release. Imported tokens equal the seed value
 * codes (CATALOG-ADMIN §10), so the registry maps them directly. WP-15 removes
 * this file with the v1 UI.
 */
export function legacyRenderInput(design: Design): RenderInput {
  const selections: Record<string, string> =
    design.product === 'suit'
      ? { ...defaultSuitCustomizations(), ...(design.customizations ?? {}) }
      : { ...(garmentPatchFromLegacy(design as DesignPatch, design.product)?.selections ?? {}) };
  if (design.product === 'suit')
    Object.assign(
      selections,
      garmentPatchFromLegacy({ fit: design.fit as DesignPatch['fit'] }, 'suit')?.selections,
    );
  const fabric = fabricFor(design.fabricId);
  const render: RenderInput = {
    visualModel: design.product,
    skinTone: design.skinTone,
    material: { color: fabric?.color ?? '#4a4c50', pattern: fabric?.pattern ?? 'plain' },
    parts:
      design.product === 'suit'
        ? ['jacket', 'trousers', ...(hasVest(selections) ? ['vest'] : [])]
        : [design.product === 'shirt' ? 'shirt' : 'jacket'],
    tokens: {},
    images: {},
  };
  for (const [key, value] of Object.entries(selections)) {
    const slot = slotForKey(key);
    if (!slot) continue;
    render.tokens[slot] = value;
    const asset = optionFor(key, value)?.asset;
    if (asset) render.images[slot] = asset;
  }
  return render;
}
