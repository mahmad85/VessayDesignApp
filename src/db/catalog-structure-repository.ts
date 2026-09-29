import { DomainError } from '@/modules/configuration/types';
import {
  entityInputs,
  rowVersionInput,
  linkInput,
  settingsInput,
  duplicateInput,
  bulkValuesInput,
  reorderInput,
  type StructureEntity,
} from '@/modules/catalog/admin-input';
import { conditionSchema, type Condition } from '@/modules/catalog/conditions';
import type { MetadataField } from '@/modules/catalog/snapshot';
import { isRegionId, isSlotId, isTokenOf } from '@/visualization/registry';
import { writeAudit } from './audit';
import { getDatabase, type Query } from './client';
import {
  columns,
  current,
  dto,
  insert,
  invalid,
  missing,
  mutate,
  update,
  version,
  type Row,
} from './admin-mutations';

export const structureTables = {
  products: 'products',
  components: 'components',
  groups: 'option_groups',
  attributes: 'attributes',
  values: 'option_values',
  rules: 'compatibility_rules',
} as const;
const parentFields = {
  groups: 'component_id',
  attributes: 'group_id',
  values: 'attribute_id',
} as const;
const parentEntities = {
  groups: 'components',
  attributes: 'groups',
  values: 'attributes',
} as const;
const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 78) || 'choice';
const audit = (
  query: Query,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  fields: string[],
) => writeAudit(query, { actor, action, entityType, entityId, summary: { fields } });

function checkCondition(input: unknown) {
  if (!input) return;
  // Bound depth before parsing the recursive schema, including hostile nested input.
  let nodes = 0;
  const walk = (value: unknown, depth: number) => {
    if (depth > 6 || ++nodes > 50)
      invalid('Conditions allow at most 6 levels and 50 parts.', 'visibleWhen');
    if (!value || typeof value !== 'object') return;
    const row = value as Record<string, unknown>;
    for (const key of ['all', 'any'])
      if (Array.isArray(row[key])) for (const item of row[key]) walk(item, depth + 1);
    if ('not' in row) walk(row.not, depth + 1);
  };
  walk(input, 1);
  conditionSchema.parse(input);
}
async function validateEntity(query: Query, entity: StructureEntity, row: Row) {
  checkCondition(row.visible_when);
  checkCondition(row.when_condition);
  if (entity === 'groups' && row.focus_region && !isRegionId(String(row.focus_region)))
    invalid('Choose a registered drawing area.', 'focusRegion');
  if (entity === 'attributes') {
    if (row.visual_slot && !isSlotId(String(row.visual_slot)))
      invalid('Choose a registered drawing slot.', 'visualSlot');
    const rules = row.text_rules as {
      maxLength: number;
      pattern?: string | null;
      transform?: string;
      placeholder?: string;
    } | null;
    if (rules) {
      // Only a repeated character class, never arbitrary/nested regular expressions.
      if (
        rules.pattern &&
        !/^\^\[(?:\\[dws]|[A-Za-z0-9 .,'_@#&!:/+\-])+\]\*\$$/.test(rules.pattern)
      )
        invalid('Use a character-class allowlist such as ^[A-Za-z .-]*$.', 'textRules.pattern');
      if (rules.pattern) {
        try {
          new RegExp(rules.pattern);
        } catch {
          invalid('Invalid character allowlist.', 'textRules.pattern');
        }
      }
      row.text_rules = { pattern: null, transform: 'none', placeholder: '', ...rules };
    }
    const fields = (row.metadata_fields ?? []) as MetadataField[];
    if (new Set(fields.map((f) => f.key)).size !== fields.length)
      invalid('Metadata field names must be unique.', 'metadataFields');
    for (const field of fields)
      if (field.type === 'lookup') {
        if (
          !(await query('SELECT code FROM lookup_types WHERE code=$1', [field.lookupType])).length
        )
          invalid('Unknown metadata list.', 'metadataFields');
      }
    row.metadata_fields = fields.map((f) => ({ ...f, lookupType: f.lookupType ?? null }));
  }
  if (entity === 'values') {
    const attribute = await current(query, 'attributes', String(row.attribute_id));
    if (attribute.input_type !== 'choice') invalid('Text options cannot have choices.');
    const slot = String(attribute.visual_slot ?? '');
    if (row.visual_token && (!isSlotId(slot) || !isTokenOf(slot, String(row.visual_token))))
      invalid('Choose a token from this option’s drawing slot.', 'visualToken');
    const fields = (attribute.metadata_fields ?? []) as MetadataField[];
    const metadata = (row.metadata ?? {}) as Row;
    for (const [key, value] of Object.entries(metadata)) {
      const field = fields.find((f) => f.key === key);
      if (!field && !/^(source|reference|import)/.test(key))
        invalid('Unknown choice metadata field.', `metadata.${key}`);
      if (!field) continue;
      if (typeof value !== (field.type === 'lookup' ? 'string' : field.type))
        invalid('The metadata value has the wrong type.', `metadata.${key}`);
      if (
        field.type === 'lookup' &&
        !(
          await query('SELECT id FROM lookup_values WHERE type_code=$1 AND code=$2', [
            field.lookupType,
            value,
          ])
        ).length
      )
        invalid('Unknown list value.', `metadata.${key}`);
    }
  }
  if (entity === 'rules') {
    const attribute = await current(query, 'attributes', String(row.attribute_id));
    if (attribute.input_type !== 'choice')
      invalid('Rules must target a choice option.', 'attributeId');
    const ids = row.value_ids as string[];
    const values = await query(
      'SELECT id FROM option_values WHERE attribute_id=$1 AND id=ANY($2::text[])',
      [attribute.id, ids],
    );
    if (new Set(ids).size !== ids.length || values.length !== ids.length)
      invalid('Choose values belonging to the target option.', 'valueIds');
    for (const id of (row.product_ids ?? []) as string[]) await current(query, 'products', id);
  }
}
function inputFor(entity: StructureEntity, input: unknown, partial: boolean) {
  const schema = entityInputs[entity];
  // Check limits before the recursive Zod condition parser.
  if (input && typeof input === 'object') {
    const row = input as Row;
    checkCondition(row.visibleWhen);
    checkCondition(row.when);
  }
  const data: Row = partial
    ? schema.partial().extend({ rowVersion: rowVersionInput }).parse(input)
    : schema.parse(input);
  const expected = data.rowVersion;
  delete data.rowVersion;
  if (entity === 'rules' && data.when !== undefined) {
    data.whenCondition = data.when;
    delete data.when;
  }
  return { data: columns(data), expected };
}
export async function listStructure(
  entity: StructureEntity,
  filters: { productId?: string; attributeId?: string } = {},
): Promise<Row[]> {
  const db = await getDatabase();
  let rows = await db.query(`SELECT * FROM ${structureTables[entity]} ORDER BY sort,code,id`);
  if (entity === 'rules')
    rows = rows.filter(
      (r) =>
        (!filters.attributeId || r.attribute_id === filters.attributeId) &&
        (!filters.productId ||
          !(r.product_ids as string[]).length ||
          (r.product_ids as string[]).includes(filters.productId)),
    );
  if (entity === 'products') {
    const links = await db.query(
      'SELECT product_id,count(*)::int AS count FROM product_components GROUP BY product_id',
    );
    const templates = await db.query(
      'SELECT product_id,count(*)::int AS count FROM templates GROUP BY product_id',
    );
    const prices = await db.query('SELECT DISTINCT product_id FROM product_band_prices');
    return rows.map((r) => ({
      ...dto(r),
      componentCount: links.find((x) => x.product_id === r.id)?.count ?? 0,
      templateCount: templates.find((x) => x.product_id === r.id)?.count ?? 0,
      priced: prices.some((x) => x.product_id === r.id),
    }));
  }
  return rows.map(dto);
}
export async function createStructure(
  entity: StructureEntity,
  input: unknown,
  actor: string,
  parentId?: string,
) {
  const { data } = inputFor(entity, input, false);
  return mutate(async (query) => {
    if (entity in parentFields) {
      const child = entity as keyof typeof parentFields;
      if (!parentId) invalid('A parent is required.');
      await current(query, structureTables[parentEntities[child]], parentId);
      data[parentFields[child]] = parentId;
    }
    if (entity === 'values' && !data.code) {
      const base = slug(String(data.label));
      let code = base;
      let suffix = 1;
      while (
        (
          await query('SELECT id FROM option_values WHERE attribute_id=$1 AND code=$2', [
            parentId,
            code,
          ])
        ).length
      )
        code = `${base.slice(0, 70)}-${++suffix}`;
      data.code = code;
    }
    await validateEntity(query, entity, data);
    if (entity === 'values' && data.is_default)
      await clearDefaults(query, String(data.attribute_id), actor);
    return dto(
      await insert(query, structureTables[entity], { id: crypto.randomUUID(), ...data }, actor),
    );
  });
}
async function clearDefaults(query: Query, attributeId: string, actor: string, except?: string) {
  // Parent lock serializes concurrent default swaps, including creates.
  await current(query, 'attributes', attributeId);
  const previous = await query(
    "SELECT * FROM option_values WHERE attribute_id=$1 AND is_default AND status<>'archived' AND id<>$2 FOR UPDATE",
    [attributeId, except ?? ''],
  );
  for (const row of previous)
    await update(
      query,
      'option_values',
      String(row.id),
      { is_default: false },
      row.row_version,
      actor,
    );
}
export async function editStructureIn(
  query: Query,
  entity: StructureEntity,
  id: string,
  input: unknown,
  actor: string,
) {
  const { data, expected } = inputFor(entity, input, true);
  const old = await current(query, structureTables[entity], id);
  version(old, expected);
  const merged = { ...old, ...data };
  await validateEntity(query, entity, merged);
  if (entity === 'attributes') {
    if (data.text_rules) data.text_rules = merged.text_rules;
    if (data.metadata_fields) data.metadata_fields = merged.metadata_fields;
  }
  if (entity === 'values' && merged.is_default && merged.status !== 'archived')
    await clearDefaults(query, String(old.attribute_id), actor, id);
  return dto(await update(query, structureTables[entity], id, data, expected, actor));
}
export const editStructure = (entity: StructureEntity, id: string, input: unknown, actor: string) =>
  mutate((q) => editStructureIn(q, entity, id, input, actor));

export async function setProductLink(
  productId: string,
  componentId: string,
  input: unknown,
  actor: string,
) {
  const { rowVersion, ...data } = linkInput.parse(input);
  return mutate(async (query) => {
    await current(query, 'products', productId);
    await current(query, 'components', componentId);
    const [old] = await query(
      'SELECT * FROM product_components WHERE product_id=$1 AND component_id=$2 FOR UPDATE',
      [productId, componentId],
    );
    if (old) version(old, rowVersion);
    else if (rowVersion !== undefined)
      throw new DomainError('stale_row_version', 'The part link was removed.', 409, {
        current: null,
      });
    const [row] = await query(
      'INSERT INTO product_components(product_id,component_id,required,default_included,surcharge_minor,include_label,sort) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(product_id,component_id) DO UPDATE SET required=excluded.required,default_included=excluded.default_included,surcharge_minor=excluded.surcharge_minor,include_label=excluded.include_label,sort=excluded.sort,row_version=product_components.row_version+1,updated_at=now() RETURNING *',
      [
        productId,
        componentId,
        data.required,
        data.defaultIncluded,
        data.surchargeMinor,
        data.includeLabel ?? null,
        data.sort ?? 0,
      ],
    );
    await audit(
      query,
      actor,
      'product_components.saved',
      'product_components',
      `${productId}:${componentId}`,
      Object.keys(data),
    );
    return dto(row);
  });
}
export const removeProductLink = (productId: string, componentId: string, actor: string) =>
  mutate(async (query) => {
    await current(query, 'products', productId);
    const rows = await query(
      'DELETE FROM product_components WHERE product_id=$1 AND component_id=$2 RETURNING component_id',
      [productId, componentId],
    );
    if (!rows.length) missing();
    await audit(
      query,
      actor,
      'product_components.removed',
      'product_components',
      `${productId}:${componentId}`,
      ['componentId'],
    );
    return { ok: true };
  });
export async function setProductSettings(productId: string, input: unknown, actor: string) {
  const { items } = settingsInput.parse(input);
  if (new Set(items.map((i) => `${i.scope}:${i.targetId}`)).size !== items.length)
    invalid('Each target may appear only once.', 'items');
  return mutate(async (query) => {
    await current(query, 'products', productId);
    for (const item of items) {
      const column = { group: 'group_id', attribute: 'attribute_id', value: 'value_id' }[
        item.scope
      ];
      const join =
        item.scope === 'group' ? 'g.id=$2' : item.scope === 'attribute' ? 'a.id=$2' : 'v.id=$2';
      const rows = await query(
        `SELECT g.id FROM product_components pc JOIN option_groups g ON g.component_id=pc.component_id LEFT JOIN attributes a ON a.group_id=g.id LEFT JOIN option_values v ON v.attribute_id=a.id WHERE pc.product_id=$1 AND ${join} LIMIT 1`,
        [productId, item.targetId],
      );
      if (!rows.length) invalid('This option is not part of the product.', 'targetId');
      if (!('remove' in item) && item.defaultValueId) {
        if (item.scope !== 'attribute')
          invalid('Only an option can override its default.', 'defaultValueId');
        const [value] = await query(
          "SELECT id FROM option_values WHERE id=$1 AND attribute_id=$2 AND status<>'archived'",
          [item.defaultValueId, item.targetId],
        );
        if (!value) invalid('The default must belong to this option.', 'defaultValueId');
      }
      await query(
        `DELETE FROM product_option_settings WHERE product_id=$1 AND scope=$2 AND ${column}=$3`,
        [productId, item.scope, item.targetId],
      );
      if (!('remove' in item))
        await insert(
          query,
          'product_option_settings',
          {
            id: crypto.randomUUID(),
            product_id: productId,
            scope: item.scope,
            [column]: item.targetId,
            available: item.available,
            default_value_id: item.defaultValueId ?? null,
            surcharge_override_minor: item.surchargeOverrideMinor ?? null,
          },
          actor,
        );
    }
    const settings = await query('SELECT * FROM product_option_settings WHERE product_id=$1', [
      productId,
    ]);
    for (const setting of settings)
      if (
        setting.default_value_id &&
        settings.some((s) => s.value_id === setting.default_value_id && !s.available)
      )
        invalid('The default choice must be available.', 'defaultValueId');
    await audit(query, actor, 'product_settings.saved', 'products', productId, ['settings']);
    return { items: settings.map(dto) };
  });
}
export const bulkValues = (input: unknown, actor: string) => {
  const { items } = bulkValuesInput.parse(input);
  if (new Set(items.map((i) => i.id)).size !== items.length)
    invalid('Each choice may appear only once.');
  return mutate(async (query) => {
    const saved = [];
    for (const { id, ...data } of items)
      saved.push(await editStructureIn(query, 'values', id, data, actor));
    return { items: saved };
  });
};
export const reorderStructure = (input: unknown, actor: string) => {
  const { entity, parentId, orderedIds } = reorderInput.parse(input);
  return mutate(async (query) => {
    const config = {
      link: ['product_components', 'product_id', 'component_id', 'products'],
      group: ['option_groups', 'component_id', 'id', 'components'],
      attribute: ['attributes', 'group_id', 'id', 'option_groups'],
      value: ['option_values', 'attribute_id', 'id', 'attributes'],
    }[entity];
    const [table, parent, key, parentTable] = config;
    await current(query, parentTable, parentId);
    const rows = await query(`SELECT ${key} FROM ${table} WHERE ${parent}=$1 FOR UPDATE`, [
      parentId,
    ]);
    if (
      new Set(orderedIds).size !== rows.length ||
      orderedIds.length !== rows.length ||
      rows.some((r) => !orderedIds.includes(String(r[key])))
    )
      invalid('Include every sibling exactly once.', 'orderedIds');
    for (const [position, id] of orderedIds.entries())
      await query(
        `UPDATE ${table} SET sort=$1,row_version=row_version+1,updated_at=now() WHERE ${parent}=$2 AND ${key}=$3`,
        [position * 10, parentId, id],
      );
    await audit(query, actor, `${table}.reordered`, table, parentId, ['sort']);
    return { ok: true };
  });
};

function remapCondition(condition: Condition | null, attrs: Map<string, string>): Condition | null {
  if (!condition) return null;
  if ('all' in condition) return { all: condition.all.map((c) => remapCondition(c, attrs)!) };
  if ('any' in condition) return { any: condition.any.map((c) => remapCondition(c, attrs)!) };
  if ('not' in condition) return { not: remapCondition(condition.not, attrs)! };
  return 'attr' in condition
    ? { ...condition, attr: attrs.get(condition.attr) ?? condition.attr }
    : condition;
}
const copyFields = (row: Row) =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([key]) =>
        !['id', 'created_at', 'updated_at', 'row_version', 'first_published_version'].includes(key),
    ),
  );
export const duplicateGroup = (id: string, input: unknown, actor: string) => {
  const { newCode, newName } = duplicateInput.parse(input);
  return mutate(async (query) => {
    const group = await current(query, 'option_groups', id);
    const attrs = await query('SELECT * FROM attributes WHERE group_id=$1 ORDER BY sort,id', [id]);
    const names = new Map(
      attrs.map((a, i) => [
        String(a.code),
        `${newCode}.${String(a.code).split('.').pop() || `option-${i + 1}`}`,
      ]),
    );
    if (new Set(names.values()).size !== attrs.length)
      invalid('The copied options need unique suffixes. Choose a different group code.');
    const created = await insert(
      query,
      'option_groups',
      {
        ...copyFields(group),
        id: crypto.randomUUID(),
        code: newCode,
        name: newName,
        status: 'draft',
        visible_when: remapCondition(group.visible_when as Condition | null, names),
      },
      actor,
    );
    for (const attr of attrs) {
      const next = await insert(
        query,
        'attributes',
        {
          ...copyFields(attr),
          id: crypto.randomUUID(),
          group_id: created.id,
          code: names.get(String(attr.code)),
          status: 'draft',
          legacy_key: null,
          visible_when: remapCondition(attr.visible_when as Condition | null, names),
        },
        actor,
      );
      for (const value of await query(
        'SELECT * FROM option_values WHERE attribute_id=$1 ORDER BY sort,id',
        [attr.id],
      ))
        await insert(
          query,
          'option_values',
          { ...copyFields(value), id: crypto.randomUUID(), attribute_id: next.id, status: 'draft' },
          actor,
        );
    }
    return dto(created);
  });
};
export const deleteCatalogEntity = (
  entity: StructureEntity | 'materials' | 'templates',
  id: string,
  actor: string,
) =>
  mutate(async (query) => {
    const table =
      entity === 'materials' || entity === 'templates' ? entity : structureTables[entity];
    const row = await current(query, table, id);
    if (row.first_published_version)
      throw new DomainError(
        'entity_published',
        'Published records must be archived so existing designs retain their meaning.',
        409,
      );
    // JSON conditions and arrays do not have database foreign keys.
    const conditions = await query(
      'SELECT visible_when AS condition FROM option_groups UNION ALL SELECT visible_when FROM attributes UNION ALL SELECT when_condition FROM compatibility_rules',
    );
    const hasCode = (value: unknown): boolean =>
      typeof value === 'string'
        ? value === row.code
        : Array.isArray(value)
          ? value.some(hasCode)
          : !!value && typeof value === 'object'
            ? Object.values(value).some(hasCode)
            : false;
    const arrayRefs = await query(
      'SELECT id FROM compatibility_rules WHERE $1=ANY(value_ids) OR $1=ANY(product_ids)',
      [id],
    );
    if (arrayRefs.length || conditions.some((c) => hasCode(c.condition)))
      throw new DomainError(
        'entity_in_use',
        'This record is used by a rule or condition. Archive it instead.',
        409,
      );
    await query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    await audit(query, actor, `${table}.deleted`, table, id, ['id']);
    return { ok: true };
  });
