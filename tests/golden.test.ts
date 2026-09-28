import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  GOLDEN_DIR,
  GOLDEN_FILES,
  applyDifferences,
  buildGoldens,
  computeSketchSpecs,
} from './golden/generate';

// AC-43 non-regression: the renderers' inputs must stay identical to the
// goldens recorded before the catalog refactor (WP-00b). A failure here is a
// visual regression, not a reason to regenerate the goldens.

const golden = async (file: string) =>
  JSON.parse(await readFile(path.join(GOLDEN_DIR, file), 'utf8'));

describe('golden visual outputs', () => {
  it('reproduce every recorded 2D drawing specification exactly', async () => {
    const recorded = await golden(GOLDEN_FILES.sketchSpecs);
    const current = computeSketchSpecs();
    expect(Object.keys(current).sort()).toEqual(Object.keys(recorded.cases).sort());
    expect(Object.keys(current).length).toBeGreaterThan(470);
    for (const [id, spec] of Object.entries(current)) {
      const product = id.split('/')[0];
      expect(spec, id).toStrictEqual(
        applyDifferences(recorded.baselines[product], recorded.cases[id]),
      );
    }
  });

  it('exercise the drawing: most single choices change the specification', async () => {
    const recorded = await golden(GOLDEN_FILES.sketchSpecs);
    const changed = Object.values(recorded.cases).filter(
      (differences) => Object.keys(differences as object).length > 0,
    );
    expect(changed.length).toBeGreaterThan(400);
  });

  it('keep the 2D focus region of every leaf and contextual focus change', async () => {
    expect(buildGoldens().regions).toStrictEqual(await golden(GOLDEN_FILES.regions));
  });

  it('keep the set of choices drawn in 3D', async () => {
    expect(buildGoldens().shownIn3D).toStrictEqual(await golden(GOLDEN_FILES.shownIn3D));
  });
});
