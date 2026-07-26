# Boxing ring and MMA cage dimensional audit

Consulted: 2026-07-26. All model units are metres at 1:1 scale.

## Source table

| Object / source | Published interior | Published exterior | Platform | Ropes / fence | Structure, padding and access | Regulatory vs commercial use |
| --- | --- | --- | --- | --- | --- | --- |
| Boxing ring - [World Boxing Competition Rules v3.99](https://worldboxing.org/wp-content/uploads/2024/09/World-Boxing-Competition-Rules-Feb-2024-v3.99-ClEAN.pdf) | Minimum 6.10 x 6.10 inside ropes | Apron minimum 0.61 beyond rope line; no complete stair-inclusive footprint published | 0.91-1.22 above floor | Four 0.04 ropes; top surfaces at 0.40, 0.70, 1.00 and 1.30 above canvas | Ropes linked by two retainers per side; corner/turnbuckle padding required | Regulatory minimums control the combat area and rope arrangement, not a complete commercial product footprint. |
| Boxing ring - [Government e-Marketplace RFP](https://mkp.gem.gov.in/catalog_data/catalog_support_document/buyer_documents/18186276/54/78/703/CatalogAttrs/SpecificationDocument/2025/5/17/rfpboxing_2025-05-17-09-40-58_7f248998f8f785cdab2a65b6ca262f96.pdf) | 6.10 x 6.10 | 7.80 x 7.80 platform | 1.00 | Four-rope competition configuration | Commercial platform specification; complete stair projection not published in the indexed specification | Supplies the commercial platform dimensions used by the model. |
| MMA cage - [Association of Boxing Commissions Unified Rules](https://www.abcboxing.com/wp-content/uploads/2020/02/unified-rules-mma-2019.pdf) | Fighting canvas 18-32 ft (5.49-9.75) wide | Complete event footprint not prescribed | Not prescribed as one fixed value | Vinyl-coated chain-link fence, minimum 6 ft (1.83) high | Fence posts and exposed metal must be padded; two entrances are permitted by the rules | Regulatory envelope; does not define one commercial octagon product. |
| MMA cage - [SportCom Competition MMA Cage Premium](https://www.sportcom.eu/gb/mma-cages/378-mma-cage-octagon-ufc.html) | 9.00 diameter/across | 11.00 with catwalk | 1.00 tubular steel frame | Eight 1.95-high panels; 5 mm mesh (3.1 mm galvanized core + 1.4 mm plastic), 500 N/mm2, EN 10223-6 | Eight padded corners, two panels with 0.90 doors, 0.05 mats, printable non-slip waterproof canvas | Commercial reference controls the modeled octagon, platform, mesh and access. |
| MMA cage - [Protec Boxing platform cages](https://www.protecboxing.com/mma-cages/platform/) | Custom sizes; no single interior dimension published | No fixed total footprint published | High and low options; no single height published | Wire panels extend below deck | Steel subframe, timber deck, 0.04 sport foam, canvas, padded top/bottom rails and uprights, lockable door | Construction cross-check only; SportCom supplies the dimensional baseline. |

## Implemented dimensions

| Object | Combat interior | Published structure footprint | Planning footprint used by catalog/bounds | Platform top | Highest contact barrier | Total model height |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `boxing-ring` | 6.10 x 6.10 | 7.80 x 7.80 | 7.80 x 8.70 including removable steps | 1.00 | Four ropes at 1.40, 1.70, 2.00 and 2.30 above room floor | 2.30 |
| `mma-cage` | 9.00 across flats | 11.00 across flats with catwalk | 11.60 x 11.60 including step projection allowance | 1.00 | 1.95 fence above canvas | 2.95 |

The boxing rope heights are the World Boxing heights measured from the 1.00 m canvas. The MMA cage has exactly eight equal sides and eight posts. The 0.90 m commercial door is contained within one panel.

## Catalog corrections

| Kind | Previous | New | Reason |
| --- | --- | --- | --- |
| `boxing-ring` | 6.10 x 6.10 x 1.25, described as the footprint | 7.80 x 8.70 x 2.30 | 6.10 is the combat interior, not the outer footprint. The new depth includes modeled removable steps. |
| `mma-cage` | 7.50 x 7.50 x 2.00 | 11.60 x 11.60 x 2.95 | Replaced the provisional diameter with the 9 m interior / 11 m catwalk commercial reference plus access allowance. |

Existing saved `x`, `z` and `rotation` values are not migrated, so saved objects remain at their prior anchors while bounds and space warnings use the corrected catalog footprint.

## Explicit planning estimates

These values were not published by the cited sources and are used only to make a visually and spatially useful generic model:

- Boxing ring stair-inclusive depth: 8.70 m. The cited product publishes a 7.80 m platform but not the removable stair projection.
- MMA stair-inclusive planning square: 11.60 m. SportCom publishes 11.00 m with catwalk but not the step projection.
- Boxing post section: 0.13 m square; post setback from rope corner: 0.17 m.
- Boxing turnbuckle body and corner-pad thicknesses, platform frame-member sections and skirt thickness.
- MMA post section: 0.12 m square; padded top/lower rail diameters and hinge/latch component sections.

These estimates do not replace a published interior or exterior dimension. Procurement drawings should confirm them before construction or purchasing.
