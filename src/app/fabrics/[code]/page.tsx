import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import {
  FABRIC_CATEGORIES,
  compositionLabel,
  fabricCategory,
  fabricProducts,
  listableFabrics,
  lookupLabel,
  similarFabrics,
} from '@/modules/catalog/fabrics';
import { isSelectable } from '@/modules/catalog/garment';
import { loadFabricCatalog } from '../data';
import { FabricCard, Swatch, availabilityLabel, priceLabel } from '../shared';
import { SiteHeader } from '@/components/site-header';

type Props = { params: Promise<{ code: string }> };

async function load(code: string) {
  const { index, availability } = await loadFabricCatalog();
  const material = listableFabrics(index).find((m) => m.code === code);
  return material ? { index, availability, material } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).code);
  return {
    title: found ? `${found.material.name} — Vessy fabrics` : 'Fabric not found — Vessy',
    description: found?.material.descriptionShort || undefined,
  };
}

const LEVEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;
const DRAPE = { fluid: 'Fluid', balanced: 'Balanced', structured: 'Structured' } as const;

export default async function FabricPage({ params }: Props) {
  const found = await load((await params).code);
  if (!found) notFound();
  const { index, availability, material } = found;
  const category = FABRIC_CATEGORIES.find((c) => c.code === fabricCategory(index, material))!;
  const products = fabricProducts(index, material);
  const selectable = isSelectable(availability[material.code]);
  const status = availabilityLabel(availability, material);
  const price = priceLabel(index, material);
  const labels = (type: string, codes: string[]) =>
    codes.map((c) => lookupLabel(index, type, c)).join(', ');
  const facts: [string, string | null][] = [
    ['Composition', compositionLabel(index, material) || null],
    ['Colour', material.colourName ?? lookupLabel(index, 'colour_family', material.colourFamily)],
    ['Pattern', lookupLabel(index, 'pattern', material.pattern || null)],
    ['Weave', lookupLabel(index, 'weave', material.weave)],
    ['Weight', material.weightGsm ? `${material.weightGsm} g/m²` : null],
    ['Wool quality', material.superNumber ? `Super ${material.superNumber}s` : null],
    ['Texture', lookupLabel(index, 'texture', material.texture)],
    ['Sheen', lookupLabel(index, 'sheen', material.sheen)],
    ['Drape', material.drape ? DRAPE[material.drape] : null],
    [
      'Stretch',
      material.stretch && material.stretch !== 'none'
        ? lookupLabel(index, 'stretch', material.stretch)
        : null,
    ],
    ['Breathability', material.breathability ? LEVEL[material.breathability] : null],
    ['Wrinkle resistance', material.wrinkleResistance ? LEVEL[material.wrinkleResistance] : null],
    ['Seasons', material.seasons.length ? labels('season', material.seasons) : null],
    ['Good for', material.occasions.length ? labels('occasion', material.occasions) : null],
    ['Care', material.care.length ? labels('care', material.care) : null],
  ];
  const similar = similarFabrics(index, material);
  return (
    <div className="app-shell fabrics-page">
      <a className="skip-link" href="#fabrics-content">
        Skip to fabric
      </a>
      <SiteHeader current="fabrics" />
      <main id="fabrics-content" className="fabrics-main">
        <nav className="fabric-breadcrumb" aria-label="Breadcrumb">
          <Link href="/fabrics">Fabrics</Link>
          <span aria-hidden>/</span>
          <Link href={`/fabrics?category=${category.code}`}>{category.label}</Link>
        </nav>
        <article className="fabric-detail">
          <Swatch material={material} large />
          <div className="fabric-detail-body">
            {material.collection && (
              <div className="eyebrow">{material.collection.toUpperCase()}</div>
            )}
            <h1>{material.name}</h1>
            {material.millName && <p className="fabric-mill">Woven by {material.millName}</p>}
            {price && <p className="fabric-detail-price">{price}</p>}
            {status && <p className="fabric-card-status">{status}</p>}
            {material.descriptionShort && <p className="intro-copy">{material.descriptionShort}</p>}
            <div className="fabric-actions">
              {selectable ? (
                products.map((product) => (
                  <Link
                    key={product.code}
                    className="button button-primary"
                    href={`/studio?product=${product.code}&fabric=${material.code}`}
                  >
                    Design a {product.shortLabel.toLowerCase()} in this fabric{' '}
                    <ArrowRight size={16} />
                  </Link>
                ))
              ) : (
                <p>This fabric can’t be ordered right now.</p>
              )}
            </div>
            <dl className="fabric-facts">
              {facts
                .filter(([, value]) => value)
                .map(([term, value]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
            {material.story && material.story !== material.descriptionShort && (
              <section aria-labelledby="fabric-story">
                <h2 id="fabric-story">About this cloth</h2>
                <p>{material.story}</p>
              </section>
            )}
          </div>
        </article>
        {!!similar.length && (
          <section className="fabric-similar" aria-labelledby="similar-heading">
            <h2 id="similar-heading">You might also like</h2>
            <ul className="fabric-grid">
              {similar.map((m) => (
                <FabricCard key={m.code} index={index} material={m} availability={availability} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
