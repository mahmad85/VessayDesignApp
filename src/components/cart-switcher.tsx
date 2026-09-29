'use client';
import { useState } from 'react';
import type { CommandV2, DraftV2 } from '@/modules/configuration/types';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import type { CartQuote } from '@/modules/pricing/quote';
import { formatPrice } from '@/lib/money';
import { Dialog } from './ui/dialog';
import { StartScreen } from './start-screen';
export function CartSwitcher({
  draft,
  index,
  quote,
  busy,
  command,
  onSwitch,
}: {
  draft: DraftV2;
  index: RuntimeIndex;
  quote: CartQuote;
  busy: boolean;
  command: (c: CommandV2) => Promise<DraftV2 | null>;
  onSwitch: () => void;
}) {
  const [add, setAdd] = useState(false),
    [remove, setRemove] = useState<string | null>(null);
  return (
    <section className="cart-switcher" aria-label="Your garments">
      <div className="cart-chips">
        {draft.garments.map((g, i) => {
          const p = index.products.get(g.productCode),
            price = quote.garments.find((q) => q.garmentId === g.id);
          return (
            <div key={g.id} className="cart-chip">
              <button
                disabled={busy}
                aria-pressed={draft.activeGarmentId === g.id}
                onClick={async () => {
                  if (await command({ type: 'select_garment', garmentId: g.id })) onSwitch();
                }}
              >
                {i + 1}. {p?.name ?? g.productCode}
                {g.templateCode
                  ? ` · ${index.templates.get(g.templateCode)?.name ?? g.templateCode}`
                  : ''}{' '}
                ·{' '}
                {price?.status === 'priced'
                  ? formatPrice(price.totalMinor, price.currency)
                  : 'Price not yet available'}
                {g.quantity > 1 ? ` ×${g.quantity}` : ''}
              </button>
              <button
                disabled={busy}
                aria-label={`Remove garment ${i + 1}: ${p?.name ?? g.productCode}`}
                onClick={() => setRemove(g.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button disabled={busy || draft.garments.length >= 10} onClick={() => setAdd(true)}>
        + Add garment
      </button>
      {draft.garments.length >= 10 && <span>A cart holds up to 10 garments.</span>}
      <p>
        All garments use one measurement profile. Quantities are identical copies for the same
        person.
      </p>
      <Dialog open={add} onOpenChange={setAdd} title="Add a garment">
        <StartScreen
          embedded
          index={index}
          busy={busy}
          onStart={async (productCode, templateCode) => {
            if (await command({ type: 'add_garment', productCode, templateCode })) {
              setAdd(false);
              onSwitch();
            }
          }}
        />
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title="Remove this garment?"
        description="Its confirmed design will be removed from this cart. Your other garments and measurements stay saved."
      >
        <button
          className="primary-button"
          disabled={busy}
          onClick={async () => {
            if (
              remove &&
              (await command({ type: 'remove_garment', garmentId: remove, confirm: true }))
            ) {
              setRemove(null);
              onSwitch();
            }
          }}
        >
          Remove garment
        </button>
        <button onClick={() => setRemove(null)}>Keep garment</button>
      </Dialog>
    </section>
  );
}
