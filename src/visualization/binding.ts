import { effectiveSelections, type GarmentShape } from '@/modules/catalog/structure';
import { valueKey, type RuntimeIndex } from '@/modules/catalog/snapshot';
import type { SkinTone } from '@/modules/configuration/types';
import { isSlotId, type SlotId, type VisualModel } from './registry';

// Visual binding (CATALOG-ADMIN.md §6, CAT-014). The renderers stay code; they
// read render values — a registry slot's token, the chosen image, the included
// parts — instead of catalog selection keys. Only effective (visible) choices
// are drawn. A visible choice on a bound option without a token is reported
// as not illustrated, so the customer sees the choice text instead (VIS-002).

export type RenderPattern = 'plain' | 'twill' | 'check' | 'stripe';
export type RenderInput = {
  visualModel: VisualModel;
  skinTone: SkinTone;
  /** The garment cloth: colour and drawn pattern. */
  material: { color: string; pattern: RenderPattern };
  /** Visual parts of the included components (`jacket`, `trousers`, `vest`, `shirt`). */
  parts: string[];
  tokens: Partial<Record<SlotId, string>>;
  /** URL of the chosen choice's image, per slot. */
  images: Partial<Record<SlotId, string>>;
};
export type Binding = RenderInput & {
  /** Visible bound options whose choice has no token (drawn as “Not illustrated”). */
  notIllustrated: string[];
};

const FALLBACK_MATERIAL = { color: '#4a4c50', pattern: 'plain' as const };

export function renderValues(
  index: RuntimeIndex,
  garment: GarmentShape,
  skinTone: SkinTone,
): Binding {
  const product = index.products.get(garment.productCode);
  const material = index.materials.get(garment.materialCode);
  const binding: Binding = {
    visualModel: product?.visualModel ?? 'suit',
    skinTone,
    material: material
      ? { color: material.primaryHex || FALLBACK_MATERIAL.color, pattern: material.renderPattern }
      : FALLBACK_MATERIAL,
    parts: [],
    tokens: {},
    images: {},
    notIllustrated: [],
  };
  if (!product) return binding;
  const effective = effectiveSelections(index, garment);
  binding.parts = product.components
    .filter((link) => effective.context.includedComponents.has(link.componentCode))
    .flatMap((link) => {
      const component = index.components.get(link.componentCode);
      return component ? [component.visualPart] : [];
    });
  for (const code of effective.visibleAttributes) {
    const { attribute } = index.attributes.get(code)!;
    const slot = attribute.visualSlot;
    const selected = effective.selections[code];
    if (!slot || !isSlotId(slot) || selected === undefined || attribute.inputType !== 'choice')
      continue;
    const value = index.values.get(valueKey(code, selected))?.value;
    if (!value) continue;
    if (value.visualToken === null) {
      binding.notIllustrated.push(code);
      continue;
    }
    binding.tokens[slot] = value.visualToken;
    const image = value.imageMediaId ? index.media.get(value.imageMediaId)?.url : undefined;
    if (image) binding.images[slot] = image;
  }
  return binding;
}
