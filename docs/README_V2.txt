# Car Simulator V2

기존 GLB 모델과 파츠 구조를 유지하면서 차량 물리를 개선한 버전입니다.

## 주요 변경
- 속도에 따른 조향 감소
- 엔진 힘과 최고속도 관계 개선
- 브레이크 / 후진 분리
- 구름저항 + 공기저항
- 앞/뒤 타이어 횡력
- 슬립각 기반 코너링
- 차체 요 관성
- 약한 언더스티어
- 핸드브레이크 시 후륜 그립 감소
- 부드러운 조향 복원
- 탭 전환/프레임 드랍에 대한 물리 안정화
- 기존 Wheel_FL/FR/RL/RR, Steer_FL/FR 구조 유지

## 실행
index.html을 로컬 서버로 실행하세요.

예:
python -m http.server 8000

그 다음 브라우저에서:
http://localhost:8000/

## 조작
W / ↑ : 가속
S / ↓ : 브레이크 또는 후진
A / ← : 좌회전
D / → : 우회전
Space : 핸드브레이크


## V2.1 변경
- W/A/S/D를 놓았을 때도 자동차가 자연스럽게 감속하도록 종방향 마찰을 강화했습니다.
- 필드의 노면을 **마른 아스팔트** 기준으로 설정했습니다.
- 구름저항 + 엔진 브레이크 + 공기저항을 분리해 적용합니다.
- 가속 페달을 놓으면 관성으로 잠깐 진행한 뒤 자연스럽게 속도가 떨어집니다.
- 자동변속기 D 상태를 가정해 입력이 없어도 약 **6 km/h**까지 천천히 전진하는 크리프(creep)를 추가했습니다.
- S는 전진 중에는 브레이크, 정지/저속에서는 후진으로 작동합니다.


## V2.2 기본 시동 상태
- 별도의 시동 버튼 없이 차량이 이미 시동된 상태로 시작합니다.
- 변속기는 D에 들어가 있는 상태로 간주합니다.
- 시작 순간부터 약 1.05 m/s(약 3.8 km/h)의 초기 전진 속도를 갖습니다.
- 입력이 없으면 크리프 힘이 아스팔트 저항을 보상하면서 약 6 km/h 부근으로 천천히 주행합니다.
- 크리프 중에는 일반적인 감속 저항을 중복 적용하지 않도록 수정하여 속도가 0↔몇 km/h 사이에서 떨리는 문제를 방지했습니다.
- W를 누르면 즉시 정상 가속으로 넘어갑니다.
- S는 전진 중 브레이크, 정지/후진 상태에서는 후진입니다.


## V2.6 — 변속기 오류 수정
- V2.5에서 발생했던 `gearForce` 참조 오류를 제거했습니다.
- 엔진 구동력은 `_drivetrainForce()`에서 직접 계산합니다.
- D에서는 자동 1~8단 변속만 수행합니다.
- Q/E는 P/R/N/D 범위만 변경합니다.
- S는 브레이크 전용입니다.
- 시작 상태는 D1이며 크리프가 작동합니다.
- W 입력은 D에서 확실히 엔진 구동력으로 연결됩니다.
- R에서는 W가 후진 가속으로 작동합니다.
- N/P에서는 엔진 구동력이 바퀴에 전달되지 않습니다.


## V2.7 — e-TVC
- e-TVC 기본 ON.
- 조향각과 실제 yaw rate로 목표 yaw rate를 계산합니다.
- FWD 구동 토크를 FL/FR에 배분합니다.
- e-TVC가 yaw error에 따라 좌우 토크를 차등 배분합니다.
- RL/RR는 FWD라 0 Nm로 표시합니다.
- 왼쪽 위 HUD에서 TARGET YAW, YAW ERROR, FL/FR/RL/RR 토크를 표시합니다.
- HUD의 e-TVC 버튼을 마우스로 클릭하여 ON/OFF할 수 있습니다.


## V2.7.1 — e-TVC 가속 오류 수정
- V2.7에서 `_drivetrainForce()`가 `driveForce`를 계산하기 전에 참조하던 치명적 오류를 수정했습니다.
- `driveForce = torqueAtWheels / wheelRadius * speedFactor`를 정상적으로 계산한 뒤 반환합니다.
- 따라서 W → 엔진 토크 → 기어비 → 최종감속비 → 구동력 경로가 다시 정상 연결됩니다.
- e-TVC HUD는 좌측 상단에서 **우측 상단**으로 이동해 기존 조작 안내와 겹치지 않도록 했습니다.

### 앞으로의 제어기능 추가 원칙
1. 입력(Input)
2. 변속기(Transmission)
3. 엔진/구동력(Powertrain)
4. 타이어(Tire)
5. 제어기(Controller: e-TVC 등)
6. HUD/UI

를 서로 분리해서 수정합니다. 새 기능을 추가할 때 기존 W/A/S/D와 파워트레인 함수를 직접 덮어쓰지 않습니다.


## V2.7.2 — e-TVC HUD 실시간 갱신
- HUD를 physics update 호출에만 의존하지 않고 requestAnimationFrame으로 계속 갱신합니다.
- TARGET YAW, ACTUAL YAW, YAW ERROR를 매 프레임 최신 state에서 읽습니다.
- FL/FR/RL/RR 토크도 매 프레임 최신 state에서 읽습니다.
- W를 놓거나 D가 아닌 상태가 되면 이전 토크값이 남지 않고 0 Nm로 초기화됩니다.
- 조향이 부드럽게 변경된 직후의 최신 steering 값으로 TARGET YAW를 다시 계산합니다.


## V2.8 — e-TVC 작동 조건 및 토크 표시 수정
- e-TVC 제어기는 W 입력 여부와 관계없이 항상 목표 Yaw/실제 Yaw를 계산합니다.
- 1단 크리프 주행에서도 실제 구동 토크를 FL/FR에 배분하므로 e-TVC가 동작할 수 있습니다.
- e-TVC OFF일 때 FL/FR 토크는 항상 정확히 50:50입니다.
- W를 놓아 순수 코스팅 상태가 되면 구동 토크는 0 Nm로 표시됩니다.
- 브레이크/P/N 상태에서도 이전 토크값이 남지 않습니다.
- HUD에 TORQUE BIAS를 추가해 e-TVC가 실제로 좌우 토크를 얼마나 차등 배분하는지 확인할 수 있습니다.


## V2.9 — e-TVC 토크 경로 재검증
- 네트워크/브라우저 UI가 아니라 물리 코드 자체에서 W→DCT→휠 토크를 단일 경로로 정리했습니다.
- `positiveDriveForce`와 최종 종방향 힘을 분리해 마찰/브레이크가 HUD 토크를 0으로 덮어쓰지 않게 했습니다.
- 매 프레임 FL/FR/RL/RR 토크가 한 번만 계산됩니다.
- e-TVC OFF는 정확히 50:50.
- e-TVC ON은 실제 양의 구동토크가 있을 때만 좌우 배분을 변경합니다.
- 시작 시 결정론적 Powertrain self-test가 실행됩니다.


## V3.0 — Wheel Torque Telemetry 수정
중요: 기존 HUD의 '토크값'은 사실상 '양의 구동토크'만 표시하고 있었습니다.
이것을 실제 회전 중인 바퀴의 물리적/축 토크 telemetry로 분리했습니다.

- W를 놓아도 바퀴가 회전하고 있으면 FL/FR/RL/RR 토크가 0으로 강제되지 않습니다.
- D에서 W를 놓으면 앞바퀴에는 엔진 브레이크 성분 + 구름저항 성분이 표시됩니다.
- 뒤바퀴에도 구름저항/접촉 토크가 표시됩니다.
- W를 누르면 앞바퀴에는 실제 구동토크가 추가됩니다.
- e-TVC OFF: 앞바퀴 구동토크 분배는 정확히 50:50.
- e-TVC ON: 앞바퀴 구동토크만 좌우 차등 배분.
- HUD에 WHEEL SPEED도 추가하여 토크값과 실제 바퀴 회전 상태를 함께 확인할 수 있습니다.

참고: '바퀴가 회전한다'와 '순수 구동토크가 있다'는 물리적으로 다른 개념입니다.
따라서 HUD의 토크는 구동토크만 0으로 만들지 않고, 회전 중의 구름/엔진브레이크 성분을 포함한 wheel/axle torque telemetry로 표시합니다.


## V3.1 — Modular Physics Architecture
물리 계산을 기능별 모듈로 분리했습니다.

- engine.js: 엔진 RPM/토크
- transmission.js: P/R/N/D + 8단 자동 DCT
- drivetrain.js: 구동력/구동토크
- etvcController.js: e-TVC 제어 및 FL/FR 토크 배분
- tireModel.js: 타이어 슬립/하중/횡력
- vehicleHud.js: HUD 출력
- carPhysics.js: 전체 시스템의 순서 제어와 차체 적분

특히 `driveTorque`와 `wheelOmega`를 분리했습니다.
따라서 앞으로 ABS/TCS/ESC/e-LSD 등을 추가할 때 기존 구동력 계산이나 HUD 값을 직접 덮어쓰지 않도록 확장할 수 있습니다.


## V3.2 — 토크 표시 선택 UI
- HUD 폭을 285px로 늘려 4자리 Nm 값도 줄바꿈되지 않도록 했습니다.
- `⚙ 토크 표시 설정` 버튼을 추가했습니다.
- `구동 토크 (Drive Torque)` 표시 ON/OFF.
- `실토크 (Real Tire Torque)` 표시 ON/OFF.
- 설정은 localStorage에 저장되어 새로고침 후에도 유지됩니다.
- 구동 토크는 Engine/Transmission/Drivetrain이 명령한 토크입니다.
- 실토크는 최종 longitudinal force를 기반으로 타이어-노면 접촉에서 발생하는 종방향 토크입니다.
- 현재 TireModel에는 종방향 slip/traction limit solver가 없으므로, V3.2의 실토크는 현재 차량의 longitudinal force를 바탕으로 계산됩니다. 추후 longitudinal tire model을 추가하면 그 결과를 실토크에 직접 연결할 수 있습니다.

## V3.3
- 초기 속도를 0으로 변경.
- 크리프를 속도 임계 ON/OFF가 아닌 연속 비례 제어로 변경하여 0↔토크값 진동 제거.
- 실토크를 net longitudinal force × radius로 계산하던 잘못된 방식을 제거.
- 실토크는 구동/브레이크/엔진브레이크/구름저항을 바퀴별로 조합한 접촉 토크 추정값으로 계산.
- HUD 토크 표시값은 절대값으로 표시하여 음수 부호가 숫자 레이아웃을 깨지 않게 함. 방향 정보는 내부 sign telemetry에 보존.
- HUD 폭 330px, 토크 숫자 영역 108px로 고정하여 4자리/5자리도 박스 밖으로 나오지 않음.
- 토크 설정 UI를 HUD 내부로 통합.


## HUD Layout Fix — exact cause
`VehicleHUD._applySettings()` was forcing `.wheel` rows to `display:flex`. The HTML/CSS was designed as a 2-column Grid containing four wheel cells. Changing the parent to flex made the four cells flow as a single row and caused labels/values to appear one position shifted/overlapping. The torque value also had a 108px minimum width, which exceeded the available width of each grid cell. The fix restores the parent Grid when visible and removes the oversized minimum width from the value.


## V4 Physics Rebuild
기존 V3 계열의 속도 기반 토크 보정/차량 전체 힘을 토크로 역산하는 구조를 제거하고 4륜 독립 wheel + tire slip + chassis force 구조로 교체했습니다. 자세한 구조는 PHYSICS_ARCHITECTURE_V3.1.md를 V4 내용으로 갱신했습니다.


## V4.1
V4.1은 UI/기어/HUD와 물리 코어를 함께 수정한 검증 버전입니다. DCT shift 판단을 도로 속도 기반으로 안정화하고, 구동토크(요구값)와 실제 적용토크를 분리했습니다. 실토크 HUD는 정지상태에서 0으로 고정되는 rolling contact torque 정의를 사용합니다.


## V6 Slope Test Field
- 기본 평지 물리는 기존 호출 방식 그대로 유지
- `terrain.js`의 TestTerrain으로 오르막/정상/내리막 테스트 가능
- 홈페이지 좌측의 `오르막/내리막` 버튼으로 테스트 필드 진입
- 경사에 따른 중력 성분, 정상하중, 차량 높이/피치 반영
