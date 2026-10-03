'use client';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { Garment } from '@/modules/configuration/types';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { materialAllowed } from '@/modules/catalog/garment';

/**
 * A fabric chosen on /fabrics while the cart already has a garment: use it on
 * the current garment when it fits, or start a new garment in it. Both go
 * through the same commands as the studio's own fabric picker.
 */
export function FabricOffer({
  index,
  garment,
  fabricCode,
  busy,
  onUse,
  onAdd,
  onDone,
}: {
  index: RuntimeIndex;
  garment: Garment;
  fabricCode: string;
  busy: boolean;
  onUse: () => void;
  onAdd: (productCode: string) => void;
  onDone: () => void;
}) {
  const fabric = index.materials.get(fabricCode);
  const fits = index.catalog.products.filter(
    (p) => fabric && materialAllowed(index, p.code, fabric.code),
  );
  const current = index.products.get(garment.productCode);
  const fitsCurrent = fits.some((p) => p.code === garment.productCode);
  if (garment.materialCode === fabricCode) return null;
  return (
    <section className="fabric-offer" aria-label="Fabric you chose">
      {fabric && fits.length ? (
        <>
          <span
            className={`fabric-swatch pattern-${fabric.renderPattern}`}
            style={{ backgroundColor: fabric.primaryHex }}
            aria-hidden
          />
          <p>
            You chose <Link href={`/fabrics/${fabric.code}`}>{fabric.name}</Link>.
          </p>
          <div className="fabric-offer-actions">
            {fitsCurrent && (
              <button
                disabled={busy}
                onClick={() => {
                  onUse();
                  onDone();
                }}
              >
                Use on this {current?.shortLabel.toLowerCase() ?? 'garment'}
              </button>
            )}
            {fits.map((product) => (
              <button
                key={product.code}
                disabled={busy}
                onClick={() => {
                  onAdd(product.code);
                  onDone();
                }}
              >
                New {product.shortLabel.toLowerCase()} in this fabric
              </button>
            ))}
          </div>
        </>
      ) : (
        <p>That fabric is no longer available.</p>
      )}
      <button className="fabric-offer-close" aria-label="Dismiss" onClick={onDone}>
        <X size={16} />
      </button>
    </section>
  );
}
