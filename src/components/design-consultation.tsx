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
import type { Draft, DesignPatch } from '@/modules/configuration/types';
import {
  PRODUCTS,
  availableFabrics,
  fabricFor,
  OCCASIONS,
  CLIMATES,
  FITS,
  type Product,
} from '@/modules/catalog/catalog';
import { nextQuestion } from '@/modules/configuration/guidance';
type Props = {
  draft: Draft;
  busy: boolean;
  mode: 'guided' | 'ai';
  change: (patch: DesignPatch) => void;
  chat: (message: string) => Promise<Draft | null>;
  onChooseDetails: () => void;
};
export function Consultation({ draft, busy, mode, change, chat, onChooseDetails }: Props) {
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
