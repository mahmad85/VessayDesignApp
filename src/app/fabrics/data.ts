import { ensureCatalog, getRelease } from '@/db/release-repository';
import { getAvailability } from '@/db/availability';
import { indexCatalog } from '@/modules/catalog/snapshot';

/** The current published release, indexed for customers, with fabric availability. */
export async function loadFabricCatalog() {
  const version = await ensureCatalog();
  const release = await getRelease(version);
  if (!release) throw new Error(`Catalog release ${version} is missing.`);
  return { index: indexCatalog(release.customer), availability: await getAvailability() };
}
