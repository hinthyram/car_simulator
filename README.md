# CAR SIMULATOR V15.5

GitHub Pages에서 실행되는 웹 기반 차량 시뮬레이터입니다. 맵 에디터와 차량 물리 엔진을 포함하며, 맵 저장소는 Supabase PostgreSQL을 직접 사용합니다.

## 현재 구조

```text
GitHub Pages
    ↓
shared/mapStorage.js
    ↓
Supabase REST API
    ↓
public.maps (PostgreSQL)
```

Render, Node.js/Express 서버, SQLite는 맵 저장에 사용하지 않습니다.

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. `public.maps` 테이블을 생성합니다.
3. RLS를 활성화하고 SELECT/INSERT/UPDATE/DELETE 정책을 설정합니다.
4. Supabase Dashboard → Settings → API Keys에서 **Publishable key**를 확인합니다.
5. `shared/runtimeConfig.js`의 `CAR_SIM_SUPABASE_PUBLISHABLE_KEY`에 Publishable key를 입력합니다.
6. 실제 배포는 GitHub Pages Actions로 진행합니다.

자세한 절차는 `docs/SUPABASE_SETUP.md`를 참고하세요.

## 로컬 테스트

정적 파일 서버를 사용하면 됩니다. 예:

```bash
python -m http.server 8000
```

그 후 `http://localhost:8000/`으로 접속합니다.

## 맵 API

프론트엔드의 `MapStorage`는 다음 Supabase 작업을 직접 수행합니다.

- 맵 목록 조회
- 맵 단건 조회
- 맵 생성/업데이트
- 맵 삭제
- 기존 localStorage 맵의 1회 서버 이전

## 보안

`shared/runtimeConfig.js`에는 **Publishable key만** 넣어야 합니다.

다음 키는 절대 넣으면 안 됩니다.

- Supabase Secret key
- `service_role` key
- Database password

Publishable key를 사용하는 대신 실제 서비스에서는 RLS 정책을 사용자별 권한으로 강화하는 것을 권장합니다.
