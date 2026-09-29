'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  RuntimeIndex,
  CustomerCatalog,
  MetadataField,
  TextRules,
} from '@/modules/catalog/snapshot';
import { indexCatalog } from '@/modules/catalog/snapshot';
import type { Condition } from '@/modules/catalog/conditions';
import { VISUAL_SLOTS, isSlotId } from '@/visualization/registry';
import { explainCharge } from '@/modules/pricing/explain';
import {
  adminFetch,
  useAdminData,
  RecordEditor,
  FieldInput,
  PageTitle,
  Badges,
  entryOptions,
  options,
  type Entry,
  type Field,
} from './editor';
import { structureFields } from './catalog-fields';
import { ConditionBuilder } from './condition-builder';
import { Dialog } from '@/components/ui/dialog';
type Tree = {
  product: Entry;
  links: (Entry & {
    component: Entry & { groups: (Entry & { attributes: (Entry & { values: Entry[] })[] })[] };
  })[];
  settings: Entry[];
  effective: Record<
    string,
    Record<string, { available: boolean; default: string | boolean | null; surchargeMinor: number }>
  >;
};
type Node = {
  kind: string;
  row: Entry;
  depth: number;
  parent?: string;
  children?: string[];
  parentId?: string;
};
const empty = (kind: string): Entry => ({
  id: 'new',
  rowVersion: 1,
  code: '',
  name: '',
  status: 'draft',
  description: '',
  sort: 0,
  ...(kind === 'groups'
    ? { kind: 'style', lineKind: 'construction', shortName: '', focusRegion: '', surchargeMinor: 0 }
    : kind === 'attributes'
      ? { inputType: 'choice', required: true, surchargeMinor: 0, metadataFields: [] }
      : kind === 'values'
        ? { label: '', isDefault: false, isOff: false, surchargeMinor: 0, metadata: {} }
        : {}),
});
export function ProductEditor({ canWrite }: { canWrite: boolean }) {
  const products = useAdminData<{ items: Entry[] }>('/api/admin/catalog/products');
  const materials = useAdminData<{ items: Entry[] }>('/api/admin/catalog/materials?limit=100');
  const media = useAdminData<{ items: Entry[] }>('/api/admin/media?limit=100');
  const working = useAdminData<CustomerCatalog>('/api/admin/catalog/working');
  const components = useAdminData<{ items: Entry[] }>('/api/admin/catalog/components');
  const [productId, setProductId] = useState(''),
    [selected, setSelected] = useState(''),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [creating, setCreating] = useState<{ kind: string; parentId?: string } | null>(null);
  const dirty = useRef(false);
  const id = productId || products.data?.items[0]?.id || '';
  const tree = useAdminData<Tree>(id ? `/api/admin/catalog/products/${id}/tree` : null);
  const index = useMemo(() => (working.data ? indexCatalog(working.data) : null), [working.data]);
  const nodes = useMemo(() => {
    if (!tree.data) return [];
    const list: Node[] = [
      {
        kind: 'products',
        row: tree.data.product,
        depth: 1,
        children: tree.data.links.map((l) => l.component.id),
      },
    ];
    for (const link of tree.data.links) {
      const c = link.component;
      list.push({
        kind: 'components',
        row: c,
        depth: 2,
        parent: tree.data.product.id,
        children: c.groups.map((g) => g.id),
      });
      for (const g of c.groups) {
        list.push({
          kind: 'groups',
          row: g,
          depth: 3,
          parent: c.id,
          parentId: c.id,
          children: g.attributes.map((a) => a.id),
        });
        for (const a of g.attributes) {
          list.push({
            kind: 'attributes',
            row: a,
            depth: 4,
            parent: g.id,
            parentId: g.id,
            children: a.values.map((v) => v.id),
          });
          for (const v of a.values)
            list.push({ kind: 'values', row: v, depth: 5, parent: a.id, parentId: a.id });
        }
      }
    }
    return list;
  }, [tree.data]);
  const visible = nodes.filter((n) => {
    let p = n.parent;
    while (p) {
      if (collapsed.has(p) && !search) return false;
      p = nodes.find((n) => n.row.id === p)?.parent;
    }
    return (
      !search ||
      `${n.row.name ?? n.row.label} ${n.row.code}`.toLowerCase().includes(search.toLowerCase())
    );
  });
  const node = nodes.find((n) => n.row.id === selected) ?? nodes[0];
  async function refresh() {
    await tree.load();
    await products.load();
    await working.load();
    window.dispatchEvent(new Event('catalog-saved'));
  }
  function select(id: string) {
    if (dirty.current && !window.confirm('Discard your unsaved changes?')) return;
    dirty.current = false;
    setSelected(id);
  }
  async function action(run: () => Promise<unknown>) {
    try {
      setError('');
      await run();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const mediaOptions = (media.data?.items ?? []).map((m) => ({
    value: m.id,
    label: String(m.altText),
  }));
  const materialOptions = entryOptions(materials.data?.items ?? []);
  async function move(n: Node, position: number) {
    const siblings = nodes.filter((s) => s.parent === n.parent);
    const from = siblings.findIndex((s) => s.row.id === n.row.id);
    const ids = siblings.map((s) => s.row.id);
    ids.splice(from, 1);
    ids.splice(Math.max(0, Math.min(position, ids.length)), 0, n.row.id);
    await action(() =>
      adminFetch('/api/admin/catalog/reorder', 'POST', {
        entity: { groups: 'group', attributes: 'attribute', values: 'value', components: 'link' }[
          n.kind
        ],
        parentId: n.parent,
        orderedIds: ids,
      }),
    );
    document.getElementById(`tree-${n.row.id}`)?.focus();
  }
  return (
    <>
      <PageTitle
        title="Products & options"
        description="Build the choices your customers see. Changes stay in the working catalog until you publish."
      >
        <div className="admin-toolbar">
          <label>
            Product
            <select
              value={id}
              onChange={(e) => {
                if (dirty.current && !window.confirm('Discard unsaved changes?')) return;
                dirty.current = false;
                setProductId(e.target.value);
                setSelected('');
              }}
            >
              {products.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {canWrite && (
            <button onClick={() => setCreating({ kind: 'products' })}>New product</button>
          )}
          <Link href={`/?catalog=working&product=${tree.data?.product.code ?? ''}`}>
            Preview as customer ↗
          </Link>
        </div>
      </PageTitle>
      {(error || products.error || working.error) && (
        <p role="alert">{error || products.error || working.error}</p>
      )}
      <div className="admin-tree-layout">
        <aside className="admin-tree-panel">
          <label>
            Find an option
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div role="tree" aria-label="Product options">
            {visible.map((n, i) => (
              <div
                key={n.row.id}
                id={`tree-${n.row.id}`}
                role="treeitem"
                aria-level={n.depth}
                aria-expanded={n.children?.length ? !collapsed.has(n.row.id) : undefined}
                aria-selected={node?.row.id === n.row.id}
                tabIndex={
                  node?.row.id === n.row.id ||
                  (!visible.some((v) => v.row.id === node?.row.id) && i === 0)
                    ? 0
                    : -1
                }
                style={{ paddingLeft: 12 + (n.depth - 1) * 13 }}
                onClick={() => select(n.row.id)}
                onKeyDown={(e) => {
                  let target: string | undefined;
                  if (e.key === 'ArrowDown') target = visible[i + 1]?.row.id;
                  if (e.key === 'ArrowUp') target = visible[i - 1]?.row.id;
                  if (e.key === 'Home') target = visible[0]?.row.id;
                  if (e.key === 'End') target = visible.at(-1)?.row.id;
                  if (e.key === 'ArrowRight') {
                    if (collapsed.has(n.row.id)) {
                      setCollapsed((s) => new Set([...s].filter((x) => x !== n.row.id)));
                    } else target = n.children?.[0];
                  }
                  if (e.key === 'ArrowLeft') {
                    if (n.children?.length && !collapsed.has(n.row.id))
                      setCollapsed((s) => new Set([...s, n.row.id]));
                    else target = n.parent;
                  }
                  if (e.key === 'Enter' || e.key === ' ') select(n.row.id);
                  if (
                    [
                      'ArrowDown',
                      'ArrowUp',
                      'ArrowLeft',
                      'ArrowRight',
                      'Home',
                      'End',
                      'Enter',
                      ' ',
                    ].includes(e.key)
                  )
                    e.preventDefault();
                  if (target) {
                    select(target);
                    document.getElementById(`tree-${target}`)?.focus();
                  }
                }}
              >
                <span>
                  {n.children?.length ? (collapsed.has(n.row.id) ? '▸' : '▾') : '·'}{' '}
                  {String(n.row.name ?? n.row.label)}
                </span>
                <small>
                  {n.row.code} · {n.row.status}
                </small>
                <Badges value={n.row.badges} />
              </div>
            ))}
          </div>
        </aside>
        <section className="admin-detail-panel" aria-label="Selected item">
          {node && index && tree.data ? (
            <>
              <div className="admin-detail-heading">
                <h2>{String(node.row.name ?? node.row.label)}</h2>
                <Badges value={node.row.badges} />
              </div>
              <div className="admin-toolbar">
                {canWrite && (
                  <>
                    {node.kind === 'products' && (
                      <button onClick={() => setCreating({ kind: 'components' })}>New part</button>
                    )}
                    {node.kind === 'components' && (
                      <button
                        onClick={() => setCreating({ kind: 'groups', parentId: node.row.id })}
                      >
                        Add group
                      </button>
                    )}
                    {node.kind === 'groups' && (
                      <button
                        onClick={() => setCreating({ kind: 'attributes', parentId: node.row.id })}
                      >
                        Add option
                      </button>
                    )}
                    {node.kind === 'attributes' && node.row.inputType === 'choice' && (
                      <button
                        onClick={() => setCreating({ kind: 'values', parentId: node.row.id })}
                      >
                        Add choice
                      </button>
                    )}
                    {node.parent && (
                      <>
                        <button
                          onClick={() =>
                            void move(
                              node,
                              nodes
                                .filter((n) => n.parent === node.parent)
                                .findIndex((n) => n.row.id === node.row.id) - 1,
                            )
                          }
                        >
                          Move up
                        </button>
                        <button
                          onClick={() =>
                            void move(
                              node,
                              nodes
                                .filter((n) => n.parent === node.parent)
                                .findIndex((n) => n.row.id === node.row.id) + 1,
                            )
                          }
                        >
                          Move down
                        </button>
                        <button
                          onClick={() => {
                            const value = window.prompt('Move to position (starting at 1)');
                            if (value && /^\d+$/.test(value)) void move(node, Number(value) - 1);
                          }}
                        >
                          Move to position…
                        </button>
                      </>
                    )}
                    <button
                      onClick={() =>
                        void action(() =>
                          adminFetch(`/api/admin/catalog/${node.kind}/${node.row.id}`, 'PATCH', {
                            rowVersion: node.row.rowVersion,
                            status: 'archived',
                          }),
                        )
                      }
                    >
                      Archive
                    </button>
                    {!node.row.firstPublishedVersion && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete “${node.row.name ?? node.row.label}”?`))
                            void action(() =>
                              adminFetch(
                                `/api/admin/catalog/${node.kind}/${node.row.id}`,
                                'DELETE',
                              ),
                            );
                        }}
                      >
                        Delete…
                      </button>
                    )}
                    {node.kind === 'groups' && (
                      <button
                        onClick={() => {
                          const code = window.prompt('Code for the duplicate group');
                          if (code)
                            void action(() =>
                              adminFetch(
                                `/api/admin/catalog/groups/${node.row.id}/duplicate`,
                                'POST',
                                { newCode: code, newName: `${node.row.name} copy` },
                              ),
                            );
                        }}
                      >
                        Duplicate group…
                      </button>
                    )}
                  </>
                )}
              </div>
              <StructureForm
                key={`${node.row.id}:${node.row.rowVersion}`}
                node={node}
                nodes={nodes}
                index={index}
                canWrite={canWrite}
                media={mediaOptions}
                materials={materialOptions}
                onSaved={() => void refresh()}
                onDirty={(d) => {
                  dirty.current = d;
                }}
              />
              {node.kind === 'products' && (
                <PartLinks
                  key={id}
                  product={tree.data.product}
                  links={tree.data.links}
                  components={components.data?.items ?? []}
                  canWrite={canWrite}
                  saved={refresh}
                />
              )}
              {['groups', 'attributes', 'values'].includes(node.kind) && (
                <ProductOverride
                  key={`${node.row.id}:${JSON.stringify(tree.data.settings)}`}
                  node={node}
                  product={tree.data.product}
                  settings={tree.data.settings}
                  effective={tree.data.effective[node.kind]?.[node.row.id]}
                  canWrite={canWrite}
                  onSaved={refresh}
                />
              )}
              {node.kind === 'attributes' && (
                <ChoiceGrid
                  values={(node.row.values as Entry[]) ?? []}
                  canWrite={canWrite}
                  onSaved={refresh}
                  select={select}
                />
              )}
            </>
          ) : (
            <p role="status">Loading the product…</p>
          )}
        </section>
      </div>
      <Dialog
        open={!!creating}
        onOpenChange={(open) => !open && setCreating(null)}
        title={`New ${creating?.kind === 'attributes' ? 'option' : creating?.kind === 'values' ? 'choice' : (creating?.kind?.replace(/s$/, '') ?? 'item')}`}
      >
        {creating && index && (
          <StructureForm
            key={`${creating.kind}:${creating.parentId}`}
            node={{
              kind: creating.kind,
              row: empty(creating.kind),
              depth: 1,
              parentId: creating.parentId,
            }}
            nodes={nodes}
            index={index}
            canWrite={canWrite}
            media={mediaOptions}
            materials={materialOptions}
            onSaved={() => {
              setCreating(null);
              void components.load();
              void refresh();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
function StructureForm({
  node,
  nodes,
  index,
  canWrite,
  media,
  materials,
  onSaved,
  onDirty,
}: {
  node: Node;
  nodes: Node[];
  index: RuntimeIndex;
  canWrite: boolean;
  media: { value: string; label: string }[];
  materials: { value: string; label: string }[];
  onSaved: () => void;
  onDirty?: (d: boolean) => void;
}) {
  const parent = nodes.find((n) => n.row.id === node.parentId)?.row;
  const slot = String(parent?.visualSlot ?? '');
  const fields = structureFields(
    node.kind,
    media,
    materials,
    isSlotId(slot) ? [...VISUAL_SLOTS[slot].tokens] : [],
  );
  const creating = node.row.id === 'new';
  const path = creating
    ? node.kind === 'groups'
      ? `components/${node.parentId}/groups`
      : node.kind === 'attributes'
        ? `groups/${node.parentId}/attributes`
        : node.kind === 'values'
          ? `attributes/${node.parentId}/values`
          : node.kind
    : `${node.kind}/${node.row.id}`;
  const extra =
    node.kind === 'groups'
      ? ['visibleWhen']
      : node.kind === 'attributes'
        ? ['visibleWhen', 'textRules', 'metadataFields']
        : node.kind === 'values'
          ? ['metadata']
          : [];
  return (
    <RecordEditor
      record={node.row}
      fields={fields}
      url={`/api/admin/catalog/${path}`}
      method={creating ? 'POST' : 'PATCH'}
      canWrite={canWrite}
      onSaved={onSaved}
      onDirty={onDirty}
      transform={(draft) =>
        Object.fromEntries(
          [...fields.map((f) => f.key), ...extra]
            .filter(
              (k) =>
                draft[k] !== undefined && !(node.kind === 'values' && k === 'code' && !draft[k]),
            )
            .map((k) => [k, draft[k]]),
        )
      }
    >
      {(draft, set) => (
        <>
          {'surchargeMinor' in draft && (
            <p className="admin-price-note">
              {explainCharge(
                node.kind === 'groups'
                  ? 'group'
                  : node.kind === 'attributes'
                    ? 'attribute'
                    : 'option',
                Number(draft.surchargeMinor) || 0,
                index.catalog.currency,
                String(draft.name ?? draft.label),
              )}{' '}
              Currency: {index.catalog.currency}.
            </p>
          )}
          {['groups', 'attributes'].includes(node.kind) && (
            <ConditionBuilder
              value={(draft.visibleWhen as Condition | null) ?? null}
              onChange={(v) => set('visibleWhen', v)}
              index={index}
            />
          )}
          {node.kind === 'attributes' && draft.inputType === 'text' && (
            <TextRuleFields
              value={draft.textRules as TextRules | null}
              onChange={(v) => set('textRules', v)}
            />
          )}
          {node.kind === 'attributes' && (
            <MetadataFields
              value={(draft.metadataFields as MetadataField[]) ?? []}
              onChange={(v) => set('metadataFields', v)}
              index={index}
            />
          )}
          {node.kind === 'values' &&
            ((parent?.metadataFields as MetadataField[]) ?? []).map((field) => (
              <FieldInput
                key={field.key}
                field={{
                  key: field.key,
                  label: field.label,
                  type:
                    field.type === 'boolean'
                      ? 'checkbox'
                      : field.type === 'number'
                        ? 'number'
                        : field.type === 'lookup'
                          ? 'select'
                          : 'text',
                  options: field.lookupType
                    ? [...(index.lookups.get(field.lookupType)?.values() ?? [])].map((v) => ({
                        value: v.code,
                        label: v.label,
                      }))
                    : undefined,
                }}
                value={(draft.metadata as Record<string, unknown>)?.[field.key]}
                onChange={(v) =>
                  set('metadata', {
                    ...(draft.metadata as Record<string, unknown>),
                    [field.key]: v,
                  })
                }
              />
            ))}
        </>
      )}
    </RecordEditor>
  );
}
function TextRuleFields({
  value,
  onChange,
}: {
  value: TextRules | null;
  onChange: (v: TextRules) => void;
}) {
  const data = value ?? { maxLength: 1, pattern: null, transform: 'none', placeholder: '' };
  return (
    <fieldset>
      <legend>Text limits</legend>
      {(
        [
          {
            key: 'maxLength',
            label: 'Maximum characters',
            type: 'number',
            min: 1,
            max: 60,
            required: true,
          },
          {
            key: 'pattern',
            label: 'Allowed characters',
            help: 'Optional character class, for example ^[A-Za-z .-]*$',
            nullable: true,
          },
          {
            key: 'transform',
            label: 'Letter case',
            type: 'select',
            options: options(['none', 'upper']),
          },
          { key: 'placeholder', label: 'Placeholder' },
        ] as Field[]
      ).map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={data[f.key as keyof TextRules]}
          onChange={(v) => onChange({ ...data, [f.key]: v })}
        />
      ))}
    </fieldset>
  );
}
function MetadataFields({
  value,
  onChange,
  index,
}: {
  value: MetadataField[];
  onChange: (v: MetadataField[]) => void;
  index: RuntimeIndex;
}) {
  return (
    <fieldset>
      <legend>Choice metadata fields</legend>
      {value.map((item, i) => (
        <div className="admin-inline-fields" key={i}>
          {(
            [
              { key: 'key', label: 'Field code' },
              { key: 'label', label: 'Field label' },
              {
                key: 'type',
                label: 'Value type',
                type: 'select',
                options: options(['text', 'number', 'boolean', 'lookup']),
              },
              {
                key: 'lookupType',
                label: 'List',
                type: 'select',
                options: options([...index.lookups.keys()]),
                nullable: true,
              },
              { key: 'required', label: 'Required', type: 'checkbox' },
            ] as Field[]
          ).map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={item[f.key as keyof MetadataField]}
              onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, [f.key]: v } : x)))}
            />
          ))}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            Remove field {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            { key: '', label: '', type: 'text', lookupType: null, required: false },
          ])
        }
      >
        Add metadata field
      </button>
    </fieldset>
  );
}
function PartLinks({
  product,
  links,
  components,
  canWrite,
  saved,
}: {
  product: Entry;
  links: Tree['links'];
  components: Entry[];
  canWrite: boolean;
  saved: () => Promise<void>;
}) {
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  return (
    <section>
      <h3>Parts in this product</h3>
      {links.map((link) => (
        <details key={`${link.component.id}:${link.rowVersion}`}>
          <summary>{link.component.name}</summary>
          <RecordEditor
            record={link}
            fields={structureFields('links', [], [])}
            url={`/api/admin/catalog/products/${product.id}/components/${link.component.id}`}
            method="PUT"
            canWrite={canWrite}
            transform={(draft) => ({
              required: draft.required,
              defaultIncluded: draft.defaultIncluded,
              surchargeMinor: draft.surchargeMinor,
              includeLabel: draft.includeLabel,
              sort: draft.sort,
              rowVersion: link.rowVersion,
            })}
            onSaved={() => void saved()}
          />
          {canWrite && (
            <button
              onClick={async () => {
                if (window.confirm(`Unlink ${link.component.name}?`)) {
                  try {
                    await adminFetch(
                      `/api/admin/catalog/products/${product.id}/components/${link.component.id}`,
                      'DELETE',
                    );
                    await saved();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }
              }}
            >
              Unlink part…
            </button>
          )}
        </details>
      ))}
      {canWrite && (
        <div className="admin-toolbar">
          <label>
            Add existing part
            <select value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Choose…</option>
              {components
                .filter((c) => !links.some((l) => l.component.id === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={!id}
            onClick={async () => {
              try {
                await adminFetch(
                  `/api/admin/catalog/products/${product.id}/components/${id}`,
                  'PUT',
                  { required: true, defaultIncluded: true, surchargeMinor: 0 },
                );
                setId('');
                await saved();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Link part
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
function ProductOverride({
  node,
  product,
  settings,
  effective,
  canWrite,
  onSaved,
}: {
  node: Node;
  product: Entry;
  settings: Entry[];
  effective?: { available: boolean; default: unknown; surchargeMinor: number };
  canWrite: boolean;
  onSaved: () => Promise<void>;
}) {
  const scope = { groups: 'group', attributes: 'attribute', values: 'value' }[node.kind];
  const existing = settings.find(
    (s) => s.scope === scope && (s.groupId ?? s.attributeId ?? s.valueId) === node.row.id,
  );
  const [data, setData] = useState<Record<string, unknown>>({
    available: existing?.available ?? true,
    defaultValueId: existing?.defaultValueId ?? null,
    surchargeOverrideMinor: existing?.surchargeOverrideMinor ?? null,
  });
  const [error, setError] = useState('');
  async function save(remove = false) {
    try {
      await adminFetch(`/api/admin/catalog/products/${product.id}/settings`, 'PUT', {
        items: [{ scope, targetId: node.row.id, ...(remove ? { remove: true } : data) }],
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <fieldset disabled={!canWrite}>
      <legend>This product only · {product.name}</legend>
      {existing && <span className="admin-chip">Overridden for {product.name}</span>}
      <p>
        Effective surcharge: {((effective?.surchargeMinor ?? 0) / 100).toFixed(2)} ·{' '}
        {effective?.available ? 'Available' : 'Unavailable'}
      </p>
      <FieldInput
        field={{ key: 'available', label: 'Available for this product', type: 'checkbox' }}
        value={data.available}
        onChange={(v) => setData({ ...data, available: v })}
      />
      <FieldInput
        field={{
          key: 'override',
          label: 'Surcharge override (blank uses global)',
          type: 'money',
          nullable: true,
        }}
        value={data.surchargeOverrideMinor}
        onChange={(v) => setData({ ...data, surchargeOverrideMinor: v })}
      />
      {node.kind === 'attributes' && (
        <FieldInput
          field={{
            key: 'default',
            label: 'Default choice (blank uses global)',
            type: 'select',
            nullable: true,
            options: ((node.row.values as Entry[]) ?? []).map((v) => ({
              value: v.id,
              label: String(v.label),
            })),
          }}
          value={data.defaultValueId}
          onChange={(v) => setData({ ...data, defaultValueId: v })}
        />
      )}
      <button onClick={() => void save()}>Save product override</button>
      {existing && <button onClick={() => void save(true)}>Use global settings</button>}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
function ChoiceGrid({
  values,
  canWrite,
  onSaved,
  select,
}: {
  values: Entry[];
  canWrite: boolean;
  onSaved: () => Promise<void>;
  select: (id: string) => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]),
    [amount, setAmount] = useState<unknown>(0),
    [status, setStatus] = useState(''),
    [error, setError] = useState('');
  return (
    <section>
      <h3>Choices</h3>
      {canWrite && (
        <div className="admin-toolbar">
          <FieldInput
            field={{ key: 'bulk-price', label: 'Bulk surcharge', type: 'money' }}
            value={amount}
            onChange={setAmount}
          />
          <FieldInput
            field={{
              key: 'bulk-status',
              label: 'Bulk status',
              type: 'select',
              options: options(['draft', 'active', 'archived']),
            }}
            value={status}
            onChange={(v) => setStatus(String(v))}
          />
          <button
            disabled={!chosen.length}
            onClick={async () => {
              try {
                await adminFetch('/api/admin/catalog/values/bulk', 'POST', {
                  items: values
                    .filter((v) => chosen.includes(v.id))
                    .map((v) => ({
                      id: v.id,
                      rowVersion: v.rowVersion,
                      surchargeMinor: amount,
                      ...(status ? { status } : {}),
                    })),
                });
                setChosen([]);
                await onSaved();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Apply to selected choices
          </button>
        </div>
      )}
      <div className="admin-table-wrap" tabIndex={0} role="region" aria-label="Choice grid">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Choice</th>
              <th>Default</th>
              <th>None</th>
              <th>Surcharge</th>
              <th>Supplier code</th>
              <th>Draws as</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {values.map((v) => (
              <tr key={v.id}>
                <td>
                  <input
                    aria-label={`Select ${v.label}`}
                    type="checkbox"
                    checked={chosen.includes(v.id)}
                    onChange={(e) =>
                      setChosen((s) =>
                        e.target.checked ? [...s, v.id] : s.filter((id) => id !== v.id),
                      )
                    }
                  />
                </td>
                <td>
                  {!!v.imageMediaId && (
                    <span
                      className="admin-thumb"
                      role="img"
                      aria-label={String(v.label)}
                      style={{ backgroundImage: `url(/api/media/${v.imageMediaId})` }}
                    />
                  )}
                  <button onClick={() => select(v.id)}>{String(v.label)}</button>
                  <small>{v.code}</small>
                </td>
                <td>{v.isDefault ? 'Default' : '—'}</td>
                <td>{v.isOff ? 'None' : '—'}</td>
                <td>{(Number(v.surchargeMinor) / 100).toFixed(2)}</td>
                <td>{String(v.supplierCode ?? '—')}</td>
                <td>{String(v.visualToken ?? 'Not illustrated')}</td>
                <td>
                  {v.status}
                  <Badges value={v.badges} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
