'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAdminData } from './editor';
import type { SupportCustomer } from '@/db/operations-repository';
import type { supplierItems } from '@/db/fulfillment-repository';
import { formatPrice } from '@/lib/money';
export function OperationsDashboard() {
  const s = useAdminData<{ tiles: { label: string; count: number; href: string }[] }>(
    '/api/admin/dashboard',
  );
  return (
    <section aria-label="Operations overview">
      <h2>Today in the workroom</h2>
      {s.error && (
        <p role="alert">
          {s.error} <button onClick={() => void s.load()}>Retry</button>
        </p>
      )}
      {!s.data && !s.error && <p role="status">Loading operations…</p>}
      {s.data?.tiles.every((t) => t.count === 0) && <p>All clear</p>}
      <div className="admin-tiles">
        {s.data?.tiles.map((t) => (
          <Link className="admin-card ops-tile" key={t.label} href={t.href}>
            <strong>{t.count}</strong>
            <span>{t.label}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
export function CustomerLookup({ id }: { id?: string }) {
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState('');
  const results = useAdminData<{ items: (SupportCustomer['user'] & { orderCount: number })[] }>(
    search.length >= 3 ? '/api/admin/customers?query=' + encodeURIComponent(search) : null,
  );
  const detail = useAdminData<SupportCustomer>(id ? '/api/admin/customers/' + id : null);
  return (
    <>
      <p className="admin-eyebrow">SUPPORT</p>
      <h1 className="order-admin-title">Customer lookup</h1>
      <p>Account details, order history and a brief summary of the current draft.</p>
      {id ? (
        <>
          <Link href="/admin/customers">← Customer search</Link>
          {detail.error && <p role="alert">{detail.error}</p>}
          {!detail.data && !detail.error && <p role="status">Loading customer…</p>}
          {detail.data && (
            <>
              <section className="ops-panel">
                <h2>{detail.data.user.name}</h2>
                <p>{detail.data.user.email}</p>
                <p>
                  {detail.data.user.emailVerified ? 'Verified account' : 'Email not verified'} ·
                  Created {new Date(detail.data.user.createdAt).toLocaleDateString()}
                </p>
                <h3>Orders</h3>
                {!detail.data.orders.length && <p>No orders yet.</p>}
                {detail.data.orders.map((o) => (
                  <article className="ops-item" key={o.id}>
                    <Link href={'/admin/orders/' + o.id}>{o.number}</Link> ·{' '}
                    {formatPrice(o.totalMinor, o.currency)}
                    <p>
                      {o.payment.replaceAll('_', ' ')} · {o.fulfillment.replaceAll('_', ' ')}
                    </p>
                  </article>
                ))}
                <h3>Current draft</h3>
                {detail.data.draft ? (
                  <>
                    <p>
                      Measurements confirmed:{' '}
                      {detail.data.draft.measurementsConfirmed ? 'Yes' : 'No'} · Updated{' '}
                      {new Date(detail.data.draft.updatedAt).toLocaleString()}
                    </p>
                    <ul>
                      {detail.data.draft.garments.map((g, i) => (
                        <li key={i}>
                          {g.productName} × {g.quantity} · {g.materialName} ·{' '}
                          {g.templateName ?? 'Custom design'}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>No saved draft.</p>
                )}
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <form
            className="ops-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query.trim());
            }}
          >
            <label>
              Name or email
              <input
                value={query}
                minLength={3}
                maxLength={200}
                required
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button>Search customers</button>
          </form>
          {query.trim().length < 3 && <p>Enter at least 3 characters.</p>}
          {results.error && <p role="alert">{results.error}</p>}
          {results.data?.items.length === 0 && <p>No customers found.</p>}
          {results.data?.items.map((u) => (
            <article className="ops-item" key={u.userId}>
              <Link href={'/admin/customers/' + u.userId}>{u.name}</Link>
              <p>
                {u.email} · {u.orderCount} orders
              </p>
            </article>
          ))}
        </>
      )}
    </>
  );
}
export function AssignedSupplierItems({ id }: { id: string }) {
  const [status, setStatus] = useState('open'),
    [cursor, setCursor] = useState('');
  const s = useAdminData<Awaited<ReturnType<typeof supplierItems>>>(
    `/api/admin/suppliers/${id}/items?status=${status}&cursor=${encodeURIComponent(cursor)}`,
  );
  return (
    <section className="ops-panel">
      <h2>Assigned items</h2>
      <label>
        Show assigned items
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor('');
          }}
        >
          {['open', 'overdue', 'completed', 'all'].map((v) => (
            <option value={v} key={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <p>Deadlines use {s.data?.opsTimezone ?? 'the operations timezone'}.</p>
      {s.error && <p role="alert">{s.error}</p>}
      {s.data?.items.length === 0 && <p>No assigned items here.</p>}
      {s.data?.items.map((i) => (
        <article className="ops-item" key={i.id}>
          <Link href={'/admin/orders/' + i.orderId}>{i.number}</Link> · {i.productName} ×{' '}
          {i.quantity}
          <p>
            {i.status.replaceAll('_', ' ')} ·{' '}
            <span className={i.overdue ? 'ops-overdue' : ''}>
              {i.overdue ? 'Overdue · ' : ''}
              {i.dueDate ?? 'No deadline'}
            </span>
          </p>
        </article>
      ))}
      {cursor && <button onClick={() => setCursor('')}>First page</button>}
      {s.data?.nextCursor && (
        <button onClick={() => setCursor(s.data!.nextCursor!)}>Next items</button>
      )}
    </section>
  );
}
