import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FABRIC_CATEGORIES,
  browseFabrics,
  fabricFacets,
  parseFilters,
  type FabricFilters,
  type FacetOption,
} from '@/modules/catalog/fabrics';
import { loadFabricCatalog } from './data';
import { FabricCard } from './shared';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Fabrics — Vessy',
  description: 'Browse the cloth for your suit, blazer or shirt.',
};

const query = (filters: FabricFilters, change: Partial<FabricFilters>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...change }))
    if (value) params.set(key, value);
  const text = params.toString();
  return text ? `/fabrics?${text}` : '/fabrics';
};

function Select({
  name,
  label,
  options,
  value,
}: {
  name: keyof FabricFilters;
  label: string;
  options: FacetOption[];
  value?: string;
}) {
  if (!options.length) return null;
  return (
    <label className="fabric-filter">
      <span>{label}</span>
      <select name={name} defaultValue={value ?? ''}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label} ({o.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function FabricsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const { index, availability } = await loadFabricCatalog();
  const facets = fabricFacets(index, filters);
  const fabrics = browseFabrics(index, filters, availability);
  const category = FABRIC_CATEGORIES.find((c) => c.code === filters.category);
  const active = Object.keys(filters).filter((k) => k !== 'category').length > 0;
  return (
    <div className="app-shell fabrics-page">
      <a className="skip-link" href="#fabrics-content">
        Skip to fabrics
      </a>
      <SiteHeader current="fabrics" />
      <main id="fabrics-content" className="fabrics-main">
        <div className="eyebrow">
          <span className="small-star">✳</span> THE CLOTH
        </div>
        <h1>{category ? category.label : 'Fabrics'}</h1>
        <p className="intro-copy">
          {category?.description ??
            'Browse the cloth we tailor with. Open a fabric to see its details, then design in it.'}
        </p>

        <nav className="fabric-categories" aria-label="Fabric categories">
          <Link
            href={query(filters, { category: undefined })}
            aria-current={!category ? 'page' : undefined}
          >
            All
          </Link>
          {facets.category
            .filter((c) => c.count > 0 || filters.category === c.code)
            .map((c) => (
              <Link
                key={c.code}
                href={query(filters, { category: c.code })}
                aria-current={filters.category === c.code ? 'page' : undefined}
              >
                {c.label} <small>{c.count}</small>
              </Link>
            ))}
        </nav>

        {!!facets.colour.length && (
          <nav className="fabric-colours" aria-label="Colour">
            {facets.colour.map((c) => {
              const on = filters.colour === c.code;
              return (
                <Link
                  key={c.code}
                  href={query(filters, { colour: on ? undefined : c.code })}
                  aria-current={on ? 'true' : undefined}
                  title={`${c.label} (${c.count})`}
                >
                  <span
                    className="colour-chip"
                    style={{ backgroundColor: c.hex || undefined }}
                    aria-hidden
                  />
                  <span className="sr-only">
                    {c.label}, {c.count} fabrics{on ? ', selected' : ''}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}

        <form className="fabric-filters" method="get" action="/fabrics">
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          {filters.colour && <input type="hidden" name="colour" value={filters.colour} />}
          <Select name="product" label="Garment" options={facets.product} value={filters.product} />
          <Select name="pattern" label="Pattern" options={facets.pattern} value={filters.pattern} />
          <Select name="fibre" label="Main fibre" options={facets.fibre} value={filters.fibre} />
          <Select name="season" label="Season" options={facets.season} value={filters.season} />
          <Select name="band" label="Price range" options={facets.band} value={filters.band} />
          <button type="submit">Apply filters</button>
          {active && <Link href={query({ category: filters.category }, {})}>Clear filters</Link>}
        </form>

        <p className="fabric-count" role="status">
          {fabrics.length} {fabrics.length === 1 ? 'fabric' : 'fabrics'}
        </p>
        {fabrics.length ? (
          <ul className="fabric-grid">
            {fabrics.map((m) => (
              <FabricCard key={m.code} index={index} material={m} availability={availability} />
            ))}
          </ul>
        ) : (
          <p className="fabric-empty">
            No fabrics match these filters. <Link href="/fabrics">See all fabrics</Link>
          </p>
        )}
        {index.catalog.referenceOnly && (
          <p className="fine-print">
            Reference catalog: prices, stock and manufacturing details have not been approved for
            ordering.
          </p>
        )}
      </main>
    </div>
  );
}
