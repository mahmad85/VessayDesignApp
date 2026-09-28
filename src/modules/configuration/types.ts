import { z } from 'zod';
import type { Product } from '../catalog/catalog';
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
