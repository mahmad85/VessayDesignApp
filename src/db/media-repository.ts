import { getDatabase } from './client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { imageInfo, uploadForm } from '@/modules/catalog/media-upload';
import { RIGHTS_STATUSES } from '@/modules/catalog/snapshot';
import { getStorage } from '@/integrations/storage';
import { columns, dto, insert, mutate, update } from './admin-mutations';
import { pageQuery } from '@/lib/admin-http';
import { DomainError } from '@/modules/configuration/types';

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

const mediaFields = z
  .object({
    altText: z.string().min(1).max(250),
    rightsStatus: z.enum(RIGHTS_STATUSES),
    sourceNote: z.string().max(2000).optional(),
  })
  .strict();
const mediaDto = (row: Record<string, unknown>) => ({ ...dto(row), url: `/api/media/${row.id}` });
export async function uploadMedia(request: Request, actor: string) {
  const form = await uploadForm(request);
  const file = form.get('file');
  if (!(file instanceof File))
    throw new DomainError('upload_invalid', 'An image file is required.', 415);
  const fields = mediaFields.parse({
    altText: form.get('altText'),
    rightsStatus: form.get('rightsStatus'),
    sourceNote: form.get('sourceNote') ?? undefined,
  });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageInfo(bytes, file.name, file.type);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storage = getStorage();
  return mutate(async (query) => {
    await query('SELECT pg_advisory_xact_lock(731853)');
    const [existing] = await query(
      'SELECT * FROM media_assets WHERE sha256=$1 ORDER BY created_at LIMIT 1',
      [sha256],
    );
    if (existing) return mediaDto(existing);
    const id = crypto.randomUUID(),
      key = `media/${id}.${info.ext}`;
    await storage.put(key, bytes, info.contentType);
    return mediaDto(
      await insert(
        query,
        'media_assets',
        {
          id,
          storage_driver: storage.driver,
          storage_key: key,
          content_type: info.contentType,
          bytes: bytes.length,
          width: info.width,
          height: info.height,
          sha256,
          ...columns(fields),
          created_by: actor,
        },
        actor,
      ),
    );
  });
}
export async function editMedia(id: string, input: unknown, actor: string) {
  const { rowVersion, ...data } = mediaFields
    .partial()
    .extend({ rowVersion: z.number().int().positive() })
    .parse(input);
  return mutate(async (query) =>
    mediaDto(await update(query, 'media_assets', id, columns(data), rowVersion, actor)),
  );
}
export async function listMedia(input: unknown) {
  const data = pageQuery
    .extend({
      query: z.string().max(200).optional(),
      rightsStatus: z.enum(RIGHTS_STATUSES).optional(),
    })
    .parse(input);
  const rows = await (
    await getDatabase()
  ).query(
    `SELECT m.*,(SELECT count(*) FROM material_media WHERE media_id=m.id)+(SELECT count(*) FROM template_media WHERE media_id=m.id)+(SELECT count(*) FROM option_values WHERE image_media_id=m.id)+(SELECT count(*) FROM products WHERE hero_media_id=m.id)+(SELECT count(*) FROM option_groups WHERE icon_media_id=m.id) AS used_by FROM media_assets m WHERE ($1::text IS NULL OR m.alt_text ILIKE '%'||$1||'%') AND ($2::text IS NULL OR m.rights_status=$2) AND ($3::text IS NULL OR m.id>$3) ORDER BY m.id LIMIT $4`,
    [data.query ?? null, data.rightsStatus ?? null, data.cursor ?? null, data.limit + 1],
  );
  return {
    items: rows.slice(0, data.limit).map(mediaDto),
    nextCursor: rows.length > data.limit ? String(rows[data.limit - 1].id) : null,
  };
}
