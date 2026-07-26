# Athletonic Gym Configurator Prototype

An isolated, real-scale martial-arts gym planning prototype built with React, Three.js, React Three Fiber, and Zustand.

## Local Development

```sh
npm install
npm run dev
```

Quality checks:

```sh
npm run lint
npm run build
```

## Licensed 3D Models

The configurator supports licensed GLB models without changing its scene code. Downloaded files belong in `public/models/`; never commit or distribute an asset unless its license permits that use.

Register each approved model in `src/catalog/modelAssets.ts`. The loader automatically:

- clones the cached model for every equipment instance;
- scales it uniformly to fit the catalog's real-world dimensions;
- centers it on the X/Z footprint and places it on the floor;
- enables casting and receiving shadows;
- preserves the model's proportions.

Current free candidates requiring a free Sketchfab account for download:

- Boxing ring by Kopag 3D: Sketchfab Standard License.
- Vintage / Old punching bag by maxsbond.work: CC BY 4.0.

The MMA model `a7aef586a9c34fe789c9b2c4acb45588` is prohibited because it contains UFC and Monster Energy branding. Only generic, unbranded MMA cage assets licensed for commercial use may be registered.

Record the creator, source URL, and exact license in `THIRD_PARTY_NOTICES.md` before enabling any model.

## Scope

This prototype stores equipment type, position, and rotation. Dimensions remain fixed in `src/catalog/equipment.ts`; users cannot stretch or deform products. Designs are persisted locally in the browser.

## Commercial Rack References

The unbranded procedural supports follow real commercial construction patterns rather than copying logos or decorative trade dress:

- TKO 522CHBS single heavy-bag stand: 70 × 61 × 88 in, freestanding cantilever, 150 lb bag capacity.
- Titan 400714 four-bag stand: 6 × 6 × 8 ft, 3 in square steel tube, bolt-down plates, four 300 lb hooks and 360-degree access.
- Valor CA-53 / commercial speed-bag platforms: circular timber rebound drum with twin-guide height adjustment.
- Meister and Exigo double-end systems: elastics tensioned between dedicated upper and lower anchors.

Two- and three-station layouts are planning adaptations of the same commercial structural system: shared-beam and radial circuit-tree configurations. Their catalog descriptions identify them as planning layouts where a manufacturer did not publish an exact matching footprint.