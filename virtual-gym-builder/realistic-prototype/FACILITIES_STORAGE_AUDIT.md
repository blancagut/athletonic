# Facilities and storage model audit

Date: 2026-07-26

Scope: existing `bench`, `wall-pads`, and `equipment-rack` entities only. Dimensions are metres in the planner. No product logos, catalog products, or manufacturer-specific trade dress are reproduced.

## Planning dimensions

| Entity | Planner dimensions W x D x H | Status | Model construction |
| --- | --- | --- | --- |
| Training bench | 1.50 x 0.48 x 0.48 m | Fixed planning footprint and height retained | 105 mm upholstered seat envelope, rectangular powder-coated steel subframe, four posts, cross rail, rubber levelling feet, and restrained fasteners |
| Wall pad section | 2.40 x 0.12 x 1.80 m | Fixed 2.40 m module retained; 1.80 m height matches common 6 ft panels within 29 mm; 0.12 m is a planning envelope, not a claimed product thickness | Three 0.80 m modules, rounded vinyl faces, rigid backers, narrow seams, upper/lower metal mounting rails, and flush floor base |
| Equipment rack | 1.80 x 0.55 x 1.90 m | Fixed planning envelope retained; commercial references vary substantially in height | Rectangular steel uprights and rails, four retained mesh shelves, cross ties, hardware, and four rubber levelling feet |

The bench height of 0.48 m is 23 mm above common 18 in commercial seating and remains a credible seat height. No dimensions were changed, so existing layouts, selection boxes, footprints, rotation, and persistence remain compatible.

## Training bench references

| Reference | Published dimensions | Published materials / structure | Support / capacity | Visible traits used |
| --- | --- | --- | --- | --- |
| [Global Industrial locker-room bench](https://www.globalindustrial.com/p/global-industrial-153-locker-bench-hardwood-top-w-steel-tube-pedestals-bolt-down-60-x-9-1-2-x-17) | 60 x 9.5 x 17 in; top 1.25 in | Hardwood top; steel round tubular pedestals | Bolt-down; 350 lb | Thick seat, two substantial supports, floor attachment logic |
| [Salsbury 77770 aluminum bench](https://www.lockers.com/aluminum-locker-bench-60-inches-wide-10-deep-black-bolt-mounted/77775blk-bm/) | 60 x 10 x 18 in | Anodized aluminum seat with rounded edges; two 3 in powder-coated pedestals | Bolt-mounted; capacity not published | Rounded seat perimeter, commercial pedestal spacing, restrained finish |
| [Uline H-5554ST locker-room bench](https://www.uline.com/Product/Detail/H-5554ST/Lockers-and-Equipment/Locker-Room-Bench-60-x-9-x-17-Standard) | 60 x 9 x 17 in; top 1.25 in | Lacquered maple top; powder-coated steel pedestals | Pre-drilled mounting; capacity not published | Visible seat thickness, two supports, supplied hardware |
| [Centerline / Global laminate bench](https://centerlinedynamics.com/products/locker-room-bench-laminate-w-steel-trapezoid-legs-60w-x-12d-x-17h) | 60 x 12 x 17 in; top 1.25 in | Laminate top; stainless trapezoid pedestals | Must be floor anchored; capacity not published | Braced commercial leg geometry and stable stance |

The neutral upholstered top is a deliberate generic gym/locker-room interpretation. Its colour and texture do not claim wood because the planner brief permits an upholstered commercial seat.

## Wall pad references

| Reference | Published dimensions | Published materials / structure | Mounting / standard | Visible traits used |
| --- | --- | --- | --- | --- |
| [Resilite Wainscot Wall Padding](https://www.resilite.com/pages/wainscot-wall-padding) | Typical panel 2 x 6 ft; 2 or 2.5 in systems | Crosslink polyethylene or neoprene compound foam; 7/16 in OSB; 14 oz fire-retardant vinyl, optional 18 oz on selected systems | Top/bottom lips, slot-back fasteners, or aluminum Z-channels; Guardian XL ASTM F2440, Safeguard Plus ASTM E84 | Individual modules, rigid back, vinyl face, narrow gaps, concealed upper/lower channel mounting |
| [AALCO Standard Wall Pads](https://www.aalcomfg.com/products/custom-wallpads/standard-wall-pads-swp/) | 2 x 6 ft; 2 in urethane foam | Urethane foam; 7/16 in OSB; NFPA 701 19 oz vinyl laminate | Standard 1 in nailing lips; optional clips; selected variants ASTM E84 | Regular panel rhythm, wrapped vinyl, rigid backing and rail/lip logic |
| [AK Athletic 2 x 6 Wood-Backed Wall Padding](https://akathletics.com/products/wood-backed-wall-padding-2-x-6) | 2 x 6 ft (published product title) | Wood-backed commercial wall pad; detailed material values were not reliably extractable | Mount details and capacity not published in retrieved content | 2 ft modular width and 6 ft height used only as a dimensional comparison |

The planner depth of 0.12 m includes pad, backing, and mounting allowance. It is intentionally identified as an estimate because common published foam thickness is about 0.051 m before backing and attachment space.

Mounting uses the existing room contract: wall thickness is 0.18 m and the pad rear plane is placed on the interior wall face. A pad within 0.25 m and 7.5 degrees of a cardinal wall snaps to that face on commit. A selected pad away from a valid wall span displays `Wall mounting required`; no feet are invented.

## Equipment rack references

| Reference | Published dimensions | Published materials / structure | Support / capacity | Visible traits used |
| --- | --- | --- | --- | --- |
| [Rogue Universal Storage System 2.0](https://www.roguefitness.com/rogue-universal-storage-system-2-0) | 76.5 x 23.75 in footprint; 29.25 or 45.25 in high | 2 x 3 and 3 x 3 in 11-gauge steel uprights; 0.1875 in laser-cut shelves; welded support channels | Casters and rubber feet included; 70 in shelf holds sixteen 70 lb kettlebells two-deep | Heavy uprights, supported trays, edge retention, robust shelf hardware, stable floor contacts |
| [Escape Rack 5](https://searasports.com/product/escape-rack-5/) | 190 x 60 x 70 cm; 75 kg | Carbon steel, powder-coated; adaptable shelves; optional plastic guards and bumpers | Floor-standing; load capacity not published | Neutral powder coat, retained adaptable shelves, storage for kettlebells/core bags/medicine balls |
| [Garage Gym Reviews: Rogue USS 2.0](https://www.garagegymreviews.com/equipment/rogue-fitness-universal-storage-system-2-0) | 76.5 x 23.75 x 29.25 or 45.25 in | 11-gauge steel; laser-cut shelves with welded underside support; black powder coat | Wheels included; product weight 55-75 lb, load capacity not published | Reinforced shelves, portable/stable base, flat trays for mixed equipment |

The 1.90 m planner height is taller than the cited low storage systems but remains a plausible four-level commercial accessory rack. Shelf spacing is a planning design, not a quoted manufacturer specification. The rack contains no selectable catalog products and is not a heavy-bag hanging rack.

## Automated checks

`tests/facilities.test.ts` locks the three catalog dimensions, validates mounting on north/east/south/west walls, rejects free-standing pads, and rejects pads extending beyond a wall span.

## Visual QA

All captures are in `visual-qa/facilities/`.

| Entity | Required desktop views | Scale / selection | Responsive views |
| --- | --- | --- | --- |
| Training bench | `bench-front.png`, `bench-side.png`, `bench-top.png`, `bench-three-quarter.png` | `bench-person.png`, `bench-selected-footprint.png` | `bench-mobile-3d.png`, `bench-mobile-top.png` |
| Wall pad section | `wall-pads-front.png`, `wall-pads-side.png`, `wall-pads-top.png`, `wall-pads-three-quarter.png` | `wall-pads-person-warning.png`, `wall-pads-selected-footprint.png` | `wall-pads-mobile-3d.png`, `wall-pads-mobile-top.png`, `wall-pads-west-wall-3d.png` |
| Equipment rack | `equipment-rack-front.png`, `equipment-rack-side.png`, `equipment-rack-top.png`, `equipment-rack-three-quarter.png` | `equipment-rack-person.png`, `equipment-rack-selected-footprint.png` | `equipment-rack-mobile-3d.png`, `equipment-rack-mobile-top.png` |

The wall-pad north and west perspectives use the two walls rendered by the existing room. East and south mounting are verified numerically by the same cardinal mounting test; room wall geometry was intentionally not changed. The free-standing wall-pad capture shows the required warning. Bench perspectives show all four feet on the floor. Rack perspectives show open shelf access, four stable contacts, and no floating parts.

## Validation results

- `npm run test:interaction`: 6 passed.
- `npm run test:facilities`: 4 passed.
- Focused ESLint for all changed TypeScript/TSX files: passed.
- `npm run build`: passed with the pre-existing Vite large-chunk advisory only.
- Browser console during clean desktop runs: no errors.
- Playwright: Top and 3D captured at desktop and 390 x 844 mobile sizes.
- Browser interaction: catalog selection succeeded; bench rotation committed at 0.261799 rad; bench drag committed at x 0.65 m / z -0.55 m; committed transforms survived reload.
- Commerce integrity seal: passed before and after implementation.
