# Delivery sequence and gates

Status: implementation authorized by D-012. The local foundation and reference customer journey are implemented; hosted/vendor gates remain open. See [current status](../implementation/STATUS.md) and [next tasks](../implementation/NEXT-TASKS.md).

## Stages

| Stage | Output | Exit evidence |
| --- | --- | --- |
| G0 Product decisions | Confirmed suits/shirts/blazers and menswear; review/payment rules, market and approved defaults | D-009/010 recorded; Q-003/004/017–022 resolved for dependent slices or explicitly gated |
| G1 UX baseline | Annotated desktop/mobile wireframes, component/state inventory, final critical copy, accessibility review | Screens S-01 to S-13 reviewed for approved scope; failures and recovery represented |
| G2 Provider/asset contract | Verified 3DLOOK docs/entitlement, sample results and model, measurement mapping | Integration and asset feasibility evidence; no invented vendor fields |
| G3 Technical baseline | Approved ADRs, data schemas, internal API/status contracts, threat/data-access review, acceptance map | Versioned baseline with named remaining blockers |
| G4 Foundation slice | Authorized repo, runtime, persistence, identity, deployment, observability | Published staging, restart/restore/ownership checks |
| G5 Design slice | Curated real catalog, shared configuration engine, direct controls, 3D viewer, then AI consultation | AC-02 to AC-08, AC-14, AC-19, AC-23 as applicable |
| G6 Measurement slice | 3DLOOK capture/resume, normalization, editable review, provenance/model | AC-09 to AC-13, AC-20, AC-24 with live-provider evidence |
| G7 Review/checkout/operations slice | Automated findings, optional human review/SLA, hosted checkout, payment reconciliation, export, amendments and notifications | AC-15 to AC-18 plus AC-25 to AC-33 as relevant; verified payment provider and reviewed policies |
| G8 Pilot/release | Representative user testing, tailor validation, operational rehearsal | All release-critical criteria verified, authorized production scope |

G1 and G2 documentation work may progress together. G4 may start only after explicit implementation authorization and its relevant G3 baseline is accepted. Unresolved provider details block the dependent integration slice, not all independent approved work. Every stage extends the same application and domain contracts.

## Task sizing

Each task is one demonstrable behavior with requirement IDs, dependencies, exact in-scope surfaces, excluded changes, acceptance cases and evidence. Examples: synchronize fabric selection across chat and swatches; recover a capture after return; prevent duplicate order requests. Avoid tasks such as build the whole backend or make UI professional.

## Initial specification backlog

1. Record resolved Q-001/002 and review the detailed dual review/payment policy in Q-003 and Q-017–019.
2. Review ADR-001 through ADR-009 as a group; record changes before code.
3. Produce annotated wireframes from UX files; review normal/error/empty/mobile states.
4. Obtain 3DLOOK commercial entitlement and technical evidence.
5. Complete the measurement mapping worksheet with the tailor.
6. Validate one garment asset and one provider model; define the actual personalization promise.
7. Expand approved internal contracts into machine-readable schemas and bounded implementation tasks.

## Milestone reviews

Approve a baseline and task scope once, then let the coding agent complete routine implementation autonomously within that scope. Reopen product approval only for material changes, unresolved conflicts, paid/external actions not already authorized, or changes to privacy/commercial promises. This process should control decisions without turning every code edit into a permission request.
