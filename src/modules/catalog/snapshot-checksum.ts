import { checksum } from '@/lib/canonical-json';
import type { CatalogSnapshot } from './snapshot';

/**
 * Release checksum (ADMIN-BACKEND.md §5): canonical JSON without `version` and
 * `publishedAt`, so equal content has an equal checksum whenever it is compiled
 * or published. Server-only (node:crypto).
 */
export function snapshotChecksum(snapshot: CatalogSnapshot) {
  return checksum({ ...snapshot, version: undefined, publishedAt: undefined });
}
