// Builds the demo catalog's missing images (D-023) from the app's own 2D
// garment drawing: product pictures for the suit, blazer and shirt, and the
// shirt collar, cuff and fit choices that have no supplied reference image.
// Output: public/reference-assets/demo/*.svg, used by src/db/demo-catalog.ts.
// Run with: npm run seed:demo-images
import React from 'react';
import { writeFile, mkdir } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import GarmentSketch from '../src/visualization/garment-sketch';
import { REGIONS, type RegionId } from '../src/visualization/focus-regions';
import type { RenderInput } from '../src/visualization/binding';

const OUT = 'public/reference-assets/demo';
const NAVY = { color: '#2f3a4f', pattern: 'plain' as const };
const WHITE = { color: '#f1efe8', pattern: 'plain' as const };

type Spec = {
  file: string;
  render: Omit<RenderInput, 'skinTone' | 'images'>;
  region?: RegionId;
};
const shirt = (tokens: RenderInput['tokens']): Spec['render'] => ({
  visualModel: 'shirt',
  material: WHITE,
  parts: ['shirt'],
  tokens,
});
export const DEMO_IMAGES: Spec[] = [
  {
    file: 'product-suit.svg',
    render: { visualModel: 'suit', material: NAVY, parts: ['jacket', 'trousers'], tokens: {} },
  },
  {
    file: 'product-blazer.svg',
    render: { visualModel: 'blazer', material: NAVY, parts: ['jacket'], tokens: {} },
  },
  { file: 'product-shirt.svg', render: shirt({}) },
  { file: 'shirt-collar-point.svg', render: shirt({ 'shirt.collar': 'point' }), region: 'collar' },
  {
    file: 'shirt-collar-spread.svg',
    render: shirt({ 'shirt.collar': 'spread' }),
    region: 'collar',
  },
  { file: 'shirt-cuffs-button.svg', render: shirt({ 'shirt.cuffs': 'button' }), region: 'sleeve' },
  { file: 'shirt-cuffs-french.svg', render: shirt({ 'shirt.cuffs': 'french' }), region: 'sleeve' },
  { file: 'shirt-fit-classic.svg', render: shirt({ fit: 'classic' }) },
  { file: 'shirt-fit-relaxed.svg', render: shirt({ fit: 'relaxed' }) },
  { file: 'shirt-fit-tailored.svg', render: shirt({ fit: 'tailored' }) },
  {
    file: 'jacket-fit-relaxed.svg',
    render: {
      visualModel: 'blazer',
      material: NAVY,
      parts: ['jacket'],
      tokens: { fit: 'relaxed' },
    },
  },
];

// The drawing's line styles from globals.css, so the file renders on its own.
const STYLE = `.sk-panel{stroke:var(--sk-detail);stroke-width:.9}.sk-welt{fill:var(--sk-welt)}.sk-line,.sk-fold{fill:none;stroke:var(--sk-detail);stroke-width:1}.sk-seam,.sk-crease{fill:none;stroke:var(--sk-detail);stroke-opacity:.55;stroke-width:.8;stroke-dasharray:3 3}.sk-crease{stroke-dasharray:none}.sk-drape{fill:none;stroke:#00000038;stroke-width:1.4;stroke-linecap:round}.sk-cuff{stroke:#00000060;stroke-width:.9}.sk-button{stroke:#00000070;stroke-width:.6}.sk-note{display:none}`;

/** The same padding the studio uses when it zooms to a region. */
function viewBox(region: RegionId | undefined) {
  if (!region || region === 'full') return '0 0 400 800';
  const [x, y, w, h] = REGIONS[region].box;
  const px = w * 0.14;
  const py = h * 0.14;
  return [x - px, y - py, w + 2 * px, h + 2 * py].map((n) => Math.round(n)).join(' ');
}

/** The drawing's own <svg> out of the rendered viewer, made standalone. */
function standalone(html: string, region: RegionId | undefined) {
  const start = html.indexOf('<svg class="sketch-svg"');
  if (start < 0) throw new Error('The sketch did not render.');
  let depth = 0;
  let end = start;
  const tag = /<svg\b|<\/svg>/g;
  tag.lastIndex = start;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    depth += match[0] === '</svg>' ? -1 : 1;
    if (!depth) {
      end = match.index + '</svg>'.length;
      break;
    }
  }
  return html
    .slice(start, end)
    .replace(
      /^<svg[^>]*?style="([^"]*)"[^>]*>/,
      (_, style: string) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(region)}" preserveAspectRatio="xMidYMid meet" style="${style}"><style>${STYLE}</style>`,
    );
}

await mkdir(OUT, { recursive: true });
for (const spec of DEMO_IMAGES) {
  const html = renderToStaticMarkup(
    <GarmentSketch
      render={{ ...spec.render, skinTone: 'warm', images: {} }}
      focus={{ region: 'full', nonce: 0 }}
    />,
  );
  await writeFile(`${OUT}/${spec.file}`, standalone(html, spec.region) + '\n');
  console.log('wrote', spec.file);
}
