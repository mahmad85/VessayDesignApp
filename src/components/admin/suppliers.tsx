'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AssignedSupplierItems } from './operations';
import {
  useAdminData,
  RecordEditor,
  FieldInput,
  PageTitle,
  options,
  type Entry,
  type Field,
} from './editor';
const kinds = ['fabric_mill', 'fabric_merchant', 'manufacturer', 'accessory', 'other'];
const contactFields: Field[] = [
  { key: 'name', label: 'Contact name' },
  { key: 'roleTitle', label: 'Role / title' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  {
    key: 'preferredChannel',
    label: 'Preferred channel',
    type: 'select',
    options: options(['email', 'phone']),
  },
  { key: 'notes', label: 'Contact notes', type: 'textarea' },
];
export function Suppliers({ canWrite }: { canWrite: boolean }) {
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState(''),
    [status, setStatus] = useState('');
  const data = useAdminData<{ items: Entry[]; nextCursor: string | null }>(
    `/api/admin/suppliers?limit=100&query=${encodeURIComponent(query)}${kind ? `&kind=${kind}` : ''}${status ? `&status=${status}` : ''}`,
  );
  return (
    <>
      <PageTitle
        title="Suppliers"
        description="Business details and contacts, available only to permitted staff."
      >
        {canWrite && (
          <Link className="admin-action" href="/admin/suppliers/new">
            New supplier →
          </Link>
        )}
      </PageTitle>
      <div className="admin-toolbar">
        <FieldInput
          field={{ key: 'query', label: 'Search suppliers' }}
          value={query}
          onChange={(v) => setQuery(String(v))}
        />
        <FieldInput
          field={{ key: 'kind', label: 'Supplier kind', type: 'select', options: options(kinds) }}
          value={kind}
          onChange={(v) => setKind(String(v))}
        />
        <FieldInput
          field={{
            key: 'status',
            label: 'Status',
            type: 'select',
            options: options(['active', 'inactive']),
          }}
          value={status}
          onChange={(v) => setStatus(String(v))}
        />
      </div>
      {data.error && <p role="alert">{data.error}</p>}
      <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Supplier list">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Kind</th>
              <th>Location</th>
              <th>Primary contact</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.data?.items.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/admin/suppliers/${s.id}`}>{s.name}</Link>
                  <small>{s.code}</small>
                </td>
                <td>{String(s.kind).replaceAll('_', ' ')}</td>
                <td>{[s.city, s.countryCode].filter(Boolean).join(', ') || 'Not recorded'}</td>
                <td>{String(s.primaryContactName ?? 'Not recorded')}</td>
                <td>
                  {String(s.openItems ?? 0)} open · {String(s.overdueItems ?? 0)} overdue
                  <br />
                  {s.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function SupplierEditor({
  id,
  canWrite,
  canReadOrders = false,
}: {
  id: string;
  canWrite: boolean;
  canReadOrders?: boolean;
}) {
  const data = useAdminData<Entry>(id === 'new' ? null : `/api/admin/suppliers/${id}`),
    products = useAdminData<{ items: Entry[] }>('/api/admin/catalog/products');
  const [record, setRecord] = useState<Entry | null>(null),
    [message, setMessage] = useState(''),
    [tab, setTab] = useState('details');
  const source =
    record ??
    (id === 'new'
      ? {
          id: 'new',
          code: '',
          name: '',
          rowVersion: 1,
          status: 'inactive',
          contacts: { primary: null, secondary: null },
        }
      : data.data);
  if (!source) return <p role="status">{data.error || 'Loading supplier…'}</p>;
  const fields: Field[] = [
    { key: 'code', label: 'Code', required: true },
    { key: 'name', label: 'Supplier name', required: true },
    { key: 'legalName', label: 'Legal name' },
    { key: 'kind', label: 'Kind', type: 'select', options: options(kinds), required: true },
    { key: 'status', label: 'Status', type: 'select', options: options(['active', 'inactive']) },
    { key: 'website', label: 'Website' },
    { key: 'addressLine1', label: 'Address line 1' },
    { key: 'addressLine2', label: 'Address line 2' },
    { key: 'city', label: 'City' },
    { key: 'region', label: 'Region / state' },
    { key: 'postalCode', label: 'Postal code' },
    { key: 'countryCode', label: 'Country (ISO two-letter code)', max: 2 },
    {
      key: 'defaultLeadTimeDays',
      label: 'Default lead time (days)',
      type: 'number',
      min: 0,
      max: 365,
    },
    {
      key: 'capabilities',
      label: 'Products this supplier can make',
      type: 'multi',
      options: (products.data?.items ?? []).map((p) => ({ value: p.code, label: p.name })),
    },
    { key: 'notes', label: 'Internal notes', type: 'textarea', max: 2000 },
  ];
  const contacts = source.contacts as { primary: Entry | null; secondary: Entry | null };
  const editable = {
    ...source,
    primaryContact: contacts?.primary ?? {},
    secondaryContact: contacts?.secondary ?? {},
  };
  return (
    <>
      <PageTitle
        title={source.id === 'new' ? 'New supplier' : source.name}
        description="An active supplier needs an address, city, country and primary contact."
      >
        <Link href="/admin/suppliers">← All suppliers</Link>
      </PageTitle>
      <div className="admin-tabs" role="tablist" aria-label="Supplier details">
        {['details', 'fabrics', ...(canReadOrders && id !== 'new' ? ['assigned items'] : [])].map(
          (t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ),
        )}
      </div>
      {tab === 'details' && (
        <section className="admin-detail-panel">
          <RecordEditor
            key={`${source.id}:${source.rowVersion}`}
            record={editable}
            fields={fields}
            url={`/api/admin/suppliers${source.id === 'new' ? '' : `/${source.id}`}`}
            method={source.id === 'new' ? 'POST' : 'PATCH'}
            canWrite={canWrite}
            transform={(draft) => {
              if (
                draft.status === 'inactive' &&
                source.status === 'active' &&
                !window.confirm(
                  `Deactivate this supplier? ${String(source.openItems ?? 0)} open assigned items will keep their history; new assignments and links are blocked.`,
                )
              )
                throw new Error('Deactivation cancelled.');
              const base = Object.fromEntries(
                fields
                  .filter(
                    (f) =>
                      draft[f.key] !== undefined && draft[f.key] !== null && draft[f.key] !== '',
                  )
                  .map((f) => [f.key, draft[f.key]]),
              );
              for (const rank of ['primaryContact', 'secondaryContact']) {
                const c = draft[rank] as Entry;
                if (c?.name)
                  base[rank] = Object.fromEntries(
                    contactFields
                      .filter((f) => c[f.key] !== undefined && c[f.key] !== '')
                      .map((f) => [f.key, c[f.key]]),
                  );
              }
              return base;
            }}
            onSaved={(row) => {
              setRecord(row);
              setMessage('Supplier details saved.');
            }}
          >
            {(draft, set) => (
              <>
                {['primaryContact', 'secondaryContact'].map((rank) => (
                  <fieldset key={rank}>
                    <legend>
                      {rank === 'primaryContact'
                        ? 'Primary contact'
                        : 'Secondary contact (optional)'}
                    </legend>
                    <div className="admin-fields">
                      {contactFields.map((f) => (
                        <FieldInput
                          key={f.key}
                          field={f}
                          value={(draft[rank] as Entry)?.[f.key]}
                          onChange={(v) => set(rank, { ...(draft[rank] as Entry), [f.key]: v })}
                        />
                      ))}
                    </div>
                  </fieldset>
                ))}
              </>
            )}
          </RecordEditor>
        </section>
      )}
      {tab === 'fabrics' && (
        <section className="admin-card">
          <h2>Fabrics supplied</h2>
          {((source.materials as Entry[]) ?? []).length ? (
            <ul>
              {(source.materials as Entry[]).map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/catalog/fabrics/${m.id}`}>{m.name}</Link> · {m.status}
                </li>
              ))}
            </ul>
          ) : (
            <p>No fabrics linked yet.</p>
          )}
        </section>
      )}
      {tab === 'assigned items' && <AssignedSupplierItems id={id} />}
      {message && <p role="status">{message}</p>}
    </>
  );
}
