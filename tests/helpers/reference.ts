import { importLegacyCatalog } from '../../src/modules/catalog/import-legacy';
import { indexSnapshot, type CatalogIndex } from '../../src/modules/catalog/snapshot';
import {
  applyCommand,
  createDraft,
  type EngineContext,
} from '../../src/modules/configuration/engine';
import type { CommandV2, DraftV2, Garment } from '../../src/modules/configuration/types';
import { renderValues } from '../../src/visualization/binding';

// The imported reference catalog as release 1 and v2 drafts built on it, for
// tests that exercise the customer runtime without a database. SYNTHETIC
// drafts only.

let cached: CatalogIndex | undefined;
export function referenceIndex(): CatalogIndex {
  return (cached ??= indexSnapshot({ ...importLegacyCatalog().snapshot, version: 1 }));
}
export function referenceContext(): EngineContext {
  const index = referenceIndex();
  return { current: index, releases: new Map([[1, index]]) };
}
/** A new draft with the commands applied against the reference release. */
export function draftWith(...commands: CommandV2[]): DraftV2 {
  const context = referenceContext();
  return commands.reduce((draft, command) => applyCommand(draft, command, context), createDraft());
}
export function activeGarment(draft: DraftV2): Garment {
  const garment = draft.garments.find((item) => item.id === draft.activeGarmentId);
  if (!garment) throw new Error('The draft has no active garment.');
  return garment;
}
/** Render values of the draft's active garment. */
export function renderOf(draft: DraftV2) {
  return renderValues(referenceIndex(), activeGarment(draft), draft.skinTone);
}
export const add = (productCode: string): CommandV2 => ({ type: 'add_garment', productCode });
export const select = (selections: Record<string, string>): CommandV2 => ({
  type: 'design',
  patch: { selections },
});
