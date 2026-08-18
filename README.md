# CAR SIMULATOR

GitHub Pages 기반 3D 차량 시뮬레이터입니다.

## 저장 구조

- **기본 맵**: `maps/*.json`으로 GitHub 저장소에 포함됩니다. 배포할 때 함께 제공되며 Supabase가 없어도 기본 맵을 실행할 수 있습니다.
- **사용자 맵**: Supabase `public.maps` 테이블에 JSONB로 저장됩니다.
- **Render**: 사용하지 않습니다.

## 현재 기본 맵

- 평지
- 오르막 / 내리막 테스트 필드
- 마운틴 링 서킷 (`maps/default_mountain_ring.json`)

## Supabase 연결

`docs/SUPABASE_SETUP.md`를 참고하세요.

`shared/runtimeConfig.js`에 Supabase Project URL과 Publishable Key를 설정해야 합니다. Secret/service-role key는 절대 넣지 마세요.

## GitHub Pages

`.github/workflows/pages.yml`이 저장소의 정적 파일을 GitHub Pages로 배포합니다.
