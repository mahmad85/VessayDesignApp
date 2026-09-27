import type { Design } from './types';
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
