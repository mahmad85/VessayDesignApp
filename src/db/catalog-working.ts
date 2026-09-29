import { compileWorkingCopy, inactiveLookups } from '@/modules/catalog/compile';
import { snapshotChecksum } from '@/modules/catalog/snapshot-checksum';
import { indexSnapshot } from '@/modules/catalog/snapshot';
import {
  validateRelease,
  type ValidationReport,
  type EntityType,
} from '@/modules/catalog/validate-release';
import { checksum } from '@/lib/canonical-json';
import { loadWorkingRows } from './catalog-admin-repository';
import { getDatabase, type Query } from './client';
import { dto, missing, type Row } from './admin-mutations';

let cached: { key: string; report: ValidationReport } | undefined;
export async function workingCatalog(query?: Query) {
  const rows = await loadWorkingRows(query ?? (await getDatabase()).query);
  const snapshot = compileWorkingCopy(rows);
  const workingChecksum = snapshotChecksum(snapshot);
  const inactive = inactiveLookups(rows);
  const key = checksum({ workingChecksum, inactive });
  const report =
    cached?.key === key ? cached.report : validateRelease(snapshot, { inactiveLookups: inactive });
  cached = { key, report };
  return { rows, snapshot, index: indexSnapshot(snapshot), workingChecksum, report };
}
export type Badges = { errors: string[]; warnings: string[] };
export function badgesFor(report: ValidationReport, entity: EntityType, code: string): Badges {
  return {
    errors: report.errors
      .filter((i) => i.entity === entity && i.entityCode === code)
      .map((i) => i.code),
    warnings: report.warnings
      .filter((i) => i.entity === entity && i.entityCode === code)
      .map((i) => i.code),
  };
}
export const mergeBadges = (...items: Badges[]): Badges => ({
  errors: [...new Set(items.flatMap((i) => i.errors))],
  warnings: [...new Set(items.flatMap((i) => i.warnings))],
});
export async function productTree(id: string) {
  const { rows, report } = await workingCatalog();
  const product = rows.products.find((p) => p.id === id) ?? missing();
  const settings = rows.settings.filter((s) => s.product_id === id);
  const effective: Record<
    'groups' | 'attributes' | 'values',
    Record<string, { available: boolean; default: string | boolean | null; surchargeMinor: number }>
  > = { groups: {}, attributes: {}, values: {} };
  const settingFor = (scope: string, target: string) =>
    settings.find(
      (s) => s.scope === scope && (s.group_id ?? s.attribute_id ?? s.value_id) === target,
    );
  const order = <T extends { sort: number; id?: string; component_id?: string }>(items: T[]) =>
    items.sort(
      (a, b) =>
        a.sort - b.sort ||
        String(a.id ?? a.component_id).localeCompare(String(b.id ?? b.component_id)),
    );
  const links = order(rows.productComponents.filter((l) => l.product_id === id)).map((link) => {
    const component = rows.components.find((c) => c.id === link.component_id)!;
    const groups = order(rows.groups.filter((g) => g.component_id === component.id)).map(
      (group) => {
        const gs = settingFor('group', group.id);
        const ga = gs?.available !== false;
        effective.groups[group.id] = {
          available: ga,
          default: null,
          surchargeMinor: gs?.surcharge_override_minor ?? group.surcharge_minor,
        };
        const attributes = order(rows.attributes.filter((a) => a.group_id === group.id)).map(
          (attr) => {
            const as = settingFor('attribute', attr.id);
            const aa = ga && as?.available !== false;
            const values = order(rows.values.filter((v) => v.attribute_id === attr.id)).map(
              (value) => {
                const vs = settingFor('value', value.id);
                effective.values[value.id] = {
                  available: aa && vs?.available !== false,
                  default: as?.default_value_id
                    ? as.default_value_id === value.id
                    : value.is_default,
                  surchargeMinor: vs?.surcharge_override_minor ?? value.surcharge_minor,
                };
                return {
                  ...dto(value as unknown as Row),
                  badges: badgesFor(report, 'value', `${attr.code}::${value.code}`),
                };
              },
            );
            effective.attributes[attr.id] = {
              available: aa,
              default:
                as?.default_value_id ??
                rows.values.find((v) => v.attribute_id === attr.id && v.is_default)?.id ??
                null,
              surchargeMinor: as?.surcharge_override_minor ?? attr.surcharge_minor,
            };
            return {
              ...dto(attr as unknown as Row),
              values,
              badges: mergeBadges(
                badgesFor(report, 'attribute', attr.code),
                ...values.map((v) => v.badges),
              ),
            };
          },
        );
        return {
          ...dto(group as unknown as Row),
          attributes,
          badges: mergeBadges(
            badgesFor(report, 'group', group.code),
            ...attributes.map((a) => a.badges),
          ),
        };
      },
    );
    return {
      ...dto(link as unknown as Row),
      component: {
        ...dto(component as unknown as Row),
        groups,
        badges: mergeBadges(
          badgesFor(report, 'component', component.code),
          ...groups.map((g) => g.badges),
        ),
      },
    };
  });
  return {
    product: {
      ...dto(product as unknown as Row),
      badges: mergeBadges(
        badgesFor(report, 'product', product.code),
        ...links.map((l) => l.component.badges),
      ),
    },
    links,
    settings: settings.map((s) => dto(s as unknown as Row)),
    effective,
  };
}
