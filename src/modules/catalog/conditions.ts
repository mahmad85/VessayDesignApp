import { z } from 'zod';
import type { CatalogIndex } from './snapshot';

// Declarative visibility and rule conditions (CATALOG-ADMIN.md §5.1). One
// evaluator serves every command path: controls, chat, templates and rebase
// (CAT-010).

export type MaterialLookupField = 'pattern' | 'weave' | 'colourFamily' | 'stretch';
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { attr: string; in: string[] }
  | { attr: string; answered: boolean }
  | { component: string; included: boolean }
  | {
      material: {
        codes?: string[];
        lookup?: { field: MaterialLookupField; in: string[] };
      };
    }
  | { product: string[] };

export const CONDITION_MAX_DEPTH = 6;
export const CONDITION_MAX_NODES = 50;

/** Lookup type behind each material field a condition may test. */
export const MATERIAL_LOOKUP_TYPES: Record<MaterialLookupField, string> = {
  pattern: 'pattern',
  weave: 'weave',
  colourFamily: 'colour_family',
  stretch: 'stretch',
};

const code = z.string().min(1).max(180);
const codes = z.array(code).min(1).max(200);

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(conditionSchema).min(1).max(CONDITION_MAX_NODES) }),
    z.strictObject({ any: z.array(conditionSchema).min(1).max(CONDITION_MAX_NODES) }),
    z.strictObject({ not: conditionSchema }),
    z.strictObject({ attr: code, in: codes }),
    z.strictObject({ attr: code, answered: z.boolean() }),
    z.strictObject({ component: code, included: z.boolean() }),
    z.strictObject({
      material: z
        .strictObject({
          codes: codes.optional(),
          lookup: z
            .strictObject({
              field: z.enum(['pattern', 'weave', 'colourFamily', 'stretch']),
              in: codes,
            })
            .optional(),
        })
        .refine((value) => value.codes || value.lookup, 'A material test needs codes or a lookup.'),
    }),
    z.strictObject({ product: codes }),
  ]),
);

export type ConditionMaterial = {
  code: string;
  pattern: string | null;
  weave: string | null;
  colourFamily: string | null;
  stretch: string | null;
};
export type ConditionContext = {
  productCode: string;
  includedComponents: ReadonlySet<string>;
  /** Effective selections: values of visible attributes only (CATALOG-ADMIN §5.2). */
  selections: Readonly<Record<string, string | undefined>>;
  material: ConditionMaterial | null;
};

export function evaluateCondition(condition: Condition, context: ConditionContext): boolean {
  if ('all' in condition) return condition.all.every((item) => evaluateCondition(item, context));
  if ('any' in condition) return condition.any.some((item) => evaluateCondition(item, context));
  if ('not' in condition) return !evaluateCondition(condition.not, context);
  if ('attr' in condition) {
    const value = context.selections[condition.attr];
    if ('in' in condition) return value !== undefined && condition.in.includes(value);
    return (value !== undefined && value.trim() !== '') === condition.answered;
  }
  if ('component' in condition)
    return context.includedComponents.has(condition.component) === condition.included;
  if ('material' in condition) {
    const { material } = context;
    if (!material) return false;
    const { codes: allowed, lookup } = condition.material;
    if (allowed && !allowed.includes(material.code)) return false;
    if (lookup) {
      const value = material[lookup.field];
      if (value === null || !lookup.in.includes(value)) return false;
    }
    return true;
  }
  return condition.product.includes(context.productCode);
}

export type ConditionIssue = {
  kind:
    | 'schema'
    | 'depth'
    | 'size'
    | 'unknown_attribute'
    | 'unknown_value'
    | 'unknown_component'
    | 'unknown_product'
    | 'unknown_material'
    | 'unknown_lookup';
  path: string;
  message: string;
};

function measure(condition: Condition, depth = 1): { depth: number; nodes: number } {
  const children =
    'all' in condition
      ? condition.all
      : 'any' in condition
        ? condition.any
        : 'not' in condition
          ? [condition.not]
          : [];
  return children.reduce(
    (total, child) => {
      const next = measure(child, depth + 1);
      return { depth: Math.max(total.depth, next.depth), nodes: total.nodes + next.nodes };
    },
    { depth, nodes: 1 },
  );
}

/** Shape, limits and every referenced code, against a catalog index (publish error `condition_invalid`). */
export function validateCondition(input: unknown, index: CatalogIndex): ConditionIssue[] {
  const parsed = conditionSchema.safeParse(input);
  if (!parsed.success)
    return parsed.error.issues.map((issue) => ({
      kind: 'schema',
      path: issue.path.join('.'),
      message: issue.message,
    }));
  const issues: ConditionIssue[] = [];
  const size = measure(parsed.data);
  if (size.depth > CONDITION_MAX_DEPTH)
    issues.push({
      kind: 'depth',
      path: '',
      message: `Conditions can be nested at most ${CONDITION_MAX_DEPTH} levels deep.`,
    });
  if (size.nodes > CONDITION_MAX_NODES)
    issues.push({
      kind: 'size',
      path: '',
      message: `A condition can have at most ${CONDITION_MAX_NODES} parts.`,
    });
  const visit = (condition: Condition, path: string) => {
    if ('all' in condition) condition.all.forEach((item, i) => visit(item, `${path}all.${i}.`));
    else if ('any' in condition)
      condition.any.forEach((item, i) => visit(item, `${path}any.${i}.`));
    else if ('not' in condition) visit(condition.not, `${path}not.`);
    else if ('attr' in condition) {
      const attribute = index.attributes.get(condition.attr);
      if (!attribute)
        issues.push({
          kind: 'unknown_attribute',
          path: `${path}attr`,
          message: `Unknown option “${condition.attr}”.`,
        });
      else if ('in' in condition)
        for (const value of condition.in)
          if (!index.values.has(`${condition.attr}::${value}`))
            issues.push({
              kind: 'unknown_value',
              path: `${path}in`,
              message: `Unknown choice “${value}” for “${condition.attr}”.`,
            });
    } else if ('component' in condition) {
      if (!index.components.has(condition.component))
        issues.push({
          kind: 'unknown_component',
          path: `${path}component`,
          message: `Unknown part “${condition.component}”.`,
        });
    } else if ('material' in condition) {
      for (const materialCode of condition.material.codes ?? [])
        if (!index.materials.has(materialCode))
          issues.push({
            kind: 'unknown_material',
            path: `${path}material.codes`,
            message: `Unknown fabric “${materialCode}”.`,
          });
      const lookup = condition.material.lookup;
      if (lookup) {
        const type = MATERIAL_LOOKUP_TYPES[lookup.field];
        for (const value of lookup.in)
          if (!index.lookups.get(type)?.has(value))
            issues.push({
              kind: 'unknown_lookup',
              path: `${path}material.lookup.in`,
              message: `Unknown ${type} value “${value}”.`,
            });
      }
    } else
      for (const productCode of condition.product)
        if (!index.products.has(productCode))
          issues.push({
            kind: 'unknown_product',
            path: `${path}product`,
            message: `Unknown product “${productCode}”.`,
          });
  };
  visit(parsed.data, '');
  return issues;
}
