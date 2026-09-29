import { describe, it, expect } from 'vitest';
import {
  MAX_MINOR,
  SUPPORTED_CURRENCIES,
  formatMinor,
  isSupportedCurrency,
  minorToDecimal,
  parseMoney,
  safeParseMoney,
} from '../src/lib/money';
import { canonicalJson, checksum, sha256Hex } from '../src/lib/canonical-json';

// PRICING.md PRC-001. SYNTHETIC amounts only.

describe('parseMoney', () => {
  it('converts decimal text to exact minor units', () => {
    expect(parseMoney('0')).toBe(0);
    expect(parseMoney('0.5')).toBe(50);
    expect(parseMoney('0.05')).toBe(5);
    expect(parseMoney('1299.00')).toBe(129900);
    expect(parseMoney('19.95')).toBe(1995);
    expect(parseMoney(' 7 ')).toBe(700);
    expect(parseMoney('10000000')).toBe(MAX_MINOR);
    expect(parseMoney('10000000.00')).toBe(MAX_MINOR);
  });

  it('never uses binary floating point', () => {
    // parseFloat('0.29') * 100 === 28.999999999999996
    expect(parseMoney('0.29')).toBe(29);
    expect(parseMoney('1.13')).toBe(113);
    expect(parseMoney('4.35')).toBe(435);
  });

  it('rejects grouping, precision, signs, exponents, ranges and empty input with a reason', () => {
    const cases: [string, string][] = [
      ['1,000', 'format'],
      ['12.345', 'precision'],
      ['-1', 'negative'],
      ['-0.01', 'negative'],
      ['+1', 'format'],
      ['1e3', 'format'],
      ['.5', 'format'],
      ['5.', 'format'],
      ['01', 'format'],
      ['$10', 'format'],
      ['NaN', 'format'],
      ['10000000.01', 'range'],
      ['123456789', 'range'],
      ['', 'empty'],
      ['   ', 'empty'],
    ];
    for (const [input, reason] of cases) {
      expect(safeParseMoney(input), input).toEqual({ ok: false, reason });
      expect(() => parseMoney(input), input).toThrow(/Not a valid amount/);
    }
  });

  it('round-trips through editable decimal text', () => {
    for (const minor of [0, 5, 50, 129900, 1995, MAX_MINOR])
      expect(parseMoney(minorToDecimal(minor))).toBe(minor);
    expect(minorToDecimal(129900)).toBe('1299.00');
    expect(() => minorToDecimal(1.5)).toThrow(RangeError);
    expect(() => minorToDecimal(-1)).toThrow(RangeError);
  });
});

describe('currencies and display', () => {
  it('allows only the exponent-2 currency list', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(12);
    expect(isSupportedCurrency('USD')).toBe(true);
    for (const code of ['JPY', 'KWD', 'usd', '', null])
      expect(isSupportedCurrency(code)).toBe(false);
    for (const code of SUPPORTED_CURRENCIES)
      expect(
        new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
          .maximumFractionDigits,
        code,
      ).toBe(2);
  });

  it('formats minor units for customers', () => {
    expect(formatMinor(129900, 'USD')).toBe('$1,299.00');
    expect(formatMinor(0, 'USD')).toBe('$0.00');
    expect(() => formatMinor(100, 'JPY')).toThrow(RangeError);
    expect(() => formatMinor(1.5, 'USD')).toThrow(RangeError);
  });
});

describe('canonical JSON checksums', () => {
  it('ignore key order at every level and keep array order', () => {
    const a = { b: 1, a: { d: [3, 1], c: 'x' } };
    const b = { a: { c: 'x', d: [3, 1] }, b: 1 };
    expect(canonicalJson(a)).toBe('{"a":{"c":"x","d":[3,1]},"b":1}');
    expect(checksum(a)).toBe(checksum(b));
    expect(checksum({ a: { d: [1, 3] } })).not.toBe(checksum({ a: { d: [3, 1] } }));
  });

  it('match JSON.stringify for undefined properties and reject what JSON cannot hold', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
    expect(canonicalJson([undefined])).toBe('[null]');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(/Non-finite/);
    expect(() => canonicalJson({ a: new Date(0) })).toThrow(/plain objects/);
    expect(() => canonicalJson({ a: 1n })).toThrow(/Unsupported/);
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
