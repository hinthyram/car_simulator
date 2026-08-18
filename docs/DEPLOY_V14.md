# V14 deployment checklist

1. Open `shared/runtimeConfig.js`.
2. Replace `REPLACE_WITH_RENDER_URL` with the Render Web Service public URL.
3. Save.
4. Commit and push:
   `git add .`
   `git commit -m "Connect frontend to Render API"`
   `git push`
5. Wait for GitHub Actions -> Deploy static preview to GitHub Pages to finish.
6. Open `https://hinthyram.github.io/car_simulator/`.
7. Open Map Editor and create/save a test map.
8. Verify the Render API returns the map from `GET /api/maps`.

The Render server does not need a new manual configuration for this change; it already
has CORS configured for the GitHub Pages origin.
