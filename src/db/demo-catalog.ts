import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { safeParseMoney } from '@/lib/money';
import { nameBasedId } from '@/modules/catalog/import-legacy';
import { writeAudit } from './audit';
import type { Query } from './client';

// D-023: turns the imported reference catalog into a complete demo catalog, so
// a publish has no warnings. Every step only fills what is missing: values an
// admin has entered (tiers, base prices, images, suppliers) are kept, and a
// second run changes nothing. Demo use only — the owner approved the
// reference images and Hockerty prices for the demo, not for production.

const DEMO_SUPPLIER = 'sup-demo-reference';
/** Demo base prices by garment type, in minor units (D-023). */
const BASE_PRICE: Record<string, number> = { suit: 45000, blazer: 35000, shirt: 12000 };
/**
 * Tier uplifts from the low end of each tier's indicative suit price in
 * migration 0007 ($450, $600, $850, $1,100): applied only while every tier adds 0.
 */
const UPLIFT: Record<string, number> = { ESS: 0, CLS: 15000, PRM: 40000, LUX: 65000 };
/** Tiers for the eight reference fabrics that have none; others default to Classic. */
const FABRIC_TIER: Record<string, string> = { 'sand-linen': 'PRM' };
const DEFAULT_TIER = 'CLS';
const DEMO_NOTE =
  'Approved by the owner for demo use only (D-023, 2026-10-03); not cleared for a production release.';

/** Images drawn by the app's 2D renderer (scripts/build-demo-images.tsx). */
const IMAGES = {
  suit: { file: 'product-suit.svg', alt: 'Navy two-piece suit, front view' },
  blazer: { file: 'product-blazer.svg', alt: 'Navy blazer, front view' },
  shirt: { file: 'product-shirt.svg', alt: 'White dress shirt, front view' },
  'shirt-collar::point': { file: 'shirt-collar-point.svg', alt: 'Point collar' },
  'shirt-collar::spread': { file: 'shirt-collar-spread.svg', alt: 'Spread collar' },
  'shirt-cuffs::button': { file: 'shirt-cuffs-button.svg', alt: 'Button cuff' },
  'shirt-cuffs::french': { file: 'shirt-cuffs-french.svg', alt: 'French cuff with cufflink' },
  'shirt-fit::classic': { file: 'shirt-fit-classic.svg', alt: 'Classic fit shirt' },
  'shirt-fit::relaxed': { file: 'shirt-fit-relaxed.svg', alt: 'Relaxed fit shirt' },
  'shirt-fit::tailored': { file: 'shirt-fit-tailored.svg', alt: 'Tailored fit shirt' },
  'jacket-fit::relaxed': { file: 'jacket-fit-relaxed.svg', alt: 'Relaxed fit jacket' },
} as const;
type ImageKey = keyof typeof IMAGES;

const readPublic = (url: string) => readFile(path.join(process.cwd(), 'public', url));

export type DemoSummary = Record<string, number>;

export async function applyDemoCatalog(
  query: Query,
  actor: string,
  readStatic: (url: string) => Promise<Uint8Array> = readPublic,
): Promise<DemoSummary> {
  const summary: DemoSummary = {};
  const count = (key: string, rows: unknown[]) => (summary[key] = rows.length);
  const touch = 'row_version=row_version+1,updated_at=now()';

  // 1. Reference images: cleared for the demo, with the reason recorded.
  count(
    'imageRights',
    await query(
      `UPDATE media_assets SET rights_status='supplier_provided',source_note=$1,${touch} WHERE rights_status IN ('reference_only','unknown') AND storage_driver='static' RETURNING id`,
      [DEMO_NOTE],
    ),
  );

  // 2. Reference-only flags: the demo catalog can be ordered.
  let flags = 0;
  for (const table of [
    'components',
    'option_groups',
    'attributes',
    'option_values',
    'products',
    'materials',
    'templates',
  ])
    flags += (
      await query(
        `UPDATE ${table} SET reference_only=false,${touch} WHERE reference_only RETURNING id`,
      )
    ).length;
  summary.referenceFlags = flags;

  // 3. Hockerty reference prices become the choices' extra prices where none is set.
  const priced = await query<{ id: string; price: string }>(
    "SELECT id, metadata->>'referencePrice' AS price FROM option_values WHERE surcharge_minor=0 AND metadata ? 'referencePrice'",
  );
  let prices = 0;
  for (const row of priced) {
    const parsed = safeParseMoney(String(row.price));
    if (!parsed.ok || parsed.minor === 0) continue;
    await query(`UPDATE option_values SET surcharge_minor=$1,${touch} WHERE id=$2`, [
      parsed.minor,
      row.id,
    ]);
    prices++;
  }
  summary.choicePrices = prices;

  // 4. Fabrics without a supplier get the clearly labelled demo supplier.
  await query(
    "INSERT INTO suppliers(id,code,name,kind,status,capabilities,notes) VALUES($1,'demo-reference','Demo reference cloth (synthetic)','fabric_merchant','active',ARRAY['suiting','shirting']::text[],$2) ON CONFLICT (id) DO NOTHING",
    [DEMO_SUPPLIER, 'Synthetic supplier for the demo reference fabrics (D-023).'],
  );
  count(
    'fabricSuppliers',
    await query(
      `UPDATE materials SET supplier_id=coalesce(supplier_id,$1),supplier_article_code=coalesce(supplier_article_code,'DEMO-'||upper(code)),${touch} WHERE supplier_id IS NULL OR supplier_article_code IS NULL RETURNING id`,
      [DEMO_SUPPLIER],
    ),
  );

  // 5. Prices: tiers for untiered fabrics, uplifts while all are 0, base prices.
  const bands = new Set(
    (await query<{ code: string }>('SELECT code FROM price_bands')).map((b) => b.code),
  );
  let tiers = 0;
  for (const row of await query<{ id: string; code: string }>(
    'SELECT id,code FROM materials WHERE price_band_code IS NULL',
  )) {
    const tier = FABRIC_TIER[row.code] ?? DEFAULT_TIER;
    if (!bands.has(tier)) continue;
    await query(`UPDATE materials SET price_band_code=$1,${touch} WHERE id=$2`, [tier, row.id]);
    tiers++;
  }
  summary.fabricTiers = tiers;
  const [{ set }] = await query<{ set: number }>(
    'SELECT count(*)::int AS set FROM price_bands WHERE uplift_minor<>0',
  );
  let uplifts = 0;
  if (!set)
    for (const [code, amount] of Object.entries(UPLIFT))
      uplifts += (
        await query(
          `UPDATE price_bands SET uplift_minor=$1,${touch} WHERE code=$2 AND uplift_minor<>$1 RETURNING code`,
          [amount, code],
        )
      ).length;
  summary.tierUplifts = uplifts;
  let bases = 0;
  for (const row of await query<{ id: string; measurement_set: string }>(
    'SELECT id,measurement_set FROM products WHERE base_price_minor IS NULL',
  )) {
    const amount = BASE_PRICE[row.measurement_set];
    if (amount === undefined) continue;
    await query(`UPDATE products SET base_price_minor=$1,${touch} WHERE id=$2`, [amount, row.id]);
    bases++;
  }
  summary.basePrices = bases;

  // 6. Images: the app's own drawings for products and choices without one.
  const mediaFor = async (key: ImageKey) => {
    const { file, alt } = IMAGES[key];
    const url = `/reference-assets/demo/${file}`;
    const id = nameBasedId(`static:${url}`);
    const bytes = await readStatic(url);
    await query(
      "INSERT INTO media_assets(id,storage_driver,storage_key,content_type,bytes,width,height,sha256,alt_text,rights_status,source_note,created_by) VALUES($1,'static',$2,'image/svg+xml',$3,NULL,NULL,$4,$5,'owned',$6,$7) ON CONFLICT (storage_driver,storage_key) DO NOTHING",
      [
        id,
        url,
        bytes.byteLength,
        createHash('sha256').update(bytes).digest('hex'),
        alt,
        "Drawn by the app's 2D garment renderer (scripts/build-demo-images.tsx).",
        actor,
      ],
    );
    const [row] = await query<{ id: string }>(
      "SELECT id FROM media_assets WHERE storage_driver='static' AND storage_key=$1",
      [url],
    );
    return row.id;
  };
  let images = 0;
  for (const row of await query<{ id: string; visual_model: string }>(
    'SELECT id,visual_model FROM products WHERE hero_media_id IS NULL',
  )) {
    const key = row.visual_model as ImageKey;
    if (!(key in IMAGES)) continue;
    await query(`UPDATE products SET hero_media_id=$1,${touch} WHERE id=$2`, [
      await mediaFor(key),
      row.id,
    ]);
    images++;
  }
  for (const row of await query<{ id: string; key: string }>(
    // `style.shirt.shirt_collar.shirt-collar` + `point` → `shirt-collar::point`
    "SELECT v.id, regexp_replace(a.code,'^.*\\.','') || '::' || v.code AS key FROM option_values v JOIN attributes a ON a.id=v.attribute_id WHERE v.image_media_id IS NULL",
  )) {
    if (!(row.key in IMAGES)) continue;
    await query(`UPDATE option_values SET image_media_id=$1,${touch} WHERE id=$2`, [
      await mediaFor(row.key as ImageKey),
      row.id,
    ]);
    images++;
  }
  // A subcategory's icon is its default choice's image (else its first with one).
  images += (
    await query(
      `UPDATE option_groups g SET icon_media_id=pick.image,${touch} FROM (
        SELECT DISTINCT ON (a.group_id) a.group_id, v.image_media_id AS image
        FROM attributes a JOIN option_values v ON v.attribute_id=a.id
        WHERE v.image_media_id IS NOT NULL AND v.status<>'archived'
        ORDER BY a.group_id, a.sort, v.is_default DESC, v.sort
      ) pick WHERE pick.group_id=g.id AND g.icon_media_id IS NULL RETURNING g.id`,
    )
  ).length;
  summary.images = images;

  await writeAudit(query, {
    actor,
    action: 'catalog.demo_applied',
    entityType: 'catalog',
    summary: { fields: Object.keys(summary), after: summary },
  });
  return summary;
}
