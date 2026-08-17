# V9 Architecture

V9 is a structural refactor of V8. The goal is to separate code by responsibility
without changing vehicle physics, map format, or UI behavior.

## Frontend modules

- `js/pages/mapSelect.js` — map selection page.
- `js/editor/mapEditor.js` — map editor.
- `js/simulator/simulator.js` — Three.js scene, simulation loop, camera and simulator UI.
- `js/simulator/carLoader.js` — GLB loading and car-part mapping.
- `js/ui/etvcHud.js` — e-TVC HUD event wiring.
- `js/ui/vehicleHud.js` — vehicle HUD implementation used by the physics layer.

## Physics

- `js/physics/carPhysics.js`
- `js/physics/tireModel.js`
- `js/physics/engine.js`
- `js/physics/drivetrain.js`
- `js/physics/transmission.js`
- `js/physics/etvcController.js`

The physics code was moved, not rewritten.

## Terrain

- `js/terrain/terrain.js`

The terrain implementation remains the same and is imported by the simulator and physics layer.

## Data boundary

`shared/mapStorage.js` remains the persistence boundary. This phase still uses localStorage.
The next phase can replace its implementation with an API without changing editor/simulator callers.

## Important rule

V9 changes organization, not simulation behavior.
