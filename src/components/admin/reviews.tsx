'use client';
import Link from 'next/link';
import { useState } from 'react';
import { adminFetch, useAdminData, type Entry } from './editor';
import type { OrderSnapshot } from '@/modules/orders/submission';
type Detail = {
  review: Entry;
  snapshot: OrderSnapshot;
  measurementSources: {
    capturedAt: string | null;
    fields: { id: string; source: string }[];
  };
};
export function ReviewQueue({ initialFilter = '' }: { initialFilter?: string }) {
  const [filter, setFilter] = useState(initialFilter),
    [cursor, setCursor] = useState(''),
    state = useAdminData<{ items: Entry[]; nextCursor: string | null }>(
      '/api/admin/reviews' +
        filter +
        (cursor ? (filter ? '&' : '?') + 'cursor=' + encodeURIComponent(cursor) : ''),
    );
  return (
    <>
      <p className="admin-eyebrow">AFTER PAYMENT</p>
      <h1 className="order-admin-title">Tailor reviews</h1>
      <p>
        Customers requested these reviews before production. The customer decides whether to accept
        proposed measurements.
      </p>
      <label>
        Show{' '}
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCursor('');
          }}
        >
          <option value="">All waiting reviews</option>
          <option value="?mine=true">Assigned to me</option>
          <option value="?unassigned=true">Unassigned</option>
          <option value="?overdue=true">Overdue</option>
          <option value="?status=awaiting_customer">Awaiting customer</option>
        </select>
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      {state.data?.items.length === 0 && <p>No tailor reviews waiting.</p>}
      <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Tailor review queue">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            {state.data?.items.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={'/admin/reviews/' + r.id}>{String(r.number)}</Link>
                </td>
                <td>{String(r.customerName)}</td>
                <td>{r.paidAt ? new Date(String(r.paidAt)).toLocaleString() : '—'}</td>
                <td>
                  {r.overdue ? 'Overdue · ' : ''}
                  {r.dueAt ? new Date(String(r.dueAt)).toLocaleString() : '—'}
                </td>
                <td>{r.status.replaceAll('_', ' ')}</td>
                <td>{r.assignedTo ? 'Assigned' : 'Unassigned'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cursor && <button onClick={() => setCursor('')}>First page</button>}
      {state.data?.nextCursor && (
        <button onClick={() => setCursor(state.data!.nextCursor!)}>Next reviews</button>
      )}
    </>
  );
}
export function TailorReview({
  id,
  canDecide,
  userId,
}: {
  id: string;
  canDecide: boolean;
  userId: string;
}) {
  const state = useAdminData<Detail>('/api/admin/reviews/' + id);
  return (
    <>
      {state.error && <p role="alert">{state.error}</p>}
      {state.data ? (
        <Decision
          key={String(state.data.review.rowVersion)}
          data={state.data}
          canDecide={canDecide}
          userId={userId}
          reload={state.load}
        />
      ) : (
        <p>Loading review…</p>
      )}
    </>
  );
}
function Decision({
  data,
  canDecide,
  userId,
  reload,
}: {
  data: Detail;
  canDecide: boolean;
  userId: string;
  reload: () => Promise<unknown>;
}) {
  const { review: r, snapshot: s } = data,
    [decision, setDecision] = useState('no_changes'),
    [proposed, setProposed] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(''),
    [notes, setNotes] = useState(''),
    [verified, setVerified] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [unit, setUnit] = useState('cm');
  async function save(action: string) {
    setBusy(true);
    setError('');
    try {
      const changes = Object.fromEntries(
        Object.entries(proposed)
          .filter(([, v]) => v !== '')
          .map(([key, v]) => [
            key,
            Math.round(Number(v) * (unit === 'cm' ? 10 : 25.4) * 100) / 100,
          ]),
      );
      await adminFetch(
        '/api/admin/reviews/' + r.id + '/' + action,
        'POST',
        action === 'claim'
          ? { rowVersion: r.rowVersion }
          : {
              rowVersion: r.rowVersion,
              snapshotVersion: r.snapshotVersion,
              decision,
              customerMessage: message,
              notes,
              proposedMeasurements: decision === 'changes_proposed' ? changes : undefined,
              measurementsVerified: decision === 'no_changes' && verified,
            },
      );
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/admin/reviews">← Tailor queue</Link>
      <h1 className="order-admin-title">{s.number} · Tailor review</h1>
      <p>
        Snapshot v{r.snapshotVersion as number} · {r.status.replaceAll('_', ' ')}
        {r.overdue ? ' · Taking longer than expected' : ''}
      </p>
      <div className="order-detail-grid">
        <section className="admin-panel">
          <h2>Customer specification</h2>
          <p>
            Signed off {new Date(s.signoff.at).toLocaleString()} · {s.signoff.statementVersion}
          </p>
          {s.items.map((i) => (
            <details key={i.lineNo}>
              <summary>
                {i.product.name} · {i.material.name} · ×{i.quantity}
              </summary>
              <dl>
                {i.options.map((v, j) => (
                  <div key={j}>
                    <dt>{v.attributeName}</dt>
                    <dd>{v.text ?? v.valueLabel}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
          <h2>Measurements</h2>
          <p>
            {s.measurements.source === 'customer' ? 'Customer entered' : '3DLOOK estimate'} · v
            {s.measurements.version}
          </p>
          <dl>
            {s.measurements.values.map((m) => (
              <div key={m.id}>
                <dt>{m.label}</dt>
                <dd>
                  {m.mm / 10} cm ·{' '}
                  {data.measurementSources.fields.find((f) => f.id === m.id)?.source === '3dlook'
                    ? '3DLOOK estimate'
                    : s.measurements.source === 'customer'
                      ? 'Customer entered'
                      : 'Customer edit or unlinked estimate'}
                </dd>
              </div>
            ))}
          </dl>
          {data.measurementSources.capturedAt && (
            <p>Source captured {new Date(data.measurementSources.capturedAt).toLocaleString()}</p>
          )}
          <h2>Check advice</h2>
          {s.check.findings.map((f) => (
            <p key={f.id}>
              <strong>{f.title}</strong> — {f.description}
            </p>
          ))}
        </section>
        <section className="admin-panel">
          <h2>Decision</h2>
          <p>
            The customer may accept your proposal or keep their own measurements. Changes with a
            price impact need separate staff handling.
          </p>
          {canDecide && r.status === 'pending' && (
            <button disabled={busy} onClick={() => void save('claim')}>
              Claim review
            </button>
          )}
          {canDecide && r.status === 'in_review' && r.assignedTo === userId ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save('decision');
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Outcome
                  <select value={decision} onChange={(e) => setDecision(e.target.value)}>
                    <option value="no_changes">No changes</option>
                    <option value="changes_proposed">Propose measurement changes</option>
                  </select>
                </label>
                {decision === 'no_changes' ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={verified}
                      onChange={(e) => setVerified(e.target.checked)}
                    />
                    Measurements verified by tailor
                  </label>
                ) : (
                  <>
                    <label>
                      Units
                      <select
                        value={unit}
                        onChange={(e) => {
                          setUnit(e.target.value);
                          setProposed({});
                        }}
                      >
                        <option value="cm">Centimetres</option>
                        <option value="in">Inches</option>
                      </select>
                    </label>
                    {s.measurements.values.map((m) => (
                      <label key={m.id}>
                        {m.label} — current {(m.mm / (unit === 'cm' ? 10 : 25.4)).toFixed(1)} {unit}
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={3000 / (unit === 'cm' ? 10 : 25.4)}
                          placeholder="Keep current value"
                          value={proposed[m.id] ?? ''}
                          onChange={(e) => setProposed({ ...proposed, [m.id]: e.target.value })}
                        />
                      </label>
                    ))}
                    <label>
                      Message to customer
                      <textarea
                        required
                        maxLength={1500}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <label>
                  Internal notes
                  <textarea
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <button type="submit">Submit decision</button>
              </fieldset>
            </form>
          ) : (
            r.status !== 'pending' && (
              <p>
                {r.status === 'awaiting_customer'
                  ? 'Waiting for the customer’s answer.'
                  : 'The decision form is available to the assigned tailor during review.'}
              </p>
            )
          )}
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
    </>
  );
}
