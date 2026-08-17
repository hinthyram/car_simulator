# CAR SIMULATOR V13 — Render 서버 배포

V13은 기존 차량 물리/시뮬레이터/맵 에디터를 건드리지 않고 서버 배포에 필요한 부분만 정리한 버전입니다.

## 1. Render에서 Web Service 생성

Render Dashboard → New → Web Service → GitHub → `car_simulator` 저장소를 선택합니다.

설정:

- Branch: `main`
- Runtime/Language: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Render Web Service는 GitHub 저장소와 연결할 수 있고, 지정 브랜치에 push하면 자동 배포할 수 있습니다.

## 2. 환경변수

다음 값을 설정합니다:

`CORS_ORIGIN=https://hinthyram.github.io`

여러 출처를 허용하려면 쉼표로 구분합니다.

## 3. 배포 확인

Render가 발급한 URL이 예를 들어:

`https://car-simulator-api.onrender.com`

이라면 브라우저에서:

`https://car-simulator-api.onrender.com/api/health`

를 열어 다음과 비슷한 JSON이 나오면 서버가 정상입니다:

```json
{
  "ok": true,
  "service": "car-simulator-api",
  "version": "13.0.0"
}
```

## 4. GitHub Pages 프론트엔드의 API 주소

V13의 `shared/mapStorage.js`는 `window.CAR_SIM_API_BASE`가 있으면 그 주소를 API 서버로 사용합니다.

현재 GitHub Pages에는 별도의 전역 설정이 없으므로, Render URL을 연결하는 다음 단계에서 페이지에 전역 API 설정을 추가합니다.

예:

```html
<script>
  window.CAR_SIM_API_BASE = 'https://car-simulator-api.onrender.com';
</script>
```

이 값은 Render에서 실제 발급된 URL로 교체해야 합니다. URL을 추측해서 넣으면 안 됩니다.

## 5. SQLite 주의

V13은 아직 SQLite를 사용합니다. Render 기본 파일 시스템은 ephemeral이므로 서버 재배포/재시작으로 SQLite 데이터가 유지된다고 가정하면 안 됩니다.

따라서 V13의 SQLite는 **서버 연결 테스트 단계**입니다. 실제 맵 저장 서비스에서는 다음 단계에서 Render Postgres 등 영구 DB로 이전하는 것을 권장합니다.

## 6. 보안

DB 비밀번호나 API 키를 GitHub 코드에 넣지 않습니다. Render Environment Variables를 사용합니다.
