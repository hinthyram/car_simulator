# CAR SIMULATOR V12

Web-based vehicle simulator with a modular physics engine, map editor, and server-backed map storage.

## Project status

V12 is GitHub-ready.

- V8: website flow
- V9: code modularization
- V10: canonical map schema
- V11: Node.js + Express + SQLite map server
- V12: GitHub repository structure, Git metadata, documentation, and GitHub Pages static-preview workflow

## Run locally

Requirements:
- Node.js 20+
- npm

```bash
npm install
npm start
```

Open:

http://localhost:3000

Do not open `index.html` with `file://`; the simulator uses the server API at `/api/maps`.

## Important: GitHub Pages vs server

GitHub Pages can host the static frontend, but it cannot run the Node.js/Express API or SQLite database.

Therefore V12 provides a GitHub Pages workflow as a **static preview**. The full map-saving application still needs the Node.js server to be deployed to a backend host.

For the full application:

Browser -> Node.js/Express -> SQLite

For a GitHub Pages preview:

Browser -> GitHub Pages

The Pages preview is not expected to persist maps through `/api/maps`.

## API

- GET `/api/maps`
- GET `/api/maps/:id`
- POST `/api/maps`
- PUT `/api/maps/:id`
- DELETE `/api/maps/:id`

## Database

The server creates:

`data/maps.db`

The database is intentionally ignored by Git. Back it up separately if it contains maps.

## Repository

Recommended default branch: `main`.

After creating an empty GitHub repository, run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial CAR SIMULATOR V12"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Then enable GitHub Pages:
Settings -> Pages -> Source: GitHub Actions.

The included `.github/workflows/pages.yml` will deploy the static project on pushes to `main`.
