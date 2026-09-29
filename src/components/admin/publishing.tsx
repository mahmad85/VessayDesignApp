'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ValidationReport } from '@/modules/catalog/validate-release';
import type { SnapshotDiff } from '@/modules/catalog/diff';
import { adminFetch, useAdminData, PageTitle, type Entry } from './editor';
type Status = {
  currentVersion: number | null;
  unpublished: boolean;
  errors: number;
  warnings: number;
  currentReferenceOnly: boolean;
};
export function PublishBar() {
  const state = useAdminData<Status>('/api/admin/catalog/status');
  const load = state.load;
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener('catalog-saved', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('catalog-saved', refresh);
      window.clearInterval(timer);
    };
  }, [load]);
  return (
    <section className="admin-publish-bar" aria-label="Catalog publishing status">
      {state.data ? (
        <>
          <span>
            Live: {state.data.currentVersion ? `v${state.data.currentVersion}` : 'No release'} ·{' '}
            {state.data.unpublished ? 'Unpublished changes' : 'Up to date'} · {state.data.errors}{' '}
            errors · {state.data.warnings} warnings
          </span>
          <Link href="/admin/catalog/publish">Review & publish →</Link>
        </>
      ) : (
        <span>{state.error || 'Checking catalog status…'}</span>
      )}
    </section>
  );
}
export function Publishing({ canPublish }: { canPublish: boolean }) {
  const state = useAdminData<Status>('/api/admin/catalog/status'),
    diff = useAdminData<SnapshotDiff>('/api/admin/catalog/diff'),
    history = useAdminData<{ items: Entry[]; nextCursor: string | null }>(
      '/api/admin/catalog/releases',
    );
  const [report, setReport] = useState<ValidationReport | null>(null),
    [ack, setAck] = useState(false),
    [step, setStep] = useState(0),
    [notes, setNotes] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function check() {
    try {
      setReport(await adminFetch<ValidationReport>('/api/admin/catalog/validate', 'POST', {}));
      setAck(false);
      await state.load();
      await diff.load();
      setMessage('Catalog checked.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const reason = !state.data?.unpublished
    ? 'Nothing changed.'
    : !report
      ? 'Run the catalog check first.'
      : report.errors.length
        ? 'Fix the blocking errors first.'
        : report.warnings.length && !ack
          ? 'Review and acknowledge the warnings.'
          : !canPublish
            ? 'Your role cannot publish.'
            : '';
  async function publish() {
    if (reason) return;
    setBusy(true);
    try {
      const result = await adminFetch<{ version: number }>('/api/admin/catalog/publish', 'POST', {
        actionId: crypto.randomUUID(),
        expectedCurrentVersion: state.data?.currentVersion ?? null,
        notes,
        acknowledgeWarnings: ack,
        warningsChecksum: report?.warningsChecksum,
      });
      await state.load();
      await history.load();
      await diff.load();
      setMessage(`v${result.version} is live.`);
      setReport(null);
      setAck(false);
      window.dispatchEvent(new Event('catalog-saved'));
    } catch (e) {
      setMessage((e as Error).message);
      setStep(0);
      setReport(await adminFetch<ValidationReport>('/api/admin/catalog/validate', 'POST', {}));
      setAck(false);
      await state.load();
    } finally {
      setBusy(false);
    }
  }
  const target = (entity: string) =>
    ['group', 'attribute', 'value', 'component', 'product', 'rule'].includes(entity)
      ? entity === 'rule'
        ? 'rules'
        : 'products'
      : entity === 'material'
        ? 'fabrics'
        : entity === 'template'
          ? 'templates'
          : entity === 'media'
            ? 'media'
            : 'products';
  return (
    <>
      <PageTitle
        title="Publish & history"
        description="Check the working catalog, review its changes, and make a new immutable release."
      />
      <div className="admin-tabs" role="tablist" aria-label="Publish steps">
        {['1 · Check', '2 · Changes', '3 · Publish'].map((label, i) => (
          <button key={label} role="tab" aria-selected={step === i} onClick={() => setStep(i)}>
            {label}
          </button>
        ))}
      </div>
      <section className="admin-detail-panel">
        {step === 0 && (
          <>
            <h2>Check the catalog</h2>
            <button onClick={() => void check()}>Run catalog check</button>
            {report && (
              <>
                <h3>
                  {report.errors.length} blocking errors · {report.warnings.length} warnings
                </h3>
                {[
                  ['Errors', report.errors],
                  ['Warnings', report.warnings],
                ].map(([title, issues]) => (
                  <details key={String(title)} open={title === 'Errors'}>
                    <summary>
                      {String(title)} ({(issues as ValidationReport['errors']).length})
                    </summary>
                    <ul className="admin-validation-list">
                      {(issues as ValidationReport['errors']).map((issue, i) => (
                        <li key={i}>
                          <Link
                            href={`/admin/catalog/${target(issue.entity)}?code=${encodeURIComponent(issue.entityCode)}`}
                          >
                            {issue.entityCode}
                          </Link>{' '}
                          — {issue.message}
                          <small>{issue.code}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
                {!!report.warnings.length && (
                  <label className="admin-confirm">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />{' '}
                    I have reviewed these warnings
                  </label>
                )}
              </>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <h2>Changes since the live release</h2>
            {diff.data &&
              (['added', 'changed', 'removed'] as const).map((kind) => (
                <details key={kind} open>
                  <summary>
                    {kind} · {diff.data![kind].length}
                  </summary>
                  <ul className="admin-validation-list">
                    {diff.data![kind].map((item) => (
                      <li key={`${item.entity}:${item.code}`}>
                        <strong>{item.code}</strong> · {item.entity}
                        {'fields' in item ? ` · ${(item.fields as string[]).join(', ')}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
          </>
        )}
        {step === 2 && (
          <>
            <h2>Publish v{(state.data?.currentVersion ?? 0) + 1}</h2>
            <p>
              This creates a new release for customer designs. Existing submitted specifications
              keep their history.
            </p>
            <label className="admin-field">
              Release notes
              <textarea
                maxLength={500}
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <p>{reason}</p>
            <button
              className="admin-primary"
              disabled={busy || !!reason}
              onClick={() => void publish()}
            >
              Publish catalog
            </button>
          </>
        )}
        {step < 2 && <button onClick={() => setStep(step + 1)}>Continue</button>}
      </section>
      {(message || state.error) && <p role="status">{message || state.error}</p>}
      <section className="admin-card">
        <h2>Release history</h2>
        <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Catalog releases">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Published</th>
                <th>Author</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.data?.items.map((r) => (
                <tr key={String(r.version)}>
                  <td>
                    v{String(r.version)}
                    {r.referenceOnly === true && <small>Reference only</small>}
                  </td>
                  <td>{new Date(String(r.publishedAt)).toLocaleString()}</td>
                  <td>{String(r.publishedBy)}</td>
                  <td>{String(r.notes)}</td>
                  <td>
                    <a href={`/api/admin/catalog/releases/${r.version}/snapshot`} download>
                      Download snapshot
                    </a>
                    {canPublish && (
                      <button
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Restore v${r.version} into the working catalog? Current unpublished changes will be replaced. You can review it before publishing.`,
                            )
                          )
                            return;
                          try {
                            await adminFetch(
                              `/api/admin/catalog/releases/${r.version}/restore`,
                              'POST',
                              {
                                actionId: crypto.randomUUID(),
                                publishImmediately: false,
                                notes: '',
                              },
                            );
                            await check();
                            setStep(0);
                            setMessage(
                              `Restored v${r.version} to the working catalog. Review before publishing.`,
                            );
                            window.dispatchEvent(new Event('catalog-saved'));
                          } catch (e) {
                            setMessage((e as Error).message);
                          }
                        }}
                      >
                        Restore…
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history.data?.nextCursor && (
          <button
            onClick={async () => {
              const more = await adminFetch<{ items: Entry[]; nextCursor: string | null }>(
                `/api/admin/catalog/releases?cursor=${history.data?.nextCursor}`,
              );
              history.setData((old) =>
                old ? { items: [...old.items, ...more.items], nextCursor: more.nextCursor } : more,
              );
            }}
          >
            Older releases
          </button>
        )}
      </section>
    </>
  );
}
