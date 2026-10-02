'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, X } from 'lucide-react';
import { materialAllowed } from '@/modules/catalog/garment';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { Button } from './ui/button';
import { formatPrice } from '@/lib/money';

/**
 * S-01, minimal (TASK-016): a new cart starts by choosing a garment from the
 * current release. Looks (templates) join this screen in TASK-021.
 */
export function StartScreen({
  index,
  busy,
  onStart,
  initialProduct,
  initialFabric,
  onClearFabric,
  embedded = false,
}: {
  index: RuntimeIndex;
  busy: boolean;
  onStart: (productCode: string, templateCode?: string, materialCode?: string) => void;
  initialProduct?: string;
  /** A fabric chosen on /fabrics: only garments it fits are offered. */
  initialFabric?: string;
  onClearFabric?: () => void;
  embedded?: boolean;
}) {
  const found = initialFabric ? index.materials.get(initialFabric) : undefined;
  const fits = index.catalog.products.filter(
    (p) => found && materialAllowed(index, p.code, found.code),
  );
  // A fabric no garment offers any more is ignored, with a notice.
  const fabric = fits.length ? found : undefined;
  const products = fabric ? fits : index.catalog.products;
  const [choice, setChoice] = useState(
    products.some((p) => p.code === initialProduct) ? initialProduct! : (products[0]?.code ?? ''),
  );
  const looks = (fabric ? [] : index.catalog.templates)
    .filter((t) => t.productCode === choice)
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) || a.sort - b.sort || a.code.localeCompare(b.code),
    );
  const Container = embedded ? 'section' : 'main';
  return (
    <Container className="start-screen" id={embedded ? undefined : 'studio-content'}>
      <div className="eyebrow">
        <span className="small-star">✳</span> YOUR PERSONAL TAILOR
      </div>
      <h1>{index.catalog.templates.length ? 'Choose a starting point' : 'Choose a garment'}</h1>
      <p className="intro-copy">
        Start with a garment. You can change anything it offers as you go.
      </p>
      {initialFabric && (
        <div className="start-fabric" role="status">
          {fabric ? (
            <>
              <span
                className={`fabric-swatch pattern-${fabric.renderPattern}`}
                style={{ backgroundColor: fabric.primaryHex }}
                aria-hidden
              />
              <span>
                Starting in <strong>{fabric.name}</strong>
                <Link href={`/fabrics/${fabric.code}`}>Fabric details</Link>
              </span>
            </>
          ) : (
            <span>That fabric is no longer available. Choose a garment to start.</span>
          )}
          <button type="button" aria-label="Start without this fabric" onClick={onClearFabric}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="start-products" role="group" aria-label="Garment">
        {products.map((product) => {
          const hero = product.heroMediaId ? index.media.get(product.heroMediaId) : undefined;
          return (
            <button
              key={product.code}
              className="start-product"
              aria-pressed={choice === product.code}
              onClick={() => setChoice(product.code)}
            >
              {hero && (
                <span
                  className="start-product-image"
                  aria-hidden
                  style={{ backgroundImage: `url("${hero.url}")` }}
                />
              )}
              <strong>{product.name}</strong>
              <small>{product.description}</small>
              {choice === product.code && (
                <span className="start-product-check" aria-hidden>
                  <Check size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!!looks.length && (
        <section className="look-gallery" aria-label="Looks">
          {looks.map((look) => {
            const hero = look.heroMediaId ? index.media.get(look.heroMediaId) : null;
            return (
              <article className="look-card" key={look.code}>
                {hero && (
                  <span
                    className="look-hero"
                    role="img"
                    aria-label={hero.alt}
                    style={{ backgroundImage: `url("${hero.url}")` }}
                  />
                )}
                <div>
                  {look.featured && <small className="eyebrow">FEATURED LOOK</small>}
                  <h2>{look.name}</h2>
                  <p>{look.subtitle}</p>
                  <strong>
                    {look.asShownPriceMinor === null
                      ? 'Price not yet available'
                      : `As shown ${formatPrice(look.asShownPriceMinor, index.catalog.currency)}`}
                  </strong>
                  <p className="look-tags">
                    {[
                      ...look.occasions.map(
                        (c) => index.lookups.get('occasion')?.get(c)?.label ?? c,
                      ),
                      ...look.climates.map((c) => index.lookups.get('climate')?.get(c)?.label ?? c),
                    ].join(' · ')}
                  </p>
                  <Button disabled={busy} onClick={() => onStart(choice, look.code)}>
                    Customise this look <ArrowRight size={16} />
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}
      <Button disabled={busy || !choice} onClick={() => onStart(choice, undefined, fabric?.code)}>
        {index.catalog.templates.length ? 'Start from scratch' : 'Start designing'}
        <ArrowRight size={16} />
      </Button>
      {index.catalog.referenceOnly && (
        <p className="fine-print">
          Reference catalog: prices, stock and manufacturing details have not been approved for
          ordering.
        </p>
      )}
    </Container>
  );
}
