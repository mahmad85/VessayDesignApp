import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { formatPrice } from '@/lib/money';
import { basePrice } from '@/modules/pricing/quote';
import { FABRIC_CATEGORIES, browseFabrics, fabricCategory } from '@/modules/catalog/fabrics';
import { loadFabricCatalog } from './fabrics/data';
import { FabricCard, Swatch } from './fabrics/shared';

export const metadata: Metadata = {
  title: 'Vessy — Your personal tailoring studio',
  description:
    'Design a suit, shirt or blazer around you: choose the cloth and every detail, add your measurements, and have it checked before it is made.',
};

/** Studio links from before the studio moved to /studio keep working. */
const STUDIO_PARAMS = ['catalog', 'product', 'group', 'fabric', 'resubmit'];

const STEPS = [
  {
    title: 'Create your look',
    body: 'Choose a garment, then its cloth and every detail, from lapels to linings. See it take shape in a drawing or in 3D, and ask the tailor assistant when you want a second opinion.',
  },
  {
    title: 'Add your measurements',
    body: 'Enter them yourself with guidance on the mannequin for each one, or use camera-assisted capture with 3DLOOK.',
  },
  {
    title: 'Review and order',
    body: 'Check your design, measurements and price in one place before you order. One measurement profile covers every garment in your cart.',
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const legacy = new URLSearchParams();
  for (const key of STUDIO_PARAMS) {
    const value = params[key];
    if (typeof value === 'string') legacy.set(key, value);
  }
  if ([...legacy.keys()].length) redirect(`/studio?${legacy}`);

  const { index, availability } = await loadFabricCatalog();
  const products = [...index.catalog.products].sort((a, b) => a.sort - b.sort);
  const fabrics = browseFabrics(index, {}, availability);
  // One fabric per category first, so the selection shows the range.
  const featured = [
    ...FABRIC_CATEGORIES.map((c) => fabrics.find((m) => fabricCategory(index, m) === c.code)),
    ...fabrics,
  ]
    .filter((m, i, all) => m && all.indexOf(m) === i)
    .slice(0, 4) as typeof fabrics;
  // Full rows of three only: nine swatches, or six in a smaller catalog.
  const mosaic = fabrics.slice(0, fabrics.length >= 9 ? 9 : 6);

  return (
    <div className="app-shell home-page">
      <a className="skip-link" href="#home-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="home-content">
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="eyebrow">
              <span className="small-star">✳</span> YOUR PERSONAL TAILORING STUDIO
            </div>
            <h1>Something considered. Something yours.</h1>
            <p className="intro-copy">
              Design a suit, shirt or blazer around you. Choose the cloth and every detail, add your
              measurements, and review it all before it is made.
            </p>
            <div className="home-actions">
              <Link className="button button-primary" href="/studio">
                Start designing <ArrowRight size={16} />
              </Link>
              <Link className="button button-secondary" href="/fabrics">
                Browse fabrics
              </Link>
            </div>
          </div>
          {!!mosaic.length && (
            <div className="home-mosaic" aria-hidden>
              {mosaic.map((m) => (
                <Swatch key={m.code} material={m} />
              ))}
            </div>
          )}
        </section>

        <section className="home-section" aria-labelledby="how-heading">
          <h2 id="how-heading">How it works</h2>
          <ol className="home-steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="home-step-number">{String(i + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section" aria-labelledby="garments-heading">
          <h2 id="garments-heading">Start with a garment</h2>
          <ul className="home-garments">
            {products.map((product) => {
              const hero = product.heroMediaId ? index.media.get(product.heroMediaId) : undefined;
              const price = product.defaultMaterialCode
                ? basePrice(index, product, product.defaultMaterialCode)
                : null;
              return (
                <li key={product.code}>
                  <Link href={`/studio?product=${product.code}`}>
                    {hero && (
                      <span
                        className="start-product-image"
                        aria-hidden
                        style={{ backgroundImage: `url("${hero.url}")` }}
                      />
                    )}
                    <strong>{product.name}</strong>
                    <small>{product.description}</small>
                    {price && (
                      <span className="fabric-card-price">
                        From {formatPrice(price.amountMinor, index.catalog.currency)}
                      </span>
                    )}
                    <span className="home-link">
                      Design yours <ArrowRight size={14} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {!!featured.length && (
          <section className="home-section" aria-labelledby="fabrics-heading">
            <div className="home-section-heading">
              <h2 id="fabrics-heading">The cloth</h2>
              <Link href="/fabrics">
                See all {fabrics.length} fabrics <ArrowRight size={14} />
              </Link>
            </div>
            <ul className="fabric-grid">
              {featured.map((m) => (
                <FabricCard key={m.code} index={index} material={m} availability={availability} />
              ))}
            </ul>
          </section>
        )}

        <section className="home-closing">
          <h2>Ready when you are.</h2>
          <p>Your design is saved as you work, so you can pick it up where you left off.</p>
          <Link className="button button-primary" href="/studio">
            Start designing <ArrowRight size={16} />
          </Link>
        </section>

        {index.catalog.referenceOnly && (
          <p className="fine-print home-fine-print">
            Reference catalog: prices, stock and manufacturing details have not been approved for
            ordering.
          </p>
        )}
      </main>
    </div>
  );
}
