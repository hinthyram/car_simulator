# V15 — Non-blocking map loading

The simulator starts the renderer, car model, and physics without waiting for
the Render API. The saved map is requested in the background.

- Backend available: the saved map is applied and the existing physics object
  switches to the loaded terrain.
- Backend unavailable: the default terrain remains and the simulator continues.
- The vehicle physics engine is not recreated just because the map request
  completes.
- Saved spawn position/yaw is applied when the server map arrives.
