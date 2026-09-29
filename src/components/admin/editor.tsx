'use client';
import { useCallback, useEffect, useRef, useState, useId, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { parseMoney } from '@/lib/money';
export type Entry = Record<string, unknown> & {
  id: string;
  rowVersion: number;
  code: string;
  name: string;
  status: string;
  firstPublishedVersion?: number | null;
  badges?: { errors: string[]; warnings: string[] };
};
export class AdminError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: { current?: Entry; fields?: { path: string; message: string }[] },
  ) {
    super(message);
  }
}
export async function adminFetch<T = Entry>(
  url: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    ...(data !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
      : {}),
  });
  const value = await response.json();
  if (!response.ok)
    throw new AdminError(
      value.error?.message ?? 'The change could not be saved.',
      value.error?.code ?? 'unknown',
      value.error?.details,
    );
  return value;
}
export function useAdminData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState('');
  const active = useRef(true);
  const load = useCallback(async () => {
    if (!url) return null;
    try {
      const next = await adminFetch<T>(url);
      if (active.current) {
        setData(next);
        setError('');
      }
      return next;
    } catch (e) {
      if (active.current) setError((e as Error).message);
      return null;
    }
  }, [url]);
  useEffect(() => {
    if (!url) return;
    active.current = true;
    let cancelled = false;
    adminFetch<T>(url)
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [url]);
  return { data, error, load, setData };
}
export type Option = { value: string; label: string };
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'money' | 'checkbox' | 'select' | 'multi' | 'colour';
  options?: Option[];
  required?: boolean;
  max?: number;
  min?: number;
  help?: string;
  nullable?: boolean;
  section?: string;
  disabled?: boolean;
};
export const options = (values: readonly string[]): Option[] =>
  values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
export const entryOptions = (rows: Entry[]): Option[] =>
  rows.map((r) => ({ value: r.id, label: r.name || String(r.label) || r.code }));
export function FieldInput({
  field,
  value,
  onChange,
  disabled = false,
  error,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  const type = field.type ?? 'text';
  const props = {
    id,
    disabled: disabled || field.disabled,
    required: field.required,
    'aria-invalid': !!error,
    'aria-describedby': `${id}-help`,
  };
  return (
    <div className={`admin-field ${type === 'textarea' ? 'admin-field-wide' : ''}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      {type === 'checkbox' ? (
        <input
          {...props}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : type === 'select' || type === 'multi' ? (
        <select
          {...props}
          multiple={type === 'multi'}
          value={type === 'multi' ? ((value as string[]) ?? []) : String(value ?? '')}
          onChange={(e) =>
            onChange(
              type === 'multi'
                ? Array.from(e.target.selectedOptions).map((o) => o.value)
                : e.target.value || (field.nullable ? null : ''),
            )
          }
        >
          {type !== 'multi' && <option value="">Choose…</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <>
          <textarea
            {...props}
            rows={4}
            maxLength={field.max}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.max && (
            <small>
              {String(value ?? '').length} / {field.max}
            </small>
          )}
        </>
      ) : type === 'money' ? (
        <MoneyField
          id={id}
          value={typeof value === 'number' ? value : null}
          disabled={disabled || field.disabled}
          nullable={field.nullable}
          onChange={onChange}
        />
      ) : (
        <div className={type === 'colour' ? 'admin-colour' : ''}>
          {type === 'colour' && (
            <input
              aria-label={`${field.label} picker`}
              type="color"
              value={String(value || '#000000')}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
          <input
            {...props}
            type={type === 'number' ? 'number' : 'text'}
            min={field.min}
            max={type === 'number' ? field.max : undefined}
            maxLength={type !== 'number' ? field.max : undefined}
            value={String(value ?? '')}
            onChange={(e) =>
              onChange(
                type === 'number'
                  ? e.target.value === ''
                    ? null
                    : Number(e.target.value)
                  : e.target.value || (field.nullable ? null : ''),
              )
            }
          />
        </div>
      )}
      <small id={`${id}-help`}>{error || field.help}</small>
    </div>
  );
}
function MoneyField({
  id,
  value,
  onChange,
  disabled,
  nullable,
}: {
  id: string;
  value: number | null;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  nullable?: boolean;
}) {
  const [text, setText] = useState(value === null ? '' : (value / 100).toFixed(2));
  const [committed, setCommitted] = useState(value);
  const [error, setError] = useState('');
  return (
    <>
      <input
        id={id}
        inputMode="decimal"
        disabled={disabled}
        value={value === committed ? text : value === null ? '' : (value / 100).toFixed(2)}
        placeholder={nullable ? 'Not priced' : '0.00'}
        aria-invalid={!!error}
        onChange={(e) => {
          setText(e.target.value);
          try {
            if (!e.target.value && nullable) {
              onChange(null);
              setCommitted(null);
              setError('');
              e.target.setCustomValidity('');
              return;
            }
            onChange(parseMoney(e.target.value));
            setCommitted(parseMoney(e.target.value));
            setError('');
            e.target.setCustomValidity('');
          } catch {
            setError('Enter an amount with at most two decimal places.');
            e.target.setCustomValidity('Enter a valid amount.');
          }
        }}
      />
      {error && <small role="alert">{error}</small>}
    </>
  );
}
export function Badges({ value }: { value?: Entry['badges'] }) {
  return (
    <span className="admin-badges">
      {!!value?.errors.length && (
        <span className="admin-badge-error" title={value.errors.join(', ')}>
          {value.errors.length} errors
        </span>
      )}
      {!!value?.warnings.length && (
        <span className="admin-badge-warning" title={value.warnings.join(', ')}>
          {value.warnings.length} warnings
        </span>
      )}
    </span>
  );
}
export function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="admin-title">
      <p className="admin-eyebrow">WORKROOM / CATALOG</p>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    const navigate = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href]');
      if (link && !window.confirm('Discard your unsaved changes?')) e.preventDefault();
    };
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', handler);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty]);
}
export function RecordEditor({
  record,
  fields,
  url,
  method = 'PATCH',
  canWrite = true,
  onSaved,
  children,
  transform,
  onDirty,
}: {
  record: Entry;
  fields: Field[];
  url: string;
  method?: string;
  canWrite?: boolean;
  onSaved: (entry: Entry) => void;
  children?: (draft: Entry, set: (key: string, value: unknown) => void) => ReactNode;
  transform?: (draft: Entry) => Record<string, unknown>;
  onDirty?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(record),
    [error, setError] = useState(''),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [theirs, setTheirs] = useState<Entry | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(record);
  useDirtyGuard(dirty);
  const change = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }));
    onDirty?.(true);
  };
  async function save(expected = record.rowVersion) {
    setBusy(true);
    setError('');
    try {
      const data = transform
        ? transform(draft)
        : Object.fromEntries(
            fields
              .filter((f) => !f.disabled)
              .map((f) => [f.key, draft[f.key]])
              .filter(([, v]) => v !== undefined),
          );
      const saved = await adminFetch<Entry>(url, method, {
        ...data,
        ...(method === 'PATCH' ? { rowVersion: expected } : {}),
      });
      onDirty?.(false);
      setTheirs(null);
      onSaved(saved);
      setDraft(saved);
    } catch (e) {
      const failure = e as AdminError;
      setError(failure.message);
      setFieldErrors(
        Object.fromEntries(failure.details?.fields?.map((f) => [f.path, f.message]) ?? []),
      );
      if (failure.code === 'stale_row_version' && failure.details?.current)
        setTheirs(failure.details.current);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        className="admin-record-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || !canWrite}>
          <div className="admin-fields">
            {fields.map((field, i) => (
              <div
                key={field.key}
                className={field.type === 'textarea' ? 'admin-field-wide' : undefined}
              >
                {field.section && field.section !== fields[i - 1]?.section && (
                  <h3>{field.section}</h3>
                )}
                <FieldInput
                  field={{
                    ...field,
                    disabled:
                      field.disabled || (field.key === 'code' && !!record.firstPublishedVersion),
                  }}
                  value={draft[field.key]}
                  onChange={(value) => change(field.key, value)}
                  error={fieldErrors[field.key]}
                />
              </div>
            ))}
          </div>
          {children?.(draft, change)}
          {canWrite && (
            <div className="admin-form-actions">
              <button className="admin-primary" type="submit">
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(record);
                  setError('');
                  onDirty?.(false);
                }}
              >
                Discard
              </button>
              {dirty && <small>Unsaved changes</small>}
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
      </form>
      <Dialog
        open={!!theirs}
        onOpenChange={(open) => !open && setTheirs(null)}
        title="Someone else changed this — review their version"
      >
        <div
          className="admin-table-wrap"
          role="region"
          aria-label="Conflicting fields"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Theirs</th>
                <th>Yours</th>
              </tr>
            </thead>
            <tbody>
              {fields
                .filter((f) => JSON.stringify(draft[f.key]) !== JSON.stringify(theirs?.[f.key]))
                .map((f) => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>{JSON.stringify(theirs?.[f.key])}</td>
                    <td>{JSON.stringify(draft[f.key])}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => {
            if (theirs) {
              onSaved(theirs);
              setDraft(theirs);
              onDirty?.(false);
            }
            setTheirs(null);
          }}
        >
          Keep theirs
        </button>
        <button onClick={() => void save(theirs!.rowVersion)}>Apply mine again</button>
      </Dialog>
    </>
  );
}
