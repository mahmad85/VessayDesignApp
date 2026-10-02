'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Garment, GarmentPatch } from '@/modules/configuration/types';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { isSelectable, type AvailabilityMap } from '@/modules/catalog/garment';
import type { StructureAttribute } from '@/modules/catalog/structure';
import { formatPrice } from '@/lib/money';
import { priceEffect } from '@/modules/pricing/explain';
import {
  attributeSurcharge,
  componentSurcharge,
  groupSurcharge,
  valueSurcharge,
} from '@/modules/pricing/quote';
import {
  fabricChoices,
  findLeaf,
  type BranchId,
  type OutlineBranch,
  type OutlineLeaf,
} from '@/modules/configuration/design-outline';

export type NavPath = { branch?: BranchId; leaf?: string };

type Props = {
  index: RuntimeIndex;
  garment: Garment;
  outline: OutlineBranch[];
  availability: AvailabilityMap;
  busy: boolean;
  change: (patch: GarmentPatch) => void;
  path: NavPath;
  navigate: (path: NavPath) => void;
};

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

export function DesignNavigator(props: Props) {
  const { index, outline, path, navigate } = props;
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
    const position = allLeaves.findIndex((item) => item.id === leaf.id);
    const previous = allLeaves[position - 1];
    const next = allLeaves[position + 1];
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
          <LeafEditor {...props} leaf={leaf} />
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
      {index.catalog.referenceOnly && (
        <p className="customization-notice">
          Reference options only. Availability, prices and manufacturing codes have not been
          approved for ordering.
        </p>
      )}
    </section>
  );
}

function choiceList(
  label: string,
  options: { value: string; label: string; hint?: string }[],
  current: string | null,
  busy: boolean,
  pick: (value: string) => void,
) {
  return (
    <div className="nav-choices" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          disabled={busy}
          aria-pressed={current === option.value}
          onClick={() => pick(option.value)}
        >
          {option.label}
          {option.hint && <small className="price-effect">{option.hint}</small>}
          {current === option.value && <Check size={13} />}
        </button>
      ))}
    </div>
  );
}

function TextOption({
  entry,
  busy,
  save,
}: {
  entry: StructureAttribute;
  busy: boolean;
  save: (text: string) => void;
}) {
  const [text, setText] = useState(entry.value ?? '');
  const rules = entry.attribute.textRules;
  const id = `text-${entry.attribute.code}`;
  return (
    <form
      className="customization-text"
      onSubmit={(e) => {
        e.preventDefault();
        save(text);
      }}
    >
      <label htmlFor={id}>{entry.attribute.name}</label>
      <input
        id={id}
        value={text}
        maxLength={rules?.maxLength}
        placeholder={rules?.placeholder}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="button button-secondary" disabled={busy}>
        Save
      </button>
      {rules && <small>Up to {rules.maxLength} characters.</small>}
    </form>
  );
}

function LeafEditor({
  index,
  garment,
  availability,
  busy,
  change,
  leaf,
}: Props & { leaf: OutlineLeaf }) {
  const media = (id: string | null) => (id ? index.media.get(id)?.url : undefined);
  const product = index.products.get(garment.productCode)!;
  const currency = index.catalog.currency;
  // Price effects are catalog data for display; quotes are computed on the server.
  const effect = (amountMinor: number) =>
    amountMinor > 0 ? priceEffect(amountMinor, currency) : undefined;
  switch (leaf.kind) {
    case 'product':
      return (
        <div className="nav-cards" role="group" aria-label="Garment">
          {index.catalog.products.map((product) => (
            <button
              key={product.code}
              disabled={busy}
              aria-pressed={garment.productCode === product.code}
              onClick={() => change({ productCode: product.code })}
            >
              <strong>{product.name}</strong>
              <small>{product.description}</small>
              {garment.productCode === product.code && <Check size={14} />}
            </button>
          ))}
        </div>
      );
    case 'occasion':
    case 'climate': {
      const type = leaf.kind;
      return choiceList(
        type === 'occasion' ? 'Occasion' : 'Weather',
        (index.catalog.lookups[type] ?? []).map((item) => ({
          value: item.code,
          label: item.label,
        })),
        garment.preferences[type],
        busy,
        (value) => change({ preferences: { [type]: value } }),
      );
    }
    case 'fabric': {
      const fabrics = fabricChoices(index, garment);
      const current = index.materials.get(garment.materialCode);
      const composition = current?.composition.length
        ? current.composition
            .map(
              (item) =>
                `${item.percent}% ${index.lookups.get('fibre')?.get(item.fibre)?.label ?? item.fibre}`,
            )
            .join(', ')
        : String(current?.metadata.compositionLabel ?? '');
      return (
        <div className="fabric-list" role="group" aria-label="Choose fabric">
          {fabrics.map((fabric) => {
            const status = availability[fabric.code];
            const selected = garment.materialCode === fabric.code;
            const unavailable = !isSelectable(status);
            return (
              <button
                key={fabric.code}
                disabled={busy || (unavailable && !selected)}
                aria-pressed={selected}
                aria-describedby={
                  unavailable || status === 'low_stock' ? `${fabric.code}-status` : undefined
                }
                className={`fabric-option ${selected ? 'selected' : ''}`}
                onClick={() => change({ materialCode: fabric.code })}
              >
                <span
                  className={`fabric-swatch pattern-${fabric.renderPattern}`}
                  style={{ backgroundColor: fabric.primaryHex }}
                >
                  {selected && (
                    <span className="swatch-check">
                      <Check size={12} />
                    </span>
                  )}
                </span>
                <span>{fabric.name}</span>
                {(unavailable || status === 'low_stock') && (
                  <small className="fabric-status" id={`${fabric.code}-status`}>
                    {unavailable ? 'Currently unavailable' : 'Limited availability'}
                  </small>
                )}
              </button>
            );
          })}
          {current && (
            <p className="fine-print nav-fabric-note">
              {current.referenceOnly ? 'Reference fabrics' : current.name}
              {composition ? ` · ${composition}` : ''}{' '}
              <Link href={`/fabrics/${current.code}`}>Fabric details</Link>
            </p>
          )}
        </div>
      );
    }
    case 'component': {
      const include = leaf.include!;
      const link = product.components.find((item) => item.componentCode === include.componentCode);
      return choiceList(
        include.label,
        [
          { value: 'no', label: 'Not added' },
          {
            value: 'yes',
            label: 'Added',
            hint: link ? effect(componentSurcharge(link)) : undefined,
          },
        ],
        include.included ? 'yes' : 'no',
        busy,
        (value) => change({ components: { [include.componentCode]: value === 'yes' } }),
      );
    }
    case 'catalog': {
      const groupMinor = groupSurcharge(product, leaf.group!.group);
      return (
        <div className="customization-sections">
          {groupMinor > 0 && (
            <p className="price-hint">Customising adds {formatPrice(groupMinor, currency)}</p>
          )}
          {leaf.group!.attributes.map((entry) => {
            const { attribute } = entry;
            const labelId = `${attribute.code}-label`;
            const attributeMinor = attributeSurcharge(product, attribute);
            return (
              <section key={attribute.code} aria-labelledby={labelId}>
                <div className="customization-section-heading">
                  <strong id={labelId}>{attribute.name}</strong>
                  {attribute.helpText && <span>{attribute.helpText}</span>}
                  {attributeMinor > 0 && (
                    <span className="price-hint">
                      Changing this adds {formatPrice(attributeMinor, currency)}
                    </span>
                  )}
                </div>
                {attribute.inputType === 'text' ? (
                  <TextOption
                    key={`${attribute.code}:${entry.value ?? ''}`}
                    entry={entry}
                    busy={busy}
                    save={(text) => change({ selections: { [attribute.code]: text } })}
                  />
                ) : (
                  <div className="customization-options" role="group" aria-label={attribute.name}>
                    {entry.values.map((value) => {
                      const selected = entry.value === value.code;
                      const image = media(value.imageMediaId);
                      return (
                        <button
                          key={value.code}
                          disabled={busy}
                          aria-pressed={selected}
                          onClick={() => change({ selections: { [attribute.code]: value.code } })}
                        >
                          <span
                            className="customization-option-image"
                            style={image ? { backgroundImage: `url("${image}")` } : undefined}
                          >
                            {!image && (
                              <span aria-hidden>{value.label.slice(0, 2).toUpperCase()}</span>
                            )}
                            {selected && (
                              <span className="swatch-check">
                                <Check size={12} />
                              </span>
                            )}
                          </span>
                          <span>{value.label}</span>
                          {effect(valueSurcharge(product, attribute, value.code)) && (
                            <small className="price-effect">
                              {effect(valueSurcharge(product, attribute, value.code))}
                            </small>
                          )}
                          {attribute.visualSlot && value.visualToken === null && (
                            <small className="not-illustrated">Not illustrated</small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      );
    }
  }
}
