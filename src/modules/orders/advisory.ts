import { z } from 'zod';
import type { DraftV2, OrderCheck } from '../configuration/types';
import type { EngineContext } from '../configuration/engine';
import { measurementSets } from '../configuration/engine';
import { requiredDefinitionsForProducts } from '../measurements/definitions';
import { effectiveSelections } from '../catalog/structure';
// This projection is also the only input an optional advisory provider may receive.
// No body values, contact details, supplier identities or conversation are included.
export function advisoryContext(draft: DraftV2, context: EngineContext) {
  return {
    garments: draft.garments.map((g) => {
      const index = context.releases.get(g.catalogVersion) ?? context.current,
        product = index.products.get(g.productCode),
        fabric = index.materials.get(g.materialCode),
        effective = effectiveSelections(index, g);
      return {
        product: product?.name ?? g.productCode,
        fabric: fabric
          ? {
              name: fabric.name,
              composition: fabric.composition,
              weightGsm: fabric.weightGsm,
              pattern: fabric.pattern,
              climates: fabric.climates,
              occasions: fabric.occasions,
            }
          : null,
        options: [...effective.visibleAttributes].map((code) => {
          const a = index.attributes.get(code)?.attribute,
            v = effective.selections[code];
          return {
            option: a?.name ?? code,
            choice:
              a?.inputType === 'text'
                ? 'Personalised text supplied'
                : (a?.values.find((x) => x.code === v)?.label ?? null),
          };
        }),
        preferences: g.preferences,
      };
    }),
    measurements: {
      source: draft.measurements.source,
      complete: requiredDefinitionsForProducts(measurementSets(context, draft)).every(
        (m) => !!draft.measurements.values[m.id],
      ),
      confirmed: draft.measurements.confirmed,
    },
  };
}
const output = z.strictObject({
  advice: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(100),
        description: z.string().trim().min(1).max(300),
        target: z.enum(['design', 'measurements', 'commercial']),
      }),
    )
    .max(5),
});
export type AdvisoryProvider = (
  input: ReturnType<typeof advisoryContext>,
  signal: AbortSignal,
) => Promise<unknown>;
export async function advisoryFindings(
  input: ReturnType<typeof advisoryContext>,
  provider?: AdvisoryProvider,
  timeoutMs = 20000,
): Promise<{ aiAdvisory: OrderCheck['aiAdvisory']; findings: OrderCheck['findings'] }> {
  if (!provider) return { aiAdvisory: 'not_configured', findings: [] };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      provider(input, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('advisory_timeout'));
        }, timeoutMs);
      }),
    ]);
    const parsed = output.parse(result);
    return {
      aiAdvisory: 'completed',
      findings: parsed.advice.map((f, i) => ({
        ...f,
        id: `ai-advice-${i}`,
        severity: 'advice',
        source: 'ai',
      })),
    };
  } catch {
    return { aiAdvisory: 'unavailable', findings: [] };
  } finally {
    clearTimeout(timer);
  }
}
