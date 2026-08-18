# V15.2 Recovery

V15.2 is rebuilt from V14's working frontend instead of V15.1.

Important:
- `shared/mapStorage.js` is NOT modified in V15.2. This removes the
  `backendAvailable is not defined` regression introduced by V15.1.
- The simulator starts with the original terrain and vehicle path immediately.
- Render map loading runs in the background and is non-fatal.
- The map editor initializes its existing tile UI even if the server is down.
- Vehicle physics code is not changed.
- Existing map editor controls are not replaced.
