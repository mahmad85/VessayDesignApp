import { z } from 'zod';
import type { Product } from '../catalog/catalog';
import { codeSchema } from '../catalog/snapshot';
export const designPatch = z
  .object({
    product: z.enum(['suit', 'shirt', 'blazer']).optional(),
    fabricId: z.string().max(80).optional(),
    occasion: z.enum(['Office', 'Wedding', 'Formal event', 'Everyday']).optional(),
    climate: z.enum(['Warm', 'All season', 'Cool']).optional(),
    fit: z.enum(['Tailored', 'Classic', 'Relaxed']).optional(),
    lapel: z.enum(['Notch', 'Peak']).optional(),
    pockets: z.enum(['Flap', 'Patch']).optional(),
    closure: z.enum(['One button', 'Two buttons']).optional(),
    collar: z.enum(['Spread', 'Point']).optional(),
    cuffs: z.enum(['Button', 'French']).optional(),
    skinTone: z.enum(['porcelain', 'warm', 'tan', 'deep']).optional(),
    customizations: z
      .record(z.string().min(1).max(180), z.string().max(180))
      .refine((value) => Object.keys(value).length <= 100)
      .optional(),
  })
  .strict();
export type DesignPatch = z.infer<typeof designPatch>;
export type Design = {
  product: Product;
  fabricId: string;
  occasion: string;
  climate: string;
  fit: string;
  lapel: 'Notch' | 'Peak';
  pockets: 'Flap' | 'Patch';
  closure: 'One button' | 'Two buttons';
  collar: 'Spread' | 'Point';
  cuffs: 'Button' | 'French';
  skinTone: 'porcelain' | 'warm' | 'tan' | 'deep';
  customizations: Record<string, string>;
  confirmed: string[];
};
export type MeasurementValues = Record<string, number>;
export type Measurements = {
  version: number;
  values: MeasurementValues;
  source: 'customer' | '3dlook';
  confirmed: boolean;
  updatedAt: string | null;
};
export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  createdAt: string;
  mode?: 'ai' | 'guided';
  suggestion?: DesignPatch;
  basisRevision?: number;
};
export type Finding = {
  id: string;
  severity: 'blocker' | 'advice' | 'expert';
  title: string;
  description: string;
  target: 'design' | 'measurements' | 'commercial';
};
export type Review = {
  id: string;
  inputRevision: number;
  mode: 'automated' | 'human';
  status: 'correction_required' | 'expert_required' | 'approved' | 'not_submitted';
  findings: Finding[];
  createdAt: string;
  checkoutEligible: boolean;
};
export type Draft = {
  id: string;
  revision: number;
  design: Design;
  measurements: Measurements;
  messages: ChatMessage[];
  review: Review | null;
  createdAt: string;
  updatedAt: string;
};
export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('design'),
    patch: designPatch,
    confirmCategoryChange: z.boolean().optional(),
  }),
  z.object({ type: z.literal('accept_design') }),
  z.object({
    type: z.literal('measurements'),
    values: z.record(z.string(), z.number().finite().positive().max(3000)),
    confirm: z.boolean(),
    source: z.enum(['customer', '3dlook']).optional(),
  }),
  z.object({ type: z.literal('review'), mode: z.enum(['automated', 'human']) }),
]);
export type Command = z.infer<typeof commandSchema>;
export const commandEnvelope = z.object({
  actionId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  command: commandSchema,
});

// Draft v2 garments (ADMIN-BACKEND.md §7.1, CRT-001). A garment pins the
// catalog release it was configured against; every code refers to that release.

export type GarmentConfirmation = 'product' | 'material' | 'preferences' | 'details';
export type Garment = {
  /** uuid; for an upgraded v1 draft it equals the draft id (deterministic). */
  id: string;
  productCode: string;
  templateCode: string | null;
  catalogVersion: number;
  materialCode: string;
  /** Component codes, required ones included. */
  includedComponents: string[];
  /** Attribute code → value code, or the text of a text option. */
  selections: Record<string, string>;
  preferences: { occasion: string | null; climate: string | null };
  confirmed: GarmentConfirmation[];
  /** 1–5 identical copies for the same measurement profile (CRT-002). */
  quantity: number;
};
export const garmentPatch = z
  .object({
    productCode: codeSchema.optional(),
    materialCode: codeSchema.optional(),
    preferences: z
      .object({
        occasion: codeSchema.nullable().optional(),
        climate: codeSchema.nullable().optional(),
      })
      .strict()
      .optional(),
    components: z
      .record(codeSchema, z.boolean())
      .refine((value) => Object.keys(value).length <= 10)
      .optional(),
    selections: z
      .record(z.string().min(1).max(180), z.string().max(180))
      .refine((value) => Object.keys(value).length <= 100)
      .optional(),
  })
  .strict();
export type GarmentPatch = z.infer<typeof garmentPatch>;
/** A change the customer must accept: removed or replaced choices (CATALOG-ADMIN §5.3, §7.8). */
export type Impact = {
  garmentId: string;
  kind:
    | 'selection_removed'
    | 'selection_replaced'
    | 'component_removed'
    | 'material_unavailable'
    | 'product_unavailable';
  attributeCode?: string;
  from?: string;
  to?: string;
  message: string;
};

/** The pre-D-019 draft (no `schemaVersion`), read only to upgrade it (ADMIN-BACKEND §7.2). */
export type DraftV1 = Draft;
export type SkinTone = Design['skinTone'];
export type ChatSuggestion = { garmentId: string | null; patch: GarmentPatch };
export type ChatMessageV2 = Omit<ChatMessage, 'suggestion'> & { suggestion?: ChatSuggestion };
export type OrderCheck = {
  id: string;
  inputRevision: number;
  policyVersion: 'check-policy-v1';
  status: 'correction_required' | 'passed';
  findings: {
    id: string;
    severity: 'blocker' | 'advice';
    source: 'rules' | 'ai';
    target: 'design' | 'measurements' | 'commercial';
    garmentId?: string;
    field?: string;
    title: string;
    description: string;
  }[];
  aiAdvisory: 'completed' | 'unavailable' | 'not_configured';
  createdAt: string;
};
export type DraftV2 = {
  schemaVersion: 2;
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  /** The garment commands target when they name none; null when the cart is empty. */
  activeGarmentId: string | null;
  /** 0–10 garments (CRT-001). */
  garments: Garment[];
  skinTone: SkinTone;
  /** One measurement profile per draft (CRT-004). */
  measurements: Measurements;
  messages: ChatMessageV2[];
  review: OrderCheck | null;
  orders: { orderId: string; number: string; submittedAt: string }[];
};

export const MAX_GARMENTS = 10;
const garmentId = z.uuid();
export const commandSchemaV2 = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_garment'),
    productCode: codeSchema,
    templateCode: codeSchema.nullable().optional(),
    /** Start in this fabric (from /fabrics); checked like a fabric change. */
    materialCode: codeSchema.optional(),
  }),
  z.object({
    type: z.literal('remove_garment'),
    garmentId,
    confirm: z.boolean().optional(),
  }),
  z.object({ type: z.literal('select_garment'), garmentId }),
  /** Clears the cart, measurements and conversation; submitted orders stay. */
  z.object({ type: z.literal('start_over'), confirm: z.literal(true) }),
  z.object({
    type: z.literal('design'),
    garmentId: garmentId.optional(),
    patch: garmentPatch,
    confirmCategoryChange: z.boolean().optional(),
    confirmImpact: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('set_quantity'),
    garmentId,
    quantity: z.number().int().min(1).max(5),
  }),
  z.object({ type: z.literal('accept_design'), garmentId: garmentId.optional() }),
  z.object({
    type: z.literal('rebase_catalog'),
    garmentId,
    confirmImpact: z.boolean(),
  }),
  z.object({
    type: z.literal('appearance'),
    skinTone: z.enum(['porcelain', 'warm', 'tan', 'deep']),
  }),
  z.object({
    type: z.literal('measurements'),
    values: z.record(z.string(), z.number().finite().positive().max(3000)),
    confirm: z.boolean(),
    source: z.enum(['customer', '3dlook']).optional(),
  }),
]);
export type CommandV2 = z.infer<typeof commandSchemaV2>;
export const commandEnvelopeV2 = z.object({
  actionId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  command: commandSchemaV2,
});

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
    /** Optional structured context, returned as `error.details` (ADMIN-BACKEND §2 “Errors”). */
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
