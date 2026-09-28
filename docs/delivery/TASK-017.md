# TASK-017: Pricing engine and customer price display

Status: ready (specified 2026-09-28; depends on TASK-016)

Implementation packages: WP-17, WP-18 in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Build and merge them in that order.

- Approved baseline: D-019 (the user chose “once when activated” and “bands plus override”).
- Implementation authorisation/source: D-019.
- Requirement IDs and canonical files: PRC-001 to PRC-005 and PRC-007 in [PRICING.md](../domain/PRICING.md); CAT-005; UX-013 (the response includes quote status); S-02 and S-03 in ADMIN-SCREENS §4.
- Acceptance scenario IDs: AC-36; the quote portion of AC-02.
- User-visible outcome: the customer sees the garment price, the cart total and a “Price details” breakdown by category, plus “+$X” on priced choices. With imported data they see “Price not yet available”, which is honest because no prices exist yet.
- In-scope surfaces/modules: `modules/pricing/{quote,explain}.ts`; studio GET and POST responses (`quote`); `review.ts` (replace the always-on `quote-unavailable` blocker with one derived from the actual quote); design UI price surfaces.
- Dependencies and blocking questions: real prices need Q-011 and Q-019. The mechanism does not.
- Explicit non-goals: tax, discounts, persisted quotes (TASK-023), admin pricing UI (TASK-020).
- Data/API/asset contracts: `GarmentQuote`, `CartQuote` and `QuoteLine` per PRC-004.
- Loading/error/empty/recovery behaviour: an unavailable quote is never rendered as zero. The breakdown disclosure is keyboard accessible.
- Authorisation and privacy requirements: prices are computed only on the server. The client never computes or submits a price other than the `acceptTotal` echo (TASK-023).
- Migration/compatibility implications: none.
- Test fixtures (synthetic or authorised): the PRICING.md E1–E7 synthetic fixture (`tests/fixtures/pricing.synthetic.ts`); a synthetic release inserted into the e2e test database with prices (labelled `SYNTHETIC`).
- Verification plan: unit tests E1–E7 plus product-override precedence, hidden-inert selections, a default value that carries its own surcharge, and text activation; e2e breakdown and unavailable copy; screenshots at 1440 and 390.
- Actual verification evidence: not started.
- Deviations and decision references: D-019.
- Remaining limitations: amounts are gross; tax is gated by Q-019.
- Changed files/commit: —
