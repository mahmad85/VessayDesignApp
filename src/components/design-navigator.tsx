'use client';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Draft, DesignPatch } from '@/modules/configuration/types';
import {
  CLIMATES,
  DETAIL_OPTIONS,
  FITS,
  OCCASIONS,
  PRODUCTS,
  availableFabrics,
  type Product,
} from '@/modules/catalog/catalog';
import { defaultSuitCustomizations } from '@/modules/catalog/suit-customization';
import {
  cleanOptionLabel,
  findLeaf,
  relevantSections,
  type BranchId,
  type OutlineBranch,
  type OutlineLeaf,
} from '@/modules/configuration/design-outline';

export type NavPath = { branch?: BranchId; leaf?: string };

type Props = {
  draft: Draft;
  outline: OutlineBranch[];
  busy: boolean;
  change: (patch: DesignPatch) => void;
  path: NavPath;
  navigate: (path: NavPath) => void;
};

const SUIT_DEFAULTS = defaultSuitCustomizations();

function LeafIcon({ leaf }: { leaf: OutlineLeaf }) {
  if (leaf.swatch)
    return <span className="nav-icon swatch" aria-hidden style={{ background: leaf.swatch }} />;
  if (leaf.asset)
    return (
      <span className="nav-icon" aria-hidden style={{ backgroundImage: `url("${leaf.asset}")` }} />
    );
  return (
    <span className="nav-icon letter" aria-hidden>
      {leaf.label.charAt(0)}
    </span>
  );
}

export function DesignNavigator({ draft, outline, busy, change, path, navigate }: Props) {
  const branch = outline.find((item) => item.id === path.branch);
  const leaf = path.leaf ? findLeaf(outline, path.leaf) : undefined;
  const allLeaves = outline.flatMap((item) => item.leaves);
  const chosen = allLeaves.filter((item) => item.customized).length;

  const crumbs = (
    <nav className="nav-crumbs" aria-label="Detail hierarchy">
      <button onClick={() => navigate({})} aria-current={!branch ? 'page' : undefined}>
        All details
      </button>
      {branch && (
        <>
          <ChevronRight size={12} aria-hidden />
          <button
            onClick={() => navigate({ branch: branch.id })}
            aria-current={!leaf ? 'page' : undefined}
          >
            {branch.label}
          </button>
        </>
      )}
      {leaf && (
        <>
          <ChevronRight size={12} aria-hidden />
          <span aria-current="page">{leaf.label}</span>
        </>
      )}
    </nav>
  );

  if (leaf && branch) {
    const index = allLeaves.findIndex((item) => item.id === leaf.id);
    const previous = allLeaves[index - 1];
    const next = allLeaves[index + 1];
    return (
      <section className="navigator" aria-label={`${leaf.label} options`}>
        {crumbs}
        <div className="nav-leaf-heading">
          <button
            className="icon-button nav-back"
            aria-label={`Back to ${branch.label}`}
            onClick={() => navigate({ branch: branch.id })}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2>{leaf.label}</h2>
            <p>{leaf.value}</p>
          </div>
        </div>
        <div className="nav-editor">
          <LeafEditor draft={draft} leaf={leaf} busy={busy} change={change} />
        </div>
        <div className="nav-steps">
          {previous ? (
            <button onClick={() => navigate({ branch: previous.branchId, leaf: previous.id })}>
              <ChevronLeft size={14} />
              <span>
                <small>Previous</small>
                {previous.label}
              </span>
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button
              className="next"
              onClick={() => navigate({ branch: next.branchId, leaf: next.id })}
            >
              <span>
                <small>Next</small>
                {next.label}
              </span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button className="next" onClick={() => navigate({})}>
              <span>
                <small>Finished</small>
                All details
              </span>
              <Check size={14} />
            </button>
          )}
        </div>
      </section>
    );
  }

  if (branch) {
    const sections = Array.from(new Set(branch.leaves.map((item) => item.section ?? '')));
    return (
      <section className="navigator" aria-label={`${branch.label} details`}>
        {crumbs}
        <div className="nav-leaf-heading">
          <button
            className="icon-button nav-back"
            aria-label="Back to all details"
            onClick={() => navigate({})}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2>{branch.label}</h2>
            <p>{branch.description}</p>
          </div>
        </div>
        {sections.map((section) => (
          <div className="nav-list-group" key={section || 'all'}>
            {section && <div className="nav-subheading">{section}</div>}
            <ul className="nav-list">
              {branch.leaves
                .filter((item) => (item.section ?? '') === section)
                .map((item) => (
                  <li key={item.id}>
                    <button onClick={() => navigate({ branch: branch.id, leaf: item.id })}>
                      <LeafIcon leaf={item} />
                      <span className="nav-row-text">
                        <strong>{item.label}</strong>
                        <small>{item.value}</small>
                      </span>
                      {item.customized && (
                        <span className="nav-chosen" aria-label="Personalised">
                          <Check size={11} />
                        </span>
                      )}
                      <ChevronRight size={15} className="nav-chevron" />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="navigator" aria-label="All design details">
      <div className="nav-summary">
        <span>
          {chosen} of {allLeaves.length} details personalised
        </span>
        <span className="nav-meter" aria-hidden>
          <i style={{ width: `${(chosen / Math.max(1, allLeaves.length)) * 100}%` }} />
        </span>
      </div>
      <ul className="nav-list nav-branches">
        {outline.map((item) => {
          const personalised = item.leaves.filter((l) => l.customized).length;
          return (
            <li key={item.id}>
              <button onClick={() => navigate({ branch: item.id })}>
                <span className="nav-count">{item.leaves.length}</span>
                <span className="nav-row-text">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                {personalised > 0 && <span className="nav-badge">{personalised} set</span>}
                <ChevronRight size={15} className="nav-chevron" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="customization-notice">
        Reference options only. Availability, prices and manufacturing codes have not been approved
        for ordering.
      </p>
    </section>
  );
}

function LeafEditor({
  draft,
  leaf,
  busy,
  change,
}: {
  draft: Draft;
  leaf: OutlineLeaf;
  busy: boolean;
  change: (patch: DesignPatch) => void;
}) {
  const d = draft.design;
  const choiceList = (
    label: string,
    options: readonly string[],
    current: string,
    patch: (value: string) => DesignPatch,
  ) => (
    <div className="nav-choices" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          disabled={busy}
          aria-pressed={current === option}
          onClick={() => change(patch(option))}
        >
          {option}
          {current === option && <Check size={13} />}
        </button>
      ))}
    </div>
  );
  switch (leaf.kind) {
    case 'product':
      return (
        <div className="nav-cards" role="group" aria-label="Garment">
          {Object.entries(PRODUCTS).map(([value, product]) => (
            <button
              key={value}
              disabled={busy}
              aria-pressed={d.product === value}
              onClick={() => change({ product: value as Product })}
            >
              <strong>{product.name}</strong>
              <small>{product.description}</small>
              {d.product === value && <Check size={14} />}
            </button>
          ))}
        </div>
      );
    case 'occasion':
      return choiceList('Occasion', OCCASIONS, d.occasion, (v) => ({
        occasion: v as DesignPatch['occasion'],
      }));
    case 'climate':
      return choiceList('Weather', CLIMATES, d.climate, (v) => ({
        climate: v as DesignPatch['climate'],
      }));
    case 'fabric':
      return (
        <div className="fabric-list" role="group" aria-label="Choose fabric">
          {availableFabrics(d.product).map((f) => (
            <button
              key={f.id}
              disabled={busy}
              aria-pressed={d.fabricId === f.id}
              className={`fabric-option ${d.fabricId === f.id ? 'selected' : ''}`}
              onClick={() => change({ fabricId: f.id })}
            >
              <span
                className={`fabric-swatch pattern-${f.pattern}`}
                style={{ backgroundColor: f.color }}
              >
                {d.fabricId === f.id && (
                  <span className="swatch-check">
                    <Check size={12} />
                  </span>
                )}
              </span>
              <span>{f.name}</span>
            </button>
          ))}
          <p className="fine-print nav-fabric-note">
            Reference fabrics ·{' '}
            {availableFabrics(d.product).find((f) => f.id === d.fabricId)?.composition}
          </p>
        </div>
      );
    case 'fit':
      return (
        <div className="fit-options">
          {FITS.map((fit, i) => (
            <button
              disabled={busy}
              key={fit}
              aria-pressed={d.fit === fit}
              onClick={() => change({ fit })}
            >
              <span className={`fit-drawing fit-${i}`}>
                <i />
              </span>
              <strong>{fit}</strong>
              <small>
                {i === 0
                  ? 'A closer silhouette'
                  : i === 1
                    ? 'Comfortably balanced'
                    : 'A little more room'}
              </small>
              {d.fit === fit && <Check size={15} />}
            </button>
          ))}
        </div>
      );
    case 'detail': {
      const key = leaf.id as keyof typeof DETAIL_OPTIONS;
      return choiceList(
        leaf.label,
        DETAIL_OPTIONS[key],
        d[key],
        (v) => ({ [key]: v }) as DesignPatch,
      );
    }
    case 'catalog': {
      const values = { ...SUIT_DEFAULTS, ...(d.customizations || {}) };
      const sections = relevantSections(leaf.group!, values);
      return (
        <div className="customization-sections">
          {sections.map((section) => (
            <section key={section.selectionKey} aria-labelledby={`${section.selectionKey}-label`}>
              <div className="customization-section-heading">
                <strong id={`${section.selectionKey}-label`}>{section.label}</strong>
                {section.note && <span>{section.note}</span>}
              </div>
              <div className="customization-options" role="group" aria-label={section.label}>
                {section.options.map((option) => {
                  const selected = values[section.selectionKey] === option.value;
                  return (
                    <button
                      key={option.id}
                      disabled={busy}
                      aria-pressed={selected}
                      onClick={() =>
                        change({ customizations: { [section.selectionKey]: option.value } })
                      }
                    >
                      <span
                        className="customization-option-image"
                        style={
                          option.asset ? { backgroundImage: `url("${option.asset}")` } : undefined
                        }
                      >
                        {!option.asset && option.label.slice(0, 2).toUpperCase()}
                        {selected && (
                          <span className="swatch-check">
                            <Check size={12} />
                          </span>
                        )}
                      </span>
                      <span>{cleanOptionLabel(option.label)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      );
    }
  }
}
