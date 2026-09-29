import { getDatabase } from './client';
import type { AvailabilityMap, MaterialAvailability } from '@/modules/catalog/garment';

// Live fabric availability (CATALOG-ADMIN.md §7.6, CAT-018): operational facts
// that change without publishing, overlaid on the release. Each instance
// caches them for up to 60 seconds (ADMIN-BACKEND.md §6); an admin edit busts
// the local cache and other instances converge within the minute. Order
// submission and checkout read them uncached (TASK-023).

export const AVAILABILITY_TTL_MS = 60_000;
const cache = globalThis as unknown as {
  vessyAvailability?: { expires: number; value: Promise<AvailabilityMap> };
};

/** Every fabric's availability, straight from the working tables. */
export async function readAvailability(): Promise<AvailabilityMap> {
  const db = await getDatabase();
  const rows = await db.query<{ code: string; availability: MaterialAvailability }>(
    'SELECT code,availability FROM materials ORDER BY code',
  );
  return Object.fromEntries(rows.map((row) => [row.code, row.availability]));
}

/** Availability for customer reads, cached per instance for AVAILABILITY_TTL_MS. */
export function getAvailability(now = Date.now()): Promise<AvailabilityMap> {
  const hit = cache.vessyAvailability;
  if (hit && hit.expires > now) return hit.value;
  const value = readAvailability();
  cache.vessyAvailability = { expires: now + AVAILABILITY_TTL_MS, value };
  value.catch(() => {
    if (cache.vessyAvailability?.value === value) cache.vessyAvailability = undefined;
  });
  return value;
}

/** Drop this instance's cached availability (after an admin availability edit). */
export function bustAvailabilityCache() {
  cache.vessyAvailability = undefined;
}
