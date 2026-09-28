// Money in integer minor units (PRICING.md PRC-001). Shared by the client and
// the server: no Node-only imports. Every supported currency has exponent 2.

export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'NZD',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'AED',
  'SGD',
] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** Largest amount in major units for one price or surcharge. */
export const MAX_MAJOR = 10_000_000;
export const MAX_MINOR = MAX_MAJOR * 100;

export function isSupportedCurrency(code: unknown): code is Currency {
  return typeof code === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

export type MoneyParseFailure = 'empty' | 'format' | 'negative' | 'precision' | 'range';
export type MoneyParseResult =
  { ok: true; minor: number } | { ok: false; reason: MoneyParseFailure };

export class MoneyParseError extends Error {
  constructor(
    public reason: MoneyParseFailure,
    input: string,
  ) {
    super(`Not a valid amount (${reason}): ${JSON.stringify(input)}`);
  }
}

/**
 * Exact decimal text to minor units, without floating point: "1299.00" → 129900,
 * "0.5" → 50. Accepts at most two decimals and no grouping separators, signs or
 * exponents. Surrounding spaces are ignored.
 */
export function safeParseMoney(input: string): MoneyParseResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (/^-/.test(text)) return { ok: false, reason: 'negative' };
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(text);
  if (!match) return { ok: false, reason: 'format' };
  const [, whole, fraction = ''] = match;
  if (fraction.length > 2) return { ok: false, reason: 'precision' };
  if (whole.length > String(MAX_MAJOR).length) return { ok: false, reason: 'range' };
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (minor > MAX_MINOR) return { ok: false, reason: 'range' };
  return { ok: true, minor };
}

export function parseMoney(input: string): number {
  const result = safeParseMoney(input);
  if (!result.ok) throw new MoneyParseError(result.reason, input);
  return result.minor;
}

function assertMinor(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || amountMinor > MAX_MINOR)
    throw new RangeError(`Not a valid minor-unit amount: ${amountMinor}`);
}

/** Minor units back to editable decimal text: 129900 → "1299.00". */
export function minorToDecimal(amountMinor: number) {
  assertMinor(amountMinor);
  const whole = Math.floor(amountMinor / 100);
  return `${whole}.${String(amountMinor % 100).padStart(2, '0')}`;
}

/** Customer display, for example “$1,299.00”. */
export function formatMinor(amountMinor: number, currency: string, locale = 'en') {
  assertMinor(amountMinor);
  if (!isSupportedCurrency(currency)) throw new RangeError(`Unsupported currency: ${currency}`);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 100);
}
