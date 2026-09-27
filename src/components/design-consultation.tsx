'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, Check, ArrowUpRight, LoaderCircle, ChevronRight } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import type { Draft, DesignPatch, Command } from '@/modules/configuration/types';
import {
  PRODUCTS,
  availableFabrics,
  fabricFor,
  OCCASIONS,
  CLIMATES,
  FITS,
  DETAIL_OPTIONS,
  type Product,
} from '@/modules/catalog/catalog';
import { nextQuestion } from '@/modules/configuration/guidance';
import {
  SUIT_CUSTOMIZATION_SEED,
  hasVest,
  optionFor,
  type SuitMenu,
} from '@/modules/catalog/suit-customization';
type Props = {
  draft: Draft;
  busy: boolean;
  mode: 'guided' | 'ai';
  change: (patch: DesignPatch) => void;
  command: (c: Command) => Promise<Draft | null>;
  chat: (message: string) => Promise<Draft | null>;
};
export function Consultation({ draft, busy, mode, change, chat }: Props) {
  const [text, setText] = useState('');
  const messages = useRef<HTMLDivElement>(null);
  const d = draft.design;
  useEffect(() => {
    messages.current?.scrollTo({
      top: messages.current.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }, [draft.messages.length, busy]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const message = text;
    const result = await chat(message);
    if (result) setText('');
  }
  const question = !d.confirmed.includes('product')
    ? 'product'
    : !d.occasion
      ? 'occasion'
      : !d.climate
        ? 'climate'
        : !d.confirmed.includes('fabricId')
          ? 'fabric'
          : !d.confirmed.includes('fit')
            ? 'fit'
            : 'details';
  const choices =
    question === 'product'
      ? Object.entries(PRODUCTS).map(([value, p]) => ({
          label: p.name,
          patch: { product: value as Product },
        }))
      : question === 'occasion'
        ? OCCASIONS.map((v) => ({ label: v, patch: { occasion: v } }))
        : question === 'climate'
          ? CLIMATES.map((v) => ({ label: v, patch: { climate: v } }))
          : question === 'fit'
            ? FITS.map((v) => ({ label: v, patch: { fit: v } }))
            : question === 'fabric'
              ? availableFabrics(d.product)
                  .slice(0, 3)
                  .map((v) => ({ label: v.name, patch: { fabricId: v.id } }))
              : [];
  return (
    <section className="consultation" aria-label="Tailoring conversation">
      <div className="consultation-intro">
        <div className="eyebrow">
          <span className="small-star">✳</span> YOUR PERSONAL TAILOR
        </div>
        <h1>
          Good style
          <br />
          starts with you.
        </h1>
        <p>A few thoughtful choices. Something entirely yours.</p>
      </div>
      <div className="choice-tray" aria-label="Confirmed choices">
        {d.confirmed.length === 0 ? (
          <span className="empty-tray">Your choices will come together here.</span>
        ) : (
          <>
            {d.confirmed.includes('product') && (
              <button onClick={() => document.getElementById('garment-select')?.focus()}>
                <Check size={12} />
                {PRODUCTS[d.product].label}
              </button>
            )}
            {d.confirmed.includes('fabricId') && (
              <button onClick={() => document.getElementById('fabric-tab')?.click()}>
                <span
                  className="tiny-swatch"
                  style={{ background: fabricFor(d.fabricId)?.color }}
                />
                {fabricFor(d.fabricId)?.name}
              </button>
            )}
            {d.occasion && (
              <label className="choice-select">
                <Check size={12} />
                <select
                  aria-label="Occasion"
                  disabled={busy}
                  value={d.occasion}
                  onChange={(e) => change({ occasion: e.target.value as DesignPatch['occasion'] })}
                >
                  {OCCASIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
            {d.climate && (
              <label className="choice-select">
                <Check size={12} />
                <select
                  aria-label="Weather"
                  disabled={busy}
                  value={d.climate}
                  onChange={(e) => change({ climate: e.target.value as DesignPatch['climate'] })}
                >
                  {CLIMATES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>
      <div
        className="conversation"
        ref={messages}
        role="log"
        aria-label="Conversation history"
        aria-live="polite"
      >
        {draft.messages.map((m) => (
          <div className={`message message-${m.role}`} key={m.id}>
            {m.role === 'assistant' && <span className="assistant-mark">v.</span>}
            <div className="message-content">
              {m.role === 'assistant' && (
                <div className="message-name">
                  Vessy <span>{m.mode === 'ai' ? 'AI stylist' : 'Guided assistant'}</span>
                </div>
              )}
              <p>{m.text}</p>
              {m.suggestion && (
                <div className="suggestion">
                  <div className="eyebrow">
                    <Sparkles size={12} /> A DIRECTION TO EXPLORE
                  </div>
                  <div className="suggestion-values">
                    {Object.entries(m.suggestion)
                      .filter(([k]) => k !== 'customizations')
                      .map(([k, v]) => (
                        <span key={k}>
                          {k === 'fabricId'
                            ? fabricFor(String(v))?.name
                            : k === 'product'
                              ? PRODUCTS[v as Product].name
                              : String(v)}
                        </span>
                      ))}
                  </div>
                  <button
                    disabled={busy || m.basisRevision !== draft.revision}
                    onClick={() => change(m.suggestion!)}
                  >
                    {m.basisRevision === draft.revision
                      ? 'Apply this suggestion'
                      : 'Suggestion from an earlier draft'}
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="thinking">
            <span />
            <span />
            <span />
            <span className="sr-only">Saving your choice</span>
          </div>
        )}
      </div>
      <div className="conversation-next">
        <div className="question-line">
          <span className="step-dot" />
          {nextQuestion(d)}
        </div>
        <div className="quick-choices">
          {choices.map((c) => (
            <button key={c.label} disabled={busy} onClick={() => change(c.patch)}>
              {c.label}
              <ChevronRight size={13} />
            </button>
          ))}
          {question === 'details' && (
            <span className="ready-note">
              <Check size={14} /> Fine-tune on the right, then continue below.
            </span>
          )}
        </div>
      </div>
      <form onSubmit={send} className="chat-form">
        <label className="sr-only" htmlFor="stylist-message">
          Message your tailor
        </label>
        <textarea
          id="stylist-message"
          value={text}
          maxLength={1500}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          placeholder="Tell me what you have in mind…"
        />
        <button
          type="submit"
          className="send-button"
          aria-label="Send message"
          disabled={busy || !text.trim()}
        >
          {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowUp size={19} />}
        </button>
      </form>
      <div className="assistant-status">
        <span className="status-dot" />
        {mode === 'ai'
          ? 'AI stylist · you approve every change'
          : 'Guided mode · live AI is not connected'}
      </div>
    </section>
  );
}
export function DesignControls({ draft, busy, change }: Pick<Props, 'draft' | 'busy' | 'change'>) {
  const d = draft.design;
  const fabric = fabricFor(d.fabricId)!;
  return (
    <div className="design-controls">
      <Tabs.Root defaultValue="fabric">
        <Tabs.List className="control-tabs" aria-label="Customize your garment">
          <Tabs.Trigger value="fabric" id="fabric-tab">
            Fabric<span>01</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="shape">
            Fit & shape<span>02</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="details">
            Finishing details<span>03</span>
          </Tabs.Trigger>
          {d.product === 'suit' && (
            <>
              <Tabs.Trigger value="style-catalog">
                Style<span>04</span>
              </Tabs.Trigger>
              <Tabs.Trigger value="accent-catalog">
                Accents<span>05</span>
              </Tabs.Trigger>
            </>
          )}
        </Tabs.List>
        <Tabs.Content value="fabric" className="control-content">
          <div className="fabric-heading">
            <div>
              <strong>{fabric.name}</strong>
              <span>
                {fabric.composition} · {fabric.weight}
              </span>
            </div>
            <span className="reference-label">REFERENCE FABRICS</span>
          </div>
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
          </div>
        </Tabs.Content>
        <Tabs.Content value="shape" className="control-content">
          <div className="field-label">How would you like it to fit?</div>
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
        </Tabs.Content>
        <Tabs.Content value="details" className="control-content">
          <div className="details-grid">
            {(d.product === 'shirt' ? ['collar', 'cuffs'] : ['lapel', 'pockets', 'closure']).map(
              (key) => (
                <div className="detail-group" key={key}>
                  <label>{key === 'closure' ? 'Fastening' : key}</label>
                  <div>
                    {DETAIL_OPTIONS[key as keyof typeof DETAIL_OPTIONS].map((option) => (
                      <button
                        disabled={busy}
                        key={option}
                        aria-pressed={d[key as keyof typeof DETAIL_OPTIONS] === option}
                        onClick={() => change({ [key]: option } as DesignPatch)}
                      >
                        {option}
                        {d[key as keyof typeof DETAIL_OPTIONS] === option && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </Tabs.Content>
        {d.product === 'suit' && (
          <>
            <Tabs.Content value="style-catalog" className="control-content customization-content">
              <SuitCustomizationMenu menuId="style" design={d} busy={busy} change={change} />
            </Tabs.Content>
            <Tabs.Content value="accent-catalog" className="control-content customization-content">
              <SuitCustomizationMenu menuId="accents" design={d} busy={busy} change={change} />
            </Tabs.Content>
          </>
        )}
      </Tabs.Root>
    </div>
  );
}

function SuitCustomizationMenu({
  menuId,
  design,
  busy,
  change,
}: {
  menuId: SuitMenu['id'];
  design: Draft['design'];
  busy: boolean;
  change: (patch: DesignPatch) => void;
}) {
  const menu = SUIT_CUSTOMIZATION_SEED.menus.find((item) => item.id === menuId)!;
  const customizations = design.customizations || {};
  const vestAdded = hasVest(customizations);
  const categories = menu.categories.filter(
    (category) => category.id !== 'vest' || menu.id === 'style' || vestAdded,
  );
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'jacket');
  const category = categories.find((item) => item.id === categoryId) || categories[0];
  const groups = category.groups.filter((group) => group.shown || vestAdded);
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const group = groups.find((item) => item.id === groupId) || groups[0];

  function chooseCategory(nextCategoryId: string) {
    const nextCategory = categories.find((item) => item.id === nextCategoryId)!;
    const nextGroups = nextCategory.groups.filter((item) => item.shown || vestAdded);
    setCategoryId(nextCategoryId);
    setGroupId(nextGroups[0]?.id || '');
  }

  return (
    <div className="customization-browser">
      <div className="customization-heading">
        <div>
          <strong>{menu.label} reference</strong>
          <span>
            {SUIT_CUSTOMIZATION_SEED.optionCount} supplied options across Style and Accents
          </span>
        </div>
        <span className="reference-label">REFERENCE DATA</span>
      </div>
      <p className="customization-notice">
        Availability, prices and manufacturing codes have not been approved for ordering.
      </p>
      <div className="customization-categories" role="tablist" aria-label={`${menu.label} garment`}>
        {categories.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={category.id === item.id}
            onClick={() => chooseCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="customization-groups"
        role="tablist"
        aria-label={`${category.label} categories`}
      >
        {groups.map((item) => {
          const selected = item.sections
            .map(
              (section) =>
                optionFor(section.selectionKey, customizations[section.selectionKey])?.label,
            )
            .filter(Boolean)
            .join(' · ');
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={group.id === item.id}
              onClick={() => setGroupId(item.id)}
            >
              {item.asset && (
                <span
                  className="customization-group-icon"
                  style={{ backgroundImage: `url("${item.asset}")` }}
                />
              )}
              <span>
                <strong>{item.shortLabel}</strong>
                <small>{selected || 'Choose an option'}</small>
              </span>
            </button>
          );
        })}
      </div>
      {group && (
        <div className="customization-sections">
          {group.sections.map((section) => (
            <section key={section.selectionKey} aria-labelledby={`${section.selectionKey}-label`}>
              <div className="customization-section-heading">
                <strong id={`${section.selectionKey}-label`}>{section.label}</strong>
                {section.note && <span>{section.note}</span>}
              </div>
              <div className="customization-options" role="group" aria-label={section.label}>
                {section.options.map((option) => {
                  const selected = customizations[section.selectionKey] === option.value;
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
                      <span>{option.label.replace(/^color_|^item_/, 'Color ')}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
