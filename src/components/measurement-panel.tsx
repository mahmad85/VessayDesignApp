'use client';
import { useEffect, useState } from 'react';
import { Camera, ArrowUpRight, Check, Info, Save, ArrowRight } from 'lucide-react';
import type { Draft, Command } from '@/modules/configuration/types';
import { definitionsFor, displayValue, toMillimeters } from '@/modules/measurements/definitions';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
export function MeasurementPanel({
  draft,
  busy,
  command,
  setHighlight,
  onContinue,
  onDirty,
  onPreview,
}: {
  draft: Draft;
  busy: boolean;
  command: (c: Command) => Promise<Draft | null>;
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
    [active, setActive] = useState('chest');
  const defs = definitionsFor(draft.design.product);
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const dirty = hasErrors || JSON.stringify(values) !== JSON.stringify(draft.measurements.values);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    onPreview(values, unit);
  }, [values, unit, onPreview]);
  const complete = defs.every((m) => values[m.id] > 0 && values[m.id] <= 3000);
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
  const [fields, setFields] = useState<Record<string, string>>({});
  function fieldValue(id: string) {
    return fields[id] ?? displayValue(values[id], unit);
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
          <small>Camera-assisted capture · connection pending</small>
        </span>
        <ArrowUpRight size={18} />
      </button>
      <div className="measurement-heading">
        <div>
          <h2>Enter your measurements</h2>
          <span className="source-tag">Customer entered · unverified</span>
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
      <div className="measurement-fields">
        {defs.map((m) => (
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
        ))}
      </div>
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
        description="Camera-assisted capture will be available once the provider integration is connected."
      >
        <div className="capture-illustration">
          <Camera size={38} />
          <span>Provider connection required</span>
        </div>
        <p>
          The live capture flow, supported devices and measurement definitions must be verified
          against your 3DLOOK plan. We won’t ask for photos or camera access until that is ready.
        </p>
        <p>
          You can enter measurements to explore this draft. These will remain marked as unverified.
        </p>
        <Button className="full-width" onClick={() => setCapture(false)}>
          Continue with manual entry
        </Button>
      </Dialog>
    </section>
  );
}
