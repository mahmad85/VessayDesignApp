import type { Design, Garment } from './types';
/** @deprecated v1 designs; the studio UI moves to nextQuestionFor in WP-15. */
export function nextQuestion(d: Design) {
  if (!d.confirmed.includes('product')) return 'What would you like to make your own?';
  if (!d.occasion) return 'Where are you planning to wear it?';
  if (!d.climate) return 'And what kind of weather are you dressing for?';
  if (!d.confirmed.includes('fabricId'))
    return 'Do you prefer a dark, light, or more expressive fabric?';
  if (!d.confirmed.includes('fit'))
    return 'How do you like your clothes to feel — tailored, classic, or relaxed?';
  return 'Your look is coming together. Explore the details, or confirm your design when you are ready.';
}
/** The next guided question for the active garment (none: choose one first). */
export function nextQuestionFor(garment: Garment | null) {
  if (!garment) return 'What would you like to make your own?';
  if (!garment.preferences.occasion) return 'Where are you planning to wear it?';
  if (!garment.preferences.climate) return 'And what kind of weather are you dressing for?';
  if (!garment.confirmed.includes('material'))
    return 'Do you prefer a dark, light, or more expressive fabric?';
  return 'Your look is coming together. Explore the details, or confirm your design when you are ready.';
}
