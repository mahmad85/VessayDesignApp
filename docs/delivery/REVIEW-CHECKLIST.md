# Baseline review checklist

Status: review aid, not completed approvals. Baseline v0.2 remains DRAFT.

## Product and UX review

- [x] User confirmed two-piece suits, shirts and blazers; menswear first.
- [ ] Tailor confirms exact supported pattern blocks/body coverage.
- [ ] Approve the sign-off wording (Q-032) and the optional 24-hour post-payment tailor-review operation (Q-018). The check-then-pay policy itself is decided by D-020.
- [ ] Choose payment provider and approve quote, reservation, refund and notification policies.
- [ ] Resolve Node/FastAPI and Better Auth/Clerk decisions before their implementation.
- [ ] Identify brand, initial market, currency and language.
- [ ] Confirm the three-step journey and acceptance of editable suggested/default choices.
- [ ] Review annotated desktop/mobile wireframes, long-content layouts and all failure/recovery states.
- [ ] Confirm appearance-photo scope, body-model limitations and supported fallbacks.
- [ ] Identify actual fabrics, construction choices and supplier manufacturing rules.

## Technical and vendor review

- [ ] Accept or amend the proposed stack and module boundaries.
- [ ] Verify contracted 3DLOOK product, plan, documentation, integration rights and sandbox access.
- [ ] Complete and approve the measurement mapping with the tailor.
- [ ] Inspect representative provider results and model export; approve actual visualization scope.
- [ ] Approve session/result authentication, revisions, idempotency and async recovery.
- [ ] Finalize internal API schemas/status transitions and data-access matrix for the first slice.
- [ ] Define supplier tolerances and fit-validation protocol.
- [ ] Confirm privacy/retention/deletion, backup/restore and incident ownership before real customer release.

## Development handoff

- [ ] Record accepted baseline version, scope, date and approver.
- [ ] List open questions and precisely which tasks they block.
- [ ] Put specifications and root AGENTS.md under version control with the application project.
- [ ] Author the first bounded task with requirement IDs and evidence requirements.
- [ ] Obtain explicit authorization to begin implementation; avoid repeated approval for routine work inside that scope.

## Structural review of this draft

Performed checks are documented when packaging: Markdown links resolve within the package; canonical requirement IDs are unique; all numbered requirements have acceptance mappings; all referenced scenario IDs exist. These checks validate document structure only. They do not certify vendor integration, usability, garment accuracy or application quality.
