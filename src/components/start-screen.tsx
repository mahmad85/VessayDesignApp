'use client';
import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
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
  embedded = false,
}: {
  index: RuntimeIndex;
  busy: boolean;
  onStart: (productCode: string, templateCode?: string) => void;
  initialProduct?: string;
  embedded?: boolean;
}) {
  const products = index.catalog.products;
  const [choice, setChoice] = useState(
    products.some((p) => p.code === initialProduct) ? initialProduct! : (products[0]?.code ?? ''),
  );
  const looks = index.catalog.templates
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
      <Button disabled={busy || !choice} onClick={() => onStart(choice)}>
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
