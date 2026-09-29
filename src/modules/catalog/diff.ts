import { canonicalJson } from '@/lib/canonical-json';
import { valueKey, type CatalogSnapshot } from './snapshot';

// Differences between two snapshots, keyed by code (CATALOG-ADMIN.md §7.5):
// the admin sees what a publish would add, remove and change. A parent's
// nested children are compared as their own entities, not as a parent field.

export type DiffEntity =
  | 'settings'
  | 'lookup'
  | 'priceBand'
  | 'media'
  | 'component'
  | 'group'
  | 'attribute'
  | 'value'
  | 'product'
  | 'material'
  | 'rule'
  | 'template';
export type SnapshotDiff = {
  added: { entity: DiffEntity; code: string }[];
  removed: { entity: DiffEntity; code: string }[];
  changed: { entity: DiffEntity; code: string; fields: string[] }[];
};

type Entry = { entity: DiffEntity; code: string; fields: Record<string, unknown> };
const without = <T extends object, K extends keyof T>(item: T, ...keys: K[]) => {
  const copy = { ...item };
  for (const key of keys) delete copy[key];
  return copy as Record<string, unknown>;
};

function entries(snapshot: CatalogSnapshot): Map<string, Entry> {
  const list: Entry[] = [
    {
      entity: 'settings',
      code: 'commerce',
      fields: { currency: snapshot.currency, ...snapshot.settings },
    },
  ];
  for (const [type, values] of Object.entries(snapshot.lookups))
    for (const value of values)
      list.push({
        entity: 'lookup',
        code: `${type}::${value.code}`,
        fields: without(value, 'code'),
      });
  for (const band of snapshot.priceBands)
    list.push({ entity: 'priceBand', code: band.code, fields: without(band, 'code') });
  for (const media of Object.values(snapshot.media))
    list.push({ entity: 'media', code: media.id, fields: without(media, 'id') });
  for (const component of snapshot.components) {
    list.push({
      entity: 'component',
      code: component.code,
      fields: without(component, 'code', 'groups'),
    });
    for (const group of component.groups) {
      list.push({
        entity: 'group',
        code: group.code,
        fields: { ...without(group, 'code', 'attributes'), component: component.code },
      });
      for (const attribute of group.attributes) {
        list.push({
          entity: 'attribute',
          code: attribute.code,
          fields: { ...without(attribute, 'code', 'values'), group: group.code },
        });
        for (const value of attribute.values)
          list.push({
            entity: 'value',
            code: valueKey(attribute.code, value.code),
            fields: without(value, 'code'),
          });
      }
    }
  }
  for (const product of snapshot.products)
    list.push({ entity: 'product', code: product.code, fields: without(product, 'code') });
  for (const material of snapshot.materials)
    list.push({ entity: 'material', code: material.code, fields: without(material, 'code') });
  for (const rule of snapshot.rules)
    list.push({ entity: 'rule', code: rule.code, fields: without(rule, 'code') });
  for (const template of snapshot.templates)
    list.push({ entity: 'template', code: template.code, fields: without(template, 'code') });
  return new Map(list.map((entry) => [`${entry.entity}\u0000${entry.code}`, entry]));
}

const order = (a: { entity: string; code: string }, b: { entity: string; code: string }) =>
  a.entity.localeCompare(b.entity) || a.code.localeCompare(b.code);

/** What changes from `before` (for example the current release) to `after` (the working compile). */
export function diffSnapshots(before: CatalogSnapshot, after: CatalogSnapshot): SnapshotDiff {
  const a = entries(before);
  const b = entries(after);
  const diff: SnapshotDiff = { added: [], removed: [], changed: [] };
  for (const [key, entry] of b)
    if (!a.has(key)) diff.added.push({ entity: entry.entity, code: entry.code });
  for (const [key, entry] of a) {
    const next = b.get(key);
    if (!next) {
      diff.removed.push({ entity: entry.entity, code: entry.code });
      continue;
    }
    const fields = [...new Set([...Object.keys(entry.fields), ...Object.keys(next.fields)])]
      .filter(
        (field) =>
          canonicalJson(entry.fields[field] ?? null) !== canonicalJson(next.fields[field] ?? null),
      )
      .sort();
    if (fields.length) diff.changed.push({ entity: entry.entity, code: entry.code, fields });
  }
  diff.added.sort(order);
  diff.removed.sort(order);
  diff.changed.sort(order);
  return diff;
}
