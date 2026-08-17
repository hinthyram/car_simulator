# CAR SIMULATOR V11 — Server Storage

## Requirements
- Node.js 20+ recommended
- npm

## Run
```bash
npm install
npm start
```
Then open:
`http://localhost:3000`

Do not open `index.html` directly with `file://`.

## What changed
- Added Express web server.
- Added SQLite database at `data/maps.db`.
- Added REST API:
  - GET `/api/maps`
  - GET `/api/maps/:id`
  - POST `/api/maps`
  - PUT `/api/maps/:id`
  - DELETE `/api/maps/:id`
- `shared/mapStorage.js` now talks to the API.
- Existing browser localStorage maps are migrated to the server once on first connection.
- Physics, terrain calculations, vehicle model and HUD were not rewritten.

## Database
The database file is created automatically:
`data/maps.db`

Back up the `data` directory to back up user maps.
