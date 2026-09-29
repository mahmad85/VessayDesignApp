import { it, expect } from 'vitest';
import { qrMatrix } from '../src/lib/qr';
import reference from './fixtures/qr.synthetic.json';
// Independent golden generated with ReportLab's QR encoder, version 6-L,
// QR8bitByte, makeImpl(false, 0). The payload is an explicitly synthetic key.
it('matches every module of an independently encoded SYNTHETIC TOTP QR', () => {
  expect(qrMatrix(reference.text)).toEqual(reference.matrix);
  expect(() => qrMatrix('x'.repeat(135))).toThrow();
});
