import { safeParseMoney, type MoneyParseFailure } from '@/lib/money';

// D-022: plain-language checks for the simplified catalog forms. Pure and
// shared by the admin modals and the media upload limits; the server still
// validates every request on its own.

export const NAME_MAX = 200;
/** Largest image the media upload accepts (5 MiB). */
export const IMAGE_UPLOAD_MAX = 5_242_880;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

const sameName = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), 'en', { sensitivity: 'base' }) === 0;

/**
 * A name is required, at most 200 characters, and unique among `taken`
 * (ignoring case and accents). `what` names the thing in the message.
 */
export function nameError(name: string, taken: readonly string[], what: string): string | null {
  const text = name.trim();
  if (!text) return `Enter a name for the ${what}.`;
  if (text.length > NAME_MAX) return `Use at most ${NAME_MAX} characters.`;
  if (taken.some((other) => sameName(other, text)))
    return `“${text}” already exists here. Choose a different name.`;
  return null;
}

const MONEY_MESSAGES: Record<MoneyParseFailure, string> = {
  empty: 'Enter an amount, or 0 for no extra charge.',
  format: 'Enter a number like 25 or 25.50, without a currency sign.',
  negative: 'Amounts cannot be negative.',
  precision: 'Use at most two decimal places.',
  range: 'That amount is too large.',
};

/** Decimal text to minor units, or the reason it cannot be used. */
export function priceResult(text: string): { minor: number } | { error: string } {
  const result = safeParseMoney(text);
  return result.ok ? { minor: result.minor } : { error: MONEY_MESSAGES[result.reason] };
}

/** The upload limits checked before sending a file. */
export function imageFileError(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    return 'Choose a PNG, JPEG or WebP image.';
  if (file.size > IMAGE_UPLOAD_MAX) return 'Choose an image smaller than 5 MB.';
  return null;
}

/**
 * Turning a choice off for one product: the default choice must stay on, and
 * at least one choice must remain, otherwise the customer has nothing to pick.
 */
export function choiceOffError(choice: { isDefault: boolean }, onCount: number): string | null {
  if (choice.isDefault) return 'This is the default choice. Make another choice the default first.';
  if (onCount <= 1)
    return 'Keep at least one choice on. To hide this subcategory, untick it on the product page.';
  return null;
}
