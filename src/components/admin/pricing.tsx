'use client';
import { useState } from 'react';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import {
  adminFetch,
  useAdminData,
  RecordEditor,
  FieldInput,
  MoneyField,
  PageTitle,
  options,
  type Entry,
} from './editor';
import { Simulator } from './catalog-tools';
type Pricing = {
  currency: string;
  bands: (Entry & { upliftMinor: number; materialCount: number; description: string })[];
};
export function PricingEditor({ canWrite }: { canWrite: boolean }) {
  return (
    <>
      <PageTitle
        title="Pricing"
        description="A product's price is its base price plus the amount its fabric tier adds."
      />
      <PriceTiers canWrite={canWrite} />
      <Simulator />
    </>
  );
}
/**
 * D-022: each fabric price tier adds one fixed amount to a product's base
 * price. Tiers themselves are fixed; only their names and amounts change here.
 */
export function PriceTiers({ canWrite, onSaved }: { canWrite: boolean; onSaved?: () => void }) {
  const data = useAdminData<Pricing>('/api/admin/pricing');
  if (data.error) return <p role="alert">{data.error}</p>;
  if (!data.data) return <p role="status">Loading price tiers…</p>;
  return (
    <TierForm
      key={JSON.stringify(data.data.bands)}
      initial={data.data}
      canWrite={canWrite}
      saved={async () => {
        await data.load();
        onSaved?.();
      }}
    />
  );
}
function TierForm({
  initial,
  canWrite,
  saved,
}: {
  initial: Pricing;
  canWrite: boolean;
  saved: () => Promise<void>;
}) {
  const [bands, setBands] = useState(initial.bands),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(bands) !== JSON.stringify(initial.bands);
  const change = (code: string, patch: Partial<Pricing['bands'][number]>) =>
    setBands((all) => all.map((b) => (b.code === code ? { ...b, ...patch } : b)));
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await adminFetch('/api/admin/pricing/bands', 'PUT', {
        items: bands.map((b) => ({
          code: b.code,
          name: b.name,
          description: b.description,
          sort: Number(b.sort),
          upliftMinor: b.upliftMinor,
        })),
      });
      window.dispatchEvent(new Event('catalog-saved'));
      await saved();
      setMessage('Price tiers saved.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card pb-section" id="price-tiers" aria-labelledby="price-tiers-title">
      <h2 id="price-tiers-title">Fabric price tiers</h2>
      <p>
        Every fabric belongs to one tier. A product costs its base price plus the amount its
        fabric’s tier adds.
      </p>
      {bands.length ? (
        <fieldset disabled={!canWrite || busy}>
          <div className="admin-table-wrap" role="region" aria-label="Tier amounts" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Tier</th>
                  <th scope="col">Adds ({initial.currency})</th>
                  <th scope="col">Fabrics</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band) => (
                  <tr key={band.code}>
                    <td>
                      <input
                        aria-label={`Name of tier ${band.code}`}
                        required
                        maxLength={200}
                        value={band.name}
                        onChange={(e) => change(band.code, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <MoneyField
                        label={`Amount ${band.name} adds`}
                        value={band.upliftMinor}
                        onChange={(v) => change(band.code, { upliftMinor: Number(v) || 0 })}
                      />
                    </td>
                    <td>{band.materialCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canWrite && (
            <div className="admin-form-actions">
              <button
                className="admin-primary"
                type="button"
                disabled={!dirty || bands.some((b) => !b.name.trim())}
                onClick={() => void save()}
              >
                {busy ? 'Saving…' : 'Save tiers'}
              </button>
              {dirty && <small>Unsaved changes</small>}
            </div>
          )}
        </fieldset>
      ) : (
        <p>No price tiers exist yet.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function CommerceSettings({ canWrite }: { canWrite: boolean }) {
  const data = useAdminData<Entry>('/api/admin/settings/commerce');
  return (
    <section className="admin-card">
      <h2>Commerce</h2>
      {data.data && (
        <>
          {!data.data.confirmed && (
            <p className="admin-chip">Unconfirmed placeholders — review before customer release</p>
          )}
          <RecordEditor
            key={data.data.rowVersion}
            record={data.data}
            fields={[
              {
                key: 'currency',
                label: 'Currency',
                type: 'select',
                options: options(SUPPORTED_CURRENCIES),
                help: 'Locked after the first order.',
              },
              { key: 'shippingFlatMinor', label: 'Delivery fee', type: 'money' },
              {
                key: 'quoteTtlMinutes',
                label: 'Quote validity (minutes)',
                type: 'number',
                min: 60,
                max: 43200,
              },
              { key: 'orderNumberPrefix', label: 'Order prefix', max: 4 },
              {
                key: 'opsTimezone',
                label: 'Operations timezone',
                help: 'IANA name, for example Asia/Karachi',
              },
            ]}
            url="/api/admin/settings/commerce"
            canWrite={canWrite}
            transform={(draft) => ({
              currency: draft.currency,
              shippingFlatMinor: draft.shippingFlatMinor,
              quoteTtlMinutes: draft.quoteTtlMinutes,
              orderNumberPrefix: draft.orderNumberPrefix,
              opsTimezone: draft.opsTimezone,
              shipCountries: draft.shipCountries,
            })}
            onSaved={(row) => {
              data.setData(row);
              window.dispatchEvent(new Event('catalog-saved'));
            }}
          >
            {(draft, set) => (
              <FieldInput
                field={{
                  key: 'countries',
                  label: 'Ship-to countries',
                  help: 'ISO two-letter codes, separated by commas.',
                }}
                value={((draft.shipCountries as string[]) ?? []).join(', ')}
                onChange={(v) =>
                  set(
                    'shipCountries',
                    String(v)
                      .split(',')
                      .map((c) => c.trim().toUpperCase())
                      .filter(Boolean),
                  )
                }
              />
            )}
          </RecordEditor>
        </>
      )}
      {data.error && <p role="alert">{data.error}</p>}
    </section>
  );
}
