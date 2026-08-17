# CAR SIMULATOR V8

V8의 목표는 기존 V7/M22 기능을 새 물리엔진으로 다시 만드는 것이 아니라,
기존 기능을 하나의 웹사이트 흐름으로 통합하는 것입니다.

## 실행 흐름

홈
- `index.html`

시뮬레이션 시작
- `pages/map-select.html`
- `simulator/simulation.html`

맵 만들기
- `map-editor/map-editor.html`

테스트 주행
- 맵 에디터 → 시뮬레이터 → ESC → 해당 맵 에디터

## 유지 원칙

- 물리엔진 파일은 웹사이트 통합 때문에 재작성하지 않음.
- `shared/mapStorage.js`의 MapStorage 인터페이스를 유지.
- 현재는 localStorage 저장을 유지.
- 향후 서버 API로 교체할 때 MapStorage 내부만 변경.
- 맵 데이터 형식은 브라우저/서버에 독립적으로 유지.

## 다음 단계

1. V8 통합 동작 검증
2. JS 모듈 분리
3. 서버 API 추가
4. DB 저장으로 MapStorage 교체
5. 사용자 계정/맵 공유
