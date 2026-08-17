# Car Physics V4.1

## What changed from V4

V4.1 fixes three concrete defects found by automated regression testing:

1. The DCT no longer uses driven-wheel angular speed as its primary shift signal.
   Tire slip can make wheel RPM much higher/lower than road RPM, which caused
   1st/2nd gear hunting. Shift decisions now use chassis road speed and the
   current gear ratio.

2. HUD Drive Torque is **commanded powertrain torque**, while
   `appliedDriveTorque` is kept separately for the physical wheel calculation.
   A DCT torque interruption therefore cannot make the Drive Torque display
   randomly become zero.

3. Real Tire Torque is explicitly defined as rolling tire-road longitudinal
   contact torque. Static brake reaction is not included in that HUD value.
   At a stationary car the displayed Real Tire Torque is exactly 0 Nm.

## Vehicle model

The model keeps four wheel states and a chassis state.

### Powertrain

`Engine -> DCT -> final drive -> front wheel torque`

The vehicle is FWD. FL/FR are driven; RL/RR are not.

### DCT

P / R / N / D range selection is controlled by Q/E.

D mode automatically selects gears 1–8. The DCT uses:
- road speed
- current ratio
- engine RPM thresholds
- shift timer
- shift cooldown

Wheel spin is not used to decide the next gear.

### Tire force

The tire contact model calculates:
- contact-patch velocity
- slip ratio
- slip angle
- longitudinal force from wheel torque
- lateral force from slip angle
- friction-circle limiting

Longitudinal tire force is capped by `mu * normalLoad`.

### Wheel rotation

Wheel visual/angular speed follows contact-patch speed with a controlled slip allowance.
This prevents low-speed numerical oscillation while retaining small longitudinal slip.

### Chassis

All four wheel forces are transformed into chassis coordinates and summed.
Yaw moment is calculated from each wheel's force and position.

A 120 Hz fixed physics timestep is used.

### e-TVC

e-TVC calculates target yaw rate from speed and steering angle.

- Under drive/creep: it biases FL/FR drive torque.
- During lift/coast: it can add differential front brake torque.
- With e-TVC OFF: front drive torque is split exactly 50/50.

It does not directly inject an artificial yaw moment.

## HUD definitions

### DRIVE TORQUE

Requested torque from the powertrain at each driven wheel after e-TVC torque distribution.

### REAL TIRE TORQUE

Rolling longitudinal tire-road contact torque.

`|longitudinal tire force × wheel radius|`

Static brake reaction at 0 km/h is intentionally not displayed here.

### Gear

The HUD always shows:
- `P`
- `R`
- `N`
- `D1` … `D8`

Engine RPM is shown beside the gear.

## Regression checks performed

- All 7 JavaScript modules pass `node --check`.
- Initial state finite.
- D1 startup.
- Idle creep.
- W acceleration.
- 0–60 km/h torque continuity.
- DCT 1→2 transition stability.
- Throttle release/coast.
- S braking.
- A/D steering.
- e-TVC differential torque/braking.
- Q/E P/R/N/D range sequence.
- Stationary Real Tire Torque = 0.
- No NaN/Infinity in speed, wheel speed, drive torque or tire torque.

The vehicle/tire architecture follows the same broad separation used by
modern wheel-based vehicle controllers: drive torque -> wheel speed -> slip ->
tire grip/force -> chassis response. `cannon-es` RaycastVehicle and
wheel-based controllers such as pmndrs/ecctrl were used as architectural
references, not copied as code.


## V4.2 brake calibration

The brake model now uses separate front/rear axle brake forces rather than
four equal wheel torques.

Baseline:
- front service brake axle force: 11,500 N
- rear service brake axle force: 5,000 N
- rear handbrake axle force: 9,000 N
- tire/asphalt friction coefficient: 0.95

The brake hardware request is intentionally above the tire-road limit so the
tire model determines maximum deceleration. The target is approximately
0.9–1.0 g on the simulated asphalt surface, consistent with the strong
straight-line braking expected from the Elantra N.

Hyundai states that the Elantra N uses enlarged 360 mm brake discs and
high-friction pads, and its published specifications identify Michelin Pilot
Sport 4S tires. This is used as the reference class rather than copying a
manufacturer brake torque value.


## V5 torque telemetry separation

The HUD now exposes four independent torque layers:

1. **Engine Torque** — actual crankshaft torque requested for the current
   powertrain state. A parked/neutral/idling vehicle with no creep demand is
   displayed as 0 Nm rather than the engine's theoretical maximum torque.
2. **Drive Torque** — torque requested at each wheel after transmission,
   final-drive and e-TVC distribution. It remains stable through a DCT shift;
   the physical `appliedDriveTorque` is tracked separately.
3. **Brake Torque** — service brake, handbrake and e-TVC vector-brake torque.
   Engine braking is tracked separately and is not mislabeled as brake-pedal
   torque.
4. **Tire Torque** — actual longitudinal tire-road contact torque.

The four settings are independent and stored in a V5 localStorage key.
The HUD never changes a torque grid to `display:flex`; hidden blocks use their
existing CSS layout, preventing the previous one-cell-shift regression.

The DCT uses road speed + gear ratio for its shift decision and includes shift
cooldown/hysteresis. Wheel spin is not used directly as the shift trigger.


## V5.1 diagnostic fixes

- Engine-brake torque is no longer copied into the Brake Torque HUD.
  On a straight D-mode lift-off, service/handbrake/e-TVC Brake Torque is 0 Nm;
  the engine-brake channel can show the separate engine-braking reaction.
- e-TVC has a small correction deadband so numerical yaw noise cannot command
  visible brake torque on a centered car.
- Reverse uses the fixed reverse reduction for engine-speed coupling. Engine
  RPM therefore rises with reverse road speed instead of being permanently
  pinned to idle.
- Reverse Engine/Drive/Tire torque telemetry is now internally consistent.


## V5.2 vehicle limits / reverse creep / handbrake

- Forward electronic speed limit: 250 km/h, matching the published Elantra N
  top-speed specification.
- Reverse electronic speed limit: 50 km/h. Hyundai does not publish a
  separate reverse top-speed specification; 50 km/h is therefore a simulation
  safety limit, not a claimed factory number. The reference DCT reverse ratio
  is 3.697:1.
- R now has an idle/clutch-creep state so releasing the brake without W
  requests a small reverse movement rather than requiring throttle.
- Handbrake acts on the rear axle only and is calibrated above the rear tire
  friction limit so the tire model, rather than an arbitrary brake number,
  determines the actual deceleration/lock behavior. The Elantra N reference
  uses a conventional hand-operated parking brake.


## V6 slope test field

V6 adds an optional terrain adapter without changing the default flat-road
physics path.

`CarPhysics(carModel, carParts)` still means the original flat field.
`CarPhysics(carModel, carParts, terrain)` enables terrain-aware physics.

The built-in `TestTerrain('slope')` contains:
- flat approach
- smooth 12 m uphill section
- crest
- smooth downhill section back to zero
- flat exit

Terrain supplies height and grade. Physics uses the grade to:
- project gravity along the road
- add cross-slope gravity
- reduce normal force by the road-plane angle
- update vehicle visual height and pitch

The slope field is selected with `?terrain=slope` or the in-page
`오르막/내리막` button. `평지` returns to the original field.

Legacy regression tests for drivetrain, DCT, braking, handbrake, reverse,
speed limit, torque continuity and stationary telemetry all pass unchanged.


## V6.1 Neutral roll + slope field visuals

- Neutral (`N`) no longer zeros chassis forces. With the service brake and
  handbrake released, gravity and rolling resistance can move the vehicle.
- Park (`P`) remains locked.
- Neutral velocity is allowed to become negative on a downhill and is bounded
  only by the simulation's safety limits.
- The slope test field now has a green terrain base, a clearly differentiated
  dark asphalt road, white road-edge lines, a yellow dashed center line, and
  slope marker posts.
- Legacy flat-road, DCT, brake, handbrake, torque and speed regression tests
  continue to pass.


## V6.2 slope-creep correction

The slope test exposed a real modeling issue: the flat-road creep controller
had a fixed force ceiling that was lower than the gravity component on the
test hill, while D/R speed clamps could then hide the resulting rollback.

V6.2 fixes this by making low-speed creep grade-aware:

required creep force =
  speed-error controller
  + gravity component along the road
  + rolling resistance

D and R now use this force to request wheel torque through the normal tire
model. The previous direct chassis reverse-creep force was removed to avoid
double-counting propulsion.

The test field mesh was also rebuilt directly in world X/Y/Z coordinates.
The previous PlaneGeometry rotation/vertex update mixed local and world axes,
which made the asphalt/terrain visual appear as a flat gray field. The new
field has distinct green terrain, dark asphalt, white edge lines and a yellow
center line.


## V6.4 contact / reverse creep / GLB material correction

- Reverse idle creep is now a force controller, not a hard `-reverseCreepSpeed`
  velocity clamp. Releasing W therefore does not snap the vehicle to 5.22 km/h.
- Reverse creep only requests extra reverse torque when the road grade
  actually opposes reverse motion; downhill gravity is allowed to accelerate
  the vehicle naturally.
- Terrain visual pitch now uses the correct positive X rotation for uphill
  motion, and is evaluated after chassis position integration.
- WheelPoint_FL/FR/RL/RR from the GLB are used as visual wheel centers to
  correct average chassis height against terrain + wheel radius.
- Cross-slope roll is applied from the terrain grade.
- GLB BLEND materials are treated as opaque unless they are actual cutout
  badge/caliper materials. This prevents packed DiffuseAOSO alpha channels
  from making exterior surfaces appear translucent.


## V6.5 slope powertrain corrections

1. Vehicle terrain attitude uses YXZ yaw-pitch-roll order. This avoids the
   intermittent flattening caused by Euler XYZ coupling when yaw changes.
2. Forward/reverse nominal top speed is no longer enforced by clamping chassis
   velocity. A soft powertrain governor reduces propulsion beyond the nominal
   speed; gravity, road grade, rolling resistance and aerodynamic drag remain
   physical, so a downhill can exceed the nominal value.
3. Reverse idle-creep grade compensation now uses the signed gravity component
   correctly: reversing uphill receives additional creep torque, while
   reversing downhill does not receive artificial extra propulsion.
4. D and R idle creep have a non-zero minimum wheel drive torque while the
   engine is on and the brake/handbrake are released. This prevents drive
   torque telemetry from collapsing to zero merely because gravity is moving
   the vehicle.
5. Aerodynamic drag coefficient was calibrated to the existing simplified
   drag-force equation so flat-road full-throttle nominal top speed is near
   250 km/h with the current 8DCT model, rather than stopping near 200 km/h.


## V6.6 terrain attitude correction

- Terrain body attitude no longer uses Euler pitch/roll assignment.
- A world-space road normal is constructed from the terrain gradient.
- The vehicle forward axis is projected onto that road plane.
- A YXZ-compatible basis (right, road-up, projected-forward) is converted
  directly to a quaternion.
- Vehicle yaw is stored independently as `_yaw` so Euler decomposition of a
  pitched/rolled model can never feed back into the physics or terrain sample.
- The resulting body orientation is tangent to the road surface for straight,
  turned, uphill, downhill, and cross-slope headings.


## V6.7 symmetric D/R idle-creep correction

The idle-creep controller now has the same basic control structure in D and R.
Minimum launch torque is only active below `creepMinSpeed` (0.8 m/s), rather
than being forced at every speed. Once the target creep speed is reached,
requested drive torque falls toward zero naturally.

This prevents R from behaving like a permanent 180 Nm electric motor. The
nominal speed governor is also allowed to act on creep torque, while no
velocity clamp is introduced. WOT D/R behavior remains on the normal
powertrain path.
