'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Sparkles,
  Check,
  ArrowUpRight,
  LoaderCircle,
  ChevronRight,
  ListChecks,
} from 'lucide-react';
import type { ChatSuggestion, DraftV2, Garment, GarmentPatch } from '@/modules/configuration/types';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { isSelectable, materialsFor, type AvailabilityMap } from '@/modules/catalog/garment';
import { nextQuestionFor } from '@/modules/configuration/guidance';
import { choiceLabel, lookupLabel } from '@/modules/configuration/design-outline';

type Props = {
  draft: DraftV2;
  garment: Garment;
  index: RuntimeIndex;
  availability: AvailabilityMap;
  busy: boolean;
  mode: 'guided' | 'ai';
  change: (patch: GarmentPatch) => void;
  applySuggestion: (suggestion: ChatSuggestion) => void;
  chat: (message: string) => Promise<DraftV2 | null>;
  onChooseDetails: () => void;
};

/** Customer-readable parts of a suggested change, from the catalog. */
function suggestionParts(index: RuntimeIndex, patch: GarmentPatch) {
  const parts: string[] = [];
  if (patch.productCode)
    parts.push(index.products.get(patch.productCode)?.name ?? patch.productCode);
  if (patch.materialCode)
    parts.push(index.materials.get(patch.materialCode)?.name ?? patch.materialCode);
  if (patch.preferences?.occasion)
    parts.push(lookupLabel(index, 'occasion', patch.preferences.occasion));
  if (patch.preferences?.climate)
    parts.push(lookupLabel(index, 'climate', patch.preferences.climate));
  for (const [code, value] of Object.entries(patch.selections ?? {}))
    parts.push(choiceLabel(index, code, value));
  for (const [code, include] of Object.entries(patch.components ?? {}))
    parts.push(`${include ? 'Add' : 'Without'} ${index.components.get(code)?.name ?? code}`);
  return parts;
}

export function Consultation({
  draft,
  garment,
  index,
  availability,
  busy,
  mode,
  change,
  applySuggestion,
  chat,
  onChooseDetails,
}: Props) {
  const [text, setText] = useState('');
  const messages = useRef<HTMLDivElement>(null);
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
    const result = await chat(text);
    if (result) setText('');
  }
  const question = !garment.preferences.occasion
    ? 'occasion'
    : !garment.preferences.climate
      ? 'climate'
      : !garment.confirmed.includes('material')
        ? 'fabric'
        : 'details';
  const lookup = (type: 'occasion' | 'climate') =>
    (index.catalog.lookups[type] ?? []).map((item) => ({
      label: item.label,
      patch: { preferences: { [type]: item.code } } as GarmentPatch,
    }));
  const choices =
    question === 'occasion' || question === 'climate'
      ? lookup(question)
      : question === 'fabric'
        ? materialsFor(index, garment.productCode)
            .filter((material) => isSelectable(availability[material.code]))
            .slice(0, 3)
            .map((material) => ({ label: material.name, patch: { materialCode: material.code } }))
        : [];
  return (
    <section className="consultation" aria-label="Tailoring conversation">
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
                    {suggestionParts(index, m.suggestion.patch).map((part) => (
                      <span key={part}>{part}</span>
                    ))}
                  </div>
                  <button
                    disabled={busy || m.basisRevision !== draft.revision}
                    onClick={() => applySuggestion(m.suggestion!)}
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
          {nextQuestionFor(garment)}
        </div>
        <div className="quick-choices">
          {choices.map((c) => (
            <button key={c.label} disabled={busy} onClick={() => change(c.patch)}>
              {c.label}
              <ChevronRight size={13} />
            </button>
          ))}
          {question === 'details' && (
            <>
              <span className="ready-note">
                <Check size={14} /> The essentials are set.
              </span>
              <button disabled={busy} onClick={onChooseDetails}>
                <ListChecks size={14} />
                Fine-tune every detail
              </button>
            </>
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
