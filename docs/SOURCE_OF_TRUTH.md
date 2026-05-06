# Athletonic Source Of Truth

The machine-readable source of truth lives in:

`src/source-of-truth/athletonic.mjs`

All marketplace code should read business-critical rules from that file instead of hardcoding them page by page.

## Marketplace Identity

- Store name: `Athletonic`
- Public domain: `athletonic.com`
- Operating country: `United States`
- Display currency: `USD`
- Model: US marketplace for supplements, sports nutrition, fitness apparel, recovery, footwear, and training accessories.

## Product And Price Rule

Product names, images, URLs, availability, and prices must come from the official brand website/domain.

Prices from retailers, aggregators, foreign-market stores, affiliate catalogs, or resellers are not valid for Athletonic.

Blocked examples:

- `thefeed.com`
- `swansonvitamins.com`
- `supplementmart.com.au`
- `nzmuscle.co.nz`
- `nutritionwarehouse.com.au`
- `bodyandfit.com`
- `bodyscience.com.au`
- `suppz.com`
- `tigerfitness.com`

## Brand Palette

- Deep blue: `#0B1F3A`
- Modern teal: `#2EC4B6`
- White: `#FFFFFF`
- Light gray: `#F5F7FA`
- Ink: `#102033`
- Muted: `#607084`
- Line: `#DDE5EF`

These colors apply across `home`, `shop`, `brands`, and `deals` unless a future page has an approved exception in the source-of-truth file.

## Brands

Approved brands and their official product/price domains are defined in `ATHLETONIC_SOURCE_OF_TRUTH.brands`.

The homepage brand cloud is defined by `ATHLETONIC_SOURCE_OF_TRUTH.featuredBrandSlugs`.

## Current Local Product Database

The current local feed source is:

`/Users/User/Desktop/Sups/output/data/products.db`

That database may contain invalid retailer data. The Athletonic generator must filter it using the official-domain rules before rendering products.
