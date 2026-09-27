# Implemented UI contract

Working visual direction: quiet ivory surfaces, deep green text/actions, restrained brass accents, self-hosted DM Sans body text and Cormorant Garamond headings. Vessy is provisional. This is an implementation choice, not an approved final brand.

## Layout

- Desktop over 900 px: consultation/detail pane and 3D pane side by side. At 1440 px the split is 42/58. Each long detail pane scrolls independently; the bottom action bar remains accessible.
- 761–900 px: stacked full-width panels to avoid narrow text columns.
- 760 px and below: explicit Your tailor/Measurements/Order details and 3D preview switching. Changing panels preserves state. A sticky action bar respects the bottom safe area.
- At 320 px the step numbers stack above their labels to avoid horizontal clipping.
- Conversation body is 16 px on desktop and 15 px on mobile. Essential form labels and primary controls are 14–17 px; secondary metadata is smaller. Destructive resets use dialogs.

## Design

Default garments and construction are preview suggestions until accepted. Accepted chips appear after server-confirmed writes. Occasion/weather chips are editable selects. Fabric recommendations show an Apply action and become stale after another draft revision. Garment-type changes explain that fabric, fit and finishing choices reset, while occasion/weather persist; measurement confirmation is invalidated.

The final design dialog summarizes the actual selected fabric, fit and finishing defaults. It requires occasion and weather. Confirming moves to measurements. Direct controls provide the same configuration commands as the assistant path.

The assistant is visibly labeled Guided assistant without credentials and AI stylist with configured credentials. Guided mode recognizes common garment/occasion/weather/colour/fit phrases; it is not represented as an LLM. No streamed or locally predicted text claims a choice was saved.

## Measurements

The capture card opens a truthful unavailable state and manual alternative. It does not request camera access or produce a pretend scan. Fields highlight a matching reference path and show the definition in text. Lower-body values use the full mannequin. Invalid text stays visible and blocks save/unit switching until corrected.

Canonical values are millimetres. Unit switching changes display without converting stored values back and forth. Dirty measurements are distinguished from saved values, and leaving the step asks whether to discard unsaved changes. Confirmation saves a new version; it never promotes the source to verified.

## Review and payment

The review explicitly states which styling garments are not included. Design and measurement sections link back to editing. Automated checks list missing inputs, manual-source verification needs, production-contract readiness and quote unavailability. Expert review displays the requested 24-hour target but explicitly says no live review was submitted. Payment is disabled with an explanation and also rejected by the server.

## Accessibility and limits

Dialogs trap focus, Escape closes them and focus returns to the opener. Tabs and native selects support keyboard use. The 3D canvas has angle/zoom/reset buttons and a no-WebGL fallback. Reduced-motion preference disables UI animation; the model never auto-rotates.

Automated accessibility and keyboard checks cover the current desktop studio; responsive overflow checks cover 320, 390, 768 and 1440 px. This is not a complete WCAG certification. Screen-reader testing, representative older-user evaluation, lower-powered mobile GPU testing and production assets still require validation.

Current reference geometry is intentionally limited. It conveys selection changes but does not predict drape, fit, exact fabric colour or body shape. The optional photo is shown beside the mannequin and is not face transfer.

As of TASK-011 (2026-09-27), the reference is a complete CC0 anatomical human GLB, with face, short hair, detailed hands and feet. Suit, shirt and blazer construction remains driven by the same accepted Design. Continuous sleeve surfaces replace cylinder joints. Reference trousers share a continuous anatomical topology; measurement mode provides shorts. Skin-tone changes affect appearance only. The 320px canvas reserves a lower strip for camera controls so the shoes remain visible. Model assets load locally with a loading message and a recoverable unavailable state; selecting clothes remains possible if the asset fails.
