'use client';
import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  LoaderCircle,
  Scissors,
  SlidersHorizontal,
  Upload,
  UserRound,
  X,
  ShieldCheck,
} from 'lucide-react';
import type { DesignPatch } from '@/modules/configuration/types';
import { PRODUCTS, fabricFor, CLIMATES, OCCASIONS, type Product } from '@/modules/catalog/catalog';
import { useStudio } from './use-studio';
import { displayValue } from '@/modules/measurements/definitions';
import { Consultation, DesignControls } from './design-consultation';
import { MeasurementPanel } from './measurement-panel';
import { ReviewPanel } from './review-panel';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
const GarmentView = dynamic(() => import('@/visualization/garment-view'), {
  ssr: false,
  loading: () => (
    <div className="model-loading">
      <LoaderCircle className="spin" size={25} />
      <span>Preparing your 3D studio…</span>
    </div>
  ),
});
export default function Studio() {
  const studio = useStudio();
  const { draft, busy, error, user } = studio;
  const [step, setStep] = useState(1),
    [mobilePane, setMobilePane] = useState('conversation'),
    [appearance, setAppearance] = useState(false),
    [photo, setPhoto] = useState<string>(),
    [highlight, setHighlight] = useState('chest'),
    [confirmDesign, setConfirmDesign] = useState(false),
    [productChange, setProductChange] = useState<DesignPatch | null>(null),
    [info, setInfo] = useState(false),
    [dirty, setDirty] = useState(false),
    [leaveStep, setLeaveStep] = useState<number | null>(null),
    [photoError, setPhotoError] = useState('');
  const photoRef = useRef<string | undefined>(undefined);
  const onDirty = useCallback((v: boolean) => setDirty(v), []);
  const [measurementPreview, setMeasurementPreview] = useState<{
    values: Record<string, number>;
    unit: 'cm' | 'in';
  }>({ values: {}, unit: 'cm' });
  const onMeasurePreview = useCallback(
    (values: Record<string, number>, unit: 'cm' | 'in') => setMeasurementPreview({ values, unit }),
    [],
  );
  function navigate(n: number) {
    if (n === step) return;
    if (step === 2 && dirty) {
      setLeaveStep(n);
      return;
    }
    setStep(n);
    setMobilePane('conversation');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function change(patch: DesignPatch) {
    if (!draft) return;
    if (patch.product && patch.product !== draft.design.product && draft.design.confirmed.length) {
      setProductChange(patch);
      return;
    }
    void studio.command({ type: 'design', patch });
  }
  async function confirm() {
    const result = await studio.command({ type: 'accept_design' });
    if (result) {
      setConfirmDesign(false);
      navigate(2);
    }
  }
  async function photoUpload(file: File | undefined) {
    setPhotoError('');
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setPhotoError('Choose a JPG, PNG or WebP image under 5 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
      photoRef.current = url;
      setPhoto(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setPhotoError('That image could not be opened. Please choose another.');
    };
    img.src = url;
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#studio-content">
        Skip to studio
      </a>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Vessy home">
          vessy<span>®</span>
        </Link>
        <nav className="journey-nav" aria-label="Order steps">
          {['Create your look', 'Measurements', 'Review'].map((label, i) => (
            <button
              key={label}
              className={step === i + 1 ? 'active' : ''}
              aria-current={step === i + 1 ? 'step' : undefined}
              onClick={() => navigate(i + 1)}
            >
              <span>{step > i + 1 ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="prototype-badge" onClick={() => setInfo(true)}>
            Studio preview
            <Info size={12} />
          </button>
          <Link
            href="/account"
            className="account-button"
            aria-label={user ? 'Your account' : 'Sign in'}
          >
            <UserRound size={19} />
            <span>{user ? user.name.split(' ')[0] : 'Your account'}</span>
          </Link>
        </div>
      </header>
      {!draft ? (
        <main className="center-state">
          <div className="eyebrow">YOUR PERSONAL TAILOR</div>
          <h1>
            {error ? 'We couldn’t open your studio.' : 'Something considered. Something yours.'}
          </h1>
          <p>{error || 'Preparing your personal tailoring studio…'}</p>
          {error ? (
            <Button
              onClick={() => {
                studio.setError('');
                void studio.load();
              }}
            >
              Try again
            </Button>
          ) : (
            <LoaderCircle className="spin" />
          )}
        </main>
      ) : (
        <>
          <div className="studio-subnav">
            <div>
              <span className="live-indicator" />
              THE TAILORING STUDIO<span className="subnav-divider">/</span>
              <span className="subnav-step">
                {step === 1 ? 'DESIGN' : step === 2 ? 'MEASURE' : 'REVIEW'}
              </span>
            </div>
            <span className="subnav-note">Considered details. Personal by design.</span>
            <button className="help-button" onClick={() => setInfo(true)}>
              About this preview
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="mobile-pane-switch" role="group" aria-label="Studio panel">
            <button
              aria-pressed={mobilePane === 'conversation'}
              onClick={() => setMobilePane('conversation')}
            >
              {step === 1 ? 'Your tailor' : step === 2 ? 'Measurements' : 'Order details'}
            </button>
            <button
              aria-pressed={mobilePane === 'preview'}
              onClick={() => setMobilePane('preview')}
            >
              3D preview
            </button>
          </div>
          <main className={`studio-grid step-${step} mobile-${mobilePane}`} id="studio-content">
            <div className="left-pane">
              {step === 1 ? (
                <Consultation {...studio} draft={draft} change={change} />
              ) : step === 2 ? (
                <MeasurementPanel
                  draft={draft}
                  busy={busy}
                  command={studio.command}
                  setHighlight={setHighlight}
                  onContinue={() => {
                    setDirty(false);
                    setStep(3);
                  }}
                  onDirty={onDirty}
                  onPreview={onMeasurePreview}
                />
              ) : (
                <ReviewPanel draft={draft} busy={busy} command={studio.command} edit={navigate} />
              )}
            </div>
            <div className="right-pane">
              <div className="preview-area">
                <div className="preview-heading">
                  <div>
                    <div className="eyebrow">
                      {step === 2 ? 'YOUR MEASUREMENT GUIDE' : 'THE SHAPE OF YOUR STYLE'}
                    </div>
                    <h2>
                      {step === 2
                        ? 'Every detail, in proportion.'
                        : PRODUCTS[draft.design.product].name}
                    </h2>
                    <p>
                      {step === 2
                        ? 'Select a field to highlight its measurement path.'
                        : `${fabricFor(draft.design.fabricId)?.name} · ${draft.design.fit} fit`}
                    </p>
                  </div>
                  {step === 1 ? (
                    <div className="preview-actions">
                      <label className="garment-picker">
                        <span className="sr-only">Garment</span>
                        <select
                          aria-label="Garment"
                          id="garment-select"
                          value={draft.design.product}
                          disabled={busy}
                          onChange={(e) => change({ product: e.target.value as Product })}
                        >
                          {Object.entries(PRODUCTS).map(([k, p]) => (
                            <option key={k} value={k}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} />
                      </label>
                      <button className="appearance-button" onClick={() => setAppearance(true)}>
                        <SlidersHorizontal size={15} />
                        <span>Appearance</span>
                      </button>
                    </div>
                  ) : (
                    <span className="reference-label">REFERENCE MANNEQUIN</span>
                  )}
                </div>
                <GarmentView
                  design={draft.design}
                  measure={step === 2}
                  highlight={highlight}
                  measurementValue={
                    measurementPreview.values[highlight]
                      ? `${displayValue(measurementPreview.values[highlight], measurementPreview.unit)} ${measurementPreview.unit}`
                      : undefined
                  }
                  photo={photo}
                />
                <div className="preview-disclaimer">
                  <span className="reference-dot" />
                  Interactive reference ·{' '}
                  {step === 2 ? 'not a scan of your body' : 'illustrative fit and fabric colour'}
                </div>
              </div>
              {step === 1 ? (
                <DesignControls draft={draft} busy={busy} change={change} />
              ) : (
                <div className="preview-bottom-note">
                  <Scissors size={22} />
                  <div>
                    <strong>
                      {step === 2
                        ? 'Your fit deserves a closer look.'
                        : 'The details make the difference.'}
                    </strong>
                    <p>
                      {step === 2
                        ? 'Body values stay separate from garment fit allowances. A visual preview does not verify a measurement.'
                        : 'Your selections and measurements are saved together. You stay in control before anything is ordered.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </main>
          <footer className="studio-footer">
            <div className="save-state">
              <span className={busy ? 'status-dot saving' : 'status-dot'} />
              {busy
                ? 'Saving your draft…'
                : dirty
                  ? 'You have unsaved measurements'
                  : 'Your draft is saved'}
              <span className="footer-separator">·</span>
              <span className="footer-secondary">No payment until you’re ready</span>
            </div>
            <div className="footer-actions">
              {step > 1 && (
                <Button variant="ghost" onClick={() => navigate(step - 1)}>
                  <ArrowLeft size={15} />
                  Back
                </Button>
              )}
              {step === 1 ? (
                <>
                  <span className="footer-next-note">Next, we’ll find your fit.</span>
                  <Button onClick={() => setConfirmDesign(true)} disabled={busy}>
                    Review design & continue
                    <ArrowRight size={16} />
                  </Button>
                </>
              ) : step === 2 ? (
                <span className="footer-next-note">Confirm your measurements to continue.</span>
              ) : (
                <span className="footer-next-note">
                  <ShieldCheck size={15} /> Payment is not enabled in this preview.
                </span>
              )}
            </div>
          </footer>
        </>
      )}
      {error && draft && (
        <div className="error-toast" role="alert">
          <Info size={18} />
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => studio.setError('')}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <Dialog
        open={info}
        onOpenChange={setInfo}
        title="Welcome to your studio preview"
        description="A working foundation for a more personal tailoring experience."
      >
        <ul className="preview-list">
          <li>
            <Check size={17} />
            <span>Design a men’s suit, shirt or blazer and explore it in 3D.</span>
          </li>
          <li>
            <Check size={17} />
            <span>
              Your choices, conversation and manually entered measurements save to this browser’s
              draft.
            </span>
          </li>
          <li>
            <Info size={17} />
            <span>
              Fabric references and the mannequin are illustrative. They are not a supplier catalog
              or a scan of your body.
            </span>
          </li>
          <li>
            <Info size={17} />
            <span>
              3DLOOK, expert review and payments need their live integrations. No order will be
              placed from this preview.
            </span>
          </li>
        </ul>
        <Button className="full-width" onClick={() => setInfo(false)}>
          Make yourself at home
        </Button>
      </Dialog>
      <Dialog
        open={appearance}
        onOpenChange={setAppearance}
        title="Make the reference your own"
        description="Adjust the mannequin’s appearance while you explore your design."
      >
        <label className="field-label">Skin tone</label>
        <div className="skin-tones">
          {(['porcelain', 'warm', 'tan', 'deep'] as const).map((tone, i) => (
            <button
              key={tone}
              disabled={busy}
              aria-label={`${tone} skin tone`}
              aria-pressed={draft?.design.skinTone === tone}
              style={{ background: ['#e2cbb6', '#b99779', '#987456', '#604436'][i] }}
              onClick={() => change({ skinTone: tone })}
            >
              {draft?.design.skinTone === tone && <Check size={18} />}
            </button>
          ))}
        </div>
        <div className="photo-upload">
          <Upload size={23} />
          <strong>Add a photo reference</strong>
          <p>
            Your photo stays in this tab. It is not uploaded, used for measurement, or mapped onto
            the mannequin.
          </p>
          <label className="button button-secondary">
            Choose a photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                void photoUpload(e.target.files?.[0]);
                e.target.value = '';
              }}
              className="sr-only"
            />
          </label>
          {photo && (
            <button
              className="text-button"
              onClick={() => {
                URL.revokeObjectURL(photo);
                photoRef.current = undefined;
                setPhoto(undefined);
              }}
            >
              Remove photo
            </button>
          )}
          <small>JPG, PNG or WebP · up to 5 MB</small>
          {photoError && (
            <p role="alert" className="field-error">
              {photoError}
            </p>
          )}
        </div>
        <Button className="full-width" onClick={() => setAppearance(false)}>
          Done
        </Button>
      </Dialog>
      <Dialog
        open={!!productChange}
        onOpenChange={(open) => {
          if (!open) setProductChange(null);
        }}
        title="Start a different garment?"
        description="Changing the garment resets its fabric, fit and finishing details. Your occasion and weather preferences stay with you; measurements will need reconfirming."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setProductChange(null)}>
            Keep my design
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (productChange) {
                const result = await studio.command({
                  type: 'design',
                  patch: productChange,
                  confirmCategoryChange: true,
                });
                if (result) setProductChange(null);
              }
            }}
          >
            Change garment
            <ArrowRight size={15} />
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={confirmDesign}
        onOpenChange={setConfirmDesign}
        title="Does this feel like you?"
        description="Confirm the complete design, including the suggested finishing details, before moving on."
      >
        {draft && (
          <>
            <div className="confirm-summary">
              <strong>{PRODUCTS[draft.design.product].name}</strong>
              <span>
                {fabricFor(draft.design.fabricId)?.name} · {draft.design.fit} fit
              </span>
              <span>
                {draft.design.product === 'shirt'
                  ? `${draft.design.collar} collar · ${draft.design.cuffs} cuffs`
                  : `${draft.design.lapel} lapel · ${draft.design.pockets} pockets · ${draft.design.closure}`}
              </span>
            </div>
            <div className="confirm-fields">
              <label>
                Occasion
                <select
                  aria-label="Confirm occasion"
                  value={draft.design.occasion}
                  disabled={busy}
                  onChange={(e) => change({ occasion: e.target.value as DesignPatch['occasion'] })}
                >
                  <option value="" disabled>
                    Choose an occasion
                  </option>
                  {OCCASIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                Weather
                <select
                  aria-label="Confirm weather"
                  value={draft.design.climate}
                  disabled={busy}
                  onChange={(e) => change({ climate: e.target.value as DesignPatch['climate'] })}
                >
                  <option value="" disabled>
                    Choose the weather
                  </option>
                  {CLIMATES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="fine-print">
              These are reference choices. A live supplier catalog and quote will be required before
              ordering.
            </p>
            <Button
              className="full-width"
              disabled={busy || !draft.design.occasion || !draft.design.climate}
              onClick={confirm}
            >
              Confirm design & take measurements
              <ArrowRight size={16} />
            </Button>
          </>
        )}
      </Dialog>
      <Dialog
        open={leaveStep !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveStep(null);
        }}
        title="You have unsaved measurements"
        description="Keep editing to save your new values, or leave and return to the last saved version."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setLeaveStep(null)}>
            Keep editing
          </Button>
          <Button
            onClick={() => {
              setDirty(false);
              setStep(leaveStep!);
              setLeaveStep(null);
            }}
          >
            Discard unsaved changes
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
