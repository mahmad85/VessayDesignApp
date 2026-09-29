import type { CatalogSnapshot, CustomerCatalog } from './snapshot';

// The customer projection of a release (CATALOG-ADMIN.md §9), served publicly
// and cached immutably at /api/catalog/v/{version}. It removes supplier data,
// source prices and provenance, rights notes and rule names. Everything left
// is non-sensitive.

/** Largest customer catalog served (the release limit, ADMIN-BACKEND §5). */
export const MAX_CUSTOMER_CATALOG_BYTES = 5 * 1024 * 1024;

/** Choice and fabric metadata keys that never reach customers. */
export const isInternalMetadataKey = (key: string) =>
  key === 'referencePrice' || /^source/.test(key);

function omit<T extends object, K extends keyof T>(item: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...item };
  for (const key of keys) delete copy[key];
  return copy;
}
const publicMetadata = <T extends Record<string, unknown>>(metadata: T) =>
  Object.fromEntries(Object.entries(metadata).filter(([key]) => !isInternalMetadataKey(key))) as T;

export function toCustomerCatalog(snapshot: CatalogSnapshot): CustomerCatalog {
  const customer: CustomerCatalog = {
    ...snapshot,
    media: Object.fromEntries(
      Object.entries(snapshot.media).map(([id, media]) => [id, omit(media, 'rightsStatus')]),
    ),
    components: snapshot.components.map((component) => ({
      ...component,
      groups: component.groups.map((group) => ({
        ...omit(group, 'metadata'),
        attributes: group.attributes.map((attribute) => ({
          ...omit(attribute, 'legacyKey'),
          values: attribute.values.map((value) => ({
            ...omit(value, 'supplierCode'),
            metadata: publicMetadata(value.metadata),
          })),
        })),
      })),
    })),
    products: snapshot.products.map((product) => ({
      ...product,
      components: product.components.map((link) => omit(link, 'metadata')),
    })),
    materials: snapshot.materials.map((material) => ({
      ...material,
      supplier: null,
      millName: material.displayMillName ? material.millName : null,
      metadata: publicMetadata(material.metadata),
    })),
    rules: snapshot.rules.map((rule) => omit(rule, 'name')),
  };
  const bytes = Buffer.byteLength(JSON.stringify(customer));
  if (bytes > MAX_CUSTOMER_CATALOG_BYTES)
    throw new RangeError(`The customer catalog is ${bytes} bytes, over the 5 MB limit.`);
  return customer;
}
