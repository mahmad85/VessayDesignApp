import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { VISUAL_SLOTS, isSlotId } from '../registry';

// Main choices drawn in 3D (D-016). Everything else with a drawing region is
// shown in the 2D technical drawing, which the studio points to when it is
// edited. Derived from the catalog (CATALOG-ADMIN §6): a group is shown in 3D
// when one of its options drives a slot the 3D garments draw; a part's include
// toggle is shown in 3D because every part is modelled.

const FIXED_IN_3D = new Set(['product', 'fabric', 'fabricId']);

/** @deprecated Pre-catalog leaves, used only without a release (the v1 UI until WP-15). */
const LEGACY_IN_3D = new Set([
  'fit',
  'lapel',
  'pockets',
  'closure',
  'collar',
  'cuffs',
  'style.jacket.jacket_style_combined',
  'style.jacket.jacket_fit',
  'style.jacket.jacket_lapel_type_combinated',
  'style.jacket.jacket_pockets_type',
  'style.jacket.jacket_sleeve_buttons_combinated',
  'style.jacket.jacket_vent',
  'style.jacket.jacket_chest_pocket',
  'style.pants.pants_fit',
  'style.pants.pants_length',
  'style.pants.pants_break',
  'style.pants.pants_cuff',
  'style.vest.waistcoat',
  'style.vest.waistcoat_style_combined',
  'style.vest.waistcoat_bottom',
  'accents.jacket.buttons_color',
  'accents.jacket.shoes',
]);

export function shownIn3D(leafId: string, index?: RuntimeIndex) {
  if (FIXED_IN_3D.has(leafId)) return true;
  if (!index) return LEGACY_IN_3D.has(leafId);
  if (leafId.startsWith('include:')) return index.components.has(leafId.slice('include:'.length));
  const group = index.groups.get(leafId)?.group;
  return !!group?.attributes.some(
    (attribute) =>
      !!attribute.visualSlot &&
      isSlotId(attribute.visualSlot) &&
      VISUAL_SLOTS[attribute.visualSlot].shownIn3D,
  );
}
