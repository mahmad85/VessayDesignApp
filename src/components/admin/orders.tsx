'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { adminFetch, useAdminData, type Entry } from './editor';
import type { AdminOrder, AdminOrders } from '@/db/fulfillment-repository';
import type { Permission } from '@/modules/staff/permissions';
import { formatPrice } from '@/lib/money';

const label = (s: string) => s.replaceAll('_', ' ');
const filters: Record<string, string> = {
  All: '',
  'Awaiting payment': 'payment=checkout_ready,payment_pending,failed,cancelled',
  'Tailor review': 'tailorReview=pending,in_review,awaiting_customer',
  'Ready to release': 'readyToRelease=true',
  'In production': 'fulfillment=released,in_production,quality_check,ready_to_ship',
  Overdue: 'overdue=true',
  Shipped: 'fulfillment=shipped',
  'Needs attention': 'needsAttention=true',
};
export function OrderDesk({ initialFilter = '' }: { initialFilter?: string }) {
  const [filter, setFilter] = useState(initialFilter),
    [query, setQuery] = useState(''),
    [cursor, setCursor] = useState('');
  const state = useAdminData<AdminOrders>(
    '/api/admin/orders?' +
      filter +
      '&query=' +
      encodeURIComponent(query) +
      '&cursor=' +
      encodeURIComponent(cursor),
  );
  return (
    <>
      <p className="admin-eyebrow">OPERATIONS</p>
      <h1 className="order-admin-title">Order desk</h1>
      <p>Follow every garment from customer sign-off to delivery.</p>
      <div className="admin-tabs" role="group" aria-label="Order filters">
        {Object.entries(filters).map(([name, value]) => (
          <button
            key={name}
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setCursor('');
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <label className="ops-search">
        Search by order number or email
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor('');
          }}
        />
      </label>
      <p>Supplier deadlines use {state.data?.opsTimezone ?? 'the operations timezone'}.</p>
      {state.error && (
        <p role="alert">
          {state.error} <button onClick={() => void state.load()}>Retry</button>
        </p>
      )}
      {!state.data && !state.error && <p role="status">Loading orders…</p>}
      {state.data?.items.length === 0 && <p>No orders here.</p>}
      <div className="ops-table-wrap">
        <table className="ops-orders">
          <thead>
            <tr>
              <th>Order / date</th>
              <th>Customer</th>
              <th>Items / total</th>
              <th>Status</th>
              <th>Suppliers / next deadline</th>
            </tr>
          </thead>
          <tbody>
            {state.data?.items.map((o) => (
              <tr key={o.id}>
                <td data-label="Order">
                  <Link href={'/admin/orders/' + o.id}>{o.number}</Link>
                  <small>{new Date(o.submittedAt).toLocaleDateString()}</small>
                </td>
                <td data-label="Customer">{o.customerName}</td>
                <td data-label="Total">
                  {o.itemCount} items · {formatPrice(o.totalMinor, o.currency)}
                </td>
                <td data-label="Status">
                  {label(o.payment)} ·{' '}
                  {o.tailorReview !== 'not_requested' && <>Review: {label(o.tailorReview)} · </>}
                  {label(o.fulfillment)}
                  {o.needsAttention && <strong> · Needs attention</strong>}
                </td>
                <td data-label="Supplier">
                  <span>{o.suppliers.map((s) => s.name).join(', ') || 'Unassigned'}</span>
                  <small className={o.overdue ? 'ops-overdue' : ''}>
                    {o.overdue ? 'Overdue · ' : ''}
                    {o.nextDueDate ?? 'No deadline'}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-toolbar">
        {cursor && <button onClick={() => setCursor('')}>First page</button>}
        {state.data?.nextCursor && (
          <button onClick={() => setCursor(state.data!.nextCursor!)}>Next orders</button>
        )}
      </div>
    </>
  );
}
type Perform = (path: string, method: string, data?: unknown) => Promise<void>;
export function AdminOrderDetail({ id, permissions }: { id: string; permissions: Permission[] }) {
  const state = useAdminData<AdminOrder>('/api/admin/orders/' + id),
    [tab, setTab] = useState('Summary'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const o = state.data;
  const can = (p: Permission) => permissions.includes(p);
  const perform: Perform = async (path, method, data) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await adminFetch(
        path.startsWith('/api/') ? path : '/api/admin/orders/' + id + path,
        method,
        data,
      );
      await state.load();
      setMessage('Change saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!o)
    return (
      <>
        <h1>Order details</h1>
        <p role={state.error ? 'alert' : 'status'}>{state.error || 'Loading order…'}</p>
      </>
    );
  const tabs = [
    'Summary',
    'Specification',
    ...(can('orders.measurements.read') ? ['Measurements'] : []),
    ...(o.tailorReview !== 'not_requested' ? ['Tailor review'] : []),
    'Payment',
    'Fulfilment',
    'Activity',
  ];
  const releaseItems = o.items.filter((i) => i.status !== 'cancelled');
  const canAssignAll =
    releaseItems.length > 0 &&
    releaseItems.every((i) =>
      ['not_released', 'released'].includes(
        i.status === 'on_hold' ? (i.holdResumeStatus ?? '') : i.status,
      ),
    );
  const awaitingRelease =
    releaseItems.length > 0 && releaseItems.every((i) => i.status === 'not_released');
  const canRelease =
    releaseItems.length > 0 &&
    releaseItems.every((i) => i.status === 'not_released' && !i.releaseProblems.length);
  return (
    <>
      <Link href="/admin/orders">← Order desk</Link>
      <div className="ops-heading">
        <div>
          <p className="admin-eyebrow">CUSTOMER ORDER</p>
          <h1 className="order-admin-title">{o.number}</h1>
          <p>
            {o.customer.name} · {o.customer.email}
          </p>
        </div>
        <strong>{formatPrice(o.totalMinor, o.currency)}</strong>
      </div>
      <div className="ops-tracks">
        <span>Payment · {label(o.payment)}</span>
        {o.tailorReview !== 'not_requested' && <span>Tailor review · {label(o.tailorReview)}</span>}
        <span>Production · {label(o.fulfillment)}</span>
      </div>
      {o.needsAttention && (
        <div className="ops-notice">
          <strong>Needs attention</strong>
          <p>Review the activity and payment history. Handle any refund separately.</p>
          {can('orders.fulfillment.write') && (
            <ReasonAction
              label="Clear attention"
              busy={busy}
              onSave={(reason) =>
                perform('/attention/clear', 'POST', { rowVersion: o.rowVersion, reason })
              }
            />
          )}
        </div>
      )}
      <div className="admin-tabs" role="group" aria-label="Order detail sections">
        {tabs.map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert">
          {error}{' '}
          <button
            onClick={() => {
              void state.load();
              setError('');
            }}
          >
            Reload latest version
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <fieldset aria-label={tab} className="ops-panel" disabled={busy}>
        {tab === 'Summary' && (
          <>
            <h2>Order summary</h2>
            <p>
              Signed off {new Date(o.snapshot.signoff.at).toLocaleString()} ·{' '}
              {o.snapshot.signoff.statementVersion} · specification v{o.snapshot.version}
            </p>
            <ul>
              {o.items.map((i) => (
                <li key={i.id}>
                  {i.spec.product.name} × {i.spec.quantity} · {i.spec.material.name} ·{' '}
                  {formatPrice(i.spec.quote.totalMinor, o.currency)}
                </li>
              ))}
            </ul>
            <dl className="ops-facts">
              <dt>Subtotal</dt>
              <dd>{formatPrice(o.snapshot.totals.subtotalMinor, o.currency)}</dd>
              <dt>Delivery</dt>
              <dd>{formatPrice(o.snapshot.totals.shippingMinor, o.currency)}</dd>
              <dt>Total</dt>
              <dd>{formatPrice(o.totalMinor, o.currency)}</dd>
            </dl>
            <h3>Shipping address</h3>
            <ShippingAddress address={o.shippingAddress} />
            <h3>Customer delivery estimate</h3>
            <p>{o.customerEtaDate ?? 'No estimate set'}</p>
            {can('orders.fulfillment.write') && (
              <EtaForm key={o.rowVersion} o={o} busy={busy} perform={perform} />
            )}
            <h3>Automated check advice</h3>
            {o.snapshot.check.findings.map((f) => (
              <p key={f.id}>
                <strong>{f.title}</strong> · {f.description}
              </p>
            ))}
          </>
        )}
        {tab === 'Specification' && (
          <>
            <h2>Signed-off specification</h2>
            {o.items.map((i) => (
              <article className="ops-item" key={i.id}>
                <h3>
                  {i.spec.product.name} × {i.spec.quantity}
                </h3>
                <p>
                  {i.spec.material.name} · {i.spec.template?.name ?? 'Custom design'}
                </p>
                <SpecOptions item={i} />
                {can('orders.measurements.read') && (
                  <Link
                    target="_blank"
                    href={`/api/admin/orders/${id}/items/${i.id}/production-sheet?format=html`}
                  >
                    Print production sheet ↗
                  </Link>
                )}
              </article>
            ))}
            <h3>Snapshot history</h3>
            {o.snapshots.map((s) => (
              <details key={s.version}>
                <summary>
                  Version {s.version} · {s.kind} · {new Date(s.createdAt).toLocaleString()}
                </summary>
                <SnapshotHistory id={id} version={s.version} />
              </details>
            ))}
          </>
        )}
        {tab === 'Measurements' && o.snapshot.measurements && (
          <>
            <h2>Current measurements</h2>
            <p>
              {o.snapshot.measurements.source} · version {o.snapshot.measurements.version}
              {o.snapshot.amendment ? ' · Amended after tailor review' : ''}
              {o.reviewCases.some((r) => r.measurementsVerifiedAt) ? ' · Tailor verified' : ''}
            </p>
            <dl className="ops-facts">
              {o.snapshot.measurements.values.map((m) => (
                <div key={m.id}>
                  <dt>{m.label}</dt>
                  <dd>{m.mm / 10} cm</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {tab === 'Tailor review' && (
          <>
            <h2>Tailor review</h2>
            {o.reviewCases.map((r) => (
              <article className="ops-item" key={r.id}>
                <p>
                  {label(r.status)} ·{' '}
                  {r.dueAt ? 'Target: ' + new Date(r.dueAt).toLocaleString() : 'Awaiting payment'}
                </p>
                <p>
                  {r.decision && label(r.decision)}{' '}
                  {r.customerResponse && ' · ' + label(r.customerResponse)}
                </p>
                {r.customerMessage && <p>{r.customerMessage}</p>}
                {can('reviews.read') && (
                  <Link href={'/admin/reviews/' + r.id}>Open tailor review</Link>
                )}
              </article>
            ))}
          </>
        )}
        {tab === 'Payment' && (
          <>
            <h2>Payment attempts</h2>
            {!o.payments.length && <p>No payment attempts.</p>}
            {o.payments.map((p) => (
              <article className="ops-item" key={p.id}>
                <p>
                  {label(p.status)} · {formatPrice(p.amountMinor, o.currency)} ·{' '}
                  {new Date(p.createdAt).toLocaleString()}
                </p>
                {p.providerSessionId &&
                  /^cs_(test|live)_[A-Za-z0-9]+$/.test(p.providerSessionId) && (
                    <a
                      href={`https://dashboard.stripe.com/${p.providerSessionId.startsWith('cs_test_') ? 'test/' : ''}checkout/sessions/${encodeURIComponent(p.providerSessionId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Stripe ↗
                    </a>
                  )}
              </article>
            ))}
          </>
        )}
        {tab === 'Fulfilment' && (
          <>
            <h2>Fulfilment</h2>
            <p>
              Deadlines use {o.opsTimezone}. Assignment is available after payment, including while
              a tailor review is open.
            </p>
            {can('orders.fulfillment.write') && (
              <>
                {canAssignAll && (
                  <AssignmentForm
                    key={'all:' + o.rowVersion}
                    rowVersion={o.rowVersion}
                    busy={busy}
                    onSave={(data) => perform('/assignment', 'POST', data)}
                    all
                  />
                )}
                {awaitingRelease && (
                  <button
                    disabled={busy || !canRelease}
                    onClick={() => void perform('/release', 'POST', { rowVersion: o.rowVersion })}
                  >
                    Release all items
                  </button>
                )}
                {awaitingRelease && !canRelease && (
                  <p>
                    Release needs payment received, any requested tailor review completed, and an
                    active manufacturer with a deadline for each unreleased item.
                  </p>
                )}
              </>
            )}
            {o.items.map((i) => (
              <ItemFulfillment
                key={i.id + ':' + i.rowVersion}
                item={i}
                busy={busy}
                canAssign={can('orders.fulfillment.write')}
                perform={perform}
              />
            ))}
          </>
        )}
        {tab === 'Activity' && (
          <>
            <h2>Activity & notes</h2>
            {can('orders.notes.write') && <NoteForm busy={busy} perform={perform} />}
            <ol className="ops-activity">
              {o.events.map((e) => (
                <li key={e.id}>
                  <strong>{label(e.type)}</strong>
                  {e.from || e.to ? (
                    <p>
                      {e.from ?? '—'} → {e.to ?? '—'}
                    </p>
                  ) : null}
                  {e.reason && <p>{e.reason}</p>}
                  <small>
                    {new Date(e.createdAt).toLocaleString()} · {e.actor} ·{' '}
                    {e.visibleToCustomer ? 'Customer visible' : 'Internal'}
                  </small>
                </li>
              ))}
            </ol>
            <h3>Notifications</h3>
            {o.notifications.length === 0 && <p>No notifications.</p>}
            {o.notifications.map((n) => (
              <div className="ops-item" key={n.id}>
                <p>
                  {label(n.purpose)} · {n.status} · {n.attempts} attempts
                </p>
                {n.status === 'failed' && can('orders.notifications.retry') && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void perform('/api/admin/notifications/' + n.id + '/retry', 'POST', {})
                    }
                  >
                    Retry {label(n.purpose)}
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </fieldset>
    </>
  );
}
function ShippingAddress({ address }: { address: Record<string, unknown> | null }) {
  if (!address) return <p>Not recorded.</p>;
  const a = (address.address ?? address) as Record<string, unknown>;
  return (
    <p>
      {[address.name, a.line1, a.line2, a.city, a.state, a.postal_code, a.country]
        .filter((v) => typeof v === 'string' && v)
        .join(', ') || 'Not recorded.'}
    </p>
  );
}
function SpecOptions({ item }: { item: AdminOrder['items'][number] }) {
  return (
    <dl className="ops-options">
      {item.spec.options.map((v, i) => (
        <div key={i}>
          <dt>
            {v.lineKind === 'accessory' ? 'Accessory · ' : ''}
            {v.groupName} · {v.attributeName}
          </dt>
          <dd>{v.text ?? v.valueLabel ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
function SnapshotHistory({ id, version }: { id: string; version: number }) {
  const [loaded, setLoaded] = useState(false),
    state = useAdminData<AdminOrder['snapshot']>(
      loaded ? `/api/admin/orders/${id}/snapshots/${version}` : null,
    );
  return (
    <>
      <button onClick={() => setLoaded(true)}>View version {version}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.data && (
        <div>
          <p>Sign-off: {state.data.signoff.at}</p>
          {state.data.items.map((i) => (
            <div key={i.lineNo}>
              <h4>
                {i.product.name} × {i.quantity} · {i.material.name}
              </h4>
              <ul>
                {i.options.map((v, n) => (
                  <li key={n}>
                    {v.attributeName}: {v.text ?? v.valueLabel}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {state.data.measurements && (
            <p>{state.data.measurements.values.map((m) => `${m.label}: ${m.mm} mm`).join(' · ')}</p>
          )}
        </div>
      )}
    </>
  );
}
function AssignmentForm({
  rowVersion,
  item,
  busy,
  onSave,
  all = false,
}: {
  rowVersion: number;
  item?: AdminOrder['items'][number];
  busy: boolean;
  onSave: (data: unknown) => Promise<void>;
  all?: boolean;
}) {
  const suppliers = useAdminData<{ items: Entry[]; nextCursor: string | null }>(
      '/api/admin/suppliers?kind=manufacturer&status=active&limit=100',
    ),
    [supplier, setSupplier] = useState(item?.supplier?.id ?? ''),
    [date, setDate] = useState(item?.dueDate ?? ''),
    [reference, setReference] = useState(item?.supplierReference ?? ''),
    [why, setWhy] = useState('');
  const manufacturerLocked =
    !!item &&
    !['not_released', 'released'].includes(
      item.status === 'on_hold' ? (item.holdResumeStatus ?? '') : item.status,
    );
  return (
    <form
      className="ops-form"
      aria-label={all ? 'Assign all items' : 'Supplier assignment'}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          rowVersion,
          supplierId: supplier,
          dueDate: date,
          ...(!all ? { supplierReference: reference || null } : {}),
          ...(why ? { reason: why } : {}),
        });
      }}
    >
      <h3>{all ? 'Assign all items' : 'Supplier assignment'}</h3>
      {suppliers.error && <p role="alert">{suppliers.error}</p>}
      <div className="ops-fields">
        <label>
          Manufacturer
          <select
            aria-label="Manufacturer"
            disabled={manufacturerLocked}
            required
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Choose an active manufacturer…</option>
            {item?.supplier && !suppliers.data?.items.some((s) => s.id === item.supplier!.id) && (
              <option value={item.supplier.id}>{item.supplier.name} (current assignment)</option>
            )}
            {suppliers.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Supplier deadline
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {!all && (
          <label>
            Supplier reference
            <input
              maxLength={200}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        )}
        <label>
          Reason for change
          <input maxLength={2000} value={why} onChange={(e) => setWhy(e.target.value)} />
        </label>
      </div>
      {manufacturerLocked && (
        <p>
          The manufacturer is fixed once production begins. You can still update the deadline and
          reference.
        </p>
      )}
      <button disabled={busy}>{all ? 'Assign all items' : 'Save assignment'}</button>
    </form>
  );
}
function ItemFulfillment({
  item: i,
  busy,
  canAssign,
  perform,
}: {
  item: AdminOrder['items'][number];
  busy: boolean;
  canAssign: boolean;
  perform: Perform;
}) {
  const [why, setWhy] = useState(''),
    [method, setMethod] = useState('carrier'),
    [carrier, setCarrier] = useState(''),
    [number, setNumber] = useState(''),
    [url, setUrl] = useState(''),
    [note, setNote] = useState('');
  const path = '/items/' + i.id;
  return (
    <article className="ops-item" aria-label={'Item ' + i.lineNo}>
      <h3>
        Item {i.lineNo} · {i.spec.product.name} × {i.spec.quantity}
      </h3>
      <p>
        <strong>{label(i.status)}</strong> · {i.supplier?.name ?? 'Unassigned'} ·{' '}
        <span className={i.overdue ? 'ops-overdue' : ''}>
          {i.overdue ? 'Overdue · ' : ''}
          {i.dueDate ?? 'No deadline'}
        </span>
      </p>
      {canAssign && !['shipped', 'delivered', 'completed', 'cancelled'].includes(i.status) && (
        <AssignmentForm
          rowVersion={i.rowVersion}
          item={i}
          busy={busy}
          onSave={(data) => perform(path + '/assignment', 'POST', data)}
        />
      )}
      {i.status === 'not_released' && i.releaseProblems.length > 0 && (
        <p>{i.releaseProblems.join(' ')}</p>
      )}
      {i.allowedTransitions.length > 0 && (
        <>
          <label className="ops-field">
            Reason (required for hold, cancellation or rework)
            <input value={why} maxLength={2000} onChange={(e) => setWhy(e.target.value)} />
          </label>
          {i.allowedTransitions.includes('shipped') && (
            <fieldset className="ops-form">
              <legend>Shipment details</legend>
              <div className="ops-fields">
                <label>
                  Delivery method
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="carrier">Carrier</option>
                    <option value="hand_delivery">Hand delivery</option>
                  </select>
                </label>
                {method === 'carrier' ? (
                  <>
                    <label>
                      Carrier
                      <input
                        value={carrier}
                        maxLength={100}
                        onChange={(e) => setCarrier(e.target.value)}
                      />
                    </label>
                    <label>
                      Tracking number
                      <input
                        value={number}
                        maxLength={200}
                        onChange={(e) => setNumber(e.target.value)}
                      />
                    </label>
                    <label>
                      Tracking URL (optional)
                      <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
                    </label>
                  </>
                ) : (
                  <label>
                    Hand delivery note
                    <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                  </label>
                )}
              </div>
            </fieldset>
          )}
          <div className="admin-toolbar">
            {i.allowedTransitions.map((to) => (
              <button
                key={to}
                disabled={
                  busy ||
                  (to === 'released' && i.status === 'not_released' && !!i.releaseProblems.length)
                }
                onClick={() => {
                  if (
                    to === 'cancelled' &&
                    !window.confirm(
                      'Cancel this item? Any paid amount requires manual refund handling.',
                    )
                  )
                    return;
                  void perform(path + '/transition', 'POST', {
                    rowVersion: i.rowVersion,
                    to,
                    ...(why ? { reason: why } : {}),
                    ...(to === 'shipped'
                      ? {
                          tracking:
                            method === 'carrier'
                              ? {
                                  carrier,
                                  trackingNumber: number,
                                  ...(url ? { trackingUrl: url } : {}),
                                }
                              : { method: 'hand_delivery', note },
                        }
                      : {}),
                  });
                }}
              >
                {i.status === 'on_hold' && to !== 'cancelled' ? 'Resume · ' : ''}
                {
                  (
                    {
                      released: 'Release item',
                      in_production: 'Start production',
                      quality_check: 'Quality check',
                      ready_to_ship: 'Ready to ship',
                      shipped: 'Ship item',
                      delivered: 'Mark delivered',
                      completed: 'Complete item',
                      on_hold: 'Put on hold',
                      cancelled: 'Cancel item',
                    } as Record<string, string>
                  )[to]
                }
              </button>
            ))}
          </div>
        </>
      )}
      {i.tracking && (
        <p>
          {'carrier' in i.tracking
            ? `${i.tracking.carrier} · ${i.tracking.trackingNumber}`
            : 'Hand delivery · ' + i.tracking.note}
        </p>
      )}
    </article>
  );
}
function EtaForm({ o, busy, perform }: { o: AdminOrder; busy: boolean; perform: Perform }) {
  const [date, setDate] = useState(o.customerEtaDate ?? ''),
    [why, setWhy] = useState('');
  return (
    <form
      className="ops-form"
      onSubmit={(e) => {
        e.preventDefault();
        void perform('/eta', 'PATCH', {
          rowVersion: o.rowVersion,
          customerEtaDate: date || null,
          reason: why,
        });
      }}
    >
      <div className="ops-fields">
        <label>
          Estimated delivery date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Reason for estimate change
          <input required maxLength={2000} value={why} onChange={(e) => setWhy(e.target.value)} />
        </label>
      </div>
      <button disabled={busy}>Save delivery estimate</button>
      <p>Leave the date empty to remove the estimate.</p>
    </form>
  );
}
function ReasonAction({
  label,
  busy,
  onSave,
}: {
  label: string;
  busy: boolean;
  onSave: (reason: string) => Promise<void>;
}) {
  const [why, setWhy] = useState('');
  return (
    <form
      className="ops-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(why);
      }}
    >
      <label>
        Reason
        <input required maxLength={2000} value={why} onChange={(e) => setWhy(e.target.value)} />
      </label>
      <button disabled={busy}>{label}</button>
    </form>
  );
}
function NoteForm({ busy, perform }: { busy: boolean; perform: Perform }) {
  const [body, setBody] = useState(''),
    [visibility, setVisibility] = useState('internal');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await perform('/notes', 'POST', { body, visibility });
  };
  return (
    <form className="ops-form" onSubmit={(e) => void submit(e)}>
      <label>
        Note
        <textarea
          required
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <label>
        Visibility
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="internal">Internal staff only</option>
          <option value="customer">Visible to customer</option>
        </select>
      </label>
      <button disabled={busy}>Add note</button>
    </form>
  );
}
