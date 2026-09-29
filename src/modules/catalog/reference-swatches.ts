import type { Fabric } from './catalog';

// Illustrative colour swatches for the eight reference fabrics (TASK-015;
// CATALOG-ADMIN §3.7 requires a swatch for an active fabric). Each is drawn
// only from the fabric's existing reference colour and pattern, the same values
// the 2D/3D renderers already use. They are not photographs of supplier cloth.
// Written to public/ by scripts/build-reference-swatches.ts.

export const REFERENCE_SWATCH_DIR = '/reference-assets/fabrics';
export const referenceSwatchPath = (fabricId: string) => `${REFERENCE_SWATCH_DIR}/${fabricId}.svg`;
export const referenceSwatchAlt = (fabric: Pick<Fabric, 'name'>) =>
  `${fabric.name}, illustrative colour swatch`;

const overlays = {
  plain: '',
  twill: Array.from(
    { length: 24 },
    (_, i) =>
      `<path d="M${i * 24 - 256} 256 L${i * 24} 0" stroke="#ffffff" stroke-opacity="0.09" stroke-width="3"/>`,
  ).join(''),
  check: [32, 96, 160, 224]
    .map(
      (at) =>
        `<path d="M${at} 0 V256 M0 ${at} H256" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>`,
    )
    .join(''),
  stripe: Array.from(
    { length: 11 },
    (_, i) =>
      `<path d="M${12 + i * 24} 0 V256" stroke="#35557a" stroke-opacity="0.45" stroke-width="2"/>`,
  ).join(''),
} satisfies Record<Fabric['pattern'], string>;

export function referenceSwatchSvg(fabric: Fabric) {
  const label = referenceSwatchAlt(fabric);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${label}"><title>${label}</title><rect width="256" height="256" fill="${fabric.color}"/>${overlays[fabric.pattern]}</svg>\n`;
}
