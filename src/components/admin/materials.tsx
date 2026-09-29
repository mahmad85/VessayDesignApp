'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  adminFetch,
  useAdminData,
  RecordEditor,
  PageTitle,
  FieldInput,
  Badges,
  options,
  entryOptions,
  type Entry,
  type Field,
} from './editor';
import { identityFields } from './catalog-fields';
import { MEDIA_ROLES, USAGES } from '@/modules/catalog/snapshot';
import { REFERENCE_CONFIRMATION } from '@/modules/catalog/material-input';
type Lookups = { types: (Entry & { values: Entry[] })[] };
const lookupOptions = (data: Lookups | null, code: string) =>
  (data?.types.find((t) => t.code === code)?.values ?? []).map((v) => ({
    value: v.code,
    label: String(v.label) + (v.active ? '' : ' (inactive)'),
  }));
export function Fabrics({ canWrite }: { canWrite: boolean }) {
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [chosen, setChosen] = useState<string[]>([]),
    [bulk, setBulk] = useState<Record<string, unknown>>({}),
    [error, setError] = useState('');
  const products = useAdminData<{ items: Entry[] }>('/api/admin/catalog/products'),
    suppliers = useAdminData<{ items: Entry[] }>('/api/admin/suppliers?limit=100'),
    pricing = useAdminData<{ bands: Entry[] }>('/api/admin/pricing');
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    limit: '100',
  }).toString();
  const materials = useAdminData<{ items: Entry[]; nextCursor: string | null }>(
    `/api/admin/catalog/materials?${query}`,
  );
  const fields: Field[] = [
    { key: 'query', label: 'Search fabrics' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: options(['draft', 'active', 'archived']),
    },
    { key: 'usage', label: 'Usage', type: 'select', options: options(USAGES) },
    {
      key: 'productId',
      label: 'Product',
      type: 'select',
      options: entryOptions(products.data?.items ?? []),
    },
    {
      key: 'band',
      label: 'Price band',
      type: 'select',
      options: (pricing.data?.bands ?? []).map((b) => ({ value: b.code, label: b.name })),
    },
    {
      key: 'availability',
      label: 'Live availability',
      type: 'select',
      options: options(['in_stock', 'low_stock', 'out_of_stock', 'discontinued', 'unknown']),
    },
    {
      key: 'supplierId',
      label: 'Supplier',
      type: 'select',
      options: entryOptions(suppliers.data?.items ?? []),
    },
    {
      key: 'referenceOnly',
      label: 'Reference data',
      type: 'select',
      options: [
        { value: 'true', label: 'Reference only' },
        { value: 'false', label: 'Cleared' },
      ],
    },
  ];
  return (
    <>
      <PageTitle
        title="Fabrics"
        description="Build a considered cloth collection, with supplier facts kept exactly as provided."
      >
        {canWrite && (
          <Link className="admin-action" href="/admin/catalog/fabrics/new">
            New fabric →
          </Link>
        )}
      </PageTitle>
      <div className="admin-filter-grid">
        {fields.map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={filters[f.key]}
            onChange={(v) => setFilters({ ...filters, [f.key]: String(v ?? '') })}
          />
        ))}
      </div>
      {canWrite && (
        <fieldset className="admin-card">
          <legend>Bulk edit · {chosen.length} selected</legend>
          <div className="admin-toolbar">
            {[
              { ...fields[1], key: 'status' },
              { ...fields[4], key: 'priceBandCode' },
              fields[5],
            ].map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={bulk[f.key]}
                onChange={(v) =>
                  setBulk((s) => {
                    const next = { ...s, [f.key]: v };
                    if (!v) delete next[f.key];
                    return next;
                  })
                }
              />
            ))}
            <button
              disabled={!chosen.length || !Object.keys(bulk).length}
              onClick={async () => {
                if (
                  bulk.availability &&
                  !window.confirm('This updates the live store now. Continue?')
                )
                  return;
                try {
                  await adminFetch('/api/admin/catalog/materials/bulk', 'POST', {
                    ids: chosen,
                    set: bulk,
                  });
                  setChosen([]);
                  await materials.load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Apply bulk changes
            </button>
          </div>
        </fieldset>
      )}
      {(error || materials.error) && <p role="alert">{error || materials.error}</p>}
      <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Fabrics">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Fabric</th>
              <th>Colour / pattern</th>
              <th>Band</th>
              <th>Availability · live</th>
              <th>Supplier</th>
              <th>Products</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {materials.data?.items.map((m) => (
              <tr key={m.id}>
                <td>
                  <input
                    aria-label={`Select ${m.name}`}
                    type="checkbox"
                    checked={chosen.includes(m.id)}
                    onChange={(e) =>
                      setChosen((s) =>
                        e.target.checked ? [...s, m.id] : s.filter((id) => id !== m.id),
                      )
                    }
                  />
                </td>
                <td>
                  {!!m.swatchUrl && (
                    <span
                      className="admin-thumb"
                      role="img"
                      aria-label={`${m.name} swatch`}
                      style={{ backgroundImage: `url(${m.swatchUrl})` }}
                    />
                  )}
                  <Link href={`/admin/catalog/fabrics/${m.id}`}>{m.name}</Link>
                  <small>{m.code}</small>
                </td>
                <td>
                  {String(m.colourFamilyCode ?? 'Unknown')} / {String(m.patternCode ?? 'Unknown')}
                </td>
                <td>{String(m.priceBandCode ?? 'Not priced')}</td>
                <td>{String(m.availability).replaceAll('_', ' ')}</td>
                <td>{String(m.supplierName ?? 'Not recorded')}</td>
                <td>{(m.productCodes as string[])?.join(', ')}</td>
                <td>
                  {m.status}
                  <Badges value={m.badges} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {materials.data?.nextCursor && (
        <button
          onClick={async () => {
            const more = await adminFetch<{ items: Entry[]; nextCursor: string | null }>(
              `/api/admin/catalog/materials?${query}&cursor=${materials.data?.nextCursor}`,
            );
            materials.setData((old) =>
              old ? { items: [...old.items, ...more.items], nextCursor: more.nextCursor } : more,
            );
          }}
        >
          Load more fabrics
        </button>
      )}
    </>
  );
}
export function FabricEditor({
  id,
  canWrite,
  canPublish,
}: {
  id: string;
  canWrite: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const data = useAdminData<Entry>(id === 'new' ? null : `/api/admin/catalog/materials/${id}`),
    lookups = useAdminData<Lookups>('/api/admin/lookups'),
    products = useAdminData<{ items: Entry[] }>('/api/admin/catalog/products'),
    suppliers = useAdminData<{ items: Entry[] }>('/api/admin/suppliers?limit=100'),
    pricing = useAdminData<{
      bands: Entry[];
      currency: string;
      matrix: { productId: string; prices: Record<string, number | null> }[];
    }>('/api/admin/pricing');
  const [created, setCreated] = useState<Entry | null>(null),
    [notice, setNotice] = useState('');
  const record =
    created ??
    (id === 'new'
      ? {
          id: 'new',
          code: '',
          name: '',
          rowVersion: 1,
          status: 'draft',
          composition: [],
          productIds: [],
          usages: [],
          media: [],
          priceOverrides: [],
        }
      : data.data);
  if (!record || !lookups.data || !products.data)
    return <p role="status">Loading fabric details…</p>;
  const lookup = (key: string, label: string, list: string, multi = false): Field => ({
    key,
    label,
    type: multi ? 'multi' : 'select',
    options: lookupOptions(lookups.data, list),
    nullable: !multi,
  });
  const nullable = (key: string, label: string): Field => ({ key, label, nullable: true });
  const fields: Field[] = [
    ...identityFields.map((f, i) => ({ ...f, section: i === 0 ? 'Identity' : undefined })),
    {
      key: 'supplierId',
      label: 'Fabric supplier',
      type: 'select',
      options: entryOptions(
        (suppliers.data?.items ?? []).filter((s) =>
          ['fabric_mill', 'fabric_merchant'].includes(String(s.kind)),
        ),
      ),
      nullable: true,
    },
    nullable('supplierArticleCode', 'Supplier article code'),
    nullable('millName', 'Mill name'),
    { key: 'displayMillName', label: 'Show mill name to customers', type: 'checkbox' },
    nullable('collectionName', 'Collection / bunch'),
    nullable('seasonCode', 'Supplier season label'),
    { ...nullable('colourName', 'Colour name'), section: 'Appearance' },
    lookup('colourFamilyCode', 'Colour family', 'colour_family'),
    { key: 'primaryHex', label: 'Primary colour', type: 'colour', nullable: true },
    { key: 'secondaryHex', label: 'Secondary colour', type: 'colour', nullable: true },
    lookup('patternCode', 'Pattern', 'pattern'),
    lookup('weaveCode', 'Weave', 'weave'),
    lookup('textureCode', 'Texture', 'texture'),
    lookup('sheenCode', 'Sheen', 'sheen'),
    lookup('finishCodes', 'Finishes', 'finish', true),
    {
      key: 'weightGsm',
      label: 'Weight (g/m²)',
      type: 'number',
      min: 60,
      max: 700,
      section: 'Technical',
      nullable: true,
    },
    {
      key: 'superNumber',
      label: 'Super number (wool only)',
      type: 'number',
      min: 60,
      max: 250,
      nullable: true,
    },
    nullable('yarnCount', 'Yarn count'),
    { key: 'widthCm', label: 'Width (cm)', type: 'number', min: 100, max: 180, nullable: true },
    lookup('stretchCode', 'Stretch', 'stretch'),
    { ...lookup('seasonCodes', 'Seasons', 'season', true), section: 'Wear' },
    lookup('climateCodes', 'Climates', 'climate', true),
    lookup('occasionCodes', 'Occasions', 'occasion', true),
    { key: 'formality', label: 'Formality (1–5)', type: 'number', min: 1, max: 5, nullable: true },
    ...['wrinkleResistance', 'breathability', 'opacity'].map((key) => ({
      key,
      label: key === 'wrinkleResistance' ? 'Wrinkle resistance' : key,
      type: 'select' as const,
      options: options(['low', 'medium', 'high']),
      nullable: true,
    })),
    {
      key: 'drape',
      label: 'Drape',
      type: 'select',
      options: options(['fluid', 'balanced', 'structured']),
      nullable: true,
    },
    lookup('careCodes', 'Care', 'care', true),
    {
      key: 'descriptionShort',
      label: 'Short description',
      type: 'textarea',
      max: 160,
      section: 'Story',
    },
    { key: 'story', label: 'Fabric story', type: 'textarea', max: 2000 },
    lookup('tagCodes', 'Tags', 'tag', true),
    {
      key: 'usages',
      label: 'Usages',
      type: 'multi',
      options: options(USAGES),
      section: 'Usage and products',
    },
    {
      key: 'productIds',
      label: 'Allowed products',
      type: 'multi',
      options: entryOptions(products.data.items),
    },
    {
      key: 'priceBandCode',
      label: 'Price band',
      type: 'select',
      options: (pricing.data?.bands ?? []).map((b) => ({ value: b.code, label: b.name })),
      nullable: true,
      section: 'Pricing',
    },
    { key: 'textureScaleCm', label: 'Texture tile width (cm)', type: 'number', nullable: true },
  ];
  async function saved(row: Entry) {
    setCreated(row);
    setNotice(
      row.activationMissing
        ? `Saved as draft. Still needed: ${(row.activationMissing as string[]).join(', ')}.`
        : 'Fabric saved.',
    );
    window.dispatchEvent(new Event('catalog-saved'));
  }
  return (
    <>
      <PageTitle
        title={record.id === 'new' ? 'New fabric' : record.name}
        description="Unknown supplier facts may stay blank. Prices and descriptive changes take effect when published."
      >
        <Link href="/admin/catalog/fabrics">← All fabrics</Link>
      </PageTitle>
      {record.referenceOnly === true && (
        <div className="admin-card">
          <strong>Reference data — not orderable in production</strong>
          {canPublish && (
            <button
              onClick={async () => {
                const confirmation = window.prompt(
                  `To clear this flag, enter exactly:\n${REFERENCE_CONFIRMATION}`,
                );
                if (confirmation)
                  try {
                    await adminFetch(
                      `/api/admin/catalog/materials/${record!.id}/clear-reference-only`,
                      'POST',
                      { confirmation },
                    );
                    setCreated(await adminFetch(`/api/admin/catalog/materials/${record!.id}`));
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
              }}
            >
              Clear reference-only…
            </button>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <nav className="admin-toolbar" aria-label="Fabric sections">
        <a href="#fabric-details">Details</a>
        <a href="#fabric-commercial">Prices & images</a>
        <a href="#fabric-availability">Live availability</a>
      </nav>
      <section className="admin-detail-panel" id="fabric-details">
        <RecordEditor
          key={`${record.id}:${record.rowVersion}`}
          record={record}
          fields={fields}
          url={`/api/admin/catalog/materials${record.id === 'new' ? '' : `/${record.id}`}`}
          method={record.id === 'new' ? 'POST' : 'PATCH'}
          canWrite={canWrite}
          transform={(draft) => ({
            ...Object.fromEntries(
              fields.filter((f) => draft[f.key] !== undefined).map((f) => [f.key, draft[f.key]]),
            ),
            composition: draft.composition,
          })}
          onSaved={(row) => void saved(row)}
        >
          {(draft, set) => (
            <>
              <fieldset>
                <legend>Composition</legend>
                {((draft.composition as { fibre: string; percent: number }[]) ?? []).map((c, i) => (
                  <div key={i} className="admin-inline-fields">
                    <FieldInput
                      field={lookup('fibre', 'Fibre', 'fibre')}
                      value={c.fibre}
                      onChange={(v) =>
                        set(
                          'composition',
                          (draft.composition as (typeof c)[]).map((x, j) =>
                            j === i ? { ...x, fibre: String(v) } : x,
                          ),
                        )
                      }
                    />
                    <FieldInput
                      field={{ key: 'percent', label: 'Percent', type: 'number', min: 1, max: 100 }}
                      value={c.percent}
                      onChange={(v) =>
                        set(
                          'composition',
                          (draft.composition as (typeof c)[]).map((x, j) =>
                            j === i ? { ...x, percent: Number(v) } : x,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          'composition',
                          (draft.composition as (typeof c)[]).filter((_, j) => j !== i),
                        )
                      }
                    >
                      Remove fibre {i + 1}
                    </button>
                  </div>
                ))}
                <p>
                  Composition total:{' '}
                  {((draft.composition as { percent: number }[]) ?? []).reduce(
                    (n, c) => n + c.percent,
                    0,
                  )}
                  % · must total 100% when supplied.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    set('composition', [
                      ...(draft.composition as object[]),
                      { fibre: '', percent: 0 },
                    ])
                  }
                >
                  Add fibre
                </button>
              </fieldset>
              {!!draft.weightGsm && (
                <p>
                  {Number(draft.weightGsm)} g/m² = {(Number(draft.weightGsm) / 33.906).toFixed(1)}{' '}
                  oz/yd²
                </p>
              )}
              <h3>Customer base prices</h3>
              {((draft.productIds as string[]) ?? []).map((p) => {
                const override = ((record.priceOverrides as Entry[]) ?? []).find(
                  (o) => o.productId === p,
                );
                const amount =
                  override?.priceMinor ??
                  pricing.data?.matrix.find((m) => m.productId === p)?.prices[
                    String(draft.priceBandCode)
                  ] ??
                  null;
                return (
                  <p key={p}>
                    {products.data?.items.find((x) => x.id === p)?.name}:{' '}
                    {amount === null
                      ? 'Price not yet available'
                      : `${pricing.data?.currency} ${(Number(amount) / 100).toFixed(2)}`}
                    {override ? ' · Fabric override' : ' · Band price'}
                  </p>
                );
              })}
            </>
          )}
        </RecordEditor>
      </section>
      {record.id !== 'new' && (
        <>
          <section id="fabric-commercial">
            <FabricCommercial
              key={record.id + ':' + record.rowVersion}
              record={record}
              products={products.data.items}
              canWrite={canWrite}
              saved={async () =>
                setCreated(await adminFetch(`/api/admin/catalog/materials/${record.id}`))
              }
            />
          </section>
          <section id="fabric-availability" className="admin-card">
            <h2>Live — updates the store immediately</h2>
            <p>
              Last updated:{' '}
              {record.availabilityUpdatedAt
                ? new Date(String(record.availabilityUpdatedAt)).toLocaleString()
                : 'Not recorded'}
            </p>
            <RecordEditor
              key={`${record.id}:availability:${record.rowVersion}`}
              record={record}
              fields={[
                {
                  key: 'availability',
                  label: 'Live availability',
                  type: 'select',
                  options: options([
                    'in_stock',
                    'low_stock',
                    'out_of_stock',
                    'discontinued',
                    'unknown',
                  ]),
                },
                {
                  key: 'stockMeters',
                  label: 'Supplier-provided stock (metres)',
                  type: 'number',
                  min: 0,
                  nullable: true,
                },
                {
                  key: 'leadTimeDays',
                  label: 'Supplier lead time (days)',
                  type: 'number',
                  min: 0,
                  max: 365,
                  nullable: true,
                },
              ]}
              url={`/api/admin/catalog/materials/${record.id}/availability`}
              canWrite={canWrite}
              onSaved={(row) => void saved(row)}
            />
          </section>
          {canWrite && (
            <div className="admin-toolbar">
              <button
                onClick={async () => {
                  const code = window.prompt('New fabric code');
                  if (code)
                    try {
                      const copy = await adminFetch(
                        `/api/admin/catalog/materials/${record.id}/duplicate`,
                        'POST',
                        { newCode: code, newName: `${record.name} copy` },
                      );
                      router.push(`/admin/catalog/fabrics/${copy.id}`);
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                }}
              >
                Duplicate fabric…
              </button>
              <button
                onClick={async () => {
                  try {
                    await saved(
                      await adminFetch(`/api/admin/catalog/materials/${record.id}`, 'PATCH', {
                        rowVersion: record.rowVersion,
                        status: 'archived',
                      }),
                    );
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                Archive fabric
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
function FabricCommercial({
  record,
  products,
  canWrite,
  saved,
}: {
  record: Entry;
  products: Entry[];
  canWrite: boolean;
  saved: () => Promise<void>;
}) {
  const library = useAdminData<{ items: Entry[] }>('/api/admin/media?limit=100');
  const [media, setMedia] = useState(
      ((record.media as Entry[]) ?? []).map((m) => ({
        mediaId: String(m.mediaId),
        role: String(m.role),
        sort: Number(m.sort),
      })),
    ),
    [overrides, setOverrides] = useState<Record<string, unknown>>(
      Object.fromEntries(
        ((record.priceOverrides as Entry[]) ?? []).map((o) => [String(o.productId), o.priceMinor]),
      ),
    ),
    [error, setError] = useState('');
  async function save(kind: string, input: unknown) {
    try {
      await adminFetch(`/api/admin/catalog/materials/${record.id}/${kind}`, 'PUT', input);
      await saved();
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <fieldset disabled={!canWrite} className="admin-card">
      <legend>Fabric prices & images</legend>
      <h3>Price overrides</h3>
      {products
        .filter((p) => (record.productIds as string[]).includes(p.id))
        .map((p) => (
          <FieldInput
            key={p.id}
            field={{
              key: p.id,
              label: `${p.name} override (blank uses band)`,
              type: 'money',
              nullable: true,
            }}
            value={overrides[p.id]}
            onChange={(v) => setOverrides({ ...overrides, [p.id]: v })}
          />
        ))}
      <button
        onClick={() =>
          void save('price-overrides', {
            items: Object.entries(overrides).map(([productId, priceMinor]) => ({
              productId,
              priceMinor,
            })),
          })
        }
      >
        Save price overrides
      </button>
      <h3>Images · a swatch is required for active fabrics</h3>
      {media.map((m, i) => (
        <div className="admin-inline-fields" key={i}>
          <FieldInput
            field={{
              key: 'image',
              label: 'Image',
              type: 'select',
              options: (library.data?.items ?? []).map((m) => ({
                value: m.id,
                label: String(m.altText),
              })),
            }}
            value={m.mediaId}
            onChange={(v) =>
              setMedia((s) => s.map((m, j) => (j === i ? { ...m, mediaId: String(v) } : m)))
            }
          />
          <FieldInput
            field={{
              key: 'role',
              label: 'Image role',
              type: 'select',
              options: options(MEDIA_ROLES),
            }}
            value={m.role}
            onChange={(v) =>
              setMedia((s) => s.map((m, j) => (j === i ? { ...m, role: String(v) } : m)))
            }
          />
          <button onClick={() => setMedia((s) => s.filter((_, j) => j !== i))}>
            Remove image {i + 1}
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          setMedia((s) => [...s, { mediaId: '', role: 'swatch', sort: s.length * 10 }])
        }
      >
        Add image
      </button>
      <button onClick={() => void save('media', { items: media })}>Save images</button>
      <Link href="/admin/catalog/media">Upload or edit alt text in media library ↗</Link>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
