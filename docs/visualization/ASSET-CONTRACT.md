# Visualization and asset contract

Status: proposed v0.2. Requirements VIS-001 to VIS-006.

VIS-001: Render from accepted catalog configuration and a versioned asset manifest. The garment preview MUST preserve selected visible construction details. Generated inspiration imagery must not replace the authoritative configuration preview.

## Asset delivery

Use Three.js / React Three Fiber / Drei. Proposed browser delivery format: GLB/glTF. Author or adapt assets in a suitable 3D/garment tool. The asset pipeline is separate from the web renderer and must be staffed/scheduled explicitly.

Each manifest defines asset/version, compatible product-schema versions, units and axes, origin, named meshes, material slots, option-to-component mapping, texture scale/orientation, supported body variants, annotation anchors, camera positions, and fallback images. Include license/source and asset-author validation.

VIS-002: Material replacement MUST retain realistic pattern orientation and consistent texture scale. Changing lapel/pocket/cuff construction must select the corresponding geometry, not only change a label. Invisible options must have an appropriate detail view or accurate textual representation.

VIS-003: Appearance personalization MUST remain separate from body measurements. A skin-tone control changes appearance only. A provider mesh is not automatically a rigged garment mannequin. Supported body adjustments and their visual limitations must be explicit and validated.

VIS-004: Measurements MUST anchor to the defined anatomical path or region. Selecting a field focuses/highlights the relevant region; controls also provide a textual/manual explanation. A displayed edited number does not authorize altering an unrelated mesh dimension.

## Required visual states

Loading placeholder; base garment loaded; materials loading; accepted design; temporary option preview; asset error; unsupported body variant; provider mesh unavailable; reference mannequin fallback; reduced-motion and static fallback. Detail changes must not reset the user's camera unnecessarily. Provide reset view.

VIS-005: Do not claim physical fit or cloth simulation from an illustrative avatar. The final full-body view MUST label styling-only items and remain consistent with the exact included garment specification. A custom face/photorealistic try-on is an independent future capability unless added to scope.

VIS-006: Publish asset/configuration mappings only after visual validation of supported combinations at the representative viewports/devices. Set asset budgets after testing one representative garment/body scene. Compress and progressively load where supported; remove unused assets from the initial bundle. Release GPU resources on navigation. Use an accurate static fallback when interactive rendering fails.

## Acceptance artifacts

Asset manifest example; supported-combination matrix; screenshots of front/back/details; small-device performance evidence; annotation alignment checks; and documented handling of missing geometry. One representative provider export must be tested before promising personalized body-model visualization.

## Source

[React Three Fiber model loading](https://r3f.docs.pmnd.rs/tutorials/loading-models), checked 2026-09-26. Library support for a format does not certify the suitability of any supplied garment or body mesh.
