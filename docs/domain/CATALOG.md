# Catalog and configuration contract

Status: proposed v0.2. Product/fabric examples are illustrative, not supplied inventory. Requirements CAT-001 to CAT-006.

CAT-001: Product category, occasion, climate, style preference, fabric attribute and construction option MUST be separate concepts. A wedding is an occasion; tweed is a fabric characteristic. Product schema determines valid options and measurements.

## Catalog entities

| Entity | Required information |
| --- | --- |
| Product schema version | Stable category, components, required option groups, defaults, compatible pattern blocks, measurement protocol version |
| Fabric | Stable ID, supplier/book/code, display name, color, composition, texture/weave, verified wearing attributes, availability, pricing reference, asset references |
| Option | Stable ID, group, compatible product schemas, label, explanation, allowed values, price effect, supplier manufacturing code, visual asset mapping |
| Compatibility rule | Inputs, allowed/forbidden combinations, customer-facing reason, version, test examples |
| Recommendation rule | Preference inputs, ranked options, supporting verified attributes, trade-offs |
| Visual asset manifest | Product/schema compatibility, mesh/material slots, version, supported views and limitations |

CAT-002: Every accepted design choice MUST map to a real catalog entity/version and a manufacturing interpretation. Store flexible attributes in typed metadata, while identities, relationships, availability and prices remain queryable and validated.

Confirmed categories are men’s two-piece suits, dress shirts and standalone blazers. Reuse compatible jacket components for blazers, while giving the blazer its own supplier-approved schema, defaults, price and option rules. Do not assume every suit jacket construction is available as a blazer. Proposed schema examples: suits contain jacket and trousers; shirt options include collar, cuffs, placket, fit and personalization; jackets include closure, lapels, pockets, vents, lining and buttons. Exact groups and combinations must come from the supplier. An option absent from the supplier schema is not offered merely because Hockerty supports it.

CAT-003: Publish a fabric/product combination only when its required manufacturing information and visual mapping are valid. An admin may save an incomplete catalog draft, but customer selection must not expose incomplete mandatory information.

## Configuration states

Draft garment -> configurable -> design complete -> measurements ready -> reviewed. These are readiness states, not proof of payment or manufacturing. Readiness is derived from validated required fields and relevant approvals, not a model's assertion.

CAT-004: An outfit draft MUST allow multiple garment configurations and one or more explicitly selected measurement-profile revisions. Switching the active garment must not conflate selections between garments.

CAT-005: Server-side pricing MUST identify currency and version. Store money using exact numeric representation appropriate to the currency. A request awaiting a quote must say so; do not display zero as a substitute for unknown price. Recheck availability and quote validity before submission.

CAT-006: A compatibility change MUST identify affected options and require explicit acceptance where selected choices will be removed. Historical orders retain their original configuration snapshots even if current catalog records are discontinued.

## Admin-driven catalog (D-019)

The database-backed catalog, the product → part → option group → option → choice hierarchy, lookups, fabric metadata, rules, templates and versioned releases are specified in [CATALOG-ADMIN.md](CATALOG-ADMIN.md) (CAT-007 to CAT-018, TPL-001 to TPL-004). Pricing is specified in [PRICING.md](PRICING.md) (PRC-001 to PRC-007). CAT-001 to CAT-006 above remain in force.

## Initial catalog onboarding

Obtain supplier records; normalize attributes; review terminology with tailor; author compatibility rules; prepare visual assets; enter a small curated catalog; test representative complete combinations and rejected combinations; then publish a version. Reference-sheet compositions and brand/mill names require supplier verification and usage rights.
