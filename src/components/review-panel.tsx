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
import type { CommandV2, DraftV2, Garment } from '@/modules/configuration/types';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import {
  designOutline,
  lookupLabel,
  type OutlineLeaf,
} from '@/modules/configuration/design-outline';
import {
  definitionsForProducts,
  displayValue,
  type MeasurementSet,
} from '@/modules/measurements/definitions';

const STYLING: Record<string, string> = {
  suit: 'The shirt and shoes are styling references.',
  shirt: 'Trousers and shoes are styling references.',
  blazer: 'Shirt, trousers and shoes are styling references.',
};
const list = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
/** The option bound to the fit slot, and up to three other main style choices. */
function summary(index: RuntimeIndex, garment: Garment) {
  const leaves = designOutline(index, garment)
    .filter((branch) => branch.id !== 'accents')
    .flatMap((branch) => branch.leaves)
    .filter((leaf): leaf is OutlineLeaf & { kind: 'catalog' } => leaf.kind === 'catalog');
  const isFit = (leaf: OutlineLeaf) =>
    leaf.group!.attributes.some((entry) => entry.attribute.visualSlot === 'fit');
  return {
    fit: leaves.find(isFit)?.value ?? '—',
    finishing: leaves
      .filter((leaf) => !isFit(leaf))
      .slice(0, 3)
      .map((leaf) => leaf.value),
  };
}
import { Button } from './ui/button';
export function ReviewPanel({
  draft,
  garment,
  index,
  measurementSets,
  busy,
  command,
  edit,
}: {
  draft: DraftV2;
  garment: Garment;
  index: RuntimeIndex;
  measurementSets: MeasurementSet[];
  busy: boolean;
  command: (c: CommandV2) => Promise<DraftV2 | null>;
  edit: (step: number) => void;
}) {
  const [mode, setMode] = useState<'automated' | 'human'>('automated');
  const product = index.products.get(garment.productCode);
  const material = index.materials.get(garment.materialCode);
  const { fit, finishing } = summary(index, garment);
  const parts = garment.includedComponents.map(
    (code) => index.components.get(code)?.name.toLowerCase() ?? code,
  );
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
            <dd>{product?.name ?? garment.productCode}</dd>
          </div>
          <div>
            <dt>Fabric</dt>
            <dd>
              <span className="tiny-swatch" style={{ background: material?.primaryHex }} />
              {material?.name ?? garment.materialCode}
            </dd>
          </div>
          <div>
            <dt>Occasion & weather</dt>
            <dd>
              {lookupLabel(index, 'occasion', garment.preferences.occasion)} ·{' '}
              {lookupLabel(index, 'climate', garment.preferences.climate)}
            </dd>
          </div>
          <div>
            <dt>Fit</dt>
            <dd>{fit}</dd>
          </div>
          <div>
            <dt>Finishing</dt>
            <dd>{finishing.join(' · ') || '—'}</dd>
          </div>
        </dl>
        <p className="inclusion-note">
          Includes {list(parts)}. {STYLING[product?.visualModel ?? 'suit']}
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
          {definitionsForProducts(measurementSets).map((m) => (
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
          {draft.measurements.source === '3dlook' ? '3DLOOK assisted' : 'Customer entered'} ·{' '}
          {draft.measurements.confirmed ? 'confirmed by you' : 'not confirmed'} · unverified
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
