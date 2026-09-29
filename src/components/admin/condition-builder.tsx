'use client';
import type { Condition, MaterialLookupField } from '@/modules/catalog/conditions';
import type { RuntimeIndex } from '@/modules/catalog/snapshot';
import { FieldInput, options } from './editor';
export function conditionSummary(c: Condition | null, index: RuntimeIndex): string {
  if (!c) return 'Always shown';
  if ('all' in c) return c.all.map((x) => conditionSummary(x, index)).join(' AND ');
  if ('any' in c) return `(${c.any.map((x) => conditionSummary(x, index)).join(' OR ')})`;
  if ('not' in c) return `Not (${conditionSummary(c.not, index)})`;
  if ('attr' in c) {
    const name = index.attributes.get(c.attr)?.attribute.name ?? c.attr;
    return 'in' in c
      ? `${name} is ${c.in.map((v) => index.values.get(`${c.attr}::${v}`)?.value.label ?? v).join(' or ')}`
      : `${name} ${c.answered ? 'has' : 'has no'} answer`;
  }
  if ('component' in c)
    return `${index.components.get(c.component)?.name ?? c.component} is ${c.included ? 'included' : 'not included'}`;
  if ('product' in c)
    return `Product is ${c.product.map((p) => index.products.get(p)?.name ?? p).join(' or ')}`;
  return c.material.codes
    ? `Fabric is ${c.material.codes.map((m) => index.materials.get(m)?.name ?? m).join(' or ')}`
    : `Fabric ${c.material.lookup?.field} is ${c.material.lookup?.in.join(' or ')}`;
}
export function ConditionBuilder({
  value,
  onChange,
  index,
  depth = 1,
}: {
  value: Condition | null;
  onChange: (v: Condition | null) => void;
  index: RuntimeIndex;
  depth?: number;
}) {
  const type = !value
    ? 'always'
    : 'all' in value
      ? 'all'
      : 'any' in value
        ? 'any'
        : 'not' in value
          ? 'not'
          : 'attr' in value
            ? 'in' in value
              ? 'choice'
              : 'answered'
            : 'component' in value
              ? 'part'
              : 'product' in value
                ? 'product'
                : value.material.codes
                  ? 'fabric'
                  : 'fabric property';
  const base = (): Condition => ({
    component: index.catalog.components[0]?.code ?? '',
    included: true,
  });
  function choose(type: string) {
    if (type === 'always') return onChange(null);
    if (type === 'all' || type === 'any') return onChange({ [type]: [base()] } as Condition);
    if (type === 'not') return onChange({ not: base() });
    if (type === 'part') return onChange(base());
    if (type === 'product') return onChange({ product: [index.catalog.products[0]?.code ?? ''] });
    if (type === 'fabric')
      return onChange({ material: { codes: [index.catalog.materials[0]?.code ?? ''] } });
    if (type === 'fabric property')
      return onChange({ material: { lookup: { field: 'pattern', in: [] } } });
    const attr = [...index.attributes.keys()][0] ?? '';
    onChange(type === 'answered' ? { attr, answered: true } : { attr, in: [] });
  }
  const select = (
    key: string,
    label: string,
    values: { value: string; label: string }[],
    selected: unknown,
    change: (v: unknown) => void,
    multi = false,
  ) => (
    <FieldInput
      field={{ key, label, type: multi ? 'multi' : 'select', options: values }}
      value={selected}
      onChange={change}
    />
  );
  return (
    <fieldset className="admin-condition">
      <legend>{depth === 1 ? 'Show when…' : `Condition level ${depth}`}</legend>
      {select(
        'condition-type',
        'Condition type',
        options([
          'always',
          ...(depth < 6 ? ['all', 'any', 'not'] : []),
          'choice',
          'answered',
          'part',
          'product',
          'fabric',
          'fabric property',
        ]),
        type,
        (v) => choose(String(v)),
      )}
      {value &&
        ('all' in value || 'any' in value) &&
        (() => {
          const children = 'all' in value ? value.all : value.any;
          const key = 'all' in value ? 'all' : 'any';
          return (
            <>
              {children.map((child, i) => (
                <div key={i}>
                  <ConditionBuilder
                    value={child}
                    index={index}
                    depth={depth + 1}
                    onChange={(v) => {
                      const next = children
                        .filter((_, j) => v || j !== i)
                        .map((c, j) => (j === i && v ? v : c));
                      onChange(next.length ? ({ [key]: next } as Condition) : null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        children.length === 1
                          ? null
                          : ({ [key]: children.filter((_, j) => j !== i) } as Condition),
                      )
                    }
                  >
                    Remove condition {i + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={children.length >= 10}
                onClick={() => onChange({ [key]: [...children, base()] } as Condition)}
              >
                Add condition
              </button>
            </>
          );
        })()}
      {value && 'not' in value && (
        <ConditionBuilder
          value={value.not}
          index={index}
          depth={depth + 1}
          onChange={(v) => onChange(v ? { not: v } : null)}
        />
      )}
      {value && 'attr' in value && (
        <>
          {select(
            'condition-option',
            'Option',
            [...index.attributes].map(([code, x]) => ({ value: code, label: x.attribute.name })),
            value.attr,
            (v) =>
              onChange(
                'in' in value
                  ? { attr: String(v), in: [] }
                  : { attr: String(v), answered: value.answered },
              ),
          )}
          {'in' in value ? (
            select(
              'condition-choices',
              'Is one of',
              (index.attributes.get(value.attr)?.attribute.values ?? []).map((v) => ({
                value: v.code,
                label: v.label,
              })),
              value.in,
              (v) => onChange({ ...value, in: v as string[] }),
              true,
            )
          ) : (
            <FieldInput
              field={{ key: 'answered', label: 'Must be answered', type: 'checkbox' }}
              value={value.answered}
              onChange={(v) => onChange({ ...value, answered: v === true })}
            />
          )}
        </>
      )}
      {value && 'component' in value && (
        <>
          {select(
            'condition-part',
            'Part',
            index.catalog.components.map((c) => ({ value: c.code, label: c.name })),
            value.component,
            (v) => onChange({ ...value, component: String(v) }),
          )}
          <FieldInput
            field={{ key: 'included', label: 'Included', type: 'checkbox' }}
            value={value.included}
            onChange={(v) => onChange({ ...value, included: v === true })}
          />
        </>
      )}
      {value &&
        'product' in value &&
        select(
          'condition-products',
          'Products',
          index.catalog.products.map((p) => ({ value: p.code, label: p.name })),
          value.product,
          (v) => onChange({ product: v as string[] }),
          true,
        )}
      {value &&
        'material' in value &&
        value.material.codes &&
        select(
          'condition-materials',
          'Fabrics',
          index.catalog.materials.map((m) => ({ value: m.code, label: m.name })),
          value.material.codes,
          (v) => onChange({ material: { codes: v as string[] } }),
          true,
        )}
      {value &&
        'material' in value &&
        value.material.lookup &&
        (() => {
          const lookup = value.material.lookup;
          const type = {
            pattern: 'pattern',
            weave: 'weave',
            colourFamily: 'colour_family',
            stretch: 'stretch',
          }[lookup.field];
          return (
            <>
              {select(
                'fabric-property',
                'Fabric property',
                options(['pattern', 'weave', 'colourFamily', 'stretch']),
                lookup.field,
                (v) =>
                  onChange({ material: { lookup: { field: v as MaterialLookupField, in: [] } } }),
              )}
              {select(
                'fabric-values',
                'Fabric values',
                [...(index.lookups.get(type)?.values() ?? [])].map((v) => ({
                  value: v.code,
                  label: v.label,
                })),
                lookup.in,
                (v) => onChange({ material: { lookup: { ...lookup, in: v as string[] } } }),
                true,
              )}
            </>
          );
        })()}
      <p className="admin-condition-summary">{conditionSummary(value, index)}</p>
    </fieldset>
  );
}
