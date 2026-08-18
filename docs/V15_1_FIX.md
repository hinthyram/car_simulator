# V15.1 startup fix

- The simulator never waits for the Render API before starting.
- The map editor never blocks its UI on the API.
- When the API is temporarily unavailable, map editing uses localStorage fallback.
- When the API is available, map persistence uses Render.
- The previous "npm start로 서버를 실행하세요" alert is removed.
- Vehicle physics files are untouched.
