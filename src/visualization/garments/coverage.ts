import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { VISUAL_SLOTS, isSlotId } from '../registry';

// Main choices drawn in 3D (D-016). Everything else with a drawing region is
// shown in the 2D technical drawing, which the studio points to when it is
// edited. Derived from the catalog (CATALOG-ADMIN §6): a group is shown in 3D
// when one of its options drives a slot the 3D garments draw; a part's include
// toggle is shown in 3D because every part is modelled.

const FIXED_IN_3D = new Set(['product', 'fabric']);

export function shownIn3D(leafId: string, index: RuntimeIndex) {
  if (FIXED_IN_3D.has(leafId)) return true;
  if (leafId.startsWith('include:')) return index.components.has(leafId.slice('include:'.length));
  const group = index.groups.get(leafId)?.group;
  return !!group?.attributes.some(
    (attribute) =>
      !!attribute.visualSlot &&
      isSlotId(attribute.visualSlot) &&
      VISUAL_SLOTS[attribute.visualSlot].shownIn3D,
  );
}
