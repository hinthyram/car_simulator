M20
- M19 충돌 실패 원인: terrain.js에 collider 생성이 없었음.
- fence/tree 렌더링과 동일한 위치/크기의 physics collider를 생성.
- 충돌은 physics.update() 직후 처리.
- velocityWorld만 고치면 다음 프레임에 velocityLocal이 덮어쓰기 되므로 둘을 동기화.
- 차량 물리/변속/e-TVC 계산은 변경하지 않음.
