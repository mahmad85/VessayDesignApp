'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/money';
import {
  adminFetch,
  useAdminData,
  FieldInput,
  PageTitle,
  RecordEditor,
  type Entry,
} from './editor';
import {
  AddCategoryDialog,
  AddSubcategoryDialog,
  ImagePicker,
  NewProductDialog,
  SubcategoryDialog,
  live,
  type ChoiceView,
  type Group,
  type Option,
} from './product-dialogs';

// D-022: the business view of the catalog. A product is a list of categories
// (parts), each holding subcategories (option groups) of choices. Codes,
// positions and drawing settings are set by the server; this screen only
// edits names, images, prices and what each product offers. Adding anything,
// and a subcategory's choices, open in modals (product-dialogs.tsx).

type PartLink = Entry & {
  required: boolean;
  defaultIncluded: boolean;
  surchargeMinor: number;
  includeLabel: string | null;
  sort: number;
  component: Entry & { groups: Group[] };
};
type Tree = { product: Entry; links: PartLink[]; settings: Entry[] };
type Pricing = {
  currency: string;
  bands: (Entry & { upliftMinor: number; materialCount: number })[];
};
type ModalTarget =
  | { kind: 'category' }
  | { kind: 'subcategory'; componentId: string }
  | { kind: 'group'; groupId: string; view?: ChoiceView };
// A closed modal stays mounted until another opens, so focus returns to its opener.
type Modal = ModalTarget & { open: boolean; seq: number };

const money = (amount: number, currency: string) => formatPrice(amount, currency);
const catalogSaved = () => window.dispatchEvent(new Event('catalog-saved'));

/** The lowest price a product can be bought for: its base price in the cheapest tier. */
function fromPrice(product: Entry, pricing: Pricing | null) {
  if (typeof product.basePriceMinor !== 'number') return null;
  const uplifts = pricing?.bands.map((band) => band.upliftMinor) ?? [];
  return product.basePriceMinor + (uplifts.length ? Math.min(...uplifts) : 0);
}

export function ProductList({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const products = useAdminData<{ items: Entry[] }>('/api/admin/catalog/products');
  const pricing = useAdminData<Pricing>('/api/admin/pricing');
  const [adding, setAdding] = useState(false);
  const items = live(products.data?.items ?? []);
  const currency = pricing.data?.currency ?? 'USD';
  return (
    <>
      <PageTitle
        title="Products"
        description="What customers can order. Open a product to change its name, price and options."
      >
        {canWrite && (
          <button
            className="admin-primary"
            aria-haspopup="dialog"
            disabled={!items.length}
            onClick={() => setAdding(true)}
          >
            New product
          </button>
        )}
      </PageTitle>
      {(products.error || pricing.error) && <p role="alert">{products.error || pricing.error}</p>}
      {!products.data && !products.error && <p role="status">Loading products…</p>}
      <ul className="pb-product-grid">
        {items.map((product) => {
          const from = fromPrice(product, pricing.data);
          return (
            <li key={product.id}>
              <Link className="pb-product-card" href={`/admin/catalog/products/${product.id}`}>
                <span
                  className="pb-product-image"
                  aria-hidden="true"
                  style={
                    product.heroMediaId
                      ? { backgroundImage: `url(/api/media/${product.heroMediaId})` }
                      : undefined
                  }
                />
                <strong>{product.name}</strong>
                <span>{from === null ? 'No price yet' : `From ${money(from, currency)}`}</span>
                <span className={product.status === 'active' ? 'pb-tag pb-tag-on' : 'pb-tag'}>
                  {product.status === 'active' ? 'Shown to customers' : 'Hidden'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <NewProductDialog
        open={adding}
        onOpenChange={setAdding}
        products={items}
        onCreated={(id) => router.push(`/admin/catalog/products/${id}`)}
      />
    </>
  );
}

export function ProductPage({ id, canWrite }: { id: string; canWrite: boolean }) {
  const router = useRouter();
  const tree = useAdminData<Tree>(`/api/admin/catalog/products/${id}/tree`);
  const pricing = useAdminData<Pricing>('/api/admin/pricing');
  const media = useAdminData<{ items: Entry[] }>('/api/admin/media?limit=100');
  const fabrics = useAdminData<{ items: Entry[] }>(
    `/api/admin/catalog/materials?productId=${encodeURIComponent(id)}&status=active&limit=100`,
  );
  const components = useAdminData<{ items: Entry[] }>('/api/admin/catalog/components');
  const [modal, setModal] = useState<Modal | null>(null),
    [message, setMessage] = useState(''),
    // Toggles show at once; the saved state replaces them when the product reloads.
    [pending, setPending] = useState<Record<string, boolean>>({});
  const currency = pricing.data?.currency ?? 'USD';
  const show = (target: ModalTarget) => setModal({ ...target, open: true, seq: Date.now() });
  const hide = () => setModal((current) => current && { ...current, open: false });
  const images: Option[] = (media.data?.items ?? []).map((m) => ({
    value: m.id,
    label: String(m.altText),
  }));
  async function refresh() {
    await tree.load();
    catalogSaved();
  }
  /** Runs one change, reports it, and reloads the product; false when it failed. */
  async function run(action: () => Promise<unknown>, done?: string, reload = true) {
    setMessage('');
    try {
      await action();
      if (done) setMessage(done);
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      if (reload) await refresh();
    }
  }
  if (!tree.data)
    return tree.error ? <p role="alert">{tree.error}</p> : <p role="status">Loading product…</p>;
  const { product, links, settings } = tree.data;
  const setting = (scope: string, targetId: string) =>
    settings.find(
      (s) => s.scope === scope && (s.groupId ?? s.attributeId ?? s.valueId) === targetId,
    );
  async function setGroupOn(groupId: string, on: boolean) {
    const own = setting('group', groupId);
    if (on && !own) return;
    await adminFetch(`/api/admin/catalog/products/${id}/settings`, 'PUT', {
      items: [
        on
          ? { scope: 'group', targetId: groupId, remove: true }
          : { scope: 'group', targetId: groupId, available: false },
      ],
    });
  }
  const fabricRows = fabrics.data?.items ?? [];
  const untiered = fabricRows.filter((f) => !f.priceBandCode).length;
  const linked = new Set(links.map((l) => l.component.id));
  const partOf = (componentId: string) => links.find((l) => l.component.id === componentId);
  const groupNames = (componentId: string, except?: string) =>
    live(partOf(componentId)?.component.groups ?? [])
      .filter((g) => g.id !== except)
      .map((g) => String(g.name));
  const openGroup =
    modal?.kind === 'group'
      ? links
          .map((l) => ({ link: l, group: l.component.groups.find((g) => g.id === modal.groupId) }))
          .find((found) => found.group)
      : undefined;
  return (
    <>
      <PageTitle
        title={product.name}
        description="Changes reach customers when you publish them from the bar at the top."
      >
        <div className="admin-toolbar">
          <Link href="/admin/catalog/products">← All products</Link>
          <Link href={`/studio?catalog=working&product=${product.code}`}>
            Preview as customer ↗
          </Link>
        </div>
      </PageTitle>
      {message && (
        <p role="status" className="pb-message">
          {message}
        </p>
      )}

      <section className="admin-card pb-section" aria-labelledby="pb-details">
        <h2 id="pb-details">Details and price</h2>
        <RecordEditor
          key={`${product.id}:${product.rowVersion}`}
          record={product}
          url={`/api/admin/catalog/products/${product.id}`}
          canWrite={canWrite}
          fields={[
            { key: 'name', label: 'Name', required: true, max: 200 },
            {
              key: 'basePriceMinor',
              label: `Base price (${currency})`,
              type: 'money',
              nullable: true,
              help: 'Customers pay this plus the fabric tier amount. Leave empty to show no price.',
            },
            { key: 'description', label: 'Description', type: 'textarea', max: 2000 },
            {
              key: 'defaultMaterialId',
              label: 'Fabric shown first',
              type: 'select',
              nullable: true,
              options: withCurrent(
                fabricRows.map((f) => ({ value: f.id, label: f.name })),
                product.defaultMaterialId,
                'Current fabric',
              ),
            },
          ]}
          transform={(draft) => ({
            name: draft.name,
            // The short label follows the name unless someone set it separately.
            ...(product.shortLabel === product.name && {
              shortLabel: String(draft.name).slice(0, 80),
            }),
            basePriceMinor: draft.basePriceMinor ?? null,
            description: draft.description,
            defaultMaterialId: draft.defaultMaterialId ?? null,
            heroMediaId: draft.heroMediaId ?? null,
            status: draft.status,
          })}
          onSaved={() => {
            setMessage('Saved.');
            void refresh();
          }}
        >
          {(draft, set) => (
            <div className="pb-details-extra">
              <TierPrices
                base={typeof draft.basePriceMinor === 'number' ? draft.basePriceMinor : null}
                pricing={pricing.data}
              />
              <label className="pb-check pb-visible">
                <input
                  type="checkbox"
                  checked={draft.status === 'active'}
                  onChange={(e) => set('status', e.target.checked ? 'active' : 'draft')}
                />
                Show this product to customers
              </label>
              <ImagePicker
                label="Main image"
                value={(draft.heroMediaId as string | null) ?? null}
                options={images}
                altText={String(draft.name)}
                disabled={!canWrite}
                onChange={(v) => set('heroMediaId', v)}
                onUploaded={() => void media.load()}
              />
            </div>
          )}
        </RecordEditor>
        {fabrics.data && !fabricRows.length && (
          <p className="pb-warning">
            No fabrics are offered for this product yet, so customers cannot order it. Add it to
            fabrics on the <Link href="/admin/catalog/fabrics">Fabrics</Link> page.
          </p>
        )}
        {untiered > 0 && (
          <p className="pb-warning">
            {untiered} of {fabricRows.length} fabrics for this product have no price tier, so they
            show “Price not yet available”. Set their tier on the{' '}
            <Link href="/admin/catalog/fabrics">Fabrics</Link> page.
          </p>
        )}
        {canWrite && (
          <div className="pb-danger">
            {product.firstPublishedVersion ? (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Stop selling ${product.name}? Customers will no longer see it after you publish. Past orders keep it.`,
                    )
                  )
                    void run(
                      () =>
                        adminFetch(`/api/admin/catalog/products/${id}`, 'PATCH', {
                          status: 'archived',
                          rowVersion: product.rowVersion,
                        }),
                      `${product.name} will no longer be sold after you publish.`,
                      false,
                    ).then((ok) => {
                      if (ok) router.push('/admin/catalog/products');
                    });
                }}
              >
                Stop selling this product…
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm(`Delete ${product.name}? It has never been published.`))
                    void run(
                      () => adminFetch(`/api/admin/catalog/products/${id}`, 'DELETE'),
                      undefined,
                      false,
                    ).then((ok) => {
                      if (ok) {
                        catalogSaved();
                        router.push('/admin/catalog/products');
                      }
                    });
                }}
              >
                Delete this product…
              </button>
            )}
          </div>
        )}
      </section>

      <section className="admin-card pb-section" aria-labelledby="pb-parts">
        <h2 id="pb-parts">What’s included</h2>
        <p>Each category is a part of the garment. Optional extras can add a price.</p>
        <ul className="pb-parts">
          {links.map((link) => (
            <PartRow
              key={`${link.component.id}:${link.rowVersion}`}
              link={link}
              productId={id}
              currency={currency}
              canWrite={canWrite}
              run={run}
            />
          ))}
        </ul>
        {canWrite && (
          <button
            className="pb-add"
            aria-haspopup="dialog"
            onClick={() => show({ kind: 'category' })}
          >
            + Add a category
          </button>
        )}
      </section>

      {links.map((link) => (
        <section
          key={link.component.id}
          className="admin-card pb-section"
          aria-labelledby={`pb-part-${link.component.id}`}
        >
          <h2 id={`pb-part-${link.component.id}`}>{link.component.name} options</h2>
          <p>Tick what this product offers. Open a subcategory to change its choices.</p>
          {(['style', 'accent'] as const).map((kind) => {
            const groups = live(link.component.groups).filter((g) => g.kind === kind);
            return (
              <div key={kind} className="pb-kind">
                <h3>{kind === 'style' ? 'Style' : 'Accents'}</h3>
                {groups.length ? (
                  <ul className="pb-groups">
                    {groups.map((group) => {
                      const own = setting('group', group.id);
                      const on = pending[group.id] ?? (own ? !!own.available : true);
                      return (
                        <li key={group.id} className={on ? undefined : 'pb-off'}>
                          <div className="pb-group-row">
                            <label className="pb-check">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={!canWrite}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setPending((all) => ({ ...all, [group.id]: checked }));
                                  void run(() => setGroupOn(group.id, checked)).then(() =>
                                    setPending((all) => {
                                      const next = { ...all };
                                      delete next[group.id];
                                      return next;
                                    }),
                                  );
                                }}
                              />
                              <span>{group.name}</span>
                            </label>
                            <span className="pb-summary">
                              {summary(group, currency, (v) => setting('value', v))}
                            </span>
                            <button
                              aria-haspopup="dialog"
                              onClick={() => show({ kind: 'group', groupId: group.id })}
                            >
                              {canWrite ? 'Choices' : 'View'}
                              <span className="sr-only"> for {group.name}</span>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="pb-empty">None yet.</p>
                )}
              </div>
            );
          })}
          {canWrite && (
            <button
              className="pb-add"
              aria-haspopup="dialog"
              onClick={() => show({ kind: 'subcategory', componentId: link.component.id })}
            >
              + Add a {link.component.name} subcategory
            </button>
          )}
        </section>
      ))}
      <p className="pb-footnote">
        Developers can change codes, drawing settings and display conditions in the{' '}
        <Link href="/admin/catalog/structure">structure editor</Link>.
      </p>

      <AddCategoryDialog
        open={modal?.kind === 'category' && modal.open}
        onOpenChange={(open) => !open && hide()}
        productId={id}
        available={live(components.data?.items ?? []).filter((c) => !linked.has(c.id))}
        allNames={live(components.data?.items ?? []).map((c) => c.name)}
        currency={currency}
        onDone={async (done) => {
          hide();
          setMessage(done);
          await components.load();
          await refresh();
        }}
      />
      {modal?.kind === 'subcategory' && (
        <AddSubcategoryDialog
          key={modal.seq}
          open={modal.open}
          onOpenChange={(open) => !open && hide()}
          componentId={modal.componentId}
          partName={String(partOf(modal.componentId)?.component.name ?? '')}
          takenNames={groupNames(modal.componentId)}
          onCreated={async (groupId, attributeId) => {
            await refresh();
            show({ kind: 'group', groupId, view: { mode: 'add', attributeId } });
          }}
        />
      )}
      {openGroup?.group && (
        <SubcategoryDialog
          key={modal?.seq}
          open={!!modal?.open}
          group={openGroup.group}
          takenNames={groupNames(openGroup.link.component.id, openGroup.group.id)}
          productId={id}
          currency={currency}
          images={images}
          canWrite={canWrite}
          setting={setting}
          initialView={modal?.kind === 'group' ? modal.view : undefined}
          onChanged={refresh}
          onUploaded={() => void media.load()}
          onClose={hide}
        />
      )}
    </>
  );
}

function withCurrent(options: Option[], current: unknown, label: string): Option[] {
  return typeof current === 'string' && current && !options.some((o) => o.value === current)
    ? [{ value: current, label }, ...options]
    : options;
}

/** “Notch ★ · Peak · Shawl +$20” — what this product offers, default first-marked. */
function summary(group: Group, currency: string, setting: (id: string) => Entry | undefined) {
  // The first option customers see that has choices; drafts are not shown to them.
  const first = group.attributes.find((a) => a.status === 'active' && live(a.values).length);
  const values = live(first?.values ?? []).filter((v) => setting(v.id)?.available !== false);
  if (!values.length) return 'No choices yet';
  const shown = values
    .slice(0, 6)
    .map((v) =>
      [
        v.label,
        v.isDefault ? '★' : '',
        v.surchargeMinor > 0 ? `+${money(v.surchargeMinor, currency)}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  return shown.join(' · ') + (values.length > 6 ? ` · +${values.length - 6} more` : '');
}

function TierPrices({ base, pricing }: { base: number | null; pricing: Pricing | null }) {
  if (!pricing) return null;
  if (base === null)
    return (
      <p className="pb-tiers admin-field-wide">
        No base price yet: customers see “Price not yet available”.
      </p>
    );
  return (
    <div className="pb-tiers admin-field-wide">
      <p>
        Customer price by fabric tier (
        <Link href="/admin/catalog/fabrics#price-tiers">change tier amounts</Link>):
      </p>
      <ul>
        {pricing.bands.map((band) => (
          <li key={band.code}>
            <span>{band.name}</span>
            <strong>{money(base + band.upliftMinor, pricing.currency)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PartRow({
  link,
  productId,
  currency,
  canWrite,
  run,
}: {
  link: PartLink;
  productId: string;
  currency: string;
  canWrite: boolean;
  run: (action: () => Promise<unknown>, done?: string) => Promise<boolean>;
}) {
  const [optional, setOptional] = useState(!link.required),
    [price, setPrice] = useState<unknown>(link.surchargeMinor);
  const dirty = optional !== !link.required || price !== link.surchargeMinor;
  const url = `/api/admin/catalog/products/${productId}/components/${link.component.id}`;
  return (
    <li className="pb-part">
      <strong>{link.component.name}</strong>
      <label>
        How it is sold
        <select
          value={optional ? 'optional' : 'always'}
          disabled={!canWrite}
          onChange={(e) => setOptional(e.target.value === 'optional')}
        >
          <option value="always">Always included</option>
          <option value="optional">Optional extra</option>
        </select>
      </label>
      {optional && (
        <FieldInput
          field={{ key: 'price', label: `Adds (${currency})`, type: 'money' }}
          value={price}
          disabled={!canWrite}
          onChange={setPrice}
        />
      )}
      {canWrite && (
        <span className="pb-part-actions">
          <button
            className="admin-primary"
            disabled={!dirty}
            onClick={() =>
              void run(
                () =>
                  adminFetch(url, 'PUT', {
                    required: !optional,
                    defaultIncluded: optional ? link.defaultIncluded && !link.required : true,
                    surchargeMinor: optional ? Number(price) || 0 : 0,
                    includeLabel: link.includeLabel,
                    sort: link.sort,
                    rowVersion: link.rowVersion,
                  }),
                `Saved ${link.component.name}.`,
              )
            }
          >
            Save
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Remove ${link.component.name} from this product?`))
                void run(() => adminFetch(url, 'DELETE'), `Removed ${link.component.name}.`);
            }}
          >
            Remove<span className="sr-only"> {link.component.name}</span>
          </button>
        </span>
      )}
      {!optional && link.surchargeMinor > 0 && (
        <small>
          Saving as always included removes its {money(link.surchargeMinor, currency)} price.
        </small>
      )}
    </li>
  );
}
