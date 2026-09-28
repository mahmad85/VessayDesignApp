import { getDatabase } from './client';

// Catalog media records (CAT-016, ADMIN-BACKEND.md §9). Catalog media never
// contain customer data. Uploads and the local driver arrive with WP-22.

export type MediaAsset = {
  id: string;
  storageDriver: 'local' | 'object_store' | 'static';
  storageKey: string;
  contentType: string;
};

export async function getMediaAsset(id: string): Promise<MediaAsset | null> {
  const db = await getDatabase();
  const [row] = await db.query<{
    id: string;
    storage_driver: MediaAsset['storageDriver'];
    storage_key: string;
    content_type: string;
  }>('SELECT id,storage_driver,storage_key,content_type FROM media_assets WHERE id=$1', [id]);
  return row
    ? {
        id: row.id,
        storageDriver: row.storage_driver,
        storageKey: row.storage_key,
        contentType: row.content_type,
      }
    : null;
}
