# UX foundations

Status: proposed design specification v0.2. Final brand and annotated wireframes remain open. Requirements here are canonical for layout and accessibility.

## Principles

UX-001: The interface MUST make the current garment, current step, accepted choices, save status, and next action understandable without reading the entire conversation.

UX-002: Customers MUST be able to complete configuration using direct controls when conversation is slow or unavailable. Technical options require plain-language descriptions and visual examples where appropriate.

UX-003: All essential actions MUST be accessible by keyboard and standard pointer/touch input; rotate/zoom gestures must have buttons. Proposed accessibility target: WCAG 2.2 AA, verified by automated and manual review, not claimed solely from component-library usage.

## Proposed responsive layout

| Width | Design and review layout | Measurement capture |
| --- | --- | --- |
| 1200px and above | Consultation/details about 40%, visualization about 60%; minimum usable pane widths 360px and 480px | Full available content region or verified provider handoff |
| 768–1199px | Stack if minimum pane widths do not fit; clearly labeled Conversation/Preview switch with persistent summary | Guided handoff or responsive capture |
| Below 768px | Single content column, compact preview, Conversation/Preview tabs, sticky next action above safe area | Phone capture flow; customer can resume draft afterward |

Document exact width behavior in annotated wireframes before UI implementation. Use 390×844 mobile, 768×1024 tablet, and 1440×900 desktop as proposed review viewports; test 320px width, zoom, and keyboard as additional constraints. Do not force a split view where text and controls become cramped.

## Proposed visual tokens

Use semantic tokens so brand changes do not alter business components. Initial neutral proposal: background #F7F7F5, surface #FFFFFF, main text #18212B, muted text #52606D, primary #183D57, border #D7DEE4, focus #1D4ED8. Verify actual contrast combinations. Selected, suggested, invalid, and processing states must include text/icons, not color alone.

Base text 16px with at least 1.5 line-height; labels 14–16px; primary headings 24–32px. Proposed spacing scale 4/8/12/16/24/32px. Main controls should provide at least 44×44px touch areas where practical. Keep focus indicators visible, including inside the 3D panel and dialogs. Honor reduced-motion preferences; disable automatic avatar rotation.

No loading spinner is an indefinite outcome: each async feature needs a status message, retry/recovery action, and preserved input. Do not display a fake numerical progress percentage for an opaque provider job.

## Persistent chrome

Top: brand placeholder, draft title, save indicator, step navigation. On design: accepted-choice summary above chat, collapsed by group if lengthy. Primary action: Continue to measurements / Review order / Resolve issues / Continue to payment or Request human review, according to the current state. The customer-facing final step is Review & pay. Secondary navigation must preserve completed inputs.

Use readable labels: Fabric, Shape, Details, Personalize. Explain lapel, vent, cuff, and lining in context. Color swatches require names and texture information. Currency and units are explicit. Brand, currency and final product wording depend on Q-004.

## Interaction accessibility

Move focus to an error summary when submitting invalid data, with links to affected controls. Announce save and processing status through restrained live regions; do not announce each streamed token. Dialogs trap focus and return it to the trigger when closed. Closing a detail drawer must not erase a selection.

Long content remains scrollable with a visible current task. New chat output must not pull the customer away while reading earlier messages; show a New message control. On send, retain focus in the input unless the user explicitly opened another control.

## Appearance and body representation

User-selected skin tone is optional and independent of measurement. Uploaded appearance photos are optional, removable, and have a distinct purpose from provider capture. Do not infer identity, pattern family, or body preferences from appearance. Provide supported pattern-family choices with explanatory language agreed with the tailor.

Wireframes must show long fabric names, unsupported options, empty catalogs, provider unavailability, keyboard focus, and small-screen controls—not only the happy path.
