import { z } from 'zod';
import { DomainError, type DraftV2 } from '../configuration/types';
import type { EngineContext } from '../configuration/engine';
import { measurementSets } from '../configuration/engine';
import { definitionsForProducts } from '../measurements/definitions';
import { isSelectable } from '../catalog/garment';
import { effectiveSelections } from '../catalog/structure';
import { indexSnapshot, type CatalogSnapshot } from '../catalog/snapshot';
import { quoteCart, valueSurcharge } from '../pricing/quote';
import { orderFindings } from './check-policy';

export const SIGNOFF_VERSION = 'signoff-v1';
export const SIGNOFF_DESIGN =
  'I have reviewed the design of each garment and want it made as shown.';
export const SIGNOFF_MEASUREMENTS =
  'These are my measurements. I confirm they are correct and understand my garments will be made to them.';
export const submitInput = z.strictObject({
  actionId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  checkId: z.string().max(100).optional(),
  signoff: z
    .strictObject({
      design: z.boolean().optional(),
      measurements: z.boolean().optional(),
      statementVersion: z.string().max(60).optional(),
    })
    .optional(),
  tailorReview: z.unknown().optional(),
  acceptTotal: z.strictObject({
    amountMinor: z.number().int().nonnegative(),
    currency: z.string().max(3),
  }),
});
export type SubmitInput = z.infer<typeof submitInput>;
const fail = (
  code: string,
  message: string,
  status = 409,
  details?: Record<string, unknown>,
): never => {
  throw new DomainError(code, message, status, details);
};
export function validateSubmission(
  owner: string,
  draft: DraftV2,
  context: EngineContext,
  input: SubmitInput,
  production = process.env.NODE_ENV === 'production',
) {
  if (!owner.startsWith('user:')) fail('sign_in_required', 'Sign in to place your order.', 401);
  if (input.expectedRevision !== draft.revision)
    fail('revision_conflict', 'Your draft changed. Check and sign off again.');
  if (!draft.garments.length) fail('cart_empty', 'Choose a garment first.', 422);
  const check = draft.review;
  // Commercial changes have their own targeted recovery codes in steps 6–10.
  const stale = draft.garments.some((g) => g.catalogVersion !== context.current.catalog.version);
  const readiness = orderFindings(draft, context, production).filter(
    (f) =>
      f.severity === 'blocker' &&
      (f.target === 'measurements' ||
        f.id.startsWith('design_unaccepted') ||
        (!stale && f.id.startsWith('design_invalid'))),
  );
  if (
    !check ||
    check.id !== input.checkId ||
    check.status !== 'passed' ||
    check.inputRevision !== draft.revision ||
    readiness.length
  )
    fail('check_required', 'Run Check my order for the current draft before signing off.');
  if (
    input.signoff?.design !== true ||
    input.signoff.measurements !== true ||
    input.signoff.statementVersion !== SIGNOFF_VERSION
  )
    fail('signoff_required', 'Confirm both the design and measurements.', 422);
  if (stale) fail('catalog_update_required', 'Review the current catalog before ordering.');
  if (draft.garments.some((g) => !isSelectable(context.availability?.[g.materialCode])))
    fail('material_unavailable', 'A fabric is no longer available. Choose another fabric.');
  const quote = quoteCart(context.current, draft, context.availability);
  if (quote.status !== 'priced' || quote.totalMinor === null)
    fail('quote_unavailable', 'Every garment needs a price.');
  if (
    input.acceptTotal.currency !== quote.currency ||
    input.acceptTotal.amountMinor !== quote.totalMinor
  )
    fail('quote_changed', 'Your total changed. Review it and confirm again.', 409, { quote });
  if (production && context.current.catalog.referenceOnly)
    fail('catalog_not_orderable', 'Reference data cannot be ordered in production.');
  if (typeof input.tailorReview !== 'boolean')
    fail('invalid_input', 'Choose whether to add a tailor review.', 422);
  return quote;
}
const nameCode = z.object({ code: z.string(), name: z.string() });
const money = z.number().int().nonnegative();
const quoteLine = z.object({
  kind: z.enum(['base', 'component', 'group', 'attribute', 'option']),
  category: z.string(),
  categoryLabel: z.string(),
  label: z.string(),
  ref: z.string(),
  lineKind: z.enum(['construction', 'accessory']),
  amountMinor: money,
});
const finding = z.object({
  id: z.string(),
  severity: z.literal('advice'),
  source: z.enum(['rules', 'ai']),
  target: z.enum(['design', 'measurements', 'commercial']),
  garmentId: z.string().optional(),
  field: z.string().optional(),
  title: z.string(),
  description: z.string(),
});
export const orderSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  orderId: z.string(),
  number: z.string(),
  version: z.number().int().positive(),
  submittedAt: z.string(),
  kind: z.enum(['submitted', 'amendment']),
  currency: z.string(),
  catalogVersion: z.number().int().positive(),
  catalogReferenceOnly: z.boolean(),
  renderer: z.string(),
  tailorReviewRequested: z.boolean(),
  customer: z.object({ userId: z.string(), name: z.string(), email: z.string() }),
  check: z.object({
    id: z.string(),
    policyVersion: z.string(),
    ranAt: z.string(),
    aiAdvisory: z.string(),
    findings: z.array(finding),
  }),
  signoff: z.object({
    userId: z.string(),
    at: z.string(),
    statementVersion: z.string(),
    design: z.literal(true),
    measurements: z.literal(true),
    draftRevision: z.number().int(),
    measurementVersion: z.number().int(),
  }),
  amendment: z
    .object({
      reason: z.literal('tailor_review'),
      reviewCaseId: z.string(),
      previousVersion: z.number().int(),
      changedMeasurements: z.array(
        z.object({ id: z.string(), label: z.string(), fromMm: z.number(), toMm: z.number() }),
      ),
      acceptedAt: z.string(),
    })
    .nullable(),
  items: z.array(
    z.object({
      lineNo: z.number().int().positive(),
      quantity: z.number().int().min(1).max(5),
      product: nameCode,
      template: nameCode.nullable(),
      material: z.object({
        code: z.string(),
        name: z.string(),
        colourName: z.string().nullable(),
        supplier: z.object({ id: z.string(), name: z.string() }).nullable(),
        supplierArticleCode: z.string().nullable(),
        composition: z.array(z.object({ fibre: z.string(), percent: z.number() })),
        weightGsm: z.number().nullable(),
        pattern: z.string(),
        weave: z.string().nullable(),
      }),
      components: z.array(nameCode.extend({ included: z.boolean() })),
      options: z.array(
        z.object({
          groupCode: z.string(),
          groupName: z.string(),
          attributeCode: z.string(),
          attributeName: z.string(),
          valueCode: z.string().nullable(),
          valueLabel: z.string().nullable(),
          text: z.string().nullable(),
          supplierCode: z.string().nullable(),
          lineKind: z.enum(['construction', 'accessory']),
          surchargeMinor: money,
        }),
      ),
      preferences: z.object({ occasion: z.string().nullable(), climate: z.string().nullable() }),
      quote: z.object({ lines: z.array(quoteLine), unitMinor: money, totalMinor: money }),
    }),
  ),
  measurements: z.object({
    version: z.number().int(),
    source: z.enum(['customer', '3dlook']),
    confirmed: z.boolean(),
    updatedAt: z.string().nullable(),
    values: z.array(
      z.object({ id: z.string(), label: z.string(), mm: z.number().positive().max(3000) }),
    ),
  }),
  totals: z.object({
    subtotalMinor: money,
    shippingMinor: money,
    totalMinor: money,
    quoteId: z.string(),
    expiresAt: z.string(),
  }),
});
export type OrderSnapshot = z.infer<typeof orderSnapshotSchema>;
export function buildSnapshot(
  draft: DraftV2,
  catalog: CatalogSnapshot,
  identity: { userId: string; name: string; email: string },
  meta: {
    id: string;
    number: string;
    version: number;
    quoteId: string;
    at: string;
    expiresAt: string;
    renderer: string;
    tailorReview: boolean;
  },
): OrderSnapshot {
  const index = indexSnapshot(catalog),
    quote = quoteCart(index, draft);
  return orderSnapshotSchema.parse({
    schemaVersion: 1,
    orderId: meta.id,
    number: meta.number,
    version: meta.version,
    kind: 'submitted',
    submittedAt: meta.at,
    currency: catalog.currency,
    catalogVersion: catalog.version,
    catalogReferenceOnly: catalog.referenceOnly,
    renderer: meta.renderer,
    tailorReviewRequested: meta.tailorReview,
    customer: identity,
    amendment: null,
    check: {
      id: draft.review!.id,
      policyVersion: draft.review!.policyVersion,
      ranAt: draft.review!.createdAt,
      aiAdvisory: draft.review!.aiAdvisory,
      findings: draft.review!.findings.filter((f) => f.severity === 'advice'),
    },
    signoff: {
      userId: identity.userId,
      at: meta.at,
      statementVersion: SIGNOFF_VERSION,
      design: true,
      measurements: true,
      draftRevision: draft.revision,
      measurementVersion: draft.measurements.version,
    },
    items: draft.garments.map((g, i) => {
      const p = index.products.get(g.productCode)!,
        m = catalog.materials.find((m) => m.code === g.materialCode)!,
        t = index.templates.get(g.templateCode ?? ''),
        e = effectiveSelections(index, g),
        priced = quote.garments[i];
      if (priced.status !== 'priced') return fail('quote_unavailable', 'Price not yet available.');
      return {
        lineNo: i + 1,
        quantity: g.quantity,
        product: { code: p.code, name: p.name },
        template: t ? { code: t.code, name: t.name } : null,
        material: {
          code: m.code,
          name: m.name,
          colourName: m.colourName,
          supplier: m.supplier ? { id: m.supplier.id, name: m.supplier.name } : null,
          supplierArticleCode: m.supplier?.articleCode ?? null,
          composition: m.composition,
          weightGsm: m.weightGsm,
          pattern: m.pattern,
          weave: m.weave,
        },
        components: p.components.map((l) => ({
          code: l.componentCode,
          name: index.components.get(l.componentCode)!.name,
          included: g.includedComponents.includes(l.componentCode),
        })),
        options: p.components.flatMap((l) =>
          index.components.get(l.componentCode)!.groups.flatMap((group) =>
            group.attributes
              .filter((a) => e.visibleAttributes.has(a.code))
              .map((a) => {
                const selected = e.selections[a.code],
                  value = a.values.find((v) => v.code === selected),
                  full = catalog.components
                    .flatMap((c) => c.groups)
                    .flatMap((g) => g.attributes)
                    .find((v) => v.code === a.code)
                    ?.values.find((v) => v.code === selected);
                return {
                  groupCode: group.code,
                  groupName: group.name,
                  attributeCode: a.code,
                  attributeName: a.name,
                  valueCode: value?.code ?? null,
                  valueLabel: value?.label ?? null,
                  text: a.inputType === 'text' ? (selected ?? null) : null,
                  supplierCode: full?.supplierCode ?? null,
                  lineKind: group.lineKind,
                  surchargeMinor: value ? valueSurcharge(p, a, value.code) : a.surchargeMinor,
                };
              }),
          ),
        ),
        preferences: g.preferences,
        quote: { lines: priced.lines, unitMinor: priced.unitMinor, totalMinor: priced.totalMinor },
      };
    }),
    measurements: {
      ...draft.measurements,
      values: definitionsForProducts(
        measurementSets({ current: index, releases: new Map([[catalog.version, index]]) }, draft),
      )
        .filter((m) => draft.measurements.values[m.id])
        .map((m) => ({ id: m.id, label: m.label, mm: draft.measurements.values[m.id] })),
    },
    totals: {
      subtotalMinor: quote.subtotalMinor,
      shippingMinor: quote.shippingMinor,
      totalMinor: quote.totalMinor,
      quoteId: meta.quoteId,
      expiresAt: meta.expiresAt,
    },
  });
}
