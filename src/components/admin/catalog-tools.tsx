'use client';
import { useMemo, useState } from 'react';
import type { CustomerCatalog, RuntimeIndex } from '@/modules/catalog/snapshot';
import { indexCatalog, RIGHTS_STATUSES } from '@/modules/catalog/snapshot';
import { newGarment, applyGarmentPatch } from '@/modules/catalog/garment';
import type { Garment, GarmentPatch } from '@/modules/configuration/types';
import { designOutline } from '@/modules/configuration/design-outline';
import { DesignNavigator, type NavPath } from '@/components/design-navigator';
import GarmentSketch from '@/visualization/garment-sketch';
import { renderValues } from '@/visualization/binding';
import { formatPrice } from '@/lib/money';
import type { GarmentQuote } from '@/modules/pricing/quote';
import {
  adminFetch,
  useAdminData,
  PageTitle,
  RecordEditor,
  FieldInput,
  options,
  entryOptions,
  type Entry,
  type Field,
} from './editor';
import { identityFields } from './catalog-fields';
import { ConditionBuilder } from './condition-builder';
import type { Condition } from '@/modules/catalog/conditions';
const fresh = (extra: Record<string, unknown> = {}): Entry => ({
  id: 'new',
  code: '',
  name: '',
  rowVersion: 1,
  status: 'draft',
  ...extra,
});
export function MediaLibrary({ canWrite }: { canWrite: boolean }) {
  const [filter, setFilter] = useState(''),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<Entry | null>(null),
    [file, setFile] = useState<File | null>(null),
    [alt, setAlt] = useState(''),
    [rights, setRights] = useState('unknown'),
    [note, setNote] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const media = useAdminData<{ items: Entry[]; nextCursor: string | null }>(
    `/api/admin/media?limit=100&query=${encodeURIComponent(query)}${filter ? `&rightsStatus=${filter}` : ''}`,
  );
  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('altText', alt);
      form.set('rightsStatus', rights);
      form.set('sourceNote', note);
      const response = await fetch('/api/admin/media', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error.message);
      setSelected(result);
      setFile(null);
      setMessage('Image saved to the library.');
      await media.load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Media library"
        description="Reusable imagery, descriptive alt text, and recorded rights."
      />
      <div className="admin-toolbar">
        <label>
          Search images
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Rights
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All rights statuses</option>
            {RIGHTS_STATUSES.map((r) => (
              <option key={r} value={r}>
                {r.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>
      {canWrite && (
        <form
          className="admin-upload admin-card"
          onSubmit={(e) => {
            e.preventDefault();
            void upload();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setFile(e.dataTransfer.files[0] ?? null);
          }}
        >
          <h2>Upload an image</h2>
          <p>
            Drop an image here, or choose a file. PNG, JPEG or WebP · up to 5 MiB · 64–8000 pixels.
          </p>
          <label>
            Image file
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file && <p>{file.name}</p>}
          <div className="admin-fields">
            <FieldInput
              field={{ key: 'alt', label: 'Alt text', required: true, max: 250 }}
              value={alt}
              onChange={(v) => setAlt(String(v))}
            />
            <FieldInput
              field={{
                key: 'rights',
                label: 'Image rights',
                type: 'select',
                options: options(RIGHTS_STATUSES),
              }}
              value={rights}
              onChange={(v) => setRights(String(v))}
            />
            <FieldInput
              field={{ key: 'source', label: 'Rights source note', type: 'textarea' }}
              value={note}
              onChange={(v) => setNote(String(v))}
            />
          </div>
          <button type="submit" disabled={!file || busy}>
            Upload
          </button>
        </form>
      )}
      {(message || media.error) && <p role="status">{message || media.error}</p>}
      <div className="admin-media-grid">
        {media.data?.items.map((m) => (
          <button key={m.id} className="admin-media-card" onClick={() => setSelected(m)}>
            <span
              role="img"
              aria-label={String(m.altText)}
              style={{ backgroundImage: `url("${m.url}")` }}
            />
            <strong>{String(m.altText)}</strong>
            <small>
              {String(m.rightsStatus).replaceAll('_', ' ')} · Used {String(m.usedBy ?? 0)} times
            </small>
          </button>
        ))}
      </div>
      {media.data?.nextCursor && (
        <button
          onClick={async () => {
            const more = await adminFetch<{ items: Entry[]; nextCursor: string | null }>(
              `/api/admin/media?limit=100&cursor=${media.data?.nextCursor}&query=${encodeURIComponent(query)}${filter ? `&rightsStatus=${filter}` : ''}`,
            );
            media.setData((old) =>
              old ? { items: [...old.items, ...more.items], nextCursor: more.nextCursor } : more,
            );
          }}
        >
          Load more images
        </button>
      )}
      {selected && (
        <section className="admin-card">
          <h2>Edit image details</h2>
          <RecordEditor
            key={`${selected.id}:${selected.rowVersion}`}
            record={selected}
            fields={[
              { key: 'altText', label: 'Alt text', required: true, max: 250 },
              {
                key: 'rightsStatus',
                label: 'Rights status',
                type: 'select',
                options: options(RIGHTS_STATUSES),
              },
              { key: 'sourceNote', label: 'Source note', type: 'textarea' },
            ]}
            url={`/api/admin/media/${selected.id}`}
            canWrite={canWrite}
            onSaved={(row) => {
              setSelected(row);
              void media.load();
            }}
          />
        </section>
      )}
    </>
  );
}
type LookupType = Entry & {
  values: Entry[];
  valueMetadataSchema: { key: string; label: string; allowed?: string[]; required: boolean }[];
};
export function ListsEditor({ canWrite }: { canWrite: boolean }) {
  const lists = useAdminData<{ types: LookupType[] }>('/api/admin/lookups');
  const [code, setCode] = useState(''),
    [selected, setSelected] = useState<Entry | null>(null),
    [error, setError] = useState('');
  const type = lists.data?.types.find((t) => t.code === code) ?? lists.data?.types[0];
  async function reorder(id: string, offset: number) {
    if (!type) return;
    const ids = type.values.map((v) => v.id);
    const i = ids.indexOf(id);
    ids.splice(i, 1);
    ids.splice(Math.max(0, Math.min(i + offset, ids.length)), 0, id);
    try {
      await adminFetch(`/api/admin/lookups/${type.code}/order`, 'POST', { orderedIds: ids });
      await lists.load();
      document.getElementById(`lookup-${id}`)?.focus();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        title="Lists"
        description="Keep catalog vocabulary consistent. System lists remain available."
      />
      <div className="admin-tree-layout">
        <nav aria-label="Lookup lists" className="admin-tree-panel">
          {lists.data?.types.map((t) => (
            <button
              key={t.code}
              aria-current={type?.code === t.code ? 'page' : undefined}
              onClick={() => {
                setCode(t.code);
                setSelected(null);
              }}
            >
              {String(t.label)}
            </button>
          ))}
        </nav>
        <section className="admin-detail-panel">
          <h2>{String(type?.label ?? 'Loading lists…')}</h2>
          {!!type?.system && <p className="admin-chip">System list · values can be deactivated</p>}
          {canWrite && (
            <button
              onClick={() =>
                setSelected(fresh({ label: '', description: '', metadata: {}, active: true }))
              }
            >
              Add value
            </button>
          )}
          <ul className="admin-lookup-list">
            {type?.values.map((v) => (
              <li key={v.id}>
                <button id={`lookup-${v.id}`} onClick={() => setSelected(v)}>
                  {String(v.label)}
                </button>
                <code>{v.code}</code>
                <span>
                  {v.active ? 'Active' : 'Inactive'} · {String(v.usedBy ?? 0)} uses
                </span>
                {canWrite && (
                  <>
                    <button
                      aria-label={`Move ${v.label} up`}
                      onClick={() => void reorder(v.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${v.label} down`}
                      onClick={() => void reorder(v.id, 1)}
                    >
                      ↓
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {selected && type && (
            <RecordEditor
              key={`${selected.id}:${selected.rowVersion}:${type.code}`}
              record={selected}
              fields={[
                ...(selected.id === 'new' ? [{ key: 'code', label: 'Code', required: true }] : []),
                { key: 'label', label: 'Label', required: true },
                { key: 'description', label: 'Description', type: 'textarea' },
                ...(selected.id !== 'new'
                  ? [
                      {
                        key: 'active',
                        label: `Active · ${selected.usedBy ?? 0} existing uses will be retained`,
                        type: 'checkbox',
                      } as Field,
                    ]
                  : []),
              ]}
              method={selected.id === 'new' ? 'POST' : 'PATCH'}
              url={
                selected.id === 'new'
                  ? `/api/admin/lookups/${type.code}/values`
                  : `/api/admin/lookup-values/${selected.id}`
              }
              canWrite={canWrite}
              transform={(draft) => ({
                ...(selected.id === 'new' ? { code: draft.code } : { active: draft.active }),
                label: draft.label,
                description: draft.description,
                metadata: draft.metadata,
              })}
              onSaved={(row) => {
                setSelected(row);
                void lists.load();
              }}
            >
              {(draft, set) =>
                type.valueMetadataSchema.map((f) => (
                  <FieldInput
                    key={f.key}
                    field={{
                      key: f.key,
                      label: f.label,
                      required: f.required,
                      type: f.allowed ? 'select' : f.key === 'hex' ? 'colour' : 'text',
                      options: f.allowed ? options(f.allowed) : undefined,
                    }}
                    value={(draft.metadata as Record<string, unknown>)?.[f.key]}
                    onChange={(v) =>
                      set('metadata', {
                        ...(draft.metadata as Record<string, unknown>),
                        [f.key]: v,
                      })
                    }
                  />
                ))
              }
            </RecordEditor>
          )}
          {(error || lists.error) && <p role="alert">{error || lists.error}</p>}
        </section>
      </div>
    </>
  );
}
export function Configurator({
  index,
  garment,
  onChange,
}: {
  index: RuntimeIndex;
  garment: Garment;
  onChange: (g: Garment) => void;
}) {
  const [path, setPath] = useState<NavPath>({}),
    [error, setError] = useState('');
  function change(patch: GarmentPatch) {
    try {
      const result = applyGarmentPatch(index, garment, patch, {
        confirmImpact: true,
        confirmCategoryChange: true,
      });
      onChange(result.garment);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="admin-configurator">
      <DesignNavigator
        index={index}
        garment={garment}
        outline={designOutline(index, garment)}
        availability={{}}
        busy={false}
        change={change}
        path={path}
        navigate={setPath}
      />
      <div className="admin-sketch">
        <GarmentSketch
          render={renderValues(index, garment, 'warm')}
          focus={{ region: 'full', nonce: 0 }}
        />
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function Simulator() {
  const source = useAdminData<CustomerCatalog>('/api/admin/catalog/working');
  const index = useMemo(() => (source.data ? indexCatalog(source.data) : null), [source.data]);
  return index && index.catalog.products[0] ? (
    <SimulatorForm key={JSON.stringify(source.data)} index={index} />
  ) : (
    <p>Loading price simulator…</p>
  );
}
function SimulatorForm({ index }: { index: RuntimeIndex }) {
  const [garment, setGarment] = useState(() =>
      newGarment(index, index.catalog.products[0].code, 'simulation'),
    ),
    [source, setSource] = useState('working'),
    [result, setResult] = useState<{
      quote: GarmentQuote;
      violations: { message: string }[];
      impactPreview: { message: string }[];
    } | null>(null),
    [error, setError] = useState('');
  return (
    <section className="admin-card">
      <h2>Try a configuration</h2>
      <FieldInput
        field={{
          key: 'source',
          label: 'Catalog to evaluate',
          type: 'select',
          options: options(['working', 'current']),
        }}
        value={source}
        onChange={(v) => setSource(String(v))}
      />
      <FieldInput
        field={{
          key: 'product',
          label: 'Product',
          type: 'select',
          options: index.catalog.products.map((p) => ({ value: p.code, label: p.name })),
        }}
        value={garment.productCode}
        onChange={(v) => setGarment(newGarment(index, String(v), 'simulation'))}
      />
      <Configurator index={index} garment={garment} onChange={setGarment} />
      <FieldInput
        field={{ key: 'quantity', label: 'Quantity', type: 'number', min: 1, max: 5 }}
        value={garment.quantity}
        onChange={(v) => setGarment({ ...garment, quantity: Number(v) })}
      />
      <button
        onClick={async () => {
          try {
            setResult(
              await adminFetch('/api/admin/pricing/simulate', 'POST', {
                source,
                productCode: garment.productCode,
                materialCode: garment.materialCode,
                includedComponents: garment.includedComponents,
                selections: garment.selections,
                quantity: garment.quantity,
              }),
            );
            setError('');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Evaluate configuration
      </button>
      {result && (
        <div aria-live="polite">
          <h3>
            {result.quote.status === 'priced'
              ? formatPrice(result.quote.totalMinor, result.quote.currency)
              : 'Price not yet available'}
          </h3>
          {result.quote.status === 'priced' && (
            <ul>
              {result.quote.byCategory.map((c) => (
                <li key={c.category}>
                  {c.label}: {formatPrice(c.amountMinor, result.quote.currency)}
                </li>
              ))}
            </ul>
          )}
          {result.violations.map((v, i) => (
            <p key={i}>{v.message}</p>
          ))}
          {result.impactPreview.map((v, i) => (
            <p key={i}>Suggested change: {v.message}</p>
          ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function RulesEditor({ canWrite }: { canWrite: boolean }) {
  const rules = useAdminData<{ items: Entry[] }>('/api/admin/catalog/rules'),
    products = useAdminData<{ items: Entry[] }>('/api/admin/catalog/products'),
    attributes = useAdminData<{ items: Entry[] }>('/api/admin/catalog/attributes'),
    values = useAdminData<{ items: Entry[] }>('/api/admin/catalog/values'),
    working = useAdminData<CustomerCatalog>('/api/admin/catalog/working');
  const [selected, setSelected] = useState<Entry | null>(null),
    [productFilter, setProductFilter] = useState(''),
    [attributeFilter, setAttributeFilter] = useState('');
  const index = useMemo(() => (working.data ? indexCatalog(working.data) : null), [working.data]);
  const fields: Field[] = [
    ...identityFields,
    {
      key: 'effect',
      label: 'Then',
      type: 'select',
      options: options(['forbid', 'require']),
      required: true,
    },
    {
      key: 'attributeId',
      label: 'Target option',
      type: 'select',
      options: entryOptions(attributes.data?.items ?? []),
      required: true,
    },
    { key: 'customerMessage', label: 'Customer explanation', type: 'textarea', required: true },
    {
      key: 'productIds',
      label: 'Apply to products (empty means all)',
      type: 'multi',
      options: entryOptions(products.data?.items ?? []),
    },
    { key: 'sort', label: 'Position', type: 'number' },
  ];
  return (
    <>
      <PageTitle
        title="Compatibility rules"
        description="Explain which combinations are allowed, and test their effects before publishing."
      />
      <div className="admin-toolbar">
        <FieldInput
          field={{
            key: 'filter-product',
            label: 'Filter by product',
            type: 'select',
            options: entryOptions(products.data?.items ?? []),
          }}
          value={productFilter}
          onChange={(v) => setProductFilter(String(v))}
        />
        <FieldInput
          field={{
            key: 'filter-option',
            label: 'Filter by option',
            type: 'select',
            options: entryOptions(attributes.data?.items ?? []),
          }}
          value={attributeFilter}
          onChange={(v) => setAttributeFilter(String(v))}
        />
        {canWrite && (
          <button
            onClick={() =>
              setSelected(
                fresh({ effect: 'forbid', whenCondition: null, valueIds: [], productIds: [] }),
              )
            }
          >
            New rule
          </button>
        )}
      </div>
      <div className="admin-tree-layout">
        <nav aria-label="Rules" className="admin-tree-panel">
          {rules.data?.items
            .filter(
              (r) =>
                (!attributeFilter || r.attributeId === attributeFilter) &&
                (!productFilter ||
                  !(r.productIds as string[])?.length ||
                  (r.productIds as string[]).includes(productFilter)),
            )
            .map((r) => (
              <button key={r.id} onClick={() => setSelected(r)}>
                {r.name} · {r.status}
              </button>
            ))}
        </nav>
        <section className="admin-detail-panel">
          {selected && index ? (
            <RecordEditor
              key={`${selected.id}:${selected.rowVersion}`}
              record={selected}
              fields={fields}
              url={`/api/admin/catalog/rules${selected.id === 'new' ? '' : `/${selected.id}`}`}
              method={selected.id === 'new' ? 'POST' : 'PATCH'}
              canWrite={canWrite}
              transform={(draft) => ({
                ...Object.fromEntries(fields.map((f) => [f.key, draft[f.key]])),
                when: draft.whenCondition ?? { product: index.catalog.products.map((p) => p.code) },
                valueIds: draft.valueIds,
              })}
              onSaved={(row) => {
                setSelected(row);
                void rules.load();
              }}
            >
              {(draft, set) => (
                <>
                  <ConditionBuilder
                    value={draft.whenCondition as Condition | null}
                    onChange={(v) => set('whenCondition', v)}
                    index={index}
                  />
                  <FieldInput
                    field={{
                      key: 'valueIds',
                      label: 'Target choices',
                      type: 'multi',
                      required: true,
                      options: (values.data?.items ?? [])
                        .filter((v) => v.attributeId === draft.attributeId)
                        .map((v) => ({ value: v.id, label: String(v.label) })),
                    }}
                    value={draft.valueIds}
                    onChange={(v) => set('valueIds', v)}
                  />
                </>
              )}
            </RecordEditor>
          ) : (
            <p>Select a rule to edit, or create one.</p>
          )}
        </section>
      </div>
      <Simulator />
    </>
  );
}
