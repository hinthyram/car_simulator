# Car Simulator 6.7 - Map System M1

기준 버전은 V6.7입니다. V6.8 토크 HUD 변경은 포함하지 않습니다.

## 실행
- `index.html`을 웹 서버로 실행
- 홈 → 시뮬레이션 → 평지/오르막·내리막/사용자 맵
- 홈 → 맵 만들기 → 지형/도로 편집 → 저장 또는 테스트 주행

## 구조
- `simulation.html`: 기존 V6.7 시뮬레이터
- `index.html`: 홈페이지 + 맵 선택
- `map-editor.html`: 1차 맵 에디터
- `terrain.js`: 기존 `TestTerrain` 유지 + `CustomTerrain` 추가
- 사용자 맵: localStorage `carSimMap:<id>`

## 현재 에디터
- 맵 크기
- 높이맵 기반 지형 올리기/내리기
- 브러시 크기/강도
- 도로 중심선 점 생성
- 도로 폭
- 맵 저장
- 저장한 맵 즉시 테스트 주행

다음 단계에서 도로 곡선 보간, 스플라인, 노면 종류, 오브젝트, 시작점 편집 등을 추가할 수 있습니다.
