import { z } from 'zod';
import { codeSchema, MEDIA_ROLES, USAGES } from './snapshot';
import { idInput, moneyInput, rowVersionInput, statusInput } from './admin-input';
const text = (max = 200) => z.string().max(max).nullable().optional();
const code = codeSchema.nullable().optional();
const codes = z.array(codeSchema).max(100).optional();
const level = z.enum(['low', 'medium', 'high']).nullable().optional();
export const materialInput = z.strictObject({
  code: codeSchema,
  name: z.string().trim().min(1).max(200),
  status: statusInput.optional(),
  supplierId: idInput.nullable().optional(),
  supplierArticleCode: text(),
  millName: text(),
  displayMillName: z.boolean().optional(),
  collectionName: text(),
  seasonCode: text(),
  colourName: text(),
  colourFamilyCode: code,
  primaryHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  secondaryHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  patternCode: code,
  weaveCode: code,
  textureCode: code,
  sheenCode: code,
  finishCodes: codes,
  composition: z
    .array(z.strictObject({ fibre: codeSchema, percent: z.number().min(1).max(100) }))
    .max(30)
    .optional(),
  weightGsm: z.number().int().min(60).max(700).nullable().optional(),
  superNumber: z.number().int().min(60).max(250).multipleOf(10).nullable().optional(),
  yarnCount: text(),
  widthCm: z.number().int().min(100).max(180).nullable().optional(),
  stretchCode: code,
  seasonCodes: codes,
  climateCodes: codes,
  occasionCodes: codes,
  formality: z.number().int().min(1).max(5).nullable().optional(),
  wrinkleResistance: level,
  breathability: level,
  opacity: level,
  drape: z.enum(['fluid', 'balanced', 'structured']).nullable().optional(),
  careCodes: codes,
  descriptionShort: z.string().max(160).optional(),
  story: z.string().max(2000).optional(),
  tagCodes: codes,
  usages: z.array(z.enum(USAGES)).max(4).optional(),
  productIds: z.array(idInput).max(200).optional(),
  priceBandCode: z
    .string()
    .regex(/^[A-Z0-9]{1,8}$/)
    .nullable()
    .optional(),
  textureScaleCm: z.number().positive().max(9999).nullable().optional(),
});
export const availabilityInput = z.strictObject({
  rowVersion: rowVersionInput,
  availability: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'discontinued', 'unknown']),
  stockMeters: z.number().nonnegative().max(99_999_999).nullable().optional(),
  leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
});
export const materialMediaInput = z.strictObject({
  items: z
    .array(z.strictObject({ mediaId: idInput, role: z.enum(MEDIA_ROLES), sort: z.number().int() }))
    .max(50),
});
export const overridesInput = z.strictObject({
  items: z
    .array(z.strictObject({ productId: idInput, priceMinor: moneyInput.nullable() }))
    .max(200),
});
export const bulkMaterialsInput = z.strictObject({
  ids: z.array(idInput).min(1).max(500),
  set: z
    .strictObject({
      status: statusInput.optional(),
      priceBandCode: materialInput.shape.priceBandCode,
      availability: availabilityInput.shape.availability.optional(),
    })
    .refine((v) => Object.keys(v).length > 0, 'Choose at least one field.'),
});
export const REFERENCE_CONFIRMATION =
  'I confirm the supplier facts and image rights for this item were verified.';
