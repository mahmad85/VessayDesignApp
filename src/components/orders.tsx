'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CustomerOrder } from '@/db/order-repository';
import { formatPrice } from '@/lib/money';
import { adminFetch, useAdminData } from './admin/editor';
import { Dialog } from './ui/dialog';
const label = (s: string) => s.replaceAll('_', ' ');
export function OrdersList() {
  const [cursor, setCursor] = useState(''),
    state = useAdminData<{
      items: Pick<
        CustomerOrder,
        'number' | 'submittedAt' | 'currency' | 'totalMinor' | 'payment' | 'fulfillment'
      >[];
      nextCursor: string | null;
    }>('/api/orders?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
  return (
    <>
      <h1>Your orders</h1>
      {state.error && <p role="alert">{state.error}</p>}
      {!state.data && !state.error && <p>Loading orders…</p>}
      {state.data?.items.length === 0 && (
        <p>
          You have no orders yet. <Link href="/">Start a garment</Link>
        </p>
      )}
      <div className="order-cards">
        {state.data?.items.map((o) => (
          <Link className="order-card" key={o.number} href={'/orders/' + o.number}>
            <strong>{o.number}</strong>
            <time>{new Date(o.submittedAt).toLocaleDateString()}</time>
            <span>{formatPrice(o.totalMinor, o.currency)}</span>
            <span>Payment: {label(o.payment.status)}</span>
            <span>{o.fulfillment.label}</span>
          </Link>
        ))}
      </div>
      {cursor && <button onClick={() => setCursor('')}>Newest orders</button>}
      {state.data?.nextCursor && (
        <button onClick={() => setCursor(state.data!.nextCursor!)}>Older orders</button>
      )}
    </>
  );
}
export function OrderDetail({ number }: { number: string }) {
  const state = useAdminData<{ order: CustomerOrder }>('/api/orders/' + encodeURIComponent(number)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [cancel, setCancel] = useState(false),
    [timedOut, setTimedOut] = useState(false),
    [saved, setSaved] = useState(false);
  const o = state.data?.order,
    lock = useRef(false),
    actionIds = useRef<Record<string, string>>({});
  const load = state.load;
  useEffect(() => {
    if (o?.payment.status !== 'payment_pending') return;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 3000;
      if (elapsed > 60000) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      void load();
    }, 3000);
    return () => clearInterval(timer);
  }, [o?.payment.status, load]);
  async function act(action: string, data: Record<string, unknown> = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    // A verified terminal outcome permits a new checkout attempt. Unknown or
    // pending retries keep their key and the server reuses the durable attempt.
    const key =
        action +
        JSON.stringify(data) +
        (action === 'checkout' ? `:${o?.payment.status}:${o?.snapshotVersion}` : ''),
      actionId = (actionIds.current[key] ??= crypto.randomUUID());
    try {
      const result = await adminFetch<{ checkoutUrl?: string }>(
        '/api/orders/' + number + '/' + action,
        'POST',
        { actionId, ...data },
      );
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
      else await load();
      setCancel(false);
    } catch (e) {
      setError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function updateSaved() {
    setBusy(true);
    try {
      const current = await adminFetch<{
        draft: { revision: number; measurements: { values: Record<string, number> } };
      }>('/api/studio');
      await adminFetch('/api/studio', 'POST', {
        actionId: crypto.randomUUID(),
        expectedRevision: current.draft.revision,
        command: {
          type: 'measurements',
          values: {
            ...current.draft.measurements.values,
            ...Object.fromEntries(o!.measurements.values.map((m) => [m.id, m.mm])),
          },
          confirm: false,
        },
      });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!o)
    return (
      <>
        <h1>Order {number}</h1>
        <p role={state.error ? 'alert' : undefined}>{state.error || 'Loading your order…'}</p>
      </>
    );
  return (
    <>
      <Link href="/orders">← All orders</Link>
      <div className="order-heading">
        <div>
          <p className="eyebrow">YOUR TAILORED ORDER</p>
          <h1>{o.number}</h1>
          <p>
            Signed off {new Date(o.signedOffAt).toLocaleString()} · specification v
            {o.snapshotVersion}
          </p>
        </div>
        <strong>{formatPrice(o.totalMinor, o.currency)}</strong>
      </div>
      <div className="order-tracks">
        <section>
          <h2>Payment</h2>
          <p>{o.payment.status === 'succeeded' ? 'Payment received' : label(o.payment.status)}</p>
        </section>
        {o.tailorReview.requested && (
          <section>
            <h2>Tailor review</h2>
            <p>
              {o.tailorReview.overdue
                ? 'Taking longer than expected'
                : label(o.tailorReview.status)}
            </p>
            {o.tailorReview.dueAt && (
              <small>Review target: {new Date(o.tailorReview.dueAt).toLocaleString()}</small>
            )}
            {o.tailorReview.awaitingCustomerSince && (
              <p>
                Waiting for your answer since{' '}
                {new Date(o.tailorReview.awaitingCustomerSince).toLocaleString()}
              </p>
            )}
          </section>
        )}
        <section>
          <h2>Production</h2>
          <p>{o.fulfillment.label}</p>
          {o.fulfillment.etaDate && <p>Expected delivery: {o.fulfillment.etaDate}</p>}
        </section>
      </div>
      {o.payment.status === 'payment_pending' && (
        <p role="status">
          {timedOut ? 'Still confirming — we’ll email you.' : 'We are confirming your payment.'}{' '}
          <button onClick={() => void load()}>Refresh status</button>
          <button disabled={busy} onClick={() => void act('checkout')}>
            Check or resume checkout
          </button>
        </p>
      )}
      {o.payment.status === 'succeeded' && (
        <p className="order-notice">
          Payment received. Our tailoring experts may contact you if we need any further details
          about your order.{' '}
          {o.tailorReview.requested && o.tailorReview.status !== 'completed'
            ? 'Your requested tailor review takes place before production.'
            : ''}
        </p>
      )}
      {o.quoteExpired && o.actions.includes('resubmit') && (
        <p>Price expired — update your order.</p>
      )}
      {typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('payment') === 'payments_disabled' && (
          <p role="status">Online payment is not available yet. Your order is saved.</p>
        )}
      {typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('checkout') === 'cancelled' &&
        o.payment.status !== 'succeeded' && <p>Payment not completed — your order is saved.</p>}
      <div className="order-actions">
        {o.actions.includes('pay') && (
          <button disabled={busy} onClick={() => void act('checkout')}>
            Pay {formatPrice(o.totalMinor, o.currency)}
          </button>
        )}
        {o.actions.includes('resubmit') && (
          <Link href={'/?resubmit=' + o.number}>Update and resubmit</Link>
        )}
        {o.actions.includes('cancel') && (
          <button disabled={busy} onClick={() => setCancel(true)}>
            Cancel order
          </button>
        )}
      </div>
      {o.actions.includes('respond_tailor') && (
        <section className="order-card">
          <h2>Your tailor’s proposal</h2>
          <p>{o.tailorReview.customerMessage}</p>
          <p>You decide which measurements to use. Either answer completes the review.</p>
          <table>
            <thead>
              <tr>
                <th>Measurement</th>
                <th>Your value</th>
                <th>Tailor’s proposal</th>
              </tr>
            </thead>
            <tbody>
              {o.tailorReview.proposedChanges.map((m) => (
                <tr key={m.id}>
                  <th>{m.label}</th>
                  <td>{m.currentMm / 10} cm</td>
                  <td>{m.proposedMm / 10} cm</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="order-actions">
            <button
              disabled={busy}
              onClick={() => void act('tailor-review/respond', { response: 'accept_changes' })}
            >
              Accept the tailor’s changes
            </button>
            <button
              disabled={busy}
              onClick={() => void act('tailor-review/respond', { response: 'keep_original' })}
            >
              Keep my measurements
            </button>
          </div>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="order-detail-grid">
        <div>
          <h2>Your specification</h2>
          {o.items.map((i) => (
            <section className="order-card" key={i.lineNo}>
              <h3>
                {i.productName} · {i.quantity} {i.quantity === 1 ? 'garment' : 'garments'}
              </h3>
              <p>
                {i.templateName ?? 'Custom design'} · {i.materialName}
              </p>
              <strong>{formatPrice(i.lineTotalMinor, o.currency)}</strong>
              <p>{i.statusLabel}</p>
              {i.tracking &&
                ('carrier' in i.tracking ? (
                  <p>
                    {i.tracking.carrier} · {i.tracking.trackingNumber}
                    {i.tracking.trackingUrl && (
                      <>
                        {' '}
                        ·{' '}
                        <a href={i.tracking.trackingUrl} target="_blank" rel="noreferrer">
                          Track shipment ↗
                        </a>
                      </>
                    )}
                  </p>
                ) : (
                  <p>Hand delivery · {i.tracking.note}</p>
                ))}
              <details>
                <summary>Design details</summary>
                <dl>
                  {i.options
                    .filter((v) => v.lineKind !== 'accessory')
                    .map((v, j) => (
                      <div key={j}>
                        <dt>
                          {v.group} · {v.option}
                        </dt>
                        <dd>{v.choice}</dd>
                      </div>
                    ))}
                </dl>
                <h4>Accessories</h4>
                <dl>
                  {i.options
                    .filter((v) => v.lineKind === 'accessory')
                    .map((v, j) => (
                      <div key={j}>
                        <dt>{v.option}</dt>
                        <dd>{v.choice}</dd>
                      </div>
                    ))}
                </dl>
              </details>
            </section>
          ))}
          <dl className="order-card">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(o.subtotalMinor, o.currency)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{formatPrice(o.shippingMinor, o.currency)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatPrice(o.totalMinor, o.currency)}</dd>
            </div>
          </dl>
        </div>
        <div>
          <section className="order-card">
            <h2>Your measurements · v{o.measurements.version}</h2>
            <p>
              {o.measurements.source === 'customer' ? 'Customer entered' : '3DLOOK estimate'}
              {o.tailorReview.verified ? ' · Tailor verified' : ''}
              {o.amendment ? ' · Amended after tailor review' : ''}
            </p>
            <dl>
              {o.measurements.values.map((m) => (
                <div key={m.id}>
                  <dt>{m.label}</dt>
                  <dd>{m.mm / 10} cm</dd>
                </div>
              ))}
            </dl>
            {o.amendment && (
              <>
                <p>Your saved studio measurements have not changed.</p>
                <button disabled={busy || saved} onClick={() => void updateSaved()}>
                  {saved ? 'Saved for your next design' : 'Update my saved measurements too'}
                </button>
              </>
            )}
          </section>
          <section className="order-card">
            <h2>Order activity</h2>
            <ol>
              {o.timeline.map((e, i) => (
                <li key={i}>
                  <strong>{e.label}</strong>
                  <br />
                  <time>{new Date(e.at).toLocaleString()}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
      <Dialog
        open={cancel}
        onOpenChange={setCancel}
        title="Cancel this unpaid order?"
        description="Your studio draft stays available. The order will no longer be payable."
      >
        <button disabled={busy} onClick={() => void act('cancel')}>
          Confirm cancellation
        </button>
        <button onClick={() => setCancel(false)}>Keep order</button>
      </Dialog>
    </>
  );
}
