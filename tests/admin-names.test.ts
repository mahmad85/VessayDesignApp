import { describe, expect, it } from 'vitest';
import {
  choiceOffError,
  imageFileError,
  nameError,
  priceResult,
  IMAGE_UPLOAD_MAX,
} from '../src/modules/catalog/admin-names';
import { UPLOAD_MAX } from '../src/modules/catalog/media-upload';

// D-022: the checks behind the simplified admin modals. SYNTHETIC names only.

describe('admin modal validation (D-022)', () => {
  it('requires a unique name of at most 200 characters, ignoring case, accents and spaces', () => {
    const taken = ['SYNTHETIC Lapel style', 'Café pocket'];
    expect(nameError('  ', taken, 'subcategory')).toBe('Enter a name for the subcategory.');
    expect(nameError('x'.repeat(201), taken, 'choice')).toBe('Use at most 200 characters.');
    expect(nameError(' synthetic LAPEL style ', taken, 'subcategory')).toBe(
      '“synthetic LAPEL style” already exists here. Choose a different name.',
    );
    expect(nameError('cafe Pocket', taken, 'subcategory')).toContain('already exists');
    expect(nameError('SYNTHETIC Vents', taken, 'subcategory')).toBeNull();
    expect(nameError('x'.repeat(200), [], 'choice')).toBeNull();
  });

  it('reads prices exactly, in the same format the server stores', () => {
    expect(priceResult('25')).toEqual({ minor: 2500 });
    expect(priceResult(' 25.5 ')).toEqual({ minor: 2550 });
    expect(priceResult('0')).toEqual({ minor: 0 });
    expect(priceResult('')).toEqual({ error: 'Enter an amount, or 0 for no extra charge.' });
    expect(priceResult('$25')).toMatchObject({
      error: expect.stringContaining('like 25 or 25.50'),
    });
    expect(priceResult('1,000')).toMatchObject({ error: expect.stringContaining('like 25') });
    expect(priceResult('-5')).toEqual({ error: 'Amounts cannot be negative.' });
    expect(priceResult('2.555')).toEqual({ error: 'Use at most two decimal places.' });
    expect(priceResult('100000000')).toEqual({ error: 'That amount is too large.' });
  });

  it('accepts only the image types and size the upload accepts', () => {
    expect(IMAGE_UPLOAD_MAX).toBe(UPLOAD_MAX);
    expect(imageFileError({ type: 'image/png', size: 1000 })).toBeNull();
    expect(imageFileError({ type: 'image/webp', size: IMAGE_UPLOAD_MAX })).toBeNull();
    expect(imageFileError({ type: 'image/svg+xml', size: 1000 })).toBe(
      'Choose a PNG, JPEG or WebP image.',
    );
    expect(imageFileError({ type: 'image/jpeg', size: IMAGE_UPLOAD_MAX + 1 })).toBe(
      'Choose an image smaller than 5 MB.',
    );
  });

  it('keeps the default and at least one choice on for a product', () => {
    expect(choiceOffError({ isDefault: true }, 5)).toContain('default choice');
    expect(choiceOffError({ isDefault: false }, 1)).toContain('at least one choice');
    expect(choiceOffError({ isDefault: false }, 2)).toBeNull();
  });
});
