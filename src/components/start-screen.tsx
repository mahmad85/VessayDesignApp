'use client';
import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { Button } from './ui/button';

/**
 * S-01, minimal (TASK-016): a new cart starts by choosing a garment from the
 * current release. Looks (templates) join this screen in TASK-021.
 */
export function StartScreen({
  index,
  busy,
  onStart,
}: {
  index: RuntimeIndex;
  busy: boolean;
  onStart: (productCode: string) => void;
}) {
  const products = index.catalog.products;
  const [choice, setChoice] = useState(products[0]?.code ?? '');
  return (
    <main className="start-screen" id="studio-content">
      <div className="eyebrow">
        <span className="small-star">✳</span> YOUR PERSONAL TAILOR
      </div>
      <h1>Choose a garment</h1>
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
      <Button disabled={busy || !choice} onClick={() => onStart(choice)}>
        Start designing
        <ArrowRight size={16} />
      </Button>
      {index.catalog.referenceOnly && (
        <p className="fine-print">
          Reference catalog: prices, stock and manufacturing details have not been approved for
          ordering.
        </p>
      )}
    </main>
  );
}
