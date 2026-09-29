'use client';
import { useState, useCallback, useMemo, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  LoaderCircle,
  ListChecks,
  RefreshCw,
  Scissors,
  Sparkles,
  SlidersHorizontal,
  Upload,
  UserRound,
  X,
  ShieldCheck,
} from 'lucide-react';
import type {
  ChatSuggestion,
  DraftV2,
  Garment,
  GarmentPatch,
  Impact,
} from '@/modules/configuration/types';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import {
  changedLeaves,
  designOutline,
  findLeaf,
  type BranchId,
} from '@/modules/configuration/design-outline';
import type { MeasurementSet } from '@/modules/measurements/definitions';
import { REGIONS, regionForLeaf, type RegionId } from '@/visualization/focus-regions';
import GarmentSketch, { type SketchHotspot } from '@/visualization/garment-sketch';
import { shownIn3D } from '@/visualization/garments/coverage';
import { renderValues } from '@/visualization/binding';
import { useStudio } from './use-studio';
import { displayValue } from '@/modules/measurements/definitions';
import { Consultation } from './design-consultation';
import { DesignNavigator, type NavPath } from './design-navigator';
import { SelectionTags } from './selection-tags';
import { MeasurementPanel } from './measurement-panel';
import { ReviewPanel } from './review-panel';
import { CartSwitcher } from './cart-switcher';
import { StartScreen } from './start-screen';
import { PriceSummary } from './price-summary';
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
const activeOf = (draft: DraftV2 | null) =>
  draft?.garments.find((garment) => garment.id === draft.activeGarmentId) ?? null;

function ImpactList({ impact }: { impact: Impact[] }) {
  return (
    <ul className="impact-list">
      {impact.map((item, i) => (
        <li key={`${item.attributeCode ?? item.kind}-${i}`}>
          <Info size={15} aria-hidden />
          <span>{item.message}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Studio({
  preview = false,
  previewCanWrite = false,
  initialProduct,
  initialGroup,
}: {
  preview?: boolean;
  previewCanWrite?: boolean;
  initialProduct?: string;
  initialGroup?: string;
} = {}) {
  const studio = useStudio(preview);
  const { state, draft, busy, error, user, catalogs } = studio;
  const current = state ? catalogs[state.catalogVersion] : undefined;
  const garment = activeOf(draft);
  const pending = useMemo(
    () => new Set((state?.catalogUpdates ?? []).map((update) => update.garmentId)),
    [state],
  );
  /**
   * A garment is shown against the current release (its next command moves it
   * there silently), unless a catalog update that changes its choices awaits
   * the customer's review; then its pinned release is shown (CATALOG-ADMIN §7.8).
   */
  const releaseFor = useCallback(
    (item: Garment): RuntimeIndex | undefined =>
      pending.has(item.id) ? (catalogs[item.catalogVersion] ?? current) : current,
    [pending, catalogs, current],
  );
  const index = garment ? releaseFor(garment) : current;
  const [step, setStep] = useState(1),
    [mobilePane, setMobilePane] = useState('conversation'),
    [appearance, setAppearance] = useState(false),
    [photo, setPhoto] = useState<string>(),
    [highlight, setHighlight] = useState('chest'),
    [confirmDesign, setConfirmDesign] = useState(false),
    [productChange, setProductChange] = useState<GarmentPatch | null>(null),
    [info, setInfo] = useState(false),
    [dirty, setDirty] = useState(false),
    [leaveStep, setLeaveStep] = useState<number | null>(null),
    [photoError, setPhotoError] = useState(''),
    [inputMode, setInputMode] = useState<'chat' | 'fields'>(preview ? 'fields' : 'chat'),
    [nav, setNav] = useState<NavPath>(initialGroup ? { leaf: initialGroup } : {}),
    [previewMode, setPreviewMode] = useState<'2d' | '3d'>('2d'),
    [updatesOpen, setUpdatesOpen] = useState(false),
    [focus, setFocus] = useState<{ region: RegionId; leafId?: string; nonce: number }>({
      region: 'full',
      nonce: 0,
    });
  const outline = useMemo(
    () => (index && garment ? designOutline(index, garment) : []),
    [index, garment],
  );
  const render = useMemo(
    () => (index && garment && draft ? renderValues(index, garment, draft.skinTone) : null),
    [index, garment, draft],
  );
  const measurementSets = useMemo(() => {
    const sets = new Set<MeasurementSet>();
    for (const item of draft?.garments ?? []) {
      const product = (catalogs[item.catalogVersion] ?? current)?.products.get(item.productCode);
      if (product) sets.add(product.measurementSet);
    }
    return [...sets];
  }, [draft, catalogs, current]);
  const updates = state?.catalogUpdates ?? [];
  const focusedLeaf = focus.leafId ? findLeaf(outline, focus.leafId) : undefined;
  const focusLeaf = useCallback(
    (leafId: string, target: Garment, skinTone: DraftV2['skinTone'], changedKey?: string) => {
      const release = releaseFor(target);
      if (!release) return;
      const values = renderValues(release, target, skinTone);
      setFocus((previous) => ({
        leafId,
        region: regionForLeaf(leafId, {
          index: release,
          product: values.visualModel,
          tokens: values.tokens,
          changedKey,
        }),
        nonce: previous.nonce + 1,
      }));
    },
    [releaseFor],
  );
  // Every committed change, whether from chat, a suggestion or a field, moves the 2D focus.
  const followChange = useCallback(
    (before: Garment, next: DraftV2 | null) => {
      const after = activeOf(next);
      if (!next || !after) return next;
      const release = releaseFor(after);
      if (before.id !== after.id || before.productCode !== after.productCode || !release)
        setFocus((previous) => ({ leafId: 'product', region: 'full', nonce: previous.nonce + 1 }));
      else {
        const [first] = changedLeaves(release, before, after);
        if (first) focusLeaf(first.leafId, after, next.skinTone, first.keys[0]);
      }
      return next;
    },
    [releaseFor, focusLeaf],
  );
  function navigateDetails(path: NavPath) {
    setNav(path);
    if (!garment || !draft) return;
    if (path.leaf) focusLeaf(path.leaf, garment, draft.skinTone);
    else
      setFocus((previous) => ({
        region:
          path.branch && path.branch !== 'essentials' && path.branch !== 'accents' && index
            ? regionForLeaf(`include:${path.branch}`, { index })
            : 'full',
        leafId: undefined,
        nonce: previous.nonce + 1,
      }));
  }
  function openLeaf(leafId: string, branch: BranchId) {
    setInputMode('fields');
    setMobilePane('conversation');
    navigateDetails({ branch, leaf: leafId });
  }
  const hotspots = useMemo(() => {
    if (!index || !render) return [];
    const seen = new Set<RegionId>(['full', 'torso', 'back']);
    const spots: SketchHotspot[] = [];
    for (const leaf of outline.flatMap((branch) => branch.leaves)) {
      const region = regionForLeaf(leaf.id, {
        index,
        product: render.visualModel,
        tokens: render.tokens,
      });
      if (seen.has(region)) continue;
      seen.add(region);
      spots.push({ region, leafId: leaf.id, label: leaf.label });
    }
    return spots;
  }, [index, render, outline]);
  const photoRef = useRef<string | undefined>(undefined);
  const onDirty = useCallback((v: boolean) => setDirty(v), []);
  const [measurementFocus, setMeasurementFocus] = useState<string>();
  const [measurementPreview, setMeasurementPreview] = useState<{
    values: Record<string, number>;
    unit: 'cm' | 'in';
  }>({ values: {}, unit: 'cm' });
  const onMeasurePreview = useCallback(
    (values: Record<string, number>, unit: 'cm' | 'in') => setMeasurementPreview({ values, unit }),
    [],
  );
  function navigate(n: number) {
    if (n === step || !garment) return;
    if (step === 2 && dirty) {
      setLeaveStep(n);
      return;
    }
    setStep(n);
    setMobilePane('conversation');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function change(patch: GarmentPatch) {
    if (!garment) return;
    if (
      patch.productCode &&
      patch.productCode !== garment.productCode &&
      garment.confirmed.length
    ) {
      setProductChange(patch);
      return;
    }
    const before = garment;
    void studio.command({ type: 'design', patch }).then((next) => followChange(before, next));
  }
  async function applySuggestion(suggestion: ChatSuggestion) {
    const { productCode, ...rest } = suggestion.patch;
    // An empty cart starts the suggested garment first (ADMIN-BACKEND §11).
    if (!garment) {
      if (!productCode) return;
      const added = await studio.command({ type: 'add_garment', productCode });
      if (added && Object.keys(rest).length) await studio.command({ type: 'design', patch: rest });
      return;
    }
    change(suggestion.patch);
  }
  async function confirm() {
    const result = await studio.command({ type: 'accept_design' });
    if (result) {
      setConfirmDesign(false);
      navigate(2);
    }
  }
  async function acceptUpdates() {
    for (const update of updates) {
      if (update.impact.some((item) => item.kind === 'product_unavailable')) continue;
      const done = await studio.command({
        type: 'rebase_catalog',
        garmentId: update.garmentId,
        confirmImpact: true,
      });
      if (!done) return;
    }
    setUpdatesOpen(false);
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
  const product = garment && index ? index.products.get(garment.productCode) : undefined;
  const material = garment && index ? index.materials.get(garment.materialCode) : undefined;
  const fitLeaf = outline
    .flatMap((branch) => branch.leaves)
    .find((leaf) => leaf.group?.attributes.some((entry) => entry.attribute.visualSlot === 'fit'));
  const fitText = fitLeaf
    ? /fit$/i.test(fitLeaf.value)
      ? fitLeaf.value
      : `${fitLeaf.value} fit`
    : '';
  const summaryLeaves = outline
    .filter((branch) => branch.id !== 'accents')
    .flatMap((branch) => branch.leaves)
    .filter((leaf) => leaf.kind === 'catalog' && leaf.id !== fitLeaf?.id)
    .slice(0, 3);
  const notIllustrated =
    focusedLeaf && render
      ? focusedLeaf.keys.filter((key) => render.notIllustrated.includes(key))
      : [];
  const changesToReview = updates.reduce((sum, update) => sum + update.impact.length, 0);
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
              className={step === i + 1 && garment ? 'active' : ''}
              aria-current={step === i + 1 && garment ? 'step' : undefined}
              disabled={!garment || (preview && i > 0)}
              onClick={() => navigate(i + 1)}
            >
              <span>{step > i + 1 ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          {!preview && user && <Link href="/orders">My orders</Link>}
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
      {preview && (
        <section className="catalog-preview-banner" aria-label="Staff catalog preview">
          <strong>Unpublished catalog preview</strong>
          <span>This separate draft is for staff design preview.</span>
          <Link href="/admin/catalog/products">Back to admin</Link>
          {garment && previewCanWrite && (
            <button
              onClick={async () => {
                const code = window.prompt(
                  'Code for the new look (lowercase words separated by hyphens)',
                );
                if (!code) return;
                const name = window.prompt('Name for the new look');
                if (!name) return;
                try {
                  const response = await fetch('/api/admin/catalog/templates/from-preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ garmentId: garment.id, code, name }),
                  });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error.message);
                  studio.setError('');
                  window.alert(`Saved “${name}” as a draft look.`);
                } catch (e) {
                  studio.setError((e as Error).message);
                }
              }}
            >
              Save as look
            </button>
          )}
        </section>
      )}
      {!draft || !current ? (
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
      ) : !garment || !index || !render ? (
        <StartScreen
          index={current}
          busy={busy}
          initialProduct={initialProduct}
          onStart={(productCode, templateCode) => {
            setStep(1);
            void studio.command({
              type: 'add_garment',
              productCode,
              ...(templateCode ? { templateCode } : {}),
            });
          }}
        />
      ) : (
        <>
          <CartSwitcher
            draft={draft}
            index={current}
            quote={state!.quote}
            busy={busy || dirty}
            command={studio.command}
            onSwitch={() => {
              setStep(1);
              setNav({});
              setFocus({ region: 'full', nonce: Date.now() });
            }}
          />
          <div className="studio-subnav" role="region" aria-label="Studio progress">
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
          {updates.length > 0 && (
            <div className="catalog-update-banner" role="status">
              <RefreshCw size={16} aria-hidden />
              <span>
                Our catalog changed. {changesToReview}{' '}
                {changesToReview === 1 ? 'choice needs' : 'choices need'} your review.
              </span>
              <button onClick={() => setUpdatesOpen(true)}>Review changes</button>
            </div>
          )}
          <div className="mobile-pane-switch" role="region" aria-label="Studio panel">
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
              Preview
            </button>
          </div>
          <main className={`studio-grid step-${step} mobile-${mobilePane}`} id="studio-content">
            <div className="left-pane">
              {preview ? (
                <Link href="/admin/catalog/publish">Review catalog & publish →</Link>
              ) : step === 1 ? (
                <div className="design-workspace">
                  <div className="workspace-head">
                    <div className="eyebrow">
                      <span className="small-star">✳</span> YOUR PERSONAL TAILOR
                    </div>
                    <h1>Good style starts with you.</h1>
                  </div>
                  <Tabs.Root
                    className="input-modes"
                    value={inputMode}
                    onValueChange={(value) => setInputMode(value as 'chat' | 'fields')}
                  >
                    <Tabs.List className="input-switch" aria-label="How would you like to design?">
                      <Tabs.Trigger value="chat">
                        <Sparkles size={14} />
                        Ask your tailor
                      </Tabs.Trigger>
                      <Tabs.Trigger value="fields">
                        <ListChecks size={14} />
                        Choose details
                      </Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="chat" forceMount className="input-mode-panel">
                      <Consultation
                        draft={draft}
                        garment={garment}
                        index={index}
                        availability={state!.availability}
                        busy={busy}
                        mode={studio.mode}
                        chat={studio.chat}
                        change={change}
                        applySuggestion={(suggestion) => void applySuggestion(suggestion)}
                        onChooseDetails={() => {
                          setInputMode('fields');
                          navigateDetails({});
                        }}
                      />
                    </Tabs.Content>
                    <Tabs.Content value="fields" forceMount className="input-mode-panel">
                      <DesignNavigator
                        index={index}
                        garment={garment}
                        outline={outline}
                        availability={state!.availability}
                        busy={busy}
                        change={change}
                        path={nav}
                        navigate={navigateDetails}
                      />
                    </Tabs.Content>
                  </Tabs.Root>
                </div>
              ) : step === 2 ? (
                <MeasurementPanel
                  focusField={measurementFocus}
                  draft={draft}
                  measurementSets={measurementSets}
                  busy={busy}
                  user={user}
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
                <ReviewPanel
                  key={`${draft.revision}:${draft.review?.id ?? ''}`}
                  draft={draft}
                  quote={state!.quote}
                  index={index}
                  measurementSets={measurementSets}
                  busy={busy}
                  command={studio.command}
                  edit={(nextStep, field) => {
                    setMeasurementFocus(field);
                    navigate(nextStep);
                  }}
                  check={studio.check}
                  signedIn={!!user}
                  onRefresh={studio.load}
                />
              )}
            </div>
            <div className="right-pane">
              <div className="preview-area">
                <div className="preview-heading">
                  <div>
                    <div className="eyebrow">
                      {step === 2 ? 'YOUR MEASUREMENT GUIDE' : 'THE SHAPE OF YOUR STYLE'}
                    </div>
                    <h2>{step === 2 ? 'Every detail, in proportion.' : product?.name}</h2>
                    <p>
                      {step === 2
                        ? 'Select a field to highlight its measurement path.'
                        : [material?.name, fitText].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {step === 1 ? (
                    <div className="preview-actions">
                      <label className="garment-picker">
                        <span className="sr-only">Garment</span>
                        <select
                          aria-label="Garment"
                          id="garment-select"
                          value={garment.productCode}
                          disabled={busy}
                          onChange={(e) => change({ productCode: e.target.value })}
                        >
                          {index.catalog.products.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.shortLabel}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} />
                      </label>
                      <button
                        className="appearance-button"
                        aria-label="Appearance"
                        onClick={() => setAppearance(true)}
                      >
                        <SlidersHorizontal size={15} />
                        <span>Appearance</span>
                      </button>
                      <div className="preview-mode" role="group" aria-label="Preview type">
                        {(['2d', '3d'] as const).map((value) => (
                          <button
                            key={value}
                            aria-pressed={previewMode === value}
                            aria-label={value === '2d' ? '2D drawing' : '3D model'}
                            onClick={() => setPreviewMode(value)}
                          >
                            {value.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="reference-label">REFERENCE MANNEQUIN</span>
                  )}
                </div>
                {step === 1 && previewMode === '2d' ? (
                  <GarmentSketch
                    render={render}
                    focus={{
                      region: focus.region,
                      nonce: focus.nonce,
                      label:
                        focusedLeaf?.label ??
                        (focus.region !== 'full' ? REGIONS[focus.region].label : undefined),
                      value: focusedLeaf?.value,
                    }}
                    hotspots={hotspots}
                    onHotspot={(spot) => {
                      const leaf = findLeaf(outline, spot.leafId);
                      if (leaf) openLeaf(leaf.id, leaf.branchId);
                    }}
                  />
                ) : (
                  <GarmentView
                    render={render}
                    measure={step === 2}
                    highlight={highlight}
                    measurementValue={
                      measurementPreview.values[highlight]
                        ? `${displayValue(measurementPreview.values[highlight], measurementPreview.unit)} ${measurementPreview.unit}`
                        : undefined
                    }
                    photo={photo}
                  />
                )}
                {step === 1 && focusedLeaf && notIllustrated.length > 0 && (
                  <div className="detail-in-2d not-illustrated-note" role="status">
                    <span>
                      <strong>Not illustrated</strong> · {focusedLeaf.label}: {focusedLeaf.value}
                    </span>
                  </div>
                )}
                {step === 1 &&
                  previewMode === '3d' &&
                  focusedLeaf &&
                  focus.region !== 'full' &&
                  !shownIn3D(focusedLeaf.id, index) && (
                    <div className="detail-in-2d" role="status">
                      <span>
                        <strong>{focusedLeaf.label}</strong> is shown in the 2D drawing
                      </span>
                      <button onClick={() => setPreviewMode('2d')}>View in 2D</button>
                    </div>
                  )}
                <div className="preview-disclaimer">
                  <span className="reference-dot" />
                  Interactive reference ·{' '}
                  {step === 2
                    ? 'not a scan of your body'
                    : step === 1 && previewMode === '2d'
                      ? 'illustrative technical drawing'
                      : 'illustrative fit and fabric colour'}
                </div>
              </div>
              {step === 1 && <PriceSummary quote={state!.quote} garmentId={garment.id} />}
              {step === 1 ? (
                <SelectionTags outline={outline} activeLeaf={focus.leafId} onEdit={openLeaf} />
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
                  <ShieldCheck size={15} /> Your order is saved before payment.
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
              Live purchasing, body scanning and a staffed tailor service are not available in this
              preview. Configured checkout uses test payments.
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
              aria-pressed={draft?.skinTone === tone}
              style={{ background: ['#e2cbb6', '#b99779', '#987456', '#604436'][i] }}
              onClick={() => void studio.command({ type: 'appearance', skinTone: tone })}
            >
              {draft?.skinTone === tone && <Check size={18} />}
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
              if (productChange && garment) {
                const result = followChange(
                  garment,
                  await studio.command({
                    type: 'design',
                    patch: productChange,
                    confirmCategoryChange: true,
                  }),
                );
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
        open={!!studio.pendingImpact}
        onOpenChange={(open) => {
          if (!open) studio.dismissImpact();
        }}
        title="This change affects other choices"
        description="To keep your design consistent, these choices would change too. Nothing changes until you confirm."
      >
        {studio.pendingImpact && <ImpactList impact={studio.pendingImpact.impact} />}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => studio.dismissImpact()}>
            Keep my design
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              const before = garment;
              const next = await studio.confirmImpact();
              if (before) followChange(before, next);
            }}
          >
            Apply the changes
            <ArrowRight size={15} />
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={updatesOpen && updates.length > 0}
        onOpenChange={setUpdatesOpen}
        title="Our catalog changed"
        description="Some of your choices are no longer offered. Review what changes before you continue designing."
      >
        {updates.map((update) => (
          <ImpactList key={update.garmentId} impact={update.impact} />
        ))}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setUpdatesOpen(false)}>
            Not now
          </Button>
          <Button disabled={busy} onClick={() => void acceptUpdates()}>
            Accept the changes
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
        {garment && index && (
          <>
            <div className="confirm-summary">
              <strong>{product?.name}</strong>
              <span>{[material?.name, fitText].filter(Boolean).join(' · ')}</span>
              <span>{summaryLeaves.map((leaf) => leaf.value).join(' · ')}</span>
            </div>
            <div className="confirm-fields">
              {(['occasion', 'climate'] as const).map((type) => (
                <label key={type}>
                  {type === 'occasion' ? 'Occasion' : 'Weather'}
                  <select
                    aria-label={type === 'occasion' ? 'Confirm occasion' : 'Confirm weather'}
                    value={garment.preferences[type] ?? ''}
                    disabled={busy}
                    onChange={(e) => change({ preferences: { [type]: e.target.value } })}
                  >
                    <option value="" disabled>
                      {type === 'occasion' ? 'Choose an occasion' : 'Choose the weather'}
                    </option>
                    {(index.catalog.lookups[type] ?? []).map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {index.catalog.referenceOnly && (
              <p className="fine-print">
                These are reference choices. A live supplier catalog and quote will be required
                before ordering.
              </p>
            )}
            <Button
              className="full-width"
              disabled={busy || !garment.preferences.occasion || !garment.preferences.climate}
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
