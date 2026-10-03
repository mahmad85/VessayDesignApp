import { z } from 'zod';
import { MAX_MINOR } from '@/lib/money';
import { codeSchema, valueCodeSchema, VISUAL_MODELS, VISUAL_PARTS } from './snapshot';
import { conditionSchema } from './conditions';

export const idInput = z.string().min(1).max(180);
export const moneyInput = z.number().int().min(0).max(MAX_MINOR);
export const statusInput = z.enum(['draft', 'active', 'archived']);
export const rowVersionInput = z.number().int().positive();
const text = (max = 2000) => z.string().max(max);
const name = z.string().trim().min(1).max(200);
const common = {
  code: codeSchema,
  name,
  sort: z.number().int().optional(),
  status: statusInput.optional(),
};
const condition = conditionSchema.nullable().optional();
export const metadataFieldInput = z
  .strictObject({
    key: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      .max(80),
    label: name,
    type: z.enum(['lookup', 'text', 'number', 'boolean']),
    lookupType: codeSchema.nullable().optional(),
    required: z.boolean(),
  })
  .refine((v) => v.type !== 'lookup' || !!v.lookupType, 'Choose a list for lookup metadata.');
export const productInput = z.strictObject({
  ...common,
  shortLabel: name.max(80),
  description: text().optional(),
  measurementSet: z.enum(VISUAL_MODELS),
  visualModel: z.enum(VISUAL_MODELS),
  defaultMaterialId: idInput.nullable().optional(),
  heroMediaId: idInput.nullable().optional(),
  fabricConsumptionCm: z.number().int().min(50).max(1000).nullable().optional(),
  /** D-022: the price before the fabric tier uplift; null leaves the product unpriced. */
  basePriceMinor: moneyInput.nullable().optional(),
});
export const componentInput = z.strictObject({
  ...common,
  description: text().optional(),
  visualPart: z.enum(VISUAL_PARTS),
});
export const groupInput = z.strictObject({
  ...common,
  shortName: name.max(120),
  description: text().optional(),
  kind: z.enum(['style', 'accent']),
  lineKind: z.enum(['construction', 'accessory']).optional(),
  iconMediaId: idInput.nullable().optional(),
  focusRegion: text(60),
  visibleWhen: condition,
});
export const attributeInput = z.strictObject({
  ...common,
  helpText: text().optional(),
  inputType: z.enum(['choice', 'text']),
  required: z.boolean().optional(),
  textRules: z
    .strictObject({
      maxLength: z.number().int().min(1).max(60),
      pattern: text(200).nullable().optional(),
      transform: z.enum(['none', 'upper']).optional(),
      placeholder: text(120).optional(),
    })
    .nullable()
    .optional(),
  visualSlot: text(120).nullable().optional(),
  metadataFields: z.array(metadataFieldInput).max(30).optional(),
  visibleWhen: condition,
});
export const valueInput = z.strictObject({
  code: valueCodeSchema.optional(),
  label: name,
  description: text().optional(),
  imageMediaId: idInput.nullable().optional(),
  isDefault: z.boolean().optional(),
  isOff: z.boolean().optional(),
  surchargeMinor: moneyInput.optional(),
  supplierCode: text(120).nullable().optional(),
  visualToken: text(120).nullable().optional(),
  metadata: z
    .record(z.string().min(1).max(80), z.union([text(), z.number().finite(), z.boolean()]))
    .optional(),
  sort: z.number().int().optional(),
  status: statusInput.optional(),
});
export const ruleInput = z.strictObject({
  ...common,
  productIds: z.array(idInput).max(200).optional(),
  when: conditionSchema,
  effect: z.enum(['forbid', 'require']),
  attributeId: idInput,
  valueIds: z.array(idInput).min(1).max(500),
  customerMessage: name.max(500),
});
export const entityInputs = {
  products: productInput,
  components: componentInput,
  groups: groupInput,
  attributes: attributeInput,
  values: valueInput,
  rules: ruleInput,
};
export type StructureEntity = keyof typeof entityInputs;
export const linkInput = z
  .strictObject({
    required: z.boolean(),
    defaultIncluded: z.boolean(),
    surchargeMinor: moneyInput,
    includeLabel: text(120).nullable().optional(),
    sort: z.number().int().optional(),
    rowVersion: rowVersionInput.optional(),
  })
  .refine((v) => !v.required || v.defaultIncluded, 'A required part must be included by default.');
export const settingsInput = z.strictObject({
  items: z
    .array(
      z.union([
        z.strictObject({
          scope: z.enum(['group', 'attribute', 'value']),
          targetId: idInput,
          available: z.boolean(),
          defaultValueId: idInput.nullable().optional(),
        }),
        z.strictObject({
          scope: z.enum(['group', 'attribute', 'value']),
          targetId: idInput,
          remove: z.literal(true),
        }),
      ]),
    )
    .max(500),
});
export const duplicateInput = z.strictObject({ newCode: codeSchema, newName: name });
/** D-022: a new product copied from an existing one; its code comes from the name. */
export const copyProductInput = z.strictObject({ name });
/** D-022: a subcategory is one option group holding one choice option of the same name. */
export const subcategoryInput = z.strictObject({ name, kind: z.enum(['style', 'accent']) });
export const bulkValuesInput = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: idInput,
        rowVersion: rowVersionInput,
        surchargeMinor: moneyInput.optional(),
        status: statusInput.optional(),
        sort: z.number().int().optional(),
      }),
    )
    .min(1)
    .max(500),
});
export const reorderInput = z.strictObject({
  entity: z.enum(['link', 'group', 'attribute', 'value']),
  parentId: idInput,
  orderedIds: z.array(idInput).max(2000),
});
