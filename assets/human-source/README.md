# Human reference source assets

These assets are bundled under **CC0-1.0**. There is no subscription, royalty, license server, or paid runtime service. The license is included in `LICENSE.md` and copied beside the public model.

Source: [MakeHuman community repository](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482), pinned commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. Retrieved 2026-09-27. The OBJ, target and proxy files explicitly state their CC0 release in their headers; the skeleton and weights declare CC0 in their metadata. No MakeHuman application code is incorporated.

| Local file                          | Upstream path                                         |
| ----------------------------------- | ----------------------------------------------------- |
| base.obj                            | makehuman/data/3dobjs/base.obj                        |
| *.target                            | makehuman/data/targets/macrodetails/ (same filenames) |
| default.mhskel, default_weights.mhw | makehuman/data/rigs/ (same filenames)                 |
| eyes.obj                            | makehuman/data/eyes/low-poly/low-poly.obj             |
| eyes.mhclo                          | makehuman/data/eyes/low-poly/low-poly.mhclo           |
| brown-eye.png                       | makehuman/data/eyes/materials/brown_eye.png           |
| LICENSE.md                          | LICENSE.ASSETS.md                                     |

Run `node scripts/build-human-model.mjs` from the project root to reproduce the public GLB, eye texture, license and manifest offline. Existing Three.js is the only required library. The build blends the three adult male base targets equally, applies the average build target, poses arms and legs using the supplied weights, removes authoring helpers, normalizes illustrative scene coordinates, and constructs a short hairstyle and reference trousers/shorts. The source filenames describe authoring inputs, not attributes inferred about a customer. Skin-tone choices do not change body geometry.

The GLB provides Body, ExposedSkin, Hair, Eyes, Trousers and Shorts meshes. Jacket, shirt, collar, sleeve, lapel, pocket, fastening and shoe surfaces are original local geometry in `src/visualization/tailored-human.tsx`. Reference fabric IDs and accepted configuration still determine those surfaces and materials. Pattern UVs run along the vertical garment direction; they are illustrative, not calibrated supplier swatches.

The model is a generic adult reference, not a customer scan, a garment simulation, or an assertion of physical fit. Asset ownership/provenance is documented; production visual acceptance, body-variant coverage and real-device performance remain separate gates.

Run `node scripts/build-garment-profiles.mjs` to regenerate `src/visualization/body-profiles.json`: exact torso, arm and leg cross-sections of the same posed body, used to generate garments in the browser. It reads only these local CC0 files.
