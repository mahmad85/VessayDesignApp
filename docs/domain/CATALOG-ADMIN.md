# Admin-driven catalog, templates and releases

Status: proposed v0.3 under D-019 (accepted direction, 2026-09-28). Requirements CAT-007 to CAT-018 and TPL-001 to TPL-004. This file refines [CATALOG.md](CATALOG.md) (CAT-001 to CAT-006 remain in force). Pricing is owned by [PRICING.md](PRICING.md). Storage, DDL and caching are in [ADMIN-BACKEND.md](../architecture/ADMIN-BACKEND.md). Endpoints are in [API-REFERENCE.md](../architecture/API-REFERENCE.md). Screens are in [ADMIN-SCREENS.md](../ux/ADMIN-SCREENS.md).

Nothing in this file approves real supplier data, prices, rights or construction rules (Q-011, Q-023). It defines the **mechanism** that lets an authorised admin enter and publish them.

## 1. Glossary

Admin UI labels are plain language. Code and database names are fixed. Use these names exactly.

| Admin UI label | Domain term | Table | Current code / seed term | Example |
| --- | --- | --- | --- | --- |
| Product | product | `products` | `Product` | Suit, Shirt, Blazer |
| Part | component | `components` | seed *category* (`jacket`, `pants`, `vest`) | Jacket, Trousers, Vest, Shirt |
| Option group | option group | `option_groups` | seed *group*; outline *leaf* | Lapels, Pockets, Monogram, Lining |
| Option | attribute | `attributes` | seed *section*; `selectionKey` | Lapel style, Lapel width |
| Choice | option value | `option_values` | seed *option* (`value`) | Notch, Peak, Shawl |
| Fabric | material | `materials` | `FABRICS` entry | Midnight navy twill |
| List (lookup) | lookup type / value | `lookup_types`, `lookup_values` | `OCCASIONS`, `CLIMATES`, fabric `pattern` | Colour family: Navy |
| Price band | price band | `price_bands` | — | Band A to E |
| Look (template) | template | `templates` | — | “The Wedding Navy” |
| Customer tab | presentation branch (derived) | — | `BranchId` | Essentials, Jacket, Trousers, Vest, Accents |
| Release | catalog release | `catalog_releases` | seed `version` | Catalog v7 |

## 2. Hierarchy

```
Product (suit)                                 base price per price band (PRICING.md)
├─ Preferences (not construction, CAT-001)     occasion, climate — lookup values
├─ Fabric (material)                           chosen once per garment; band or override price
└─ Part links (product_components)             required | optional (+ surcharge when included)
   └─ Part (component: jacket)                 reusable across products (suit and blazer share jacket)
      └─ Option group (kind: style | accent; line kind: construction | accessory)   + surcharge once when active
         └─ Option (attribute; input: choice | text)                                  + surcharge once when active
            └─ Choice (option value)                                                  + surcharge when selected
```

- A component belongs to no product by itself. `product_components` links it to a product with `required`, `default_included`, `surcharge_minor`, `sort` and an optional customer label (for example “Add a vest”).
- An option group belongs to exactly one component. An attribute belongs to exactly one group. An option value belongs to exactly one attribute.
- **Per-product settings** (`product_option_settings`) can make a group, attribute or value unavailable for one product, set a product-specific default choice, or override a surcharge. This is how the blazer reuses the jacket without inheriting every suit construction (CAT-002: “Do not assume every suit jacket construction is available as a blazer”).

### 2.1 Customer tabs (presentation rule, derived — never stored)

Given a product and the garment’s included components, the customer navigator (and its selection tags and 2D focus) is built as follows:

1. **Essentials** always comes first: Garment (product), Occasion, Weather (climate), Fabric.
2. For a product whose links contain **exactly one component** (shirt, blazer), that component’s `style` groups are appended to Essentials in `sort` order. No separate part tab is shown. This reproduces today’s shirt and blazer navigation.
3. For a product with **more than one component** (suit), one tab is shown per included component in link `sort` order, labelled with the component name. It holds that component’s `style` groups. An optional component that is not included (vest) still shows its tab, containing only the include toggle, so the customer can add it.
4. **Accents** holds every visible `accent` group across included components, sub-headed by component name, in component then group `sort` order. It is shown only when at least one accent group is visible.

Leaf id = `option_groups.code`. The branch ids are `essentials`, `<componentCode>` and `accents`.

## 3. Entities (domain fields)

Types: `code` is a stable machine key (§8.2). `minor` is integer money in minor units ([PRICING.md](PRICING.md) PRC-001). `status` ∈ `draft | active | archived` unless stated. Every mutable table also has `id` (uuid text), `row_version`, `created_at` and `updated_at`, and catalog tables have `first_published_version` ([ADMIN-BACKEND.md](../architecture/ADMIN-BACKEND.md)).

### 3.1 Product

| Field | Rule |
| --- | --- |
| `code` | `suit`, `shirt`, `blazer` imported. New products allowed, but only with a registry-backed `measurement_set` and `visual_model`. |
| `name`, `short_label`, `description` | Required for `active`. |
| `measurement_set` | One of the code-owned sets in `modules/measurements/definitions.ts` (`suit`, `shirt`, `blazer`). Measurement definitions stay tailor-owned code (MEAS-001, Q-012), and admins cannot edit them in this scope. |
| `visual_model` | `suit`, `shirt` or `blazer` (the renderer bases in `src/visualization`). A product that the renderer cannot draw is not allowed in this scope. |
| `default_material_id` | Must be an active material allowed for the product. Used when a garment starts from scratch. |
| `hero_media_id` | Image for the start screen. |
| `fabric_consumption_cm` | Optional, informational (for example 350 for a suit). Never used to invent stock. |
| `sort`, `status` | — |

### 3.2 Component and product link

`components`: `code` (`jacket`, `trousers`, `vest`, `shirt`), `name`, `description`, `visual_part` (`jacket|trousers|vest|shirt`, from the registry), `sort`, `status`.

`product_components`: `product_id`, `component_id`, `required` (bool), `default_included` (bool; must be true when `required`), `surcharge_minor` (≥0, charged once when included, PRC-003), `include_label` (customer label for optional parts), `sort`.

### 3.3 Option group

`code` (globally unique), `component_id`, `name`, `short_name`, `description`, `kind` (`style` | `accent`), `line_kind` (`construction` | `accessory`; accessory = sold item such as a tie or shoes, listed as a separate spec line for the supplier), `icon_media_id`, `focus_region` (a `RegionId` from `visualization/focus-regions.ts`, required for `active`), `surcharge_minor`, `visible_when` (Condition, §5), `sort`, `status`.

### 3.4 Attribute (Option)

`code` (globally unique; stored in customer selections; immutable after first publish), `group_id`, `name`, `help_text`, `input_type` (`choice` | `text`), `required` (a visible required attribute must have an answer before the design can be accepted), `text_rules` (only for `text`: `{maxLength: 1–60, pattern: RegExp source limited to a character-class allowlist, transform: 'none'|'upper', placeholder}`; `maxLength` is mandatory because no monogram limit may be assumed, UX-016), `visual_slot` (registry slot or null, §6), `metadata_fields` (§3.6), `surcharge_minor`, `visible_when`, `sort`, `status`, `legacy_key` (the seed selection key when imported, otherwise null).

### 3.5 Option value (Choice)

`code` (unique within the attribute; imported codes are kept verbatim, including `A1` and `By default`; new codes are generated from the label as a lower-case slug), `attribute_id`, `label`, `description`, `image_media_id`, `is_default` (at most one per attribute; null default is allowed and means “customer must choose” when visible), `is_off` (marks the “none/without/by default” value used by gates and shown as “None”), `surcharge_minor`, `supplier_code` (manufacturing code, internal only, CAT-002), `visual_token` (§6), `metadata` (values for the attribute’s `metadata_fields`), `sort`, `status`.

### 3.6 Choice metadata (lookup-driven, generic)

An attribute may declare `metadata_fields: [{key, label, type: 'lookup'|'text'|'number'|'boolean', lookupType?, required}]`. For example, the imported lining-fabric option declares `tone → lookup colour_family`, `material → text`, `texture → lookup texture`, `composition → text`. The admin form for each choice renders these fields, and publish validation checks them. This gives rich metadata to ties, socks, linings and threads without a table per accessory type.

### 3.7 Material (fabric) — expert metadata

Materials are the shell cloth customers choose per garment. Fields are grouped as the admin form shows them. “Lookup” means a `lookup_values.code` of the named type. Unknown values stay null: **never fill supplier facts with estimates** (AGENTS.md).

| Group | Field | Type / rule | Why it matters |
| --- | --- | --- | --- |
| Identity | `code` | unique code, immutable after publish | Stable id in drafts and orders |
| | `name` | required for active | Customer name (“Midnight navy twill”) |
| | `supplier_id` | FK `suppliers` (kind `fabric_mill` or `fabric_merchant`) | Who supplies the cloth |
| | `supplier_article_code` | text, internal | Mill/merchant article number, used for production (CAT-002) |
| | `mill_name`, `display_mill_name` | text; bool (default false) | The mill is shown to customers only when rights allow (Q-023) |
| | `collection_name`, `season_code` | text (bunch/book name; for example `SS27`) | Traceability to the supplier bunch |
| Appearance | `colour_name` | text | “Midnight navy” |
| | `colour_family_code` | lookup `colour_family` | Filters and AI grounding |
| | `primary_hex`, `secondary_hex` | `#RRGGBB`, primary required | Renderer colour and swatch fallback |
| | `pattern_code` | lookup `pattern` (its `metadata.renderPattern` ∈ `plain|twill|check|stripe`) | Filters; 2D/3D pattern |
| | `weave_code` | lookup `weave` | Expert detail (twill, hopsack, oxford …) |
| | `texture_code`, `sheen_code` | lookup `texture`, `sheen` | Hand and lustre |
| | `finish_codes` | lookup[] `finish` | Brushed, mercerised, easy-iron … |
| Composition | `composition` | `[{fibre: lookup fibre, percent: 1–100}]`; the sum must be exactly 100 when present | Labelling and care; required for a production release |
| Technical | `weight_gsm` | int 60–700 | Displayed as g/m² and oz/yd² (`gsm / 33.906`, 1 decimal) |
| | `super_number` | int 60–250, multiple of 10, wool only | “Super 120s” fineness |
| | `yarn_count` | text (for example `2/120`) | Shirting and worsted detail |
| | `width_cm` | int 100–180 | Cutting and consumption |
| | `stretch_code` | lookup `stretch` | None, mechanical, elastane |
| Wear | `season_codes` | lookup[] `season` | Spring, summer, autumn, winter |
| | `climate_codes` | lookup[] `climate` | Existing Warm / All season / Cool |
| | `occasion_codes` | lookup[] `occasion` | Existing Office / Wedding / Formal event / Everyday |
| | `formality` | int 1–5 | Recommendation ranking |
| | `wrinkle_resistance`, `breathability`, `opacity` | `low|medium|high` | Advice (opacity for shirting) |
| | `drape` | `fluid|balanced|structured` | Advice |
| | `care_codes` | lookup[] `care` | Care label |
| Story | `description_short` (≤160), `story` (≤2000, plain text) | text | Customer copy and AI grounding |
| | `tag_codes` | lookup[] `tag` | Curated search/AI vocabulary |
| Usage | `usages` | subset of `shell`, `lining`, `contrast`, `shirting` | Which choices can use it (this scope: `shell` and `shirting` are selectable as the garment fabric) |
| | product links | `material_products(material_id, product_id)` | Allowed products (replaces `Fabric.products`) |
| Commercial | `price_band_code` | FK `price_bands` | PRICING.md PRC-002 |
| | price overrides | `material_price_overrides(material_id, product_id, price_minor)` | PRC-002 |
| Availability (**live, not release-bound**, §7.6) | `availability` | `in_stock|low_stock|out_of_stock|discontinued|unknown` | Selectability and submission recheck (CAT-005) |
| | `stock_meters` | numeric, supplier-provided only, internal | Informational |
| | `lead_time_days`, `availability_updated_at` | int; timestamptz | Staff planning; never shown as a delivery promise |
| Media | `material_media(role)` | `swatch` (required for active), `texture` (tileable), `closeup`, `drape`, `garment` | Cards, zoom, renderer texture |
| | `texture_scale_cm` | numeric; real-world width of one texture tile | VIS-002 consistent scale |
| Governance | `reference_only` | bool | Reference/synthetic data can never be checked out in production (D-012, §7.7) |
| | `status` | draft/active/archived | — |

### 3.8 Lookups (CAT-008)

`lookup_types(code, label, description, system, value_metadata_schema)` and `lookup_values(type_code, code, label, description, sort, active, metadata)`.

System types are seeded and cannot be deleted. Admins may add, rename, reorder and deactivate values:

| Type | Seed values (codes) | Required value metadata |
| --- | --- | --- |
| `occasion` | `office`, `wedding`, `formal_event`, `everyday` (labels as today) | — |
| `climate` | `warm`, `all_season`, `cool` | — |
| `colour_family` | `black`, `charcoal`, `grey`, `navy`, `blue`, `light_blue`, `green`, `olive`, `brown`, `tan`, `beige`, `cream`, `white`, `burgundy`, `red`, `pink`, `purple`, `yellow`, `orange`, `multi` | `hex` |
| `pattern` | `solid`, `twill`, `herringbone`, `birdseye`, `sharkskin`, `nailhead`, `pinstripe`, `chalk_stripe`, `bengal_stripe`, `check`, `windowpane`, `glen_check`, `houndstooth`, `gingham`, `tartan`, `micro_pattern`, `textured` | `renderPattern` ∈ `plain|twill|check|stripe` |
| `weave` | `plain`, `twill`, `herringbone`, `hopsack`, `basketweave`, `satin`, `oxford`, `royal_oxford`, `pinpoint`, `poplin`, `end_on_end`, `dobby`, `jacquard`, `seersucker` | — |
| `fibre` | `wool`, `cashmere`, `mohair`, `alpaca`, `silk`, `linen`, `cotton`, `polyester`, `viscose`, `cupro`, `polyamide`, `elastane`, `other` | — |
| `finish` | `brushed`, `milled`, `mercerised`, `easy_iron`, `water_repellent`, `natural_stretch` | — |
| `texture` | `smooth`, `crisp`, `soft`, `textured`, `slubby`, `lustrous` | — |
| `sheen` | `matte`, `subtle`, `lustrous` | — |
| `season` | `spring`, `summer`, `autumn`, `winter` | — |
| `stretch` | `none`, `mechanical`, `elastane` | — |
| `care` | `dry_clean_only`, `machine_wash_cold`, `hand_wash`, `iron_low`, `iron_medium`, `do_not_tumble` | — |
| `tag` | none (admin-curated) | — |

Lookup value codes are immutable once referenced by a published release. A value that is in use can be deactivated (`active=false`): it disappears from admin pickers, but existing records keep it and publish validation reports a warning. The seed lists above are a curated starting vocabulary, not supplier facts.

## 4. Per-product settings (CAT-011)

`product_option_settings(product_id, scope, group_id | attribute_id | value_id, available, default_value_id, surcharge_override_minor)`, with exactly one target per row (`scope` ∈ `group|attribute|value`).

- A missing row means the entity is available with its global default and surcharge.
- An unavailable group hides all its attributes for that product. An unavailable attribute hides its values. An unavailable value cannot be chosen.
- `default_value_id` (attribute scope) overrides `option_values.is_default` for that product. It must point to an available value of the same attribute.
- `surcharge_override_minor` replaces the entity’s global surcharge for that product. Null means use the global value.

## 5. Visibility and compatibility rules (CAT-010)

### 5.1 Condition language (JSON, validated with Zod)

```ts
type Condition =
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  | { attr: string; in: string[] }             // effective value of attribute code is one of value codes
  | { attr: string; answered: boolean }        // attribute has any effective value (text: non-empty)
  | { component: string; included: boolean }   // component code included in the garment
  | { material: { codes?: string[]; lookup?: { field: 'pattern'|'weave'|'colourFamily'|'stretch'; in: string[] } } }
  | { product: string[] };                     // garment product code is one of
```

Maximum depth is 6 and maximum node count is 50 per condition. Unknown attribute, value or component codes are publish **errors**.

### 5.2 Effective selections

`visible(group)`: the group is active in the release, available for the product, its component is included, and `visible_when` (if any) is true. `visible(attribute)`: its group is visible, it is available for the product, and its `visible_when` is true. Values stored for invisible attributes are **kept but inert**: they are excluded from conditions, validation, price and the order specification, and are restored if the attribute becomes visible again. Conditions are evaluated against effective selections, in outline order, with a fixed-point loop (at most 10 passes). If visibility still changes on the 10th pass, the release is invalid (publish error: cyclic visibility).

### 5.3 Compatibility rules

`compatibility_rules(code, product_ids[] (empty = all products), when: Condition, effect: 'forbid'|'require', attribute_id, value_ids[], customer_message, status, sort)`.

- `forbid`: when `when` holds, the attribute’s effective value must not be in `value_ids`.
- `require`: when `when` holds, the attribute’s effective value must be in `value_ids`.
- Rules apply only when the target attribute is visible.
- Every product’s **defaults must satisfy every rule**, and so must every template (publish errors).
- Rule evaluation returns `{ruleCode, attributeCode, message}` violations. The engine never silently changes a customer’s accepted choice. When a customer change would violate a rule on another attribute, the server returns the proposed resolution (the default or the first allowed value) as an **impact list** that the customer must accept (409 `impact_confirmation_required`, CAT-006, AC-07).

## 6. Visual binding (CAT-014)

The renderers stay code (D-016). The coupling becomes explicit:

- A code registry `src/visualization/registry.ts` exports `VISUAL_SLOTS: Record<SlotId, {label, tokens: readonly string[], shownIn3D: boolean, visualModels: VisualModel[]}>` and `REGION_IDS` (from `focus-regions.ts`).
- `attributes.visual_slot` names the slot the attribute drives. `option_values.visual_token` names the token the renderer draws for that choice, or is null, meaning “Not illustrated”.
- `src/visualization/binding.ts#renderValues(snapshot, garment) → Record<SlotId, token>` replaces direct selection-key reads in `sketch-spec.ts`, `tailored-human.tsx` and `garments/*`. `focus-regions.ts` reads `option_groups.focus_region`. `coverage.ts` derives “shown in 3D” from the slots of a group’s attributes.
- **Slot ids and tokens are derived from today’s code, not invented.** Each key that `sketch-spec.ts`, `tailored-human.tsx`, `garments/*.ts`, `focus-regions.ts` and `coverage.ts` read becomes one slot. Its tokens are exactly the seed values those files compare against, plus the seed’s other values for that key. The slot id is the render property name (for example `jacket.lapelType` for `style.jacket.jacket_lapel_type_combinated.jacket-lapel-type`). A unit test asserts that every imported binding resolves.
- Publish validation: a token that is not in the slot is an **error**. A choice without a token on a bound attribute is a **warning**, and the customer sees the 2D “Not illustrated” marker plus the choice text (VIS-002). Accessory image assets (ties and similar) use the choice image, as today.
- Non-regression (AC-43): before refactoring, record golden `sketchSpec()` outputs and 3D choice sets for a synthetic design matrix. After import and refactor, the outputs must be identical.

## 7. Lifecycle, releases and runtime (CAT-012, CAT-013, CAT-015 to CAT-017)

### 7.1 Working copy and statuses

Admins edit relational **working tables**. Customers never read them. `draft` rows are ignored by publish, so admins can stage incomplete work (CAT-003). `active` rows are compiled and validated. `archived` rows are excluded but kept.

Hard delete is allowed only when `first_published_version IS NULL` and no other working row references the entity. Otherwise the admin archives it.

### 7.2 Codes

Product, component, group, attribute, value, material, template, lookup value and price-band codes are **immutable once `first_published_version` is set** (409 `code_immutable`). Labels, images, prices and metadata can always change.

### 7.3 Publish (CAT-012)

Publishing is one transaction under an advisory lock:

1. Compile the active working rows into a `CatalogSnapshot` (§9 and [ADMIN-BACKEND.md](../architecture/ADMIN-BACKEND.md)).
2. Validate (§7.4). Any error returns 422 `publish_blocked` with the report. Warnings must be acknowledged: the request carries `acknowledgeWarnings: true` and a `warningsChecksum` equal to the checksum of the current warning list.
3. Compute each template’s `asShownPriceMinor` with the pricing engine (TPL-004).
4. Insert `catalog_releases(version = previous + 1, snapshot, checksum, reference_only, notes, validation, published_by)`. Set `first_published_version` on newly published rows. Write an audit event.
5. The request must carry `expectedCurrentVersion` (409 `stale_release` if another publish happened in between).

The current release is the row with the highest `version`. Releases are immutable (AC-19: historic versions preserved).

### 7.4 Validation catalogue (CAT-003)

**Errors** (block publish):

| Code | Condition |
| --- | --- |
| `product_no_components` | An active product has no active linked component, or no required component |
| `product_invalid_registry` | `measurement_set` or `visual_model` is not in the registry |
| `product_default_material` | The default material is missing, inactive or not allowed for the product |
| `attribute_no_values` | An active visible `choice` attribute has no available active values for a product |
| `default_invalid` | The default value (global or product) is not an available active value of that attribute |
| `text_rules_missing` | A `text` attribute has no `maxLength` |
| `condition_invalid` | A condition references unknown codes, exceeds limits or cycles |
| `rule_violated_by_defaults` | A product’s defaults violate a rule |
| `template_invalid` | A template references an inactive or unavailable product, material, component or value, is missing an answer to a required visible attribute, or violates a rule |
| `material_incomplete` | An active material is missing `name`, `primary_hex`, `pattern_code`, a swatch, `usages`, or at least one product |
| `composition_sum` | The composition is present but its percentages do not sum to 100 |
| `visual_token_unknown` | A token is not in the bound slot, or the slot is not in the registry |
| `focus_region_unknown` | An active group’s `focus_region` is missing or not a `RegionId` |
| `metadata_invalid` | A choice’s metadata does not match its attribute’s `metadata_fields` |
| `lookup_unknown` | A lookup code on an active entity (material fields, template preferences, choice metadata) does not exist in its lookup type |
| `currency_invalid` | The commerce currency is not in the supported list (PRC-001) |

**Warnings** (publish allowed after acknowledgement):

| Code | Condition |
| --- | --- |
| `price_missing` | A product has no band prices, or an active material allowed for a product has neither a band price nor an override (the quote will be unavailable, PRC-005) |
| `reference_price_unset` | An imported choice has `metadata.referencePrice > 0` and `surcharge_minor = 0` |
| `image_missing` | A choice, group icon, product hero or template hero is missing, or its alt text is empty |
| `rights_unconfirmed` | Active entities use media with `rights_status` of `unknown` or `reference_only` |
| `reference_only_present` | Any active entity has `reference_only`; the release is marked `reference_only` (§7.7) |
| `not_illustrated` | A choice on a bound attribute has no `visual_token` |
| `supplier_missing` | An active material has no supplier or article code |
| `lookup_inactive_in_use` | An active entity references an inactive lookup value |

### 7.5 Diff, restore and preview

- **Diff**: `GET /api/admin/catalog/diff` compares the working compile with the current release, keyed by code. The result is `{added[], removed[], changed[{entity, code, fields[]}]}`. The admin UI shows it before publishing.
- **Restore**: loading release *N* into the working copy replaces all working catalog rows with the compiled content of *N* (the same loader the importer uses), keeping ids by code. Emergency rollback is *restore N, then publish* as a new version. Nothing is ever rewritten in place.
- **Preview** (ADM-006): staff can open the studio with `?catalog=working`. The server compiles the working copy (cached by checksum) and uses the separate draft owner `preview:user:<id>`, so no customer draft is ever pinned to an unpublished catalog.

### 7.6 Live availability (not release-bound)

`materials.availability`, `lead_time_days` and `availability_updated_at` change without publishing. They are operational facts. The runtime overlays them on the release (cached for up to 60 s per instance):

- `out_of_stock` or `discontinued`: shown disabled with the reason “Currently unavailable”; cannot be newly selected; blocks order submission and checkout (CAT-005).
- `low_stock`: selectable, with a “Limited availability” badge.
- `unknown`: selectable; staff see it as a warning on the order.

### 7.7 Reference-only guard (CAT-017)

Imported Hockerty options, the 8 reference fabrics and their thumbnails are `reference_only = true` (D-012, D-014, Q-023). A release containing any reference-only entity is `reference_only`. In `NODE_ENV=production`, order submission and checkout reject any garment that uses a reference-only product, material, value or template (409 `catalog_not_orderable`). Clearing the flag requires the `catalog.publish` permission, a confirmation text that the supplier facts and rights were verified, and an audit event. The agent must never clear it on its own initiative.

### 7.8 Customer runtime and rebase (CAT-013)

- Each garment in a draft stores `catalogVersion`. Commands validate against that version’s snapshot.
- When the current version is newer, the server dry-runs a **rebase**: it keeps every selection still valid, fills new visible attributes with defaults, and lists removed or replaced selections as an impact list.
- If the impact list is empty, the next command for that garment rebases silently. Price changes are not selection impact; the live quote always shows current prices.
- If the impact list is not empty, `GET /api/studio` returns `catalogUpdates[]`, and commands for that garment return 409 `catalog_update_required` until the customer sends `rebase_catalog` with `confirmImpact: true`.
- Submitted orders keep their own resolved snapshot and are never rebased (CAT-006, ORD-001).

## 8. Templates (TPL-001 to TPL-004)

TPL-001: A template MUST define a product, a material, the included optional components, selections (attribute code → value code, or text), merchandising preferences (`occasion_codes`, `climate_codes`), name, subtitle, description, story, hero image, gallery (0–8), `featured` and `sort`. Templates are catalog entities (draft/active/archived) and are published only inside a release.

TPL-002: A template MUST validate against its release exactly like a customer garment. Missing answers are filled from product defaults at compile time, and the stored template is not modified. Any violation is the publish error `template_invalid`.

TPL-003: Starting from a template MUST copy its resolved configuration into a new garment (`templateId`, `catalogVersion` recorded as provenance). After that, the garment is independent: later template edits or archiving never change customer drafts or orders. The customer may change anything the product allows (the D-019 “starting point only” choice). There are no locks.

TPL-004: A template’s price MUST come from the pricing engine for the same release. `asShownPriceMinor` is stored in the snapshot at publish. It is null when the quote is unavailable, and the gallery then shows “Price on request” (never 0). Customer copy is **“As shown $X”**: the customer can move the price up or down (for example with a cheaper fabric band), so “from” would be inaccurate. This is a wording refinement of the D-019 option text.

## 9. Snapshot and customer projection

The `CatalogSnapshot` TypeScript/Zod definition is in [ADMIN-BACKEND.md §5](../architecture/ADMIN-BACKEND.md#5-catalog-snapshot-contract). The **customer projection** (served at `/api/catalog/v/{version}`) removes: `supplier_code`, `supplier_id`, `supplier_article_code`, `mill_name` unless `display_mill_name`, `stock_meters`, `metadata.referencePrice`, `metadata.source*`, media `rights_status` and `source_note`, and rule names (it keeps `customer_message`). It is non-sensitive and versioned, so it can be cached publicly and immutably.

## 10. Import from today’s data (TASK-015)

The importer is a pure function `importLegacyCatalog(seedJson, FABRICS, PRODUCTS, DETAIL_OPTIONS, OCCASIONS, CLIMATES) → CatalogSnapshot`, plus a loader into the working tables. It must be deterministic and idempotent: re-running it produces the same codes and values.

| Source | Target |
| --- | --- |
| `PRODUCTS` suit/shirt/blazer | products `suit` (links: jacket required, trousers required, vest optional with `include_label` “Add a vest”, `default_included=false`), `blazer` (jacket required), `shirt` (shirt required). `name` = `PRODUCTS[p].name`, `short_label` = `.label`, `description` = `.description`; `measurement_set` and `visual_model` equal the code. `default_material_id` = today’s defaults: suit and blazer → `navy-twill`, shirt → `ivory` (`availableFabrics(product)[0]`). Status `active`, `reference_only = true` |
| seed category `jacket`/`pants`/`vest` | components `jacket`/`trousers`/`vest` |
| seed group | option group; `code` = `${menu}.${category}.${group.id}` (equal to today’s leaf id, for example `style.jacket.jacket_fit`, `accents.jacket.lining`); `kind` = `style` for menu `style`, `accent` for `accents`; `name` = the readable label (`readableLabel()` from `design-outline.ts`); `focus_region` from `LEAF_REGIONS`; `metadata.referenceMenuPrice` from `referenceMenuPrice` |
| groups `accents.jacket.{panuelos,bowtie,tie,suspenders,shoes}` and `accents.pants.{belt,socks}` | `line_kind = accessory` |
| seed section | attribute; `code` = `selectionKey` (unchanged, so stored drafts and golden tests match); `legacy_key` = `selectionKey`; `input_type = choice`; `required = true` |
| seed option | option value; `code` = `value` (verbatim); `label` = `cleanOptionLabel(label)`; `metadata.sourceLabel`; `metadata.referencePrice`; `attributes` copied into `metadata`, with `metadata_fields` declared on the attribute; `is_default` = `selected`; `is_off` = value ∈ `OFF_VALUES`; `surcharge_minor = 0`; `reference_only = true` |
| seed thumbnails | `media_assets` with `storage_driver = 'static'`, `storage_key` = the existing `/reference-assets/...` path, `rights_status = 'reference_only'` |
| `relevantSections()` gating | For each group with more than one section: if the first section has a `personalizado` value, the other attributes get `visible_when {attr: first, in: ['personalizado']}`; otherwise, if it has an off value, they get `visible_when {not: {attr: first, in: [off]}}` |
| `visibleGroups()` | Style vest groups other than `style.vest.waistcoat` and all accents-vest groups get `visible_when {component: 'vest', included: true}`; groups whose `label === id` (`pants_chinos`, `waistcoat_wedding`) are `archived` |
| `style.vest.waistcoat.waistcoat` (`'1'`/`'0'`) | Replaced by including the `vest` component (garment `includedComponents`). The attribute is archived. Its `referencePrice` 100 goes to `product_components.metadata.referencePrice` only |
| legacy shirt `collar`, `cuffs`, `fit` | component `shirt`, style groups `style.shirt.shirt_fit`, `style.shirt.shirt_collar`, `style.shirt.shirt_cuffs`, with one attribute each: `style.shirt.shirt_fit.shirt-fit`, `style.shirt.shirt_collar.shirt-collar`, `style.shirt.shirt_cuffs.shirt-cuffs` (the seed naming pattern). Values `tailored`/`classic`/`relaxed`, `spread`/`point`, `button`/`french`; defaults `tailored`, `spread`, `button` (today’s `createDraft` defaults); focus regions `torso`, `collar`, `sleeve`; `reference_only = true` |
| legacy blazer `lapel`, `pockets`, `closure`, `fit` | Blazer uses the jacket component. Product settings leave available only: the jacket style values `simple_1`, `simple_2`; lapel type `standard`, `peak`; pockets `2`, `2b`; fit `1`, `0`, `relaxed`. All other jacket groups are `available=false` for blazer until an admin enables them (CAT-002) |
| legacy `fit` for suits | The jacket-fit attribute gains a value `relaxed` (label “Relaxed”, token `relaxed`) so today’s Relaxed fit choice is preserved. Flagged for tailor review in Q-026 |
| `FABRICS` (8) | materials: `code` = `id`; `colour_name` = `name`; `primary_hex` = `color`; `pattern_code` plain→`solid`, twill→`twill`, check→`windowpane`, stripe→`pinstripe`; `usages` `['shell']` (suit/blazer) or `['shirting']`; product links from `products`; `climate_codes` mapped from labels; `description_short` = `description`; `weight_gsm` and `composition` **null/empty** with `metadata.weightLabel` / `metadata.compositionLabel` kept (never converted to invented numbers); no price band; `availability = 'unknown'`; `reference_only = true` |
| `OCCASIONS`, `CLIMATES` | lookup values (codes in §3.8; labels unchanged) |
| Prices | None. All surcharges are 0, no band prices, and every quote is “unavailable” until an admin prices the catalog (honest, PRC-005) |

After import, publish release v1 as actor `system:bootstrap`. In development and tests, bootstrap runs automatically when no release exists (`CATALOG_AUTO_BOOTSTRAP`, default on outside production). In production, an operator runs `npm run catalog:bootstrap` explicitly.

**Legacy draft upgrade** (lazy, on read; `schemaVersion` absent means v1) is specified in [ADMIN-BACKEND.md §7](../architecture/ADMIN-BACKEND.md#7-draft-v2-and-lazy-upgrade).

## 11. Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| CAT-007 | The catalog MUST be data-driven through the product → component → option group → attribute → option value hierarchy in §2, with customer tabs derived by §2.1 | AC-34, AC-43 |
| CAT-008 | Enumerations used for materials and preferences MUST be admin-maintained lookups (§3.8) with immutable codes | AC-34 |
| CAT-009 | Materials MUST carry the metadata in §3.7. Unknown supplier facts stay null and are never estimated | AC-34, AC-35 |
| CAT-010 | Visibility and compatibility MUST be declarative conditions and rules (§5), evaluated identically by every command path (chat, controls, templates, rebase) | AC-07, AC-34 |
| CAT-011 | A product MUST be able to restrict availability, defaults and surcharges of shared component options (§4) | AC-34 |
| CAT-012 | Customer-visible catalog changes MUST take effect only through a validated, immutable, versioned release (§7.3–7.4) | AC-19, AC-34, AC-35 |
| CAT-013 | Drafts MUST pin a release version and rebase with explicit impact acceptance (§7.8) | AC-07, AC-34 |
| CAT-014 | Rendering MUST use explicit visual bindings from a code registry, with no visual regression for imported data (§6) | AC-43 |
| CAT-015 | Published codes MUST be immutable, and published entities are archived, never deleted (§7.1–7.2) | AC-34 |
| CAT-016 | Admin-uploaded media MUST record type, size, checksum, alt text and rights status, and customer pages must not use images without alt text (warning at publish) | AC-45 |
| CAT-017 | Reference-only data MUST NOT be orderable in production (§7.7) | AC-39 |
| CAT-018 | Material availability MUST be live and rechecked at submission and checkout (§7.6) | AC-39 |
| TPL-001 – TPL-004 | §8 | AC-37 |
