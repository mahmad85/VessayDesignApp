# Pricing and quotes

Status: proposed v0.4. D-019 set the original rules on 2026-09-28; D-022 (2026-10-02) replaced the band price matrix with a base price plus tier uplift and withdrew group and option fees. Requirements PRC-001 to PRC-007. This file refines CAT-005 in [CATALOG.md](CATALOG.md). The catalog entities are in [CATALOG-ADMIN.md](CATALOG-ADMIN.md). The use of quotes by orders and checkout is in [ORDERS-FULFILLMENT.md](ORDERS-FULFILLMENT.md).

All amounts in this file are **synthetic examples**. No commercial price has been supplied (Q-011, Q-019).

## PRC-001 Money representation

- Every amount is an integer in **minor units** (`*_minor`, for example cents), with an ISO 4217 currency. Floating-point money is forbidden in the database, domain code and API.
- A release has exactly one currency (`commerce_settings.currency`, copied into the snapshot, P-004). Supported currencies have exponent 2: `USD`, `EUR`, `GBP`, `CAD`, `AUD`, `NZD`, `CHF`, `SEK`, `NOK`, `DKK`, `AED`, `SGD`. Anything else is the publish error `currency_invalid`.
- The API carries **integers in minor units only**, in both directions. The admin UI accepts decimal text (`"1299.00"`) and converts it with `parseMoney()` from `src/lib/money.ts`, an exact string parser (no `parseFloat`) shared by client and server tests. There are at most 2 decimals. The range is 0 to 10,000,000 (in major units) per amount. Negative prices and surcharges are not allowed (DB `CHECK >= 0`). Discounts are out of scope.
- Display uses `Intl.NumberFormat('en', {style:'currency', currency})` on the client from `{amountMinor, currency}` returned by the server.

## PRC-002 Garment base price (base price plus tier uplift, D-022)

```
base(product P, material M) =
    material_price_overrides[M][P]                       if a row exists
    else release.bandPrices[P][M.price_band_code]        if M has a band and P has a price for it
    else UNAVAILABLE

release.bandPrices[P][band] =
    products.base_price_minor[P] + price_bands.uplift_minor[band]   for every band, when P has a base price
    else product_band_prices[P][band]                               (stored band prices, kept for products priced before D-022)
```

`price_bands` are admin-defined fabric price tiers, for example Essential, Classic, Premium and Luxury, each with a name, sort and one uplift amount (0 allowed). The admin enters one base price on each product page and the tier uplifts on the Fabrics page. Publishing computes the per-tier price into the release, so editing a tier uplift changes nothing for customers until the next publish (PRC-007). A material in no tier and with no override is unpriced for that product (the publish warning `price_missing`).

## PRC-003 Extra charges: optional parts and choices only (D-022)

Definitions over the garment’s **effective selections** ([CATALOG-ADMIN.md §5.2](CATALOG-ADMIN.md#52-effective-selections)):

```
included(component C) := C is required, or C is optional and in garment.includedComponents
```

| Node | Charged | Times |
| --- | --- | --- |
| Product | `base(P, M)` (PRC-002) | once per unit |
| Component link | `product_components.surcharge_minor` when `included(C)` | once per unit |
| Option value | the value’s `surcharge_minor` when it is the effective value of a **visible** attribute, **even if it is the default** | once per unit |

Rules that follow from this table:

- Option groups and attributes carry no charge. Their stored `surcharge_minor` is 0 and the admin cannot set it. Older data and releases may still contain non-zero values; the quote engine ignores them.
- A choice price is *the price of that specific choice*. An admin who wants a default choice to cost extra puts the cost on that choice.
- Templates do not change the baseline (TPL-004).
- Hidden (inert) selections are never charged.
- Per-product price overrides are no longer entered. A per-product value override in an older release is still honoured.


## PRC-004 Quote computation and breakdown

`quoteGarment(snapshot, garment, liveAvailability) → GarmentQuote` is a pure function in `src/modules/pricing/quote.ts`, shared by the customer runtime, the admin price simulator, template pricing and order submission. **No other code may compute prices.**

```ts
type QuoteLine = {
  kind: 'base' | 'component' | 'group' | 'attribute' | 'option';
  category: string;          // 'base' | component code | 'accents'
  categoryLabel: string;     // 'Suit · Band B' | 'Jacket' | 'Accents'
  label: string;             // customer label, e.g. 'Lining (custom)', 'Peak lapel'
  ref: string;               // product/component/group/attribute code, or `${attributeCode}::${valueCode}`
  lineKind: 'construction' | 'accessory';
  amountMinor: number;       // per unit
};
type GarmentQuote =
  | { status: 'priced'; currency: string; catalogVersion: number; lines: QuoteLine[];
      unitMinor: number; quantity: number; totalMinor: number;
      byCategory: { category: string; label: string; amountMinor: number }[] }
  | { status: 'unavailable'; currency: string; catalogVersion: number; reasons: QuoteUnavailableReason[] };
type QuoteUnavailableReason = 'base_price_missing' | 'material_unavailable' | 'invalid_configuration';
```

- Lines are emitted in outline order, and zero-amount lines are omitted. `byCategory` sums lines by `category`. This gives the “additive cost per category” breakdown that the customer and admin see (Base, Jacket, Trousers, Vest, Accents).
- `category` = `'base'` for the product line; the component code for component, style-group and style-attribute/value lines; `'accents'` for lines from `accent` groups.
- `unitMinor` = the sum of the lines. `totalMinor` = `unitMinor × quantity` (quantity 1–5 per garment, CRT-002).
- A material that is `out_of_stock` or `discontinued` in the live overlay makes the quote `unavailable` with `material_unavailable`.

`quoteCart(snapshot, draft)` returns `{status, currency, garments: GarmentQuote[], subtotalMinor, shippingMinor, totalMinor}`, where `status = 'priced'` only when every garment is priced. `shippingMinor` = `commerce_settings.shipping_flat_minor` (0 allowed). Tax handling is a Q-019 release gate. Until it is resolved, amounts are treated as final gross prices and the customer copy says “Taxes: see checkout” only if the operations owner approves that copy. The agent must not implement tax calculation.

## PRC-005 Unknown is not zero

A missing base price makes the garment quote `unavailable`. The UI then shows **“Price not yet available”** and never `$0.00` (CAT-005). A missing surcharge is stored as an explicit `0` (the DB default) and shown as “Included”. Imported data has all surcharges at 0 and no base prices, so every imported configuration is `unavailable` until an admin prices it.

## PRC-006 Quote persistence and validity

- Customer and admin screens compute quotes live on every read and after every command. They are not persisted.
- Order submission persists a `quotes` row (the lines JSON, totals, currency, `catalog_version`, `expires_at = now + commerce_settings.quote_ttl_minutes`). The default TTL is 10080 minutes (7 days), which lets a customer pay an unpaid order later without re-pricing. Tailor review happens after payment (D-020), so it does not consume quote validity. Changing the default needs operations approval (Q-019).
- The customer must accept the exact cart total: the submit request carries `acceptTotal {amountMinor, currency}`. If it differs from the recomputed total, the server returns 409 `quote_changed` with the new quote.
- Checkout uses the persisted quote while it is valid and the order is approved. An expired quote returns 409 `quote_expired`, and the customer must update and resubmit, which requires a new check, a new sign-off and a new snapshot (ORD-009).

## PRC-007 Price changes and releases

Prices are release data. Editing a band price or surcharge changes nothing for customers until publish (CAT-012). After publish, open drafts show the new price on their next read; the price change is not selection impact (CAT-013). Submitted orders keep their persisted quote.

## Worked examples (synthetic — for tests, labelled `SYNTHETIC`)

Fixture: currency `USD`; band `B` with uplift 10000; `products.base_price_minor[suit] = 69900`, so the release has `bandPrices[suit][B] = 79900`; material `syn-navy` (band B); component links suit: jacket (required, 0), trousers (required, 0), vest (optional, 10000); accent group `accents.jacket.lining` with attributes `…internal-lining` (default `default`, value `personalizado` 0) and `…lining-fabrics` (visible when `internal-lining = personalizado`, value `98` 900); style attribute `…jacket-sleeve-buttonholes` with value `1` (working buttonholes) 1000 and default `0`; lapel value `peak` 0. A group charge present in an older release (for example lining 1600) is ignored.

| # | Configuration | Lines (minor) | Unit total |
| --- | --- | --- | --- |
| E1 | Defaults only | base 79900 | **79900** |
| E2 | E1 + vest included | base 79900; component vest 10000 | **89900** |
| E3 | E2 + lining `personalizado` + lining fabric `98` + buttonholes `1` + lapel `peak` | base 79900; vest 10000; option lining fabric 900; option buttonholes 1000 (lining and lapel add 0) | **91800** |
| E4 | E3, then lining set back to `default` | lining-fabric hidden and inert → 0 | **90900** |
| E5 | E3 with `material_price_overrides[syn-navy][suit] = 129900` | base 129900 replaces the tier price | **141800** |
| E6 | Material `syn-unpriced` (no band, no override) | — | `unavailable` / `base_price_missing` |
| E7 | E3, quantity 2 | unit 91800 | **183600** |

`byCategory` for E3: Base 79900 · Vest 10000 · Jacket 1000 · Accents 900.
