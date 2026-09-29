'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, ArrowUpRight, Check, Info, Save, ArrowRight } from 'lucide-react';
import type { CommandV2, DraftV2 } from '@/modules/configuration/types';
import {
  definitionsForProducts,
  requiredDefinitionsForProducts,
  displayValue,
  toMillimeters,
  type MeasurementSet,
} from '@/modules/measurements/definitions';
import type { SaiaPerson } from '@/integrations/3dlook';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { SaiaMeasurementWidget } from './saia-measurement-widget';
export function MeasurementPanel({
  draft,
  measurementSets,
  busy,
  user,
  command,
  setHighlight,
  onContinue,
  onDirty,
  onPreview,
}: {
  draft: DraftV2;
  /** The measurement sets of every garment in the cart (CRT-004: one profile). */
  measurementSets: MeasurementSet[];
  busy: boolean;
  user: { name: string; email: string } | null;
  command: (c: CommandV2) => Promise<DraftV2 | null>;
  setHighlight: (id: string) => void;
  onContinue: () => void;
  onDirty: (dirty: boolean) => void;
  onPreview: (values: Record<string, number>, unit: 'cm' | 'in') => void;
}) {
  const [unit, setUnit] = useState<'cm' | 'in'>('cm'),
    [values, setValues] = useState<Record<string, number>>(draft.measurements.values),
    [capture, setCapture] = useState(false),
    [notice, setNotice] = useState(''),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [active, setActive] = useState('chest'),
    [fields, setFields] = useState<Record<string, string>>({}),
    [showAdvanced, setShowAdvanced] = useState(false);
  const setsKey = measurementSets.join(',');
  const [defs, commonDefs] = useMemo(() => {
    const sets = (setsKey ? setsKey.split(',') : []) as MeasurementSet[];
    return [definitionsForProducts(sets), requiredDefinitionsForProducts(sets)];
  }, [setsKey]);
  const advancedDefs = defs.filter((m) => !commonDefs.includes(m));
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const dirty = hasErrors || JSON.stringify(values) !== JSON.stringify(draft.measurements.values);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    onPreview(values, unit);
  }, [values, unit, onPreview]);
  const complete = commonDefs.every((m) => values[m.id] > 0 && values[m.id] <= 3000);
  const hasAdvancedValues = advancedDefs.some((m) => values[m.id] > 0);
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  const saiaCaptureStart = useCallback(async () => {
    const r = await fetch('/api/measurements/saia/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUnit: unit }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'unavailable');
    return d.draft.captureToken as string;
  }, [unit]);
  const saiaMeasurementsReady = useCallback(
    async (person: SaiaPerson, captureToken: string) => {
      const r = await fetch(`/api/measurements/saia/${captureToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'save_failed');
      const mapped = (d.draft.measurements ?? {}) as Record<string, number>;
      const allowed = new Set(defs.map((m) => m.id as string));
      const merged = { ...valuesRef.current };
      let applied = 0;
      for (const [id, value] of Object.entries(mapped))
        if (allowed.has(id)) {
          merged[id] = value;
          applied++;
        }
      if (applied === 0) throw new Error('no_supported_measurements');
      setValues(merged);
      setFields({});
      const result = await command({
        type: 'measurements',
        values: merged,
        confirm: false,
        source: '3dlook',
      });
      if (result) {
        onDirty(false);
        setNotice('3DLOOK measurements saved. Review and confirm before continuing.');
        setCapture(false);
      }
    },
    [command, defs, onDirty],
  );
  async function save(confirm: boolean) {
    if (hasErrors) return;
    const kept = Object.fromEntries(
      defs.filter((m) => values[m.id]).map((m) => [m.id, values[m.id]]),
    );
    const result = await command({ type: 'measurements', values: kept, confirm });
    if (result) {
      onDirty(false);
      setNotice(confirm ? 'Measurements confirmed.' : 'Measurements saved.');
      if (confirm) onContinue();
    }
  }
  function edit(id: string, text: string) {
    setFieldErrors((errors) => {
      const next = { ...errors };
      delete next[id];
      return next;
    });
    if (text === '') {
      setValues((v) => {
        const n = { ...v };
        delete n[id];
        return n;
      });
      return;
    }
    const v = Number(text);
    if (!Number.isFinite(v) || v <= 0) {
      setFieldErrors((errors) => ({ ...errors, [id]: 'Enter a positive number.' }));
      return;
    }
    const mm = toMillimeters(v, unit);
    if (mm > 3000) {
      setFieldErrors((errors) => ({ ...errors, [id]: 'Check the units. Maximum 300 cm.' }));
      return;
    }
    setValues((values) => ({ ...values, [id]: mm }));
  }
  function fieldValue(id: string) {
    return fields[id] ?? displayValue(values[id], unit);
  }
  function renderField(m: { id: string; label: string }) {
    return (
      <label className={`measurement-field ${active === m.id ? 'active' : ''}`} key={m.id}>
        <span>
          {m.label}
          {values[m.id] > 0 && <Check size={13} />}
        </span>
        <div>
          <input
            aria-label={m.label}
            aria-invalid={!!fieldErrors[m.id]}
            aria-describedby={fieldErrors[m.id] ? `error-${m.id}` : 'measurement-guidance'}
            type="text"
            inputMode="decimal"
            value={fieldValue(m.id)}
            placeholder="—"
            onFocus={() => {
              setHighlight(m.id);
              setActive(m.id);
            }}
            onChange={(e) => {
              setFields((f) => ({ ...f, [m.id]: e.target.value }));
              edit(m.id, e.target.value);
            }}
            onBlur={() => {
              if (fieldErrors[m.id]) return;
              setFields((f) => {
                const next = { ...f };
                delete next[m.id];
                return next;
              });
            }}
          />
          <span>{unit}</span>
        </div>
        {fieldErrors[m.id] && (
          <small id={`error-${m.id}`} className="field-error">
            {fieldErrors[m.id]}
          </small>
        )}
      </label>
    );
  }
  return (
    <section className="measurement-panel">
      <div className="eyebrow">
        <span className="small-star">✳</span> MADE AROUND YOU
      </div>
      <h1>
        A better fit
        <br />
        starts here.
      </h1>
      <p className="intro-copy">
        Your measurements, with you in control. Check each point on the mannequin as you go.
      </p>
      <button className="scan-card" onClick={() => setCapture(true)}>
        <span className="scan-icon">
          <Camera size={23} />
        </span>
        <span>
          <strong>Measure with 3DLOOK</strong>
          <small>
            {user
              ? 'Camera-assisted capture · free, unverified until you confirm'
              : 'Camera-assisted capture · sign in to use 3DLOOK'}
          </small>
        </span>
        <ArrowUpRight size={18} />
      </button>
      <div className="measurement-heading">
        <div>
          <h2>Enter your measurements</h2>
          <span className="source-tag">
            {draft.measurements.source === '3dlook' ? '3DLOOK assisted' : 'Customer entered'} ·
            unverified
          </span>
        </div>
        <div className="unit-switch" role="group" aria-label="Measurement units">
          {(['cm', 'in'] as const).map((u) => (
            <button
              aria-pressed={unit === u}
              disabled={hasErrors}
              key={u}
              onClick={() => {
                setUnit(u);
                setFields({});
              }}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <div className="measurement-fields">{commonDefs.map(renderField)}</div>
      {(showAdvanced || hasAdvancedValues) && (
        <div className="measurement-fields measurement-fields-advanced">
          {advancedDefs.map(renderField)}
        </div>
      )}
      <button
        type="button"
        className="measurement-advanced-toggle"
        aria-expanded={showAdvanced || hasAdvancedValues}
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced || hasAdvancedValues
          ? 'Hide additional-accuracy measurements'
          : `Add more for accuracy (${advancedDefs.length})`}
      </button>
      <div className="measurement-hint">
        <Info size={16} />
        <p id="measurement-guidance">
          {defs.find((m) => m.id === active)?.hint ||
            'Select a field to see where and how to measure.'}
        </p>
      </div>
      {hasErrors && (
        <p role="alert" className="field-error">
          Correct the highlighted measurements before saving or switching units.
        </p>
      )}
      {notice && (
        <p role="status" className="saved-note">
          {notice}
        </p>
      )}
      <div className="measurement-actions">
        <Button
          variant="secondary"
          disabled={busy || !dirty || hasErrors}
          onClick={() => save(false)}
        >
          <Save size={15} />
          Save progress
        </Button>
        <Button disabled={busy || !complete || hasErrors} onClick={() => save(true)}>
          Confirm measurements
          <ArrowRight size={16} />
        </Button>
      </div>
      <p className="fine-print">
        {!complete ? 'Complete every field to continue. ' : ''}This reference set needs an approved
        tailoring protocol before production. Confirming saves your values; it does not verify their
        accuracy.
      </p>
      <Dialog
        open={capture}
        onOpenChange={setCapture}
        title="Your 3DLOOK measurement session"
        description={
          user
            ? 'A free, camera-assisted scan. Results are saved as unverified until you review and confirm them.'
            : 'Sign in to save a 3DLOOK scan to your account.'
        }
      >
        {user ? (
          <>
            {capture && (
              <SaiaMeasurementWidget
                onCaptureStart={saiaCaptureStart}
                onMeasurementsReady={saiaMeasurementsReady}
              />
            )}
            <p>
              We won’t use this to place an order. Review and confirm the mapped values below before
              continuing — this does not verify measurement accuracy.
            </p>
          </>
        ) : (
          <p>
            3DLOOK results are saved to your account, so we ask you to sign in first. You can keep
            entering measurements manually without an account.
          </p>
        )}
        {user ? (
          <Button className="full-width" variant="secondary" onClick={() => setCapture(false)}>
            Continue with manual entry
          </Button>
        ) : (
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setCapture(false)}>
              Continue with manual entry
            </Button>
            <Button asChild onClick={() => setCapture(false)}>
              <Link href="/account">Sign in</Link>
            </Button>
          </div>
        )}
      </Dialog>
    </section>
  );
}
