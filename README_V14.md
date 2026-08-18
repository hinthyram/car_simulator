# CAR SIMULATOR V14

V14 connects the GitHub Pages frontend to the deployed Render API.

Before pushing V14 to GitHub, edit:

`shared/runtimeConfig.js`

and put your Render Web Service public URL into `CAR_SIM_API_BASE`.

Example:
`https://car-simulator-xxxx.onrender.com`

The browser will then call:
`https://car-simulator-xxxx.onrender.com/api/maps`

The backend already allows requests from:
`https://hinthyram.github.io`

Do not put secrets in this file.
