'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { CommandV2, DraftV2 } from '@/modules/configuration/types';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import type { CartQuote } from '@/modules/pricing/quote';
import { formatPrice } from '@/lib/money';
import {
  definitionsForProducts,
  displayValue,
  type MeasurementSet,
} from '@/modules/measurements/definitions';
import { designOutline } from '@/modules/configuration/design-outline';
import { SIGNOFF_DESIGN, SIGNOFF_MEASUREMENTS, SIGNOFF_VERSION } from '@/modules/orders/submission';
import { Button } from './ui/button';
export function ReviewPanel({
  draft,
  quote,
  index,
  measurementSets,
  busy,
  command,
  check,
  edit,
  signedIn,
  onRefresh,
}: {
  draft: DraftV2;
  quote: CartQuote;
  index: RuntimeIndex;
  measurementSets: MeasurementSet[];
  busy: boolean;
  command: (c: CommandV2) => Promise<DraftV2 | null>;
  check: () => Promise<DraftV2 | null>;
  edit: (step: number, field?: string) => void;
  signedIn: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const [design, setDesign] = useState(false),
    [measurements, setMeasurements] = useState(false),
    [tailor, setTailor] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [error, setError] = useState('');
  const action = useRef<{ fingerprint: string; id: string } | null>(null),
    lock = useRef(false);
  const passed = draft.review?.status === 'passed' && draft.review.inputRevision === draft.revision;
  const reason = !signedIn
    ? 'Sign in to place your order.'
    : !passed
      ? 'Run Check my order and resolve any blocking findings.'
      : !design || !measurements
        ? 'Confirm both the design and measurements.'
        : quote.status !== 'priced'
          ? 'A price is needed for every garment.'
          : '';
  async function place() {
    if (reason || lock.current) return;
    lock.current = true;
    setSubmitting(true);
    setError('');
    const payload = {
      expectedRevision: draft.revision,
      checkId: draft.review!.id,
      signoff: { design, measurements, statementVersion: SIGNOFF_VERSION },
      tailorReview: tailor,
      acceptTotal: { amountMinor: quote.totalMinor, currency: quote.currency },
    };
    const fingerprint = JSON.stringify(payload);
    if (action.current?.fingerprint !== fingerprint)
      action.current = { fingerprint, id: crypto.randomUUID() };
    const resubmit = new URLSearchParams(window.location.search).get('resubmit');
    try {
      const response = await fetch(
          resubmit ? '/api/orders/' + encodeURIComponent(resubmit) + '/resubmit' : '/api/orders',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, actionId: action.current.id }),
          },
        ),
        result = await response.json();
      if (!response.ok) {
        setDesign(false);
        setMeasurements(false);
        await onRefresh();
        throw new Error(result.error?.message ?? 'Your order could not be placed.');
      }
      const number = result.order.number,
        checkout = await fetch('/api/orders/' + number + '/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionId: crypto.randomUUID() }),
        }),
        paid = await checkout.json();
      window.location.assign(
        checkout.ok
          ? paid.checkoutUrl
          : '/orders/' +
              number +
              '?payment=' +
              encodeURIComponent(paid.error?.code ?? 'unavailable'),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to place your order. Retry with the same saved action.',
      );
    } finally {
      setSubmitting(false);
      lock.current = false;
    }
  }
  return (
    <section className="review-panel">
      <div className="eyebrow">THE FINISHING TOUCH</div>
      <h1>Review &amp; pay</h1>
      <p className="intro-copy">Review every garment and the measurements you want us to use.</p>
      {draft.garments.map((g, i) => {
        const p = index.products.get(g.productCode),
          m = index.materials.get(g.materialCode),
          price = quote.garments.find((v) => v.garmentId === g.id);
        return (
          <section className="review-section" key={g.id}>
            <div className="section-heading">
              <h2>
                {i + 1}. {p?.name ?? g.productCode}
              </h2>
              <button
                onClick={async () => {
                  if (await command({ type: 'select_garment', garmentId: g.id })) edit(1);
                }}
              >
                Edit garment {i + 1}
              </button>
            </div>
            <p>{m?.name ?? g.materialCode}</p>
            <details>
              <summary>Design specification</summary>
              <dl>
                {designOutline(index, g)
                  .flatMap((b) => b.leaves)
                  .map((l) => (
                    <div key={l.id}>
                      <dt>{l.label}</dt>
                      <dd>{l.value}</dd>
                    </div>
                  ))}
              </dl>
            </details>
            <label className="order-quantity">
              Quantity{' '}
              <input
                aria-label={'Quantity for garment ' + (i + 1)}
                type="number"
                min={1}
                max={5}
                value={g.quantity}
                disabled={busy || submitting}
                onChange={(e) => {
                  const quantity = Number(e.target.value);
                  if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 5)
                    void command({ type: 'set_quantity', garmentId: g.id, quantity });
                }}
              />
            </label>
            <strong>
              {price?.status === 'priced'
                ? formatPrice(price.totalMinor, price.currency)
                : 'Price not yet available'}
            </strong>
          </section>
        );
      })}
      <section className="review-section">
        <div className="section-heading">
          <h2>Your measurements · v{draft.measurements.version}</h2>
          <button onClick={() => edit(2)}>Edit measurements</button>
        </div>
        <p>One profile covers every garment in your cart.</p>
        <div className="measurement-summary">
          {definitionsForProducts(measurementSets)
            .filter((m) => draft.measurements.values[m.id] || !('advanced' in m && m.advanced))
            .map((m) => (
              <div key={m.id}>
                <span>{m.label}</span>
                <strong>
                  {displayValue(draft.measurements.values[m.id], 'cm') || '—'} <small>cm</small>
                </strong>
              </div>
            ))}
        </div>
        <p className="source-tag">
          {draft.measurements.source === 'customer' ? 'Customer entered' : '3DLOOK estimate'} ·{' '}
          {draft.measurements.confirmed ? 'confirmed by you' : 'not confirmed'}
        </p>
      </section>
      <section className="quote-section">
        <dl>
          {(['subtotalMinor', 'shippingMinor', 'totalMinor'] as const).map((key, i) => (
            <div key={key}>
              <dt>{['Subtotal', 'Delivery', 'Total'][i]}</dt>
              <dd>
                {quote[key] === null
                  ? 'Price not yet available'
                  : formatPrice(quote[key]!, quote.currency)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="review-section">
        <h2>Check your order</h2>
        <p>Checks confirm completeness and compatibility. They do not certify physical fit.</p>
        <Button disabled={busy || submitting} onClick={check}>
          Check my order
        </Button>
        {draft.review && (
          <div aria-live="polite">
            <h3>{passed ? 'Your order is ready' : 'Resolve these findings'}</h3>
            {draft.review.findings.map((f) => (
              <article className="finding" key={f.id}>
                <div>
                  <strong>
                    {f.severity === 'blocker' ? 'Action needed: ' : 'Advice: '}
                    {f.title}
                  </strong>
                  <p>{f.description}</p>
                  {f.severity === 'blocker' && f.target !== 'commercial' && (
                    <button
                      onClick={async () => {
                        if (f.garmentId && f.garmentId !== draft.activeGarmentId)
                          await command({ type: 'select_garment', garmentId: f.garmentId });
                        edit(f.target === 'measurements' ? 2 : 1, f.field);
                      }}
                    >
                      Review {f.target}
                    </button>
                  )}
                </div>
              </article>
            ))}
            {draft.review.aiAdvisory === 'unavailable' && (
              <p>Advice unavailable right now{passed ? ' — your order check still passed' : ''}.</p>
            )}
          </div>
        )}
      </section>
      <section className="review-section">
        <h2>Your sign-off</h2>
        <fieldset disabled={!passed || busy || submitting} className="order-signoff">
          <label>
            <input type="checkbox" checked={design} onChange={(e) => setDesign(e.target.checked)} />
            {SIGNOFF_DESIGN}
          </label>
          <label>
            <input
              type="checkbox"
              checked={measurements}
              onChange={(e) => setMeasurements(e.target.checked)}
            />
            {SIGNOFF_MEASUREMENTS}
          </label>
          <label>
            <input type="checkbox" checked={tailor} onChange={(e) => setTailor(e.target.checked)} />
            Add a tailor review
          </label>
          <p>
            After payment, a tailor checks your design and measurements before production. If they
            suggest a change, you decide. The review target is 24 hours. Timing is provisional until
            the service launches.
          </p>
        </fieldset>
        {!signedIn && <Link href="/account">Sign in to place your order</Link>}
        <Button className="full-width" disabled={!!reason || busy || submitting} onClick={place}>
          {submitting
            ? 'Saving your order…'
            : 'Place order and pay' +
              (quote.totalMinor === null
                ? ''
                : ' ' + formatPrice(quote.totalMinor, quote.currency))}
        </Button>
        <p>{reason}</p>
        {error && <p role="alert">{error}</p>}
      </section>
    </section>
  );
}
