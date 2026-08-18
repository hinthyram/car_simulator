# V14 — GitHub Pages ↔ Render API

V14 separates the frontend origin from the backend origin.

## One setting

Edit:

`shared/runtimeConfig.js`

and replace:

```js
export const CAR_SIM_API_BASE = 'REPLACE_WITH_RENDER_URL';
```

with your real Render Web Service URL, for example:

```js
export const CAR_SIM_API_BASE = 'https://car-simulator-xxxx.onrender.com';
```

Do not add `/api` to the URL. `MapStorage` appends `/api/maps` itself.

## Flow

GitHub Pages:
`https://hinthyram.github.io/car_simulator/`

calls Render:
`https://YOUR-RENDER-SERVICE.onrender.com/api/maps`

The Render server already includes CORS handling for:
`https://hinthyram.github.io`

## Local development

If the project is opened through the Node server at `http://localhost:3000`, set
the same runtime URL if you want to use the remote Render API, or temporarily set
it to an appropriate local API URL.

## Important

Do not put passwords, database credentials, Render API tokens, or other secrets in
`runtimeConfig.js`. A browser-visible API base URL is not a secret.
