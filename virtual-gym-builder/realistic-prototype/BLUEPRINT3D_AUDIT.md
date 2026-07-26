# Blueprint3D Modern Audit

Audited upstream: `charmlinn/blueprint3d-modern` at commit `f56f0b2a4a6e177181aefbf535d2945b937b5c02`.

## Result

The core package and Next.js demo type-check and build. The demo required a temporary locale-prefix workaround during local audit because Next.js 15.5.14 and next-intl 3.26.5 produced a redirect loop with `localePrefix: 'as-needed'`. It also required matching the server bind host to the middleware proxy host.

Once running, the demo loaded its 2D floor planner and Three.js 3D view. Wall drawing changed the 2D plan and the 3D renderer initialized. Its visual language and furniture-oriented demo are not suitable as the Athletonic product experience.

## Reuse decision

Chosen architecture: isolated Vite application using Three.js through React Three Fiber and Drei. Blueprint3D Modern is retained as a reference for floorplan algorithms, dimensions, wall topology, and serialization, not as a runtime dependency or copied application.

Useful references:

- `src/model/` for floorplan domain concepts
- `src/floorplanner/` for 2D wall interaction patterns
- `src/core/dimensioning.ts` for unit presentation
- `src/items/` for placement constraints
- `src/three/` for scene/controller responsibilities

Discarded from integration:

- Next.js demo application and i18n middleware
- Furniture catalog and demo UI
- Monolithic imperative controller coupling
- Any assumption that roadmap features already exist

## Verified capability notes

This upstream commit contains GLB/GLTF loaders despite README roadmap wording. Undo/Redo, PDF export, advanced mobile support, plan duplication, and URL sharing were not treated as available production features.

## Risk

The reusable value is primarily algorithmic. Directly importing the full engine would introduce coupling to its controller and item model while still not solving realistic martial-arts assets, branding, collision clearances, or the desired product UX. Selective reimplementation has lower maintenance and integration risk.
