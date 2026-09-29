import { expect, it } from 'vitest';
import { types } from 'pg';
import { postgresTypes } from '../src/db/postgres-types';
import { dateOnly } from '../src/modules/orders/fulfillment';

it('preserves SQL deadlines and ETAs as calendar dates without changing timestamp instants', () => {
  const date = postgresTypes.getTypeParser(types.builtins.DATE, 'text');
  for (const value of ['2026-10-01', '2028-02-29', '2026-12-31']) {
    expect(date(value)).toBe(value);
    expect(dateOnly(date(value))).toBe(value);
  }
  const timestamp = postgresTypes.getTypeParser(types.builtins.TIMESTAMPTZ, 'text');
  expect(timestamp('2026-10-01 00:00:00+05').toISOString()).toBe('2026-09-30T19:00:00.000Z');
  expect(postgresTypes.getTypeParser(types.builtins.INT4, 'text')('123')).toBe(123);
});
