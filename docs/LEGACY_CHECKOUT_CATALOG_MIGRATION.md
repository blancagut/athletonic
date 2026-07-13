# Legacy checkout catalog migration

Retail checkout no longer merges unpublished rows from `data/checkout-catalog.json` into
the canonical published catalog. Canonical `data/final/catalog.published.json` products
always win, and only explicit aliases in `api/_lib/catalog.js` may resolve old IDs.

The audit found 13 legacy-only rows. None can be safely promoted automatically:

- `49720`, `49760`: Pegasus Premium rows. The only same-name published product (`49856`)
  has a different Realtree URL, so no alias was created.
- `49832`, `49782`: Vaporfly 4 rows with no published canonical match.
- `official-boon-none` (two rows): duplicate ID for different products; ambiguous and rejected.
- `official-boon-mk3bl` (three rows): duplicate ID, inconsistent names/colors/SKU; ambiguous and rejected.
- `official-boon-mpswg` (two rows): duplicate ID for different products; ambiguous and rejected.
- `official-topking-tksgp-gl-pp-bk-s` (two rows): duplicate ID for different colors; ambiguous and rejected.

The pre-existing `1509-extreme`, `1509-other`, and `1509-vanilla` aliases remain explicit
and resolve to published product `1509`, with flavor context where unambiguous.
