import { createHash } from 'node:crypto';

// Stable JSON for checksums (ADMIN-BACKEND.md §1, §5): object keys sorted at
// every level, array order kept, undefined object properties omitted as in
// JSON.stringify. Values JSON cannot represent exactly are rejected rather
// than silently changed.

export function canonicalJson(value: unknown): string {
  return serialise(value, '$');
}

function serialise(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}.`);
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value))
        return `[${value.map((item, index) => serialise(item ?? null, `${path}[${index}]`)).join(',')}]`;
      if (
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      )
        throw new TypeError(`Only plain objects can be serialised (${path}).`);
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${serialise(record[key], `${path}.${key}`)}`)
        .join(',')}}`;
    }
    default:
      throw new TypeError(`Unsupported ${typeof value} at ${path}.`);
  }
}

export function sha256Hex(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** sha256 of the canonical JSON: equal for equal content, whatever the key order. */
export function checksum(value: unknown) {
  return sha256Hex(canonicalJson(value));
}
