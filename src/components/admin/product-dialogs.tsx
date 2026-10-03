'use client';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { formatPrice, minorToDecimal } from '@/lib/money';
import {
  choiceOffError,
  imageFileError,
  nameError,
  priceResult,
  IMAGE_TYPES,
} from '@/modules/catalog/admin-names';
import { adminFetch, AdminError, codeFromName, FieldInput, type Entry } from './editor';

// D-022: every “add” on the product screens, and a subcategory's choices,
// open in a modal so the page stays a short list. Each form checks its fields
// before sending and shows the server's own field errors in the same place.

export type Value = Entry & {
  label: string;
  surchargeMinor: number;
  isDefault: boolean;
  imageMediaId: string | null;
};
export type Attribute = Entry & { values: Value[]; inputType: string; visibleWhen: unknown };
export type Group = Entry & { kind: 'style' | 'accent'; attributes: Attribute[] };
export type Option = { value: string; label: string };
type Errors = Record<string, string | null | undefined>;

export const live = <T extends Entry>(rows: T[]) => rows.filter((row) => row.status !== 'archived');
const catalogSaved = () => window.dispatchEvent(new Event('catalog-saved'));
const PIECES = [
  { value: 'jacket', label: 'Jacket' },
  { value: 'trousers', label: 'Trousers' },
  { value: 'vest', label: 'Vest' },
  { value: 'shirt', label: 'Shirt' },
];

/** Moves focus to the first field the user has to fix. */
function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
/** Server field errors onto this form's fields; anything else is a form-level message. */
function serverErrors(e: unknown, fields: Record<string, string>) {
  const mapped: Errors = {};
  if (e instanceof AdminError)
    for (const item of e.details?.fields ?? []) {
      const key = fields[item.path.split('.')[0]];
      if (key) mapped[key] = item.message;
    }
  return {
    fields: mapped,
    form: Object.keys(mapped).length ? '' : (e as Error).message,
  };
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}) {
  const id = useId();
  const note = error || hint ? `${id}-note` : undefined;
  return (
    <div className="pb-field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': note })}
      {(error || hint) && (
        <small id={note} className={error ? 'pb-field-error' : undefined}>
          {error || hint}
        </small>
      )}
    </div>
  );
}

function FormAlert({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="pb-form-error">
      {message}
    </p>
  ) : null;
}

function Actions({
  busy,
  submit,
  onCancel,
  cancel = 'Cancel',
}: {
  busy: boolean;
  submit: string;
  onCancel: () => void;
  cancel?: string;
}) {
  return (
    <div className="dialog-actions">
      <button type="button" onClick={onCancel} disabled={busy}>
        {cancel}
      </button>
      <button className="admin-primary" type="submit" disabled={busy}>
        {busy ? 'Saving…' : submit}
      </button>
    </div>
  );
}

/** Field errors shown once the user leaves a field or tries to save. */
function useChecks(validate: () => Errors) {
  const [touched, setTouched] = useState<Record<string, boolean>>({}),
    [submitted, setSubmitted] = useState(false),
    [server, setServer] = useState<Errors>({});
  const all = validate();
  const shown = (key: string) => server[key] ?? (submitted || touched[key] ? all[key] : undefined);
  return {
    shown,
    touch: (key: string) => setTouched((t) => ({ ...t, [key]: true })),
    clearServer: (key: string) => setServer((s) => ({ ...s, [key]: undefined })),
    setServer,
    /** True when the form may be sent; otherwise shows every error. */
    check(form: HTMLFormElement | null) {
      setSubmitted(true);
      setServer({});
      if (Object.values(all).some(Boolean)) {
        focusFirstInvalid(form);
        return false;
      }
      return true;
    },
  };
}

function PriceField({
  label,
  value,
  error,
  hint,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  error?: string | null;
  hint?: string;
  onChange: (text: string) => void;
  onBlur: () => void;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(props) => (
        <input
          {...props}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      )}
    </Field>
  );
}

export function ImagePicker({
  label,
  value,
  options,
  altText,
  disabled,
  onChange,
  onUploaded,
}: {
  label: string;
  value: string | null;
  options: Option[];
  altText: string;
  disabled?: boolean;
  onChange: (id: string | null) => void;
  onUploaded: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [owned, setOwned] = useState(false),
    [error, setError] = useState('');
  async function upload(file: File) {
    const problem = imageFileError(file);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('altText', altText.trim() || file.name);
      form.set('rightsStatus', owned ? 'owned' : 'unknown');
      const response = await fetch('/api/admin/media', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? 'The image could not be uploaded.');
      onUploaded();
      onChange(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const choices =
    value && !options.some((o) => o.value === value)
      ? [{ value, label: 'Current image' }, ...options]
      : options;
  return (
    <fieldset className="pb-image admin-field-wide" disabled={disabled || busy}>
      <legend>{label}</legend>
      {value && (
        <span
          className="pb-image-preview"
          role="img"
          aria-label={`Current ${label.toLowerCase()}`}
          style={{ backgroundImage: `url(/api/media/${value})` }}
        />
      )}
      <FieldInput
        field={{
          key: 'image',
          label: 'Choose an uploaded image',
          type: 'select',
          nullable: true,
          options: choices,
        }}
        value={value}
        onChange={(v) => onChange((v as string | null) || null)}
      />
      <label className="pb-upload">
        Or upload a new image (PNG, JPEG or WebP, up to 5 MB)
        <input
          type="file"
          accept={IMAGE_TYPES.join(',')}
          aria-invalid={!!error}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
      </label>
      <label className="pb-check">
        <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />
        We own the rights to images I upload here
      </label>
      {busy && <small role="status">Uploading…</small>}
      {error && (
        <small role="alert" className="pb-field-error">
          {error}
        </small>
      )}
    </fieldset>
  );
}

// ——— New product ———

export function NewProductDialog({
  open,
  onOpenChange,
  products,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Entry[];
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New product"
      description="It starts as a copy of an existing product, with the same parts, options and fabrics, and stays hidden from customers until you show it."
      className="admin-dialog"
    >
      <NewProductForm
        products={products}
        onCancel={() => onOpenChange(false)}
        onCreated={onCreated}
      />
    </Dialog>
  );
}
function NewProductForm({
  products,
  onCancel,
  onCreated,
}: {
  products: Entry[];
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(''),
    [source, setSource] = useState(products[0]?.id ?? ''),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState('');
  const checks = useChecks(() => ({
    name: nameError(
      name,
      products.map((p) => p.name),
      'product',
    ),
    source: source ? null : 'Choose a product to start from.',
  }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!checks.check(form.current)) return;
    setBusy(true);
    try {
      const row = await adminFetch(`/api/admin/catalog/products/${source}/copy`, 'POST', {
        name: name.trim(),
      });
      catalogSaved();
      onCreated(row.id);
    } catch (error) {
      const result = serverErrors(error, { name: 'name' });
      checks.setServer(result.fields);
      setFormError(result.form);
      focusFirstInvalid(form.current);
      setBusy(false);
    }
  }
  return (
    <form ref={form} noValidate onSubmit={submit} className="pb-dialog-form">
      <FormAlert message={formError} />
      <Field label="Name" error={checks.shown('name')}>
        {(props) => (
          <input
            {...props}
            data-autofocus
            maxLength={250}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              checks.clearServer('name');
            }}
            onBlur={() => checks.touch('name')}
          />
        )}
      </Field>
      <Field label="Start from" error={checks.shown('source')}>
        {(props) => (
          <select {...props} value={source} onChange={(e) => setSource(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Actions busy={busy} submit="Create product" onCancel={onCancel} />
    </form>
  );
}

// ——— Add a category ———

export function AddCategoryDialog({
  open,
  onOpenChange,
  productId,
  available,
  allNames,
  currency,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  /** Categories not yet in this product. */
  available: Entry[];
  /** Every category name, for the duplicate check. */
  allNames: string[];
  currency: string;
  onDone: (message: string) => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a category"
      description="A category is a part of the garment, such as a jacket or a vest."
      className="admin-dialog"
    >
      <AddCategoryForm
        productId={productId}
        available={available}
        allNames={allNames}
        currency={currency}
        onCancel={() => onOpenChange(false)}
        onDone={onDone}
      />
    </Dialog>
  );
}
function AddCategoryForm({
  productId,
  available,
  allNames,
  currency,
  onCancel,
  onDone,
}: {
  productId: string;
  available: Entry[];
  allNames: string[];
  currency: string;
  onCancel: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [existing, setExisting] = useState(''),
    [name, setName] = useState(''),
    [piece, setPiece] = useState('jacket'),
    [optional, setOptional] = useState(false),
    [price, setPrice] = useState('0.00'),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState('');
  const creating = !existing;
  const priced = priceResult(price);
  const checks = useChecks(() => ({
    name: creating ? nameError(name, allNames, 'category') : null,
    price: optional && 'error' in priced ? priced.error : null,
  }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!checks.check(form.current)) return;
    setBusy(true);
    try {
      const create = (code: string) =>
        adminFetch('/api/admin/catalog/components', 'POST', {
          code,
          name: name.trim(),
          visualPart: piece,
          status: 'active',
        });
      const code = codeFromName(name) || piece;
      // A readable code first; a short suffix only when that code is taken.
      const componentId = creating
        ? (
            await create(code).catch((error: AdminError) => {
              if (error.code !== 'code_taken') throw error;
              return create(`${code}-${crypto.randomUUID().slice(0, 4)}`);
            })
          ).id
        : existing;
      await adminFetch(
        `/api/admin/catalog/products/${productId}/components/${componentId}`,
        'PUT',
        {
          required: !optional,
          defaultIncluded: !optional,
          surchargeMinor: optional && 'minor' in priced ? priced.minor : 0,
        },
      );
      await onDone(
        `${creating ? name.trim() : available.find((c) => c.id === existing)?.name} added.`,
      );
    } catch (error) {
      const result = serverErrors(error, { name: 'name', surchargeMinor: 'price' });
      checks.setServer(result.fields);
      setFormError(result.form);
      focusFirstInvalid(form.current);
      setBusy(false);
    }
  }
  return (
    <form ref={form} noValidate onSubmit={submit} className="pb-dialog-form">
      <FormAlert message={formError} />
      <Field label="Category">
        {(props) => (
          <select {...props} value={existing} onChange={(e) => setExisting(e.target.value)}>
            <option value="">A new category…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {creating && (
        <>
          <Field label="Name" error={checks.shown('name')}>
            {(props) => (
              <input
                {...props}
                data-autofocus
                maxLength={250}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  checks.clearServer('name');
                }}
                onBlur={() => checks.touch('name')}
              />
            )}
          </Field>
          <Field label="Drawn as" hint="Which garment drawing shows this part.">
            {(props) => (
              <select {...props} value={piece} onChange={(e) => setPiece(e.target.value)}>
                {PIECES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </>
      )}
      <fieldset className="pb-radio-group">
        <legend>How it is sold</legend>
        <label className="pb-check">
          <input type="radio" checked={!optional} onChange={() => setOptional(false)} />
          Always included
        </label>
        <label className="pb-check">
          <input type="radio" checked={optional} onChange={() => setOptional(true)} />
          Optional extra the customer can add
        </label>
      </fieldset>
      {optional && (
        <PriceField
          label={`Adds (${currency})`}
          value={price}
          error={checks.shown('price')}
          hint="0 means it is added at no charge."
          onChange={(text) => {
            setPrice(text);
            checks.clearServer('price');
          }}
          onBlur={() => checks.touch('price')}
        />
      )}
      <Actions busy={busy} submit="Add category" onCancel={onCancel} />
    </form>
  );
}

// ——— Add a subcategory ———

export function AddSubcategoryDialog({
  open,
  onOpenChange,
  componentId,
  partName,
  takenNames,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentId: string;
  partName: string;
  /** Subcategory names already in this part. */
  takenNames: string[];
  onCreated: (groupId: string, attributeId: string) => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add a ${partName} subcategory`}
      description="For example “Lapel style”. You add its choices next."
      className="admin-dialog"
    >
      <AddSubcategoryForm
        componentId={componentId}
        takenNames={takenNames}
        onCancel={() => onOpenChange(false)}
        onCreated={onCreated}
      />
    </Dialog>
  );
}
function AddSubcategoryForm({
  componentId,
  takenNames,
  onCancel,
  onCreated,
}: {
  componentId: string;
  takenNames: string[];
  onCancel: () => void;
  onCreated: (groupId: string, attributeId: string) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(''),
    [kind, setKind] = useState<'style' | 'accent'>('style'),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState('');
  const checks = useChecks(() => ({ name: nameError(name, takenNames, 'subcategory') }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!checks.check(form.current)) return;
    setBusy(true);
    try {
      const created = await adminFetch<{ group: Entry; attribute: Entry }>(
        `/api/admin/catalog/components/${componentId}/subcategories`,
        'POST',
        { name: name.trim(), kind },
      );
      await onCreated(created.group.id, created.attribute.id);
    } catch (error) {
      const result = serverErrors(error, { name: 'name' });
      checks.setServer(result.fields);
      setFormError(result.form);
      focusFirstInvalid(form.current);
      setBusy(false);
    }
  }
  return (
    <form ref={form} noValidate onSubmit={submit} className="pb-dialog-form">
      <FormAlert message={formError} />
      <Field label="Name" error={checks.shown('name')}>
        {(props) => (
          <input
            {...props}
            data-autofocus
            maxLength={250}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              checks.clearServer('name');
            }}
            onBlur={() => checks.touch('name')}
          />
        )}
      </Field>
      <fieldset className="pb-radio-group">
        <legend>Shown under</legend>
        <label className="pb-check">
          <input type="radio" checked={kind === 'style'} onChange={() => setKind('style')} />
          Style
        </label>
        <label className="pb-check">
          <input type="radio" checked={kind === 'accent'} onChange={() => setKind('accent')} />
          Accents
        </label>
      </fieldset>
      <Actions busy={busy} submit="Add and choose its choices" onCancel={onCancel} />
    </form>
  );
}

// ——— A subcategory and its choices ———

export type ChoiceView =
  { mode: 'grid' } | { mode: 'add'; attributeId: string } | { mode: 'edit'; valueId: string };

export function SubcategoryDialog({
  open,
  group,
  takenNames,
  productId,
  currency,
  images,
  canWrite,
  setting,
  initialView = { mode: 'grid' },
  onChanged,
  onUploaded,
  onClose,
}: {
  open: boolean;
  group: Group;
  /** Other subcategory names in the same part. */
  takenNames: string[];
  productId: string;
  currency: string;
  images: Option[];
  canWrite: boolean;
  setting: (scope: string, targetId: string) => Entry | undefined;
  initialView?: ChoiceView;
  /** Reloads the product after a saved change. */
  onChanged: () => Promise<void>;
  onUploaded: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<ChoiceView>(initialView),
    [notice, setNotice] = useState(''),
    // Focus follows the switch between the grid and a choice form: the form's
    // name field, then back to the button that opened it.
    [returnTo, setReturnTo] = useState(''),
    [switched, setSwitched] = useState(false);
  const switchTo = (next: ChoiceView, from: string) => {
    setReturnTo(from);
    setSwitched(true);
    setView(next);
  };
  const attributes = group.attributes.filter((a) => a.status !== 'archived');
  const values = attributes.flatMap((a) => a.values);
  const editing = view.mode === 'edit' ? values.find((v) => v.id === view.valueId) : undefined;
  const attribute =
    view.mode === 'add'
      ? attributes.find((a) => a.id === view.attributeId)
      : editing
        ? attributes.find((a) => a.values.includes(editing))
        : undefined;
  const title =
    view.mode === 'add' && attribute
      ? `Add a choice to ${attribute.name}`
      : editing
        ? `Edit “${editing.label}”`
        : String(group.name);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      description={
        view.mode === 'grid'
          ? 'Names, images and prices are shared by every product with this category. The ticks apply to this product only.'
          : undefined
      }
      className="admin-dialog admin-dialog-wide"
    >
      {view.mode !== 'grid' && attribute ? (
        <ChoiceForm
          key={view.mode === 'edit' ? view.valueId : view.attributeId}
          attribute={attribute}
          value={editing}
          productId={productId}
          currency={currency}
          images={images}
          focusName={switched}
          onUploaded={onUploaded}
          onCancel={() => setView({ mode: 'grid' })}
          onSaved={async (message) => {
            await onChanged();
            setNotice(message);
            setView({ mode: 'grid' });
          }}
        />
      ) : (
        <ChoiceGrid
          group={group}
          attributes={attributes}
          takenNames={takenNames}
          productId={productId}
          currency={currency}
          canWrite={canWrite}
          setting={setting}
          notice={notice}
          setNotice={setNotice}
          onChanged={onChanged}
          focusOn={switched ? returnTo : ''}
          onAdd={(attributeId) => switchTo({ mode: 'add', attributeId }, `add-${attributeId}`)}
          onEdit={(valueId) => switchTo({ mode: 'edit', valueId }, `edit-${valueId}`)}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function ChoiceGrid({
  group,
  attributes,
  takenNames,
  productId,
  currency,
  canWrite,
  setting,
  notice,
  setNotice,
  focusOn,
  onChanged,
  onAdd,
  onEdit,
  onClose,
}: {
  group: Group;
  attributes: Attribute[];
  takenNames: string[];
  productId: string;
  currency: string;
  canWrite: boolean;
  setting: (scope: string, targetId: string) => Entry | undefined;
  notice: string;
  setNotice: (message: string) => void;
  /** The control to focus when coming back from a choice form. */
  focusOn: string;
  onChanged: () => Promise<void>;
  onAdd: (attributeId: string) => void;
  onEdit: (valueId: string) => void;
  onClose: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusOn) return;
    const target =
      box.current?.querySelector<HTMLElement>(`[data-return="${focusOn}"]`) ??
      box.current?.querySelector<HTMLElement>('[data-return="done"]');
    target?.focus();
    // Only when the grid comes back into view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [name, setName] = useState(String(group.name)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    // Ticks show at once; the saved state replaces them when the product reloads.
    [pending, setPending] = useState<Record<string, boolean>>({});
  const checks = useChecks(() => ({ name: nameError(name, takenNames, 'subcategory') }));
  const isOn = (v: Value) => pending[v.id] ?? setting('value', v.id)?.available !== false;

  async function act(change: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await change();
      await onChanged();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
      await onChanged();
    } finally {
      setBusy(false);
      setPending({});
    }
  }
  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!checks.check(form.current)) return;
    const text = name.trim();
    await act(async () => {
      await adminFetch(`/api/admin/catalog/groups/${group.id}`, 'PATCH', {
        name: text,
        shortName: text.slice(0, 120),
        rowVersion: group.rowVersion,
      });
      // A subcategory with one option of the same name keeps them matched.
      const [only] = attributes;
      if (attributes.length === 1 && only.name === group.name)
        await adminFetch(`/api/admin/catalog/attributes/${only.id}`, 'PATCH', {
          name: text,
          rowVersion: only.rowVersion,
        });
    }, `Renamed to ${text}.`);
  }
  function toggle(attribute: Attribute, value: Value, on: boolean) {
    const onCount = live(attribute.values).filter(isOn).length;
    const problem = on ? null : choiceOffError(value, onCount);
    if (problem) {
      setNotice('');
      return setError(problem);
    }
    setPending((all) => ({ ...all, [value.id]: on }));
    const own = setting('value', value.id);
    void act(
      () =>
        on && !own
          ? Promise.resolve()
          : adminFetch(`/api/admin/catalog/products/${productId}/settings`, 'PUT', {
              items: [
                on
                  ? { scope: 'value', targetId: value.id, remove: true }
                  : { scope: 'value', targetId: value.id, available: false },
              ],
            }),
      `${value.label} is ${on ? 'on' : 'off'} for this product.`,
    );
  }
  function makeDefault(value: Value) {
    if (!isOn(value)) {
      setNotice('');
      return setError(`Turn “${value.label}” on for this product before making it the default.`);
    }
    void act(
      () =>
        adminFetch(`/api/admin/catalog/values/${value.id}`, 'PATCH', {
          isDefault: true,
          rowVersion: value.rowVersion,
        }),
      `${value.label} is now the default.`,
    );
  }
  function remove(value: Value) {
    if (value.isDefault) {
      setNotice('');
      return setError('Make another choice the default before removing this one.');
    }
    if (!window.confirm(`Remove “${value.label}” from every product?`)) return;
    void act(
      () =>
        adminFetch(`/api/admin/catalog/values/${value.id}`, 'PATCH', {
          status: 'archived',
          rowVersion: value.rowVersion,
        }),
      `Removed ${value.label}.`,
    );
  }

  return (
    <div className="pb-dialog-form" ref={box}>
      {canWrite && (
        <form ref={form} noValidate onSubmit={rename} className="pb-rename">
          <Field label="Subcategory name" error={checks.shown('name')}>
            {(props) => (
              <input
                {...props}
                maxLength={250}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => checks.touch('name')}
              />
            )}
          </Field>
          <button type="submit" disabled={busy || name.trim() === group.name}>
            Save name
          </button>
        </form>
      )}
      {notice && (
        <p role="status" className="pb-form-notice">
          {notice}
        </p>
      )}
      <FormAlert message={error} />
      {attributes.map((attribute) => {
        const rows = live(attribute.values);
        return (
          <section key={attribute.id} className="pb-attribute" aria-label={attribute.name}>
            {(attributes.length > 1 || attribute.status !== 'active') && (
              <h3>
                {attribute.name}
                {attribute.status !== 'active' && <small> · draft, not shown to customers</small>}
                {!!attribute.visibleWhen && <small> · shown only after an earlier choice</small>}
              </h3>
            )}
            {attribute.inputType === 'text' ? (
              <p>Customers type their own text here.</p>
            ) : (
              <>
                {rows.length ? (
                  <div
                    className="admin-table-wrap"
                    role="region"
                    aria-label={`${attribute.name} choices`}
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Choice</th>
                          <th scope="col">Extra price</th>
                          <th scope="col">Default</th>
                          <th scope="col">On this product</th>
                          <th scope="col">Image</th>
                          {canWrite && (
                            <th scope="col">
                              <span className="sr-only">Actions</span>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((value) => (
                          <tr key={value.id} className={isOn(value) ? undefined : 'pb-off'}>
                            <td>{value.label}</td>
                            <td>
                              {value.surchargeMinor > 0
                                ? `+${formatPrice(value.surchargeMinor, currency)}`
                                : 'Included'}
                            </td>
                            <td>
                              <input
                                type="radio"
                                name={`default-${attribute.id}`}
                                aria-label={`Make ${value.label} the default`}
                                checked={value.isDefault}
                                disabled={!canWrite || busy}
                                onChange={() => makeDefault(value)}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Offer ${value.label} on this product`}
                                checked={isOn(value)}
                                disabled={!canWrite || busy}
                                onChange={(e) => toggle(attribute, value, e.target.checked)}
                              />
                            </td>
                            <td>
                              {value.imageMediaId ? (
                                <span
                                  className="admin-thumb"
                                  role="img"
                                  aria-label={`${value.label} image`}
                                  style={{
                                    backgroundImage: `url(/api/media/${value.imageMediaId})`,
                                  }}
                                />
                              ) : (
                                <span className="pb-muted">None</span>
                              )}
                            </td>
                            {canWrite && (
                              <td className="pb-row-actions">
                                <button
                                  type="button"
                                  data-return={`edit-${value.id}`}
                                  disabled={busy}
                                  onClick={() => onEdit(value.id)}
                                >
                                  Edit<span className="sr-only"> {value.label}</span>
                                </button>
                                <button type="button" disabled={busy} onClick={() => remove(value)}>
                                  Remove<span className="sr-only"> {value.label}</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="pb-muted">No choices yet.</p>
                )}
                {canWrite && (
                  <button
                    type="button"
                    className="pb-add"
                    data-return={`add-${attribute.id}`}
                    disabled={busy}
                    onClick={() => onAdd(attribute.id)}
                  >
                    + Add a choice
                    {attributes.length > 1 && <span className="sr-only"> to {attribute.name}</span>}
                  </button>
                )}
              </>
            )}
          </section>
        );
      })}
      <div className="dialog-actions">
        <button type="button" className="admin-primary" data-return="done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function ChoiceForm({
  attribute,
  value,
  productId,
  currency,
  images,
  focusName,
  onUploaded,
  onCancel,
  onSaved,
}: {
  attribute: Attribute;
  /** The choice being edited; absent when adding. */
  value?: Value;
  productId: string;
  currency: string;
  images: Option[];
  /** Move focus to the name field (when switched to from the grid). */
  focusName: boolean;
  onUploaded: () => void;
  onCancel: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusName) nameField.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onNote = useId();
  const others = live(attribute.values).filter((v) => v.id !== value?.id);
  const [label, setLabel] = useState(value?.label ?? ''),
    [price, setPrice] = useState(minorToDecimal(value?.surchargeMinor ?? 0)),
    [image, setImage] = useState<string | null>(value?.imageMediaId ?? null),
    [isDefault, setIsDefault] = useState(value?.isDefault ?? !others.length),
    [on, setOn] = useState(true),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState('');
  const priced = priceResult(price);
  const checks = useChecks(() => ({
    label: nameError(
      label,
      others.map((v) => v.label),
      'choice',
    ),
    price: 'error' in priced ? priced.error : null,
    on: isDefault && !on ? 'A default choice must be on for this product.' : null,
  }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!checks.check(form.current) || !('minor' in priced)) return;
    setBusy(true);
    const text = label.trim();
    try {
      if (value) {
        const saved = await adminFetch(`/api/admin/catalog/values/${value.id}`, 'PATCH', {
          label: text,
          surchargeMinor: priced.minor,
          imageMediaId: image,
          rowVersion: value.rowVersion,
        });
        if (isDefault && !value.isDefault)
          await adminFetch(`/api/admin/catalog/values/${value.id}`, 'PATCH', {
            isDefault: true,
            rowVersion: saved.rowVersion,
          });
      } else {
        const created = await adminFetch(
          `/api/admin/catalog/attributes/${attribute.id}/values`,
          'POST',
          {
            label: text,
            surchargeMinor: priced.minor,
            imageMediaId: image,
            isDefault,
            status: 'active',
          },
        );
        if (!on)
          await adminFetch(`/api/admin/catalog/products/${productId}/settings`, 'PUT', {
            items: [{ scope: 'value', targetId: created.id, available: false }],
          });
      }
      await onSaved(value ? `Saved ${text}.` : `Added ${text}.`);
    } catch (error) {
      const result = serverErrors(error, {
        label: 'label',
        code: 'label',
        surchargeMinor: 'price',
      });
      checks.setServer(result.fields);
      setFormError(result.form);
      focusFirstInvalid(form.current);
      setBusy(false);
    }
  }
  return (
    <form ref={form} noValidate onSubmit={submit} className="pb-dialog-form">
      <FormAlert message={formError} />
      <Field label="Choice name" error={checks.shown('label')}>
        {(props) => (
          <input
            {...props}
            ref={nameField}
            data-autofocus
            maxLength={250}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              checks.clearServer('label');
            }}
            onBlur={() => checks.touch('label')}
          />
        )}
      </Field>
      <PriceField
        label={`Extra price (${currency})`}
        value={price}
        error={checks.shown('price')}
        hint="0 means the choice is included in the price."
        onChange={(text) => {
          setPrice(text);
          checks.clearServer('price');
        }}
        onBlur={() => checks.touch('price')}
      />
      <ImagePicker
        label="Image"
        value={image}
        options={images}
        altText={label}
        onChange={setImage}
        onUploaded={onUploaded}
      />
      <label className="pb-check">
        <input
          type="checkbox"
          checked={isDefault}
          disabled={value?.isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        Default choice
      </label>
      {value?.isDefault && (
        <small className="pb-muted">To change the default, make another choice the default.</small>
      )}
      {!value && (
        <div className="pb-field">
          <label className="pb-check">
            <input
              type="checkbox"
              checked={on}
              aria-invalid={!!checks.shown('on')}
              aria-describedby={checks.shown('on') ? onNote : undefined}
              onChange={(e) => {
                setOn(e.target.checked);
                checks.touch('on');
              }}
            />
            Offer it on this product
          </label>
          {checks.shown('on') && (
            <small id={onNote} className="pb-field-error">
              {checks.shown('on')}
            </small>
          )}
        </div>
      )}
      <Actions
        busy={busy}
        submit={value ? 'Save choice' : 'Add choice'}
        onCancel={onCancel}
        cancel="Back to choices"
      />
    </form>
  );
}
