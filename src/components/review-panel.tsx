'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Clock3,
  Download,
  FileCheck2,
  Info,
  PenLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { Draft, Command } from '@/modules/configuration/types';
import { PRODUCTS, fabricFor } from '@/modules/catalog/catalog';
import { definitionsFor, displayValue } from '@/modules/measurements/definitions';
import { Button } from './ui/button';
export function ReviewPanel({
  draft,
  busy,
  command,
  edit,
}: {
  draft: Draft;
  busy: boolean;
  command: (c: Command) => Promise<Draft | null>;
  edit: (step: number) => void;
}) {
  const [mode, setMode] = useState<'automated' | 'human'>('automated');
  const d = draft.design;
  const f = fabricFor(d.fabricId)!;
  const review = draft.review;
  function download() {
    const payload = {
      kind: 'development-draft',
      notAnOrder: true,
      exportedAt: new Date().toISOString(),
      ...draft,
      messages: undefined,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `vessy-draft-${draft.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="review-panel">
      <div className="eyebrow">
        <span className="small-star">✳</span> THE FINISHING TOUCH
      </div>
      <h1>
        Thoughtfully chosen.
        <br />
        Entirely yours.
      </h1>
      <p className="intro-copy">One last look at the details that make it your own.</p>
      <div className="review-section">
        <div className="section-heading">
          <h2>Your design</h2>
          <button onClick={() => edit(1)}>
            <PenLine size={13} /> Edit
          </button>
        </div>
        <dl>
          <div>
            <dt>Garment</dt>
            <dd>{PRODUCTS[d.product].name}</dd>
          </div>
          <div>
            <dt>Fabric</dt>
            <dd>
              <span className="tiny-swatch" style={{ background: f.color }} />
              {f.name}
            </dd>
          </div>
          <div>
            <dt>Occasion & weather</dt>
            <dd>
              {d.occasion || 'Not selected'} · {d.climate || 'Not selected'}
            </dd>
          </div>
          <div>
            <dt>Fit</dt>
            <dd>{d.fit}</dd>
          </div>
          <div>
            <dt>Finishing</dt>
            <dd>
              {d.product === 'shirt'
                ? `${d.collar} collar · ${d.cuffs} cuffs`
                : `${d.lapel} lapel · ${d.pockets} pockets · ${d.closure}`}
            </dd>
          </div>
        </dl>
        <p className="inclusion-note">
          {d.product === 'suit'
            ? 'Includes jacket and trousers. The shirt and shoes are styling references.'
            : d.product === 'shirt'
              ? 'Includes the shirt only. Trousers and shoes are styling references.'
              : 'Includes the blazer only. Shirt, trousers and shoes are styling references.'}
        </p>
      </div>
      <div className="review-section">
        <div className="section-heading">
          <h2>
            Your measurements <span>v{draft.measurements.version}</span>
          </h2>
          <button onClick={() => edit(2)}>
            <PenLine size={13} /> Edit
          </button>
        </div>
        <div className="measurement-summary">
          {definitionsFor(d.product).map((m) => (
            <div key={m.id}>
              <span>{m.label}</span>
              <strong>
                {displayValue(draft.measurements.values[m.id], 'cm') || '—'}
                <small> cm</small>
              </strong>
            </div>
          ))}
        </div>
        <p className="source-tag">
          Customer entered · {draft.measurements.confirmed ? 'confirmed by you' : 'not confirmed'} ·
          unverified
        </p>
      </div>
      <div className="review-section">
        <h2>How would you like to review?</h2>
        <div className="review-modes" role="radiogroup" aria-label="Review method">
          <button
            role="radio"
            aria-checked={mode === 'automated'}
            onClick={() => setMode('automated')}
          >
            <ShieldCheck size={20} />
            <strong>Automated checks</strong>
            <small>Check completeness now</small>
            <span className="radio-circle" />
          </button>
          <button role="radio" aria-checked={mode === 'human'} onClick={() => setMode('human')}>
            <UserRound size={20} />
            <strong>Expert review</strong>
            <small>Target: within 24 hours</small>
            <span className="radio-circle" />
          </button>
        </div>
        <p className="fine-print">
          {mode === 'automated'
            ? 'These checks validate saved choices and missing information. They do not certify physical fit.'
            : 'The 24-hour service and reviewer queue are not live yet. When available, you will receive a payment request after approval; you will not be charged automatically.'}
        </p>
        <Button
          className="full-width"
          disabled={busy}
          onClick={() => command({ type: 'review', mode })}
        >
          {mode === 'automated' ? <FileCheck2 size={17} /> : <Clock3 size={17} />}{' '}
          {mode === 'automated' ? 'Check my draft' : 'Check expert review availability'}
          <ArrowRight size={16} />
        </Button>
      </div>
      {review && (
        <div className="review-findings" role="status">
          <div className="eyebrow">
            {review.mode === 'human' ? 'NO REVIEW HAS BEEN SUBMITTED' : 'DRAFT CHECK COMPLETE'}
          </div>
          <h3>
            {review.mode === 'human'
              ? 'Expert review is not connected yet.'
              : 'A few things before it’s an order.'}
          </h3>
          {review.findings.map((finding) => (
            <div className="finding" key={finding.id}>
              <Info size={16} />
              <div>
                <strong>{finding.title}</strong>
                <p>{finding.description}</p>
                {finding.target !== 'commercial' && (
                  <button onClick={() => edit(finding.target === 'design' ? 1 : 2)}>
                    Review {finding.target}
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="quote-section">
        <div>
          <span>Order total</span>
          <strong>Quote unavailable</strong>
        </div>
        <p>
          This reference catalog has no live prices. You will always review the total before paying.
        </p>
        <Button className="full-width" disabled>
          Continue to payment
          <ArrowRight size={16} />
        </Button>
        <span className="fine-print">
          Payment requires a verified catalog, measurement protocol and an eligible review.
        </span>
      </div>
      <button className="download-draft" onClick={download}>
        <Download size={15} />
        Download your draft details
      </button>
    </section>
  );
}
