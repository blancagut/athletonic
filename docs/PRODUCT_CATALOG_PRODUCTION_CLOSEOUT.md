# Product Catalog Production Closeout

This closeout treats product readiness as a system problem, not a product-by-product cleanup.
Athletonic should not let a customer buy an ambiguous product line.

## Current Evidence

- Source catalog database: `output/data/products.db`.
- Product rows: 45,730.
- Variant rows: 217,756.
- Products with options JSON: 45,553.
- Products with at least one available variant: 36,362.
- Products with variant rows but zero available variants: 9,240.
- Products with no variant rows: 128.
- Published server catalog files are still mostly flat product records:
  - `data/athletonic-catalog.json`
  - `data/search-index.json`
- Checkout currently validates product id and price from the flat catalog, but not a real `variant_id`.
- The PDP can show option selects, but the cart stores selected variants as plain text.
- Footwear audit found real variant data for size/SKU/price/availability, but generated listing cards and checkout can bypass it.

## Production Rule

A product is buyable only when every required customer choice is represented as a real variant or a verified fixed spec, and checkout can validate that selection server-side.

Required server fields for buyable variant products:

- `product_id`
- `variant_id`
- `sku`
- `selected_options`
- `available`
- `unit_amount_cents`
- `compare_at_price_cents`
- `currency`
- `image_url`
- `weight_grams`
- `source_snapshot`

## Hard Blockers

- Product has options or variants, but checkout receives no `variant_id`.
- Customer-selected option text does not match a real variant row.
- Selected variant is unavailable.
- Selected variant has missing or invalid price.
- Product has variant-specific price but checkout uses product-level price.
- Product has images/title/description that contradict each other.
- Description appears copied from another product.
- Product category requires a choice that is missing from PDP.
- Product has no usable image.
- Product is active while all variants are unavailable.

## Product Domain Agents

Use domain agents because required choices are different by product type.

1. Supplements and nutrition
   - Flavor, size/weight, servings, count, capsules/tablets, dosage, form, pack count, purchase type.
2. Apparel
   - Size, color, gender/fit, inseam, length, material/care, pack count.
3. Footwear
   - Shoe size system, width, gender/fit, colorway, surface/use, availability by size.
4. Fight and combat gear
   - Glove ounces, color, closure, hand side, headgear/shin guard size, shorts size, bag weight, filled/unfilled.
5. Soccer and team sports
   - Jersey size/version/player/season, cleat size/surface/width, ball size, socks/shinguards size.
6. Accessories, recovery, and gym equipment
   - Side, voltage/power, compatibility, resistance, weight, dimensions, length, pack count.
7. Images and visual matching
   - Image/title/description agreement, gallery consistency, color-image matching, missing or wrong product photos.
8. Descriptions and copy QA
   - Placeholder text, copied descriptions, contradictions, unsafe claims, missing specs.

## Platform Agents

9. Source-of-truth and export schema
   - Export real variants from SQLite into public/server catalog artifacts.
10. PDP UX and option rendering
   - Render required choices, fixed specs, sold-out states, and variant-specific images/prices.
11. Cart runtime
   - Store structured selections and `variant_id`, not plain text only.
12. Checkout validation and pricing
   - Recalculate price and availability from server-side variant data.
13. Offers and discounts
   - Apply offers at product or variant level without making non-eligible variants look discounted.
14. Inventory and availability
   - Prevent sold-out variants from checkout; show unavailable options clearly.
15. Admin and operations
   - Preserve variant/SKU/options in order, support, return, and fulfillment records.
16. QA automation
   - Generate reports, blocker counts, PDP checks, cart checks, and checkout simulation.
17. Compliance and claims
   - Flag supplement dosage, health claims, serving directions, warnings, and restricted claims.
18. Rollout and production gate
   - Block deployment or promotion when blocker thresholds are not met.

## Category Matrices

### Supplements

Buyable only when:

- Flavor is selected or verified as single-flavor.
- Size/weight or count is visible.
- Servings, capsules/tablets, dosage, or form are visible when present in source data.
- Variant price is real and available.
- Claims and directions do not contradict the label/source copy.

Known failures:

- Supplement rows are indexed without normalized options, variants, servings, dosage, form, count, or net weight.
- Multi-variant supplement cards can bypass option selection.
- Some supplement categories are wrong, including multivitamin/hydration/creatine examples assigned to unrelated shelves.
- Some variants have unavailable flavor/size combinations or missing/zero variant prices that must not be sold.

### Apparel

Buyable only when:

- Size is selected when there is more than one size.
- Color is selected or shown as a fixed spec.
- Gender/fit and inseam are shown when relevant.
- Variant availability is enforced by size/color.

Known failures:

- Apparel listing cards can add size/color products directly to cart.
- PDP dropdowns allow independent selections that may not exist as a real variant combination.
- Checkout accepts empty or fake apparel variant text.
- Material and care details are often buried in description, not structured details.

### Footwear

Buyable only when:

- Shoe size is selected.
- Size system is clear.
- Width is shown or explicitly unknown.
- Sold-out sizes cannot be purchased.
- Variant SKU is stored with the order.

Known failures:

- Category cards can add footwear directly to cart without size.
- PDP size dropdowns include unavailable sizes.
- Multi-option footwear can present invalid color/size combinations.
- Server checkout validates product-level price and availability, not selected variant.

### Fight Gear

Buyable only when:

- Gloves expose ounces.
- Color/finish is selected or shown as fixed.
- Closure and material are not contradicted by title/description.
- Shorts/headgear/shin guards expose size.
- Bags expose weight and filled/unfilled state where applicable.

Known failures:

- Twins products have many generated pages but no real options in the source DB.
- Twins glove and shorts pages can sell with no ounces or size selected.
- Fairtex and Hayabusa have useful variants, but listing/deals cards can still add them without selecting color/ounces/size.
- Bag filled/unfilled state can change price and shipping weight, so product-level checkout price is unsafe.

### Soccer And Team Sports

Buyable only when:

- Jerseys expose size, version, and player/customization state.
- Cleats expose shoe size and surface/use.
- Balls expose size.
- Shinguards/socks expose size.

Known failures:

- Soccer is huge but not represented in the curated server catalog.
- Jersey player, version, team, season, and customization are mostly title text, not structured attributes.
- Cleat surface, gender/age, width, and size system are not normalized.
- Soccer categories are too coarse and often displayed with generic training labels.

### Accessories And Equipment

Buyable only when:

- Side-specific products expose side.
- Powered products expose voltage/power where applicable.
- Compatibility is shown for attachments, electrodes, parts, and device accessories.
- Weight/resistance/dimensions/pack count are shown where applicable.

Known failures:

- PDP details across generated product pages mostly show only Brand, Category, and Reference.
- Side, voltage, compatibility, resistance, dimensions, length, pack count, and filled/unfilled state are not normalized.
- Electrical and compatibility-sensitive items can expose unsafe or wrong options unless normalized and gated.

## Immediate Implementation Order

1. Export normalized variants and option schema from `output/data/products.db`.
2. Update server catalog validation to require `variant_id` for variant products.
3. Update PDP to render real variants, not only option value lists.
4. Update cart to store structured variant data.
5. Update checkout and order snapshots to preserve variant id, SKU, options, price, stock, and image.
6. Block or de-promote products with zero available variants.
7. Add content/image mismatch reports and stop promoting blocker products.
8. Re-run generation, code checks, QA reports, browser smoke tests, then deploy.

## PDP Variant Contract

Generated PDPs must not build purchase choices from `products.options` alone.
They must use real rows from `variants`.

Required PDP behavior:

- Query variants with `product_row_id`, `variant_id`, `title`, `sku`, `option1`, `option2`, `option3`, `price`, `compare_at_price`, `available`, and `weight_grams`.
- Build option selectors from real variant combinations.
- Disable choices that cannot resolve to a real variant.
- Mark sold-out choices when matching variants exist but are unavailable.
- Keep Add to cart disabled until the selection maps to exactly one available variant.
- Show the selected variant price, compare-at price, SKU, selected options, availability, and weight when available.
- For products requiring variants, product cards and search/catalog cards must use `View options`, not direct Add to cart.
- Variant-specific images require upstream image mapping. Until then, image swaps may only be inferred when confidence is high.

## Offer Contract

Offers must be validated with the same precision as checkout.

Offer scopes:

- Product offer: applies only when `product_id` matches exactly and the offer is intended for every purchasable variant of that product.
- Variant offer: applies only when `product_id` matches exactly and the selected real variant matches every required option in `option_match`.

Offer blockers:

- Do not apply an offer by brand, product name text, model prefix, category, or URL.
- Do not show a sale price, compare-at price, or discount badge on non-eligible variants.
- Do not let checkout price a variant offer from product-level price alone.
- Do not let `scripts/deals-engine.mjs` erase manual `variant_offers`.

Known offer risks:

- Optimum Nutrition Gold Standard Whey 5 lb must only discount `Extreme Milk Chocolate` and `Vanilla Ice Cream`.
- `Vanilla Ice Cream - NSF`, other flavors, and non-5 lb sizes are not eligible for that offer.
- Fairtex BGV16 and BGV1BR/BGV1 Breathable must be explicit product/variant matches; one must not inherit the other's offer by name similarity.

## Cart Contract

Cart lines must move from free-text variants to structured variant data.

Required cart item shape:

- `schemaVersion`
- `productId`
- `variantId`
- `sku`
- `selectedOptions`
- `variant`
- `mergeKey`
- `priceSnapshot`
- `image`
- `quantity`

Rules:

- Merge by `productId + variantId` when a real variant exists.
- Keep legacy variant text only for backward compatibility and display fallback.
- Send `variantId`, `sku`, `selectedOptions`, `variant`, `quantity`, `mergeKey`, and `priceSnapshot` to quote and checkout APIs.
- Never trust `priceSnapshot` for final charge amount; server-side catalog/variant/offer pricing wins.
- Store `variant_id`, `selected_options`, `cart_merge_key`, and `client_price_snapshot` inside the order item snapshot if no immediate DB migration is needed.

## Export Schema V2

`data/athletonic-catalog.json` must become the authoritative checkout catalog.
`data/search-index.json` should stay lightweight for search.

Required product fields:

- `schema_version`
- `id`
- `external_product_id`
- `brand_slug`
- `brand`
- `name`
- `url`
- `image`
- `currency`
- `available`
- `purchasable`
- `requires_variant_selection`
- `default_variant_id`
- `price_cents`
- `price_min_cents`
- `price_max_cents`
- `compare_at_price_cents`
- `section_id`
- `section_title`
- `options`
- `variants`
- `deal`

Required variant fields:

- `variant_id`
- `title`
- `sku`
- `option_values`
- `price_cents`
- `regular_price_cents`
- `compare_at_price_cents`
- `currency`
- `available`
- `weight_grams`

Search index should add only:

- `available`
- `purchasable`
- `requires_variant_selection`
- `default_variant_id`
- `price_min_cents`
- `price_max_cents`

Do not put every variant row into the search index.

## Server Checkout Contract

Checkout validation must build:

- `productsById`
- `variantsByProductAndId`, keyed by `productId::variant_id`

Validation rules:

- Require valid `productId`.
- Reject missing, unavailable, or non-purchasable products.
- Validate quantity from 1 to 20.
- If a product has variants, require `variant_id`.
- Confirm the variant belongs to the product.
- Reject unavailable variants.
- Use server-side variant price, regular price, SKU, title, option values, currency, and availability.
- Ignore client price, name, brand, and variant label for final pricing.
- Merge by `productId::variant_id`.
- Reject mixed currencies.

Private pricing should use a resolved line item, not product-only pricing.

## Order Snapshot Contract

Short-term:

- Store variant details in existing `product_snapshot`.
- Use existing `order_items.sku`.

Recommended migration:

- `variant_id text`
- `variant_title text`
- `brand_slug text`
- `external_product_id text`
- `option_values jsonb not null default '[]'::jsonb`
- `unit_public_amount_cents integer`
- `unit_regular_amount_cents integer`
- `unit_compare_at_amount_cents integer`

Recommended indexes:

- `order_items_product_variant_idx(product_id, variant_id)`
- `order_items_sku_idx(sku)`

## Definition Of Ready To Sell

- Zero hard blockers for promoted products.
- Variant products cannot be checked out without a valid available `variant_id`.
- Cart and order records show exact selected options.
- Product price in checkout matches the validated variant price or approved variant offer.
- Images, title, and description do not contradict required options.
- Category-specific required options are visible before Add to cart.
- A generated QA report lists blocker counts and sampled passes by category.

## Production QA Gate

Deployment and promotion must be blocked when any of these are nonzero:

- `missing_variant_id`: public buyable product has source variant rows but no real public/server `variant_id`.
- `direct_add_variant_products`: listing/search/card button can add a variant product directly to cart.
- `zero_available_variants`: product with no available variants appears in catalog, PDP, listing, search, or deals.
- `server_checkout_variant_bypass`: checkout accepts variant products without a valid available `variant_id`.
- `stale_pdp_search_mismatch`: search records and PDP/generated files disagree on product existence or key fields.
- `checkout_catalog_search_mismatch`: checkout catalog does not cover what the storefront can sell.
- `description_image_mismatch_samples`: high-confidence title/image/description contradictions exceed threshold.

Current observed blockers:

- Public catalog/search artifacts do not include `variant_id`.
- Listing pages expose hundreds of direct Add to cart buttons for products with variants.
- Some direct Add to cart buttons point at products with zero available variants.
- Checkout catalog is much smaller than search/PDP coverage.
- Duplicate, placeholder, and image/color/gender mismatch samples exist and need a report.

Recommended scripts:

- `scripts/qa-commerce-gate.mjs`
- `scripts/qa-content-samples.mjs`
- `npm run qa:prod`
