import Link from 'next/link';
import type { RuntimeIndex, RuntimeMaterial } from '@/modules/catalog/snapshot';
import type { AvailabilityMap } from '@/modules/catalog/garment';
import { isSelectable } from '@/modules/catalog/garment';
import { formatPrice } from '@/lib/money';
import { fromPrice, lookupLabel, mainFibre } from '@/modules/catalog/fabrics';

export function Swatch({
  material,
  large = false,
}: {
  material: RuntimeMaterial;
  large?: boolean;
}) {
  return (
    <span
      className={`fabric-swatch pattern-${material.renderPattern} ${large ? 'fabric-swatch-large' : ''}`}
      style={{ backgroundColor: material.primaryHex || undefined }}
      aria-hidden
    />
  );
}

export function priceLabel(index: RuntimeIndex, material: RuntimeMaterial) {
  const price = fromPrice(index, material);
  if (price)
    return `${price.productName} from ${formatPrice(price.amountMinor, index.catalog.currency)}`;
  const band = index.catalog.priceBands.find((b) => b.code === material.priceBand);
  return band ? `${band.name} range` : null;
}

export function availabilityLabel(availability: AvailabilityMap, material: RuntimeMaterial) {
  const state = availability[material.code];
  if (!isSelectable(state)) return 'Currently unavailable';
  if (state === 'low_stock') return 'Limited availability';
  return null;
}

export function FabricCard({
  index,
  material,
  availability,
}: {
  index: RuntimeIndex;
  material: RuntimeMaterial;
  availability: AvailabilityMap;
}) {
  const fibre = mainFibre(material);
  const status = availabilityLabel(availability, material);
  const price = priceLabel(index, material);
  return (
    <li className="fabric-card">
      <Link href={`/fabrics/${material.code}`}>
        <Swatch material={material} />
        <strong>{material.name}</strong>
        <small>
          {[
            material.collection,
            lookupLabel(index, 'fibre', fibre),
            material.weightGsm && `${material.weightGsm} g/m²`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </small>
        {price && <span className="fabric-card-price">{price}</span>}
        {status && <span className="fabric-card-status">{status}</span>}
      </Link>
    </li>
  );
}
