import { z } from 'zod';
import type { Query } from './client';

// Audit events for admin and system mutations (ADMIN-BACKEND.md §2 “Audit”).
// Call with the transaction's query function so the event commits or rolls
// back with the change it records. Summaries hold only non-personal scalar
// fields: never supplier contact values, customer data or free-form documents.

const scalar = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);
const summarySchema = z
  .object({
    fields: z.array(z.string().min(1).max(120)).max(200),
    before: z.record(z.string(), scalar).optional(),
    after: z.record(z.string(), scalar).optional(),
  })
  .strict();
const eventSchema = z
  .object({
    actor: z.string().regex(/^(user:[A-Za-z0-9_-]{1,120}|system:[a-z][a-z_]{0,40})$/),
    action: z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/),
    entityType: z.string().regex(/^[a-z][a-z0-9_]{0,60}$/),
    entityId: z.string().min(1).max(200).nullable().optional(),
    summary: summarySchema.optional(),
  })
  .strict();

export type AuditSummary = z.infer<typeof summarySchema>;
export type AuditEvent = z.input<typeof eventSchema>;

export async function writeAudit(query: Query, event: AuditEvent) {
  const valid = eventSchema.parse(event);
  const id = crypto.randomUUID();
  await query(
    'INSERT INTO audit_events(id,actor,action,entity_type,entity_id,summary) VALUES($1,$2,$3,$4,$5,$6)',
    [
      id,
      valid.actor,
      valid.action,
      valid.entityType,
      valid.entityId ?? null,
      JSON.stringify(valid.summary ?? { fields: [] }),
    ],
  );
  return id;
}
