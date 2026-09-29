import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FABRICS } from '../src/modules/catalog/catalog';
import {
  REFERENCE_SWATCH_DIR,
  referenceSwatchPath,
  referenceSwatchSvg,
} from '../src/modules/catalog/reference-swatches';

// Writes the illustrative reference-fabric swatches imported as static media.
//   node --import tsx scripts/build-reference-swatches.ts

await mkdir(path.join(process.cwd(), 'public', REFERENCE_SWATCH_DIR), { recursive: true });
for (const fabric of FABRICS) {
  const target = path.join(process.cwd(), 'public', referenceSwatchPath(fabric.id));
  await writeFile(target, referenceSwatchSvg(fabric));
  console.log(`Wrote public${referenceSwatchPath(fabric.id)}`);
}
