'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { indexCatalog, type CustomerCatalog } from '@/modules/catalog/snapshot';
import { newGarment, validateGarment } from '@/modules/catalog/garment';
import { quoteGarment } from '@/modules/pricing/quote';
import { formatPrice } from '@/lib/money';
import { Configurator } from './catalog-tools';
import {
  adminFetch,
  useAdminData,
  RecordEditor,
  FieldInput,
  PageTitle,
  Badges,
  entryOptions,
  options,
  type Entry,
  type Field,
} from './editor';
import { identityFields } from './catalog-fields';
export function Looks({ canWrite }: { canWrite: boolean }) {
  const [product, setProduct] = useState(''),
    [status, setStatus] = useState('');
  const products = useAdminData<{ items: Entry[] }>('/api/admin/catalog/products'),
    looks = useAdminData<{ items: Entry[] }>(
      `/api/admin/catalog/templates?${new URLSearchParams({ ...(product ? { productId: product } : {}), ...(status ? { status } : {}) })}`,
    );
  return (
    <>
      <PageTitle
        title="Ready-made styles"
        description="Complete outfits customers can start from, then change any choice."
      >
        {canWrite && (
          <Link className="admin-action" href="/admin/catalog/templates/new">
            New style →
          </Link>
        )}
      </PageTitle>
      <div className="admin-toolbar">
        <FieldInput
          field={{
            key: 'product',
            label: 'Product',
            type: 'select',
            options: entryOptions(products.data?.items ?? []),
          }}
          value={product}
          onChange={(v) => setProduct(String(v))}
        />
        <FieldInput
          field={{
            key: 'status',
            label: 'Status',
            type: 'select',
            options: options(['draft', 'active', 'archived']),
          }}
          value={status}
          onChange={(v) => setStatus(String(v))}
        />
      </div>
      {looks.error && <p role="alert">{looks.error}</p>}
      <div className="admin-media-grid">
        {looks.data?.items.map((look) => (
          <article className="admin-card" key={look.id}>
            {!!look.heroUrl && (
              <span
                className="admin-look-image"
                role="img"
                aria-label={`${look.name} hero image`}
                style={{ backgroundImage: `url(${look.heroUrl})` }}
              />
            )}
            <h2>
              <Link href={`/admin/catalog/templates/${look.id}`}>{look.name}</Link>
            </h2>
            <p>
              {look.featured ? '★ Featured · ' : ''}
              {look.status}
            </p>
            <p>
              {look.workingPriceMinor === null
                ? 'Price not yet available'
                : `As shown ${formatPrice(Number(look.workingPriceMinor), String((look.quote as { currency: string })?.currency ?? 'USD'))}`}
            </p>
            <Badges value={look.badges} />
          </article>
        ))}
      </div>
    </>
  );
}
export function LookEditor({ id, canWrite }: { id: string; canWrite: boolean }) {
  const data = useAdminData<Entry>(id === 'new' ? null : `/api/admin/catalog/templates/${id}`),
    working = useAdminData<CustomerCatalog>('/api/admin/catalog/working'),
    products = useAdminData<{ items: Entry[] }>('/api/admin/catalog/products'),
    materials = useAdminData<{ items: Entry[] }>('/api/admin/catalog/materials?limit=100');
  const [saved, setSaved] = useState<Entry | null>(null),
    [message, setMessage] = useState('');
  const index = useMemo(() => (working.data ? indexCatalog(working.data) : null), [working.data]);
  const record =
    saved ??
    (id === 'new'
      ? {
          id: 'new',
          code: '',
          name: '',
          status: 'draft',
          rowVersion: 1,
          featured: false,
          selections: {},
          includedComponents: [],
          occasionCodes: [],
          climateCodes: [],
          media: [],
        }
      : data.data);
  if (!record || !index || !products.data || !materials.data)
    return <p role="status">{data.error || working.error || 'Loading look…'}</p>;
  const fields: Field[] = [
    ...identityFields,
    {
      key: 'productId',
      label: 'Product',
      type: 'select',
      required: true,
      options: entryOptions(products.data.items.filter((p) => index.products.has(p.code))),
    },
    {
      key: 'materialId',
      label: 'Fabric',
      type: 'select',
      required: true,
      options: entryOptions(materials.data.items.filter((m) => index.materials.has(m.code))),
    },
    { key: 'subtitle', label: 'Subtitle', max: 200 },
    { key: 'description', label: 'Description', type: 'textarea', max: 2000 },
    { key: 'story', label: 'Story', type: 'textarea', max: 2000 },
    {
      key: 'occasionCodes',
      label: 'Occasions',
      type: 'multi',
      options: [...(index.lookups.get('occasion')?.values() ?? [])].map((v) => ({
        value: v.code,
        label: v.label,
      })),
    },
    {
      key: 'climateCodes',
      label: 'Climates',
      type: 'multi',
      options: [...(index.lookups.get('climate')?.values() ?? [])].map((v) => ({
        value: v.code,
        label: v.label,
      })),
    },
    { key: 'featured', label: 'Featured', type: 'checkbox' },
    { key: 'sort', label: 'Position within product', type: 'number' },
  ];
  return (
    <>
      <PageTitle
        title={record.id === 'new' ? 'New style' : record.name}
        description="Design the starting configuration, then add imagery and publish it with the catalog."
      >
        <Link href="/admin/catalog/templates">← All looks</Link>
      </PageTitle>
      <div className="admin-toolbar">
        <Link
          href={`/studio?catalog=working&product=${products.data.items.find((p) => p.id === record.productId)?.code ?? ''}`}
        >
          Preview as customer ↗
        </Link>
        {canWrite && record.id !== 'new' && (
          <>
            <button
              onClick={async () => {
                const code = window.prompt('Code for the new style');
                if (code)
                  try {
                    const row = await adminFetch(
                      `/api/admin/catalog/templates/${record.id}/duplicate`,
                      'POST',
                      { newCode: code, newName: `${record.name} copy` },
                    );
                    setSaved(row);
                    setMessage('Copied as a draft style.');
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
              }}
            >
              Duplicate…
            </button>
            <button
              onClick={async () => {
                try {
                  setSaved(
                    await adminFetch(`/api/admin/catalog/templates/${record.id}`, 'PATCH', {
                      rowVersion: record.rowVersion,
                      status: 'archived',
                    }),
                  );
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Archive look
            </button>
          </>
        )}
      </div>
      <section className="admin-detail-panel">
        <RecordEditor
          key={`${record.id}:${record.rowVersion}`}
          record={record}
          fields={fields}
          url={`/api/admin/catalog/templates${record.id === 'new' ? '' : `/${record.id}`}`}
          method={record.id === 'new' ? 'POST' : 'PATCH'}
          canWrite={canWrite}
          transform={(draft) =>
            Object.fromEntries(
              [...fields.map((f) => f.key), 'selections', 'includedComponents']
                .filter((k) => draft[k] !== undefined)
                .map((k) => [k, draft[k]]),
            )
          }
          onSaved={(row) => {
            setSaved(row);
            setMessage('Look saved.');
            window.dispatchEvent(new Event('catalog-saved'));
          }}
        >
          {(draft, set) => {
            const p = products.data!.items.find((p) => p.id === draft.productId);
            if (!p || !index.products.has(p.code))
              return <p>Choose a product to configure the look.</p>;
            const base = newGarment(index, p.code, 'look-editor');
            const garment = {
              ...base,
              materialCode:
                materials.data!.items.find((m) => m.id === draft.materialId)?.code ??
                base.materialCode,
              includedComponents: [
                ...new Set([
                  ...base.includedComponents.filter(
                    (c) =>
                      index.products.get(p.code)!.components.find((l) => l.componentCode === c)
                        ?.required,
                  ),
                  ...(draft.includedComponents as string[]),
                ]),
              ],
              selections: { ...base.selections, ...(draft.selections as Record<string, string>) },
            };
            const quote = quoteGarment(index, garment);
            return (
              <>
                <h3>Design & “As shown” price</h3>
                <Configurator
                  index={index}
                  garment={garment}
                  onChange={(g) => {
                    set('selections', g.selections);
                    set('includedComponents', g.includedComponents);
                    const m = materials.data!.items.find((m) => m.code === g.materialCode);
                    if (m) set('materialId', m.id);
                    const nextProduct = products.data!.items.find((p) => p.code === g.productCode);
                    if (nextProduct) set('productId', nextProduct.id);
                  }}
                />
                <strong>
                  {quote.status === 'priced'
                    ? `As shown ${formatPrice(quote.unitMinor, quote.currency)}`
                    : 'Price not yet available'}
                </strong>
                {validateGarment(index, garment).issues.map((issue, i) => (
                  <p key={i} className="admin-error">
                    {'message' in issue ? issue.message : issue.kind.replaceAll('_', ' ')}
                  </p>
                ))}
              </>
            );
          }}
        </RecordEditor>
      </section>
      {record.id !== 'new' && <LookMedia key={record.id} record={record} canWrite={canWrite} />}
      <p role="status">{message}</p>
    </>
  );
}
function LookMedia({ record, canWrite }: { record: Entry; canWrite: boolean }) {
  const library = useAdminData<{ items: Entry[] }>('/api/admin/media?limit=100');
  const [items, setItems] = useState(
      ((record.media as Entry[]) ?? []).map((m) => ({
        mediaId: String(m.mediaId),
        role: String(m.role),
        sort: Number(m.sort),
      })),
    ),
    [message, setMessage] = useState('');
  return (
    <fieldset disabled={!canWrite} className="admin-card">
      <legend>Hero & gallery</legend>
      <p>Choose one hero and up to eight gallery images.</p>
      {items.map((m, i) => (
        <div className="admin-inline-fields" key={i}>
          <FieldInput
            field={{
              key: 'image',
              label: `Image ${i + 1}`,
              type: 'select',
              options: (library.data?.items ?? []).map((m) => ({
                value: m.id,
                label: String(m.altText),
              })),
            }}
            value={m.mediaId}
            onChange={(v) =>
              setItems((s) => s.map((m, j) => (j === i ? { ...m, mediaId: String(v) } : m)))
            }
          />
          <FieldInput
            field={{
              key: 'role',
              label: 'Role',
              type: 'select',
              options: options(['hero', 'gallery']),
            }}
            value={m.role}
            onChange={(v) =>
              setItems((s) => s.map((m, j) => (j === i ? { ...m, role: String(v) } : m)))
            }
          />
          <button onClick={() => setItems((s) => s.filter((_, j) => j !== i))}>
            Remove image {i + 1}
          </button>
        </div>
      ))}
      <button
        disabled={items.length >= 9}
        onClick={() =>
          setItems((s) => [
            ...s,
            { mediaId: '', role: s.length ? 'gallery' : 'hero', sort: s.length * 10 },
          ])
        }
      >
        Add image
      </button>
      <button
        onClick={async () => {
          try {
            await adminFetch(`/api/admin/catalog/templates/${record.id}/media`, 'PUT', { items });
            setMessage('Look imagery saved.');
            window.dispatchEvent(new Event('catalog-saved'));
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        Save look images
      </button>
      <p role="status">{message}</p>
    </fieldset>
  );
}
