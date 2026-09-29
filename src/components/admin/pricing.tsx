'use client';
import { useState } from 'react';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import {
  adminFetch,
  useAdminData,
  RecordEditor,
  FieldInput,
  PageTitle,
  options,
  type Entry,
} from './editor';
import { Simulator } from './catalog-tools';
type Pricing = {
  currency: string;
  bands: Entry[];
  matrix: {
    productId: string;
    productCode: string;
    productName: string;
    prices: Record<string, number | null>;
  }[];
};
export function PricingEditor({ canWrite }: { canWrite: boolean }) {
  const data = useAdminData<Pricing>('/api/admin/pricing');
  return (
    <>
      <PageTitle
        title="Pricing"
        description="Set a base price for each product and fabric band. Empty cells stay unpriced."
      />
      {data.error && <p role="alert">{data.error}</p>}
      {data.data && (
        <PriceMatrix
          key={JSON.stringify(data.data)}
          initial={data.data}
          canWrite={canWrite}
          saved={data.load}
        />
      )}
      <Simulator />
    </>
  );
}
function PriceMatrix({
  initial,
  canWrite,
  saved,
}: {
  initial: Pricing;
  canWrite: boolean;
  saved: () => Promise<unknown>;
}) {
  const [bands, setBands] = useState(
      initial.bands.map((b) => ({
        code: b.code,
        name: b.name,
        description: String(b.description ?? ''),
        sort: Number(b.sort),
      })),
    ),
    [matrix, setMatrix] = useState(initial.matrix),
    [message, setMessage] = useState('');
  async function saveBands() {
    try {
      await adminFetch('/api/admin/pricing/bands', 'PUT', { items: bands });
      await saved();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <fieldset disabled={!canWrite} className="admin-card">
      <legend>{initial.currency} · Catalog prices</legend>
      <details>
        <summary>Manage price bands</summary>
        {bands.map((b, i) => (
          <div className="admin-inline-fields" key={i}>
            <FieldInput
              field={{ key: 'code', label: 'Band code', max: 8 }}
              value={b.code}
              onChange={(v) =>
                setBands((s) => s.map((x, j) => (i === j ? { ...x, code: String(v) } : x)))
              }
            />
            <FieldInput
              field={{ key: 'name', label: 'Band name' }}
              value={b.name}
              onChange={(v) =>
                setBands((s) => s.map((x, j) => (i === j ? { ...x, name: String(v) } : x)))
              }
            />
            <FieldInput
              field={{ key: 'description', label: 'Band description' }}
              value={b.description}
              onChange={(v) =>
                setBands((s) => s.map((x, j) => (i === j ? { ...x, description: String(v) } : x)))
              }
            />
            <FieldInput
              field={{ key: 'sort', label: 'Position', type: 'number' }}
              value={b.sort}
              onChange={(v) =>
                setBands((s) => s.map((x, j) => (i === j ? { ...x, sort: Number(v) } : x)))
              }
            />
            <button onClick={() => setBands((s) => s.filter((_, j) => j !== i))}>
              Remove band {b.code || i + 1}
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setBands((s) => [...s, { code: '', name: '', description: '', sort: s.length * 10 }])
          }
        >
          Add band
        </button>
        <button onClick={() => void saveBands()}>Save bands</button>
      </details>
      <p>Not priced means customers see “Price not yet available”. Zero is a deliberate price.</p>
      <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Product band prices">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              {initial.bands.map((b) => (
                <th key={b.code}>
                  {b.name} · {initial.currency}
                </th>
              ))}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={row.productId}>
                <th>{row.productName}</th>
                {initial.bands.map((b) => (
                  <td key={b.code}>
                    <FieldInput
                      field={{
                        key: `${row.productCode}-${b.code}`,
                        label: `${row.productName} · ${b.code} (${initial.currency})`,
                        type: 'money',
                        nullable: true,
                      }}
                      value={row.prices[b.code]}
                      onChange={(v) =>
                        setMatrix((s) =>
                          s.map((x, j) =>
                            i === j
                              ? { ...x, prices: { ...x.prices, [b.code]: v as number | null } }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    onClick={async () => {
                      try {
                        await adminFetch(
                          `/api/admin/pricing/products/${row.productId}/band-prices`,
                          'PUT',
                          {
                            items: Object.entries(row.prices).map(([bandCode, priceMinor]) => ({
                              bandCode,
                              priceMinor,
                            })),
                          },
                        );
                        setMessage(`Saved prices for ${row.productName}.`);
                        window.dispatchEvent(new Event('catalog-saved'));
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    Save {row.productName} prices
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p role="status">{message}</p>}
    </fieldset>
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
