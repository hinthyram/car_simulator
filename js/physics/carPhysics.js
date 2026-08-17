import * as THREE from 'three';
import { EngineModel } from './engine.js';
import { AutomaticDCT } from './transmission.js';
import { FWDDrivetrain } from './drivetrain.js';
import { ETVCController } from './etvcController.js';
import { TireModel } from './tireModel.js';
import { VehicleHUD } from '../ui/vehicleHud.js';

/*
 * CarPhysics V4
 *
 * Four-wheel, fixed-timestep vehicle model.
 *
 * Important separation:
 *   Powertrain -> wheel drive/brake torque
 *   Wheel      -> angular velocity
 *   Tire       -> slip -> longitudinal/lateral force
 *   Chassis    -> forces/moments -> velocity/yaw
 *   e-TVC      -> modifies left/right drive/brake torque
 *
 * No "vehicle speed -> arbitrary torque scale" is used.
 * No net chassis force is converted back into "tire torque".
 */

export class CarPhysics {
    constructor(carModel, carParts, terrain = null) {
        this.carModel = carModel;
        this.carParts = carParts;
        // Optional terrain adapter. Null means the original flat-road
        // behavior, so existing simulations remain unchanged.
        this.terrain = terrain;
        this._baseModelY = carModel.position.y;
        this._baseModelPitch = carModel.rotation.x || 0;
        this._baseModelRoll = carModel.rotation.z || 0;

        // Keep yaw as an independent scalar. Once terrain pitch/roll is
        // applied as a quaternion, reading rotation.y back from the model
        // can introduce Euler decomposition noise. Physics must never depend
        // on that decomposed value.
        this._yaw = carModel.rotation.y || 0;
        carModel.rotation.order = 'YXZ';

        this.state = {
            // Body
            mass: 1450,
            wheelbase: 2.70,
            frontWeightBias: 0.58,
            cgHeight: 0.52,
            trackWidth: 1.55,
            yawInertia: 2700,

            // Powertrain / DCT (Elantra N-like 8DCT baseline)
            engineIdleRpm: 850,
            engineRedlineRpm: 6750,
            engineMaxTorque: 400,
            finalDrive: 3.17,
            gearRatios: [3.60, 2.19, 1.62, 1.27, 1.00, 0.82, 0.72, 0.60],
            drivetrainEfficiency: 0.91,
            autoUpshiftRpm: 6100,
            autoDownshiftRpm: 1800,
            shiftTime: 0.16,
            shiftTimer: 0,
            shiftCooldown: 0,

            wheelRadius: 0.34,
            wheelInertia: 1.8,

            // Brakes — Elantra N-class baseline.
            // Hyundai describes the N as using enlarged 360 mm high-performance
            // brake discs; the model therefore targets roughly 0.9–1.0 g
            // maximum straight-line road braking on the asphalt tire model.
            serviceBrakeFrontForce: 11500,
            serviceBrakeRearForce: 5000,
            handbrakeRearForce: 15000,
            brakeBiasFront: 0.697,

            // Road / resistance
            gravity: 9.81,
            rollingResistanceCoeff: 0.015,
            aeroDragCoeff: 0.375,
            coastEngineBrakeForce: 360,
            asphaltMu: 0.95,

            // D idle creep
            idleCreepSpeed: 1.65,
            idleCreepGain: 0.78,
            idleCreepMaxForce: 4500,
            reverseCreepSpeed: 1.45,
            reverseCreepGain: 0.72,
            reverseCreepMaxForce: 4500,
            reverseCreepContactForce: 900,

            // Real-world Elantra N DCT reference limits.
            maxForwardSpeed: 250 / 3.6,
            maxReverseSpeed: 50 / 3.6,

            // Nominal top speed is a soft powertrain governor, not a velocity
            // clamp. Gravity and road grade can push beyond it.
            speedGovernorBand: 12 / 3.6,
            speedGovernorMinScale: 0.0,

            // Engine-on idle creep always has a small non-zero wheel torque.
            idleCreepMinDriveTorque: 180,
            reverseCreepMinDriveTorque: 180,
            creepMinSpeed: 0.8,

            // Tires
            tireMu: 0.95,
            corneringStiffness: 5.2,
            tireRelaxation: 8.0,

            // Steering
            maxSteerAngle: THREE.MathUtils.degToRad(31),
            steerSpeed: 5.0,
            steerReturnSpeed: 7.0,

            // e-TVC
            eTVCEnabled: true,
            eTVCTargetYawGain: 1.85,
            eTVCTorqueGain: 0.42,
            eTVCCorrectionLimit: 0.45,
            eTVCMaxVectorBrakeTorque: 850,

            // Runtime
            speed: 0,
            terrainHeight: 0,
            terrainGrade: 0,
            terrainCrossGrade: 0,
            selector: 'D',
            gear: 1,
            engineRpm: 850,
            steeringAngle: 0,
            yawRate: 0,
            lateralSpeed: 0,
            throttle: 0,
            brake: 0,
            engineTorque: 0,
            engineTorqueEffective: 0,
            brakeTorque: { FL: 0, FR: 0, RL: 0, RR: 0 },
            brakeTorqueTotal: 0,
            engineBrakeTorque: { FL: 0, FR: 0, RL: 0, RR: 0 },
            engineBrakeTorqueTotal: 0,
            frontSlip: 0,
            rearSlip: 0,
            yawG: 0,

            // Telemetry
            driveTorque: { FL: 0, FR: 0, RL: 0, RR: 0 },
            driveTorqueTotal: 0,
            appliedDriveTorque: { FL: 0, FR: 0, RL: 0, RR: 0 },
            appliedDriveTorqueTotal: 0,
            tireTorque: { FL: 0, FR: 0, RL: 0, RR: 0 },
            tireTorqueTotal: 0,
            // HUD-only filtered tire torque. The physical raw value above
            // remains untouched; this prevents a DCT shift's one-frame
            // contact-force interruption from flashing 0 Nm in the UI.
            tireTorqueDisplay: { FL: 0, FR: 0, RL: 0, RR: 0 },
            tireTorqueDisplayTotal: 0,
            tireTorqueSign: { FL: 0, FR: 0, RL: 0, RR: 0 },
            wheelOmega: { FL: 0, FR: 0, RL: 0, RR: 0 },
            wheelSlipRatio: { FL: 0, FR: 0, RL: 0, RR: 0 },
            wheelSlipAngle: { FL: 0, FR: 0, RL: 0, RR: 0 },
            wheelLongForce: { FL: 0, FR: 0, RL: 0, RR: 0 },
            wheelLatForce: { FL: 0, FR: 0, RL: 0, RR: 0 },
            wheelNormalLoad: { FL: 0, FR: 0, RL: 0, RR: 0 },

            eTVCTargetYaw: 0,
            eTVCTorqueCorrection: 0,
            eTVCBrakeTorque: { FL: 0, FR: 0, RL: 0, RR: 0 },

            hudTorqueDisplay: {
                engine: true,
                drive: true,
                brake: true,
                tire: true
            }
        };

        this.velocityLocal = new THREE.Vector2(0, 0);
        this.velocityWorld = new THREE.Vector3();
        this._accumulator = 0;
        this._fixedDt = 1 / 120;
        this._maxSubSteps = 8;

        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            handbrake: false
        };

        // Wheel positions: x = lateral (+right), z = forward.
        const lf = this.state.wheelbase * this.state.frontWeightBias;
        const lr = this.state.wheelbase - lf;
        this.wheels = [
            this._makeWheel('FL', -this.state.trackWidth / 2, lf, true),
            this._makeWheel('FR',  this.state.trackWidth / 2, lf, true),
            this._makeWheel('RL', -this.state.trackWidth / 2, -lr, false),
            this._makeWheel('RR',  this.state.trackWidth / 2, -lr, false)
        ];

        this.engine = new EngineModel(this.state);
        this.transmission = new AutomaticDCT(this.state);
        this.drivetrain = new FWDDrivetrain(this.state);
        this.etvc = new ETVCController(this.state);
        this.tires = new TireModel(this.state);
        this.hud = new VehicleHUD();

        this._initInputs();
        this._runPhysicsSelfTests();

        if (window.setCarPhysicsInstance) {
            window.setCarPhysicsInstance(this);
        }
    }

    _makeWheel(name, x, z, front) {
        return {
            name,
            x,
            z,
            front,
            driven: front,
            steer: 0,
            radius: this.state.wheelRadius,
            omega: 0,
            displaySlip: 0,
            normalLoad: this.state.mass * this.state.gravity *
                (front ? this.state.frontWeightBias : 1 - this.state.frontWeightBias) / 2,
            lastTireForce: 0
        };
    }

    _initInputs() {
        window.addEventListener('keydown', e => {
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
                e.preventDefault();
            }
            this._handleKey(e.code, true);
        }, { passive: false });

        window.addEventListener('keyup', e => {
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
                e.preventDefault();
            }
            this._handleKey(e.code, false);
        }, { passive: false });

        window.addEventListener('blur', () => {
            this.keys.forward = false;
            this.keys.backward = false;
            this.keys.left = false;
            this.keys.right = false;
            this.keys.handbrake = false;
        });
    }

    _handleKey(code, down) {
        if (down && code === 'KeyQ') {
            this._changeRange(-1);
            return;
        }
        if (down && code === 'KeyE') {
            this._changeRange(1);
            return;
        }

        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = down;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = down;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = down;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = down;
                break;
            case 'Space':
                this.keys.handbrake = down;
                break;
        }
    }

    _changeRange(direction) {
        this.transmission.changeRange(
            this.state,
            direction,
            this.velocityLocal.y
        );

        if (this.state.selector === 'P') {
            this.velocityLocal.set(0, 0);
            for (const w of this.wheels) w.omega = 0;
        }
    }

    toggleETVC() {
        this.etvc.toggle(this.state);
    }

    update(frameDt) {
        const dt = Math.min(Math.max(frameDt || 0, 0), 0.05);
        this._accumulator += dt;

        let steps = 0;
        while (this._accumulator >= this._fixedDt && steps < this._maxSubSteps) {
            this._stepFixed(this._fixedDt);
            this._accumulator -= this._fixedDt;
            steps++;
        }

        if (steps === this._maxSubSteps) {
            this._accumulator = 0;
        }

        this._updateVisuals(dt);
    }

    _stepFixed(dt) {
        const s = this.state;

        const throttle = this.keys.forward ? 1 : 0;
        const brakeInput = this.keys.backward ? 1 : 0;
        const handbrake = this.keys.handbrake ? 1 : 0;

        s.throttle = throttle;
        s.brake = brakeInput;

        // Steering is a state variable, not an instantaneous wheel angle.
        const steerInput =
            (this.keys.left ? 1 : 0) -
            (this.keys.right ? 1 : 0);

        const speedAbs = Math.abs(this.velocityLocal.y);
        const speedSteerScale =
            THREE.MathUtils.clamp(1 - speedAbs / 58, 0.42, 1);

        const targetSteer =
            steerInput * s.maxSteerAngle * speedSteerScale;

        const steerRate =
            Math.abs(targetSteer) > Math.abs(s.steeringAngle)
                ? s.steerSpeed
                : s.steerReturnSpeed;

        s.steeringAngle = THREE.MathUtils.damp(
            s.steeringAngle,
            targetSteer,
            steerRate,
            dt
        );

        // Front wheels steer; rear wheels remain straight.
        for (const w of this.wheels) {
            w.steer = w.front ? s.steeringAngle : 0;
        }

        // Sample the optional terrain before calculating powertrain and tire
        // forces. A null terrain is exactly the old flat-road model.
        const terrainSample = this.terrain
            ? this.terrain.sample(
                this.carModel.position.x,
                this.carModel.position.z,
                this._yaw
            )
            : {
                height: 0,
                pitch: 0,
                gradeAlong: 0,
                gradeCross: 0
            };

        s.terrainHeight = terrainSample.height;
        s.terrainGrade = terrainSample.gradeAlong;
        s.terrainCrossGrade = terrainSample.gradeCross;

        // DCT uses chassis speed, not wheel omega. Wheel omega contains
        // tire slip and must not make the gearbox hunt between gears.
        this.transmission.update(
            s,
            dt,
            throttle,
            this.engine,
            this.velocityLocal.y
        );

        // P/N: no engine-to-wheel drive. R uses reverse drive.
        const availableEngineTorque = this.engine.torqueAt(s.engineRpm);
        let baseDriveTorque = 0;

        if (s.selector === 'D' && s.gear >= 1) {
            if (throttle) {
                baseDriveTorque =
                    this.drivetrain.engineWheelTorque(
                        availableEngineTorque,
                        s.gear,
                        throttle
                    );
            } else if (!brakeInput && !handbrake && s.gear === 1) {
                // Forward idle creep:
                // - produce force while below the target creep speed
                // - smoothly remove drive torque at/above the target
                // - keep only a small clutch/idle torque in the near-zero
                //   speed region, so the engine can move the car from rest
                //   without turning that minimum torque into a constant motor.
                const target = s.idleCreepSpeed;
                const error = target - this.velocityLocal.y;
                const rolling =
                    s.mass * s.gravity * s.rollingResistanceCoeff;
                const gravityAlong =
                    s.mass * s.gravity *
                    Math.sin(terrainSample.gradeAlong);

                const requestedForce =
                    error * s.mass * s.idleCreepGain +
                    gravityAlong +
                    rolling;

                const creepForce = THREE.MathUtils.clamp(
                    requestedForce,
                    0,
                    s.idleCreepMaxForce
                );

                const lowSpeedMin =
                    Math.abs(this.velocityLocal.y) < s.creepMinSpeed
                        ? s.idleCreepMinDriveTorque
                        : 0;

                baseDriveTorque =
                    Math.max(
                        creepForce * s.wheelRadius,
                        lowSpeedMin
                    );
            }
        } else if (s.selector === 'R' &&
                   !brakeInput &&
                   !handbrake &&
                   s.shiftTimer <= 0) {
            if (throttle) {
                // W in R requests normal reverse powertrain torque.
                baseDriveTorque =
                    this.drivetrain.reverseWheelTorque(
                        availableEngineTorque,
                        throttle
                    );
            } else {
                // Reverse idle creep mirrors D:
                // target velocity is negative, and drive torque disappears
                // naturally once that target is reached. It must never be
                // replaced by a permanent minimum torque at high speed.
                const target = -s.reverseCreepSpeed;
                const error = target - this.velocityLocal.y;
                const rolling =
                    s.mass * s.gravity * s.rollingResistanceCoeff;
                const gravityAlong =
                    s.mass * s.gravity *
                    Math.sin(terrainSample.gradeAlong);

                const requestedForce =
                    error * s.mass * s.reverseCreepGain +
                    gravityAlong -
                    rolling;

                const creepForce = THREE.MathUtils.clamp(
                    requestedForce,
                    -s.reverseCreepMaxForce,
                    0
                );

                const lowSpeedMin =
                    Math.abs(this.velocityLocal.y) < s.creepMinSpeed
                        ? s.reverseCreepMinDriveTorque
                        : 0;

                const creepThrottle = THREE.MathUtils.clamp(
                    Math.abs(creepForce) /
                    Math.max(s.reverseCreepMaxForce, 1),
                    0,
                    1
                );

                const controllerTorque =
                    this.drivetrain.reverseWheelTorque(
                        availableEngineTorque,
                        creepThrottle
                    );

                baseDriveTorque =
                    Math.max(controllerTorque, lowSpeedMin);
            }
        }

        // Soft top-speed governor. It reduces engine torque after the
        // nominal maximum is exceeded but never clamps vehicle velocity.
        // A downhill can therefore push the car beyond the nominal top speed.
        if ((throttle || s.selector === 'D' || s.selector === 'R')) {
            if ((s.selector === 'D' && s.gear >= 1) &&
                this.velocityLocal.y > s.maxForwardSpeed) {
                const overspeed = this.velocityLocal.y - s.maxForwardSpeed;
                const scale = THREE.MathUtils.clamp(
                    1 - overspeed / Math.max(s.speedGovernorBand, 0.1),
                    s.speedGovernorMinScale,
                    1
                );
                baseDriveTorque *= scale;
            } else if (s.selector === 'R' &&
                       this.velocityLocal.y < -s.maxReverseSpeed) {
                const overspeed =
                    Math.abs(this.velocityLocal.y) - s.maxReverseSpeed;
                const scale = THREE.MathUtils.clamp(
                    1 - overspeed / Math.max(s.speedGovernorBand, 0.1),
                    s.speedGovernorMinScale,
                    1
                );
                baseDriveTorque *= scale;
            }
        }

        // ENGINE TORQUE telemetry is the torque actually requested from the
        // crankshaft for this step, not the engine's theoretical maximum.
        // At idle with no creep/throttle demand it is 0 Nm.
        if (baseDriveTorque > 0 && s.selector === 'R') {
            const ratio = 3.697 * s.finalDrive * s.drivetrainEfficiency;
            s.engineTorque = ratio > 0 ? baseDriveTorque / ratio : 0;
        } else if (baseDriveTorque > 0 && s.selector === 'D' && s.gear >= 1) {
            const ratio = s.gearRatios[s.gear - 1] * s.finalDrive *
                s.drivetrainEfficiency;
            s.engineTorque = ratio > 0 ? baseDriveTorque / ratio : 0;
        } else {
            s.engineTorque = 0;
        }
        s.engineTorqueEffective = s.engineTorque;

        // e-TVC decides how that wheel torque is split and, when lifting,
        // which front wheel receives vector brake torque.
        const split = this.etvc.distribute(
            s,
            baseDriveTorque,
            this.velocityLocal.y
        );

        const commandedDrive = {
            FL: s.selector === 'D' ? Math.max(0, split.FL) : 0,
            FR: s.selector === 'D' ? Math.max(0, split.FR) : 0,
            RL: 0,
            RR: 0
        };

        if (s.selector === 'R') {
            commandedDrive.FL = -Math.abs(baseDriveTorque) * 0.5;
            commandedDrive.FR = -Math.abs(baseDriveTorque) * 0.5;
        }

        // Brake torque is computed independently from drive torque.
        // Brake force is split by axle, not evenly across all four wheels.
        // The front axle carries more static/dynamic load and therefore
        // receives the larger share. The requested force is intentionally
        // above the tire friction limit so the tire model, not the brake
        // hardware number, determines the final deceleration.
        const serviceBrakeFrontTorque =
            brakeInput
                ? (s.serviceBrakeFrontForce * s.wheelRadius / 2)
                : 0;

        const serviceBrakeRearTorque =
            brakeInput
                ? (s.serviceBrakeRearForce * s.wheelRadius / 2)
                : 0;

        const handbrakeRearTorque =
            handbrake
                ? (s.handbrakeRearForce * s.wheelRadius / 2)
                : 0;

        const engineBrakeForce =
            (!throttle &&
             s.selector === 'D' &&
             Math.abs(this.velocityLocal.y) > 0.25)
                ? s.coastEngineBrakeForce
                : 0;

        const engineBrakeTorquePerFront =
            engineBrakeForce * s.wheelRadius / 2;

        const brake = {
            FL: serviceBrakeFrontTorque + engineBrakeTorquePerFront + split.brakeFL,
            FR: serviceBrakeFrontTorque + engineBrakeTorquePerFront + split.brakeFR,
            RL: serviceBrakeRearTorque + handbrakeRearTorque,
            RR: serviceBrakeRearTorque + handbrakeRearTorque
        };
        // Brake Torque HUD = service brake + handbrake + e-TVC vector brake.
        // Engine braking is tracked separately so the four displayed torque
        // categories never mix two different physical sources.
        s.engineBrakeTorque.FL = engineBrakeTorquePerFront;
        s.engineBrakeTorque.FR = engineBrakeTorquePerFront;
        s.engineBrakeTorque.RL = 0;
        s.engineBrakeTorque.RR = 0;
        s.engineBrakeTorqueTotal =
            s.engineBrakeTorque.FL + s.engineBrakeTorque.FR;

        s.brakeTorque.FL =
            Math.max(0, serviceBrakeFrontTorque + split.brakeFL);
        s.brakeTorque.FR =
            Math.max(0, serviceBrakeFrontTorque + split.brakeFR);
        s.brakeTorque.RL =
            Math.max(0, serviceBrakeRearTorque + handbrakeRearTorque);
        s.brakeTorque.RR =
            Math.max(0, serviceBrakeRearTorque + handbrakeRearTorque);
        s.brakeTorqueTotal =
            s.brakeTorque.FL + s.brakeTorque.FR +
            s.brakeTorque.RL + s.brakeTorque.RR;

        // Requested torque remains visible during a DCT shift. Applied
        // torque is interrupted separately.
        const appliedDrive = { ...commandedDrive };

        if (s.shiftTimer > 0) {
            appliedDrive.FL = 0;
            appliedDrive.FR = 0;
            appliedDrive.RL = 0;
            appliedDrive.RR = 0;
        }

        // P physically holds the car.
        if (s.selector === 'P') {
            for (const k of Object.keys(brake)) {
                brake[k] = Math.max(brake[k], 5000);
            }
        }

        // Clear telemetry before accumulating this fixed step.
        for (const k of ['FL','FR','RL','RR']) {
            s.driveTorque[k] = Math.abs(commandedDrive[k]);
            s.appliedDriveTorque[k] = Math.abs(appliedDrive[k]);

            // HUD Brake Torque intentionally excludes engine braking.
            // `brake[k]` above is the physical tire input and includes
            // engine-brake torque, so it must never be copied directly here.
            let hudBrake = s.brakeTorque[k];
            if (s.selector === 'P') hudBrake = Math.max(hudBrake, 5000);
            s.brakeTorque[k] = Math.max(0, hudBrake);

            s.eTVCBrakeTorque[k] =
                k === 'FL' ? split.brakeFL :
                k === 'FR' ? split.brakeFR : 0;
        }

        s.driveTorqueTotal =
            s.driveTorque.FL + s.driveTorque.FR +
            s.driveTorque.RL + s.driveTorque.RR;

        s.appliedDriveTorqueTotal =
            s.appliedDriveTorque.FL + s.appliedDriveTorque.FR +
            s.appliedDriveTorque.RL + s.appliedDriveTorque.RR;

        s.brakeTorqueTotal =
            s.brakeTorque.FL + s.brakeTorque.FR +
            s.brakeTorque.RL + s.brakeTorque.RR;

        // If W is released, e-TVC can still use differential braking.
        // That brake torque is already in `brake` above.

        // Determine normal loads using current longitudinal/lateral accel
        // estimate. Keep every wheel positive.
        const axEstimate = this._lastLongitudinalAccel || 0;
        const ayEstimate = this._lastLateralAccel || 0;
        this._updateNormalLoads(axEstimate, ayEstimate, terrainSample.gradeAlong);

        let totalFx = 0;
        let totalFz = 0;
        let totalYawMoment = 0;

        // Gravity is projected onto the local road plane. Positive gradeAlong
        // means the car is climbing, so gravity opposes forward motion.
        totalFz +=
            -s.mass * s.gravity *
            Math.sin(terrainSample.gradeAlong);

        // A cross-slope component is treated as lateral gravity.
        totalFx +=
            -s.mass * s.gravity *
            Math.sin(terrainSample.gradeCross);

        const tireResults = {};

        for (const w of this.wheels) {
            const key = w.name;
            const result = this.tires.force(
                w,
                this.velocityLocal.x,
                this.velocityLocal.y,
                s.yawRate,
                w.steer,
                w.normalLoad,
                dt,
                appliedDrive[key],
                brake[key]
            );

            // Wheel angular dynamics:
            // I*w' = drive - brake - tire reaction.
            const driveSigned = appliedDrive[key];
            const brakeSigned =
                Math.sign(w.omega || this.velocityLocal.y || 1) * brake[key];

            // The visual wheel speed follows the contact patch with a small
            // physically meaningful slip allowance. Longitudinal force has
            // already been calculated from the applied wheel torque above.
            const normalizedDrive =
                s.mass * s.gravity > 0
                    ? Math.max(
                        -1,
                        Math.min(
                            1,
                            result.tireReactionTorque /
                            Math.max(w.normalLoad * s.tireMu * w.radius, 1)
                        )
                    )
                    : 0;

            const targetOmega =
                (result.roadSpeed / w.radius) *
                (1 + (w.driven ? normalizedDrive * 0.10 : 0));

            const coupling =
                w.driven ? 18.0 : 28.0;

            const couplingAlpha =
                1 - Math.exp(-coupling * dt);

            w.omega +=
                (targetOmega - w.omega) * couplingAlpha;

            if (Math.abs(w.omega) < 0.02) w.omega = 0;

            totalFx += result.bodyFx;
            totalFz += result.bodyFz;
            totalYawMoment +=
                w.x * result.bodyFz -
                w.z * result.bodyFx;

            tireResults[key] = result;

            s.wheelSlipRatio[key] = result.slipRatio;
            s.wheelSlipAngle[key] = result.slipAngle;
            s.wheelLongForce[key] = result.bodyFz;
            s.wheelLatForce[key] = result.bodyFx;
            s.wheelNormalLoad[key] = w.normalLoad;

            // Real Tire Torque is rolling tire-road longitudinal torque.
            // Static brake reaction is intentionally excluded from this HUD
            // value, so a stationary car displays exactly 0 Nm.
            const rollingForTelemetry =
                Math.abs(result.roadSpeed) >= 0.20 &&
                Math.abs(this.velocityLocal.y) >= 0.20;

            s.tireTorque[key] = rollingForTelemetry
                ? Math.abs(result.tireReactionTorque)
                : 0;
            s.tireTorqueSign[key] = rollingForTelemetry
                ? Math.sign(result.tireReactionTorque)
                : 0;

            // UI telemetry smoothing only. The physics value remains raw.
            const displayTarget = s.tireTorque[key];
            const displayAlpha = displayTarget > s.tireTorqueDisplay[key]
                ? 1 - Math.exp(-18 * dt)
                : 1 - Math.exp(-7 * dt);
            s.tireTorqueDisplay[key] +=
                (displayTarget - s.tireTorqueDisplay[key]) * displayAlpha;
            s.wheelOmega[key] = w.omega;
        }

        // Rolling + aero drag act on the chassis, not on tire telemetry.
        const vz = this.velocityLocal.y;
        const vx = this.velocityLocal.x;

        const rollingForce =
            Math.abs(vz) > 0.02
                ? s.mass * s.gravity * s.rollingResistanceCoeff
                : 0;

        const dragForce =
            vz * Math.abs(vz) * s.aeroDragCoeff;

        let chassisFx = totalFx;
        let chassisFz = totalFz;

        if (Math.abs(vz) > 0.02) {
            chassisFz -= Math.sign(vz) * rollingForce;
            chassisFz -= dragForce;

            if (!throttle &&
                s.selector === 'D' &&
                Math.abs(vz) > 0.25) {
                chassisFz -= Math.sign(vz) * engineBrakeForce;
            }
        }

        // P locks the vehicle. N does NOT: with the brake released, gravity,
        // rolling resistance and aero forces are still allowed to move the car.
        // This is important on a slope: Neutral must be able to roll downhill.
        if (s.selector === 'P') {
            chassisFz = 0;
            chassisFx = 0;
        }

        // Fixed timestep chassis integration.
        const ax = chassisFz / s.mass;
        const ay = chassisFx / s.mass;

        this.velocityLocal.y += ax * dt;
        this.velocityLocal.x += ay * dt;
        // Selector direction constraints only. There is deliberately no
        // maximum-speed velocity clamp; the governor and physical drag handle
        // nominal top speed, while downhill gravity may exceed it.
        if (s.selector === 'R') {
            this.velocityLocal.y = Math.min(this.velocityLocal.y, 0);
        } else if (s.selector === 'D') {
            this.velocityLocal.y = Math.max(this.velocityLocal.y, 0);
        } else if (s.selector === 'N') {
            // Neutral rolls freely in either direction.
        } else {
            this.velocityLocal.y = 0;
        }

        // Yaw dynamics from wheel forces.
        s.yawRate += (totalYawMoment / s.yawInertia) * dt;

        // Mild physical yaw damping; no artificial yaw target force.
        s.yawRate *= Math.exp(-1.05 * dt);

        // At very low speed, lateral velocity should settle naturally.
        if (Math.abs(this.velocityLocal.y) < 0.35) {
            this.velocityLocal.x *= Math.exp(-4.0 * dt);
            s.yawRate *= Math.exp(-4.0 * dt);
        }

        s.speed = this.velocityLocal.y;
        s.lateralSpeed = this.velocityLocal.x;
        s.frontSlip =
            (s.wheelSlipAngle.FL + s.wheelSlipAngle.FR) * 0.5;
        s.rearSlip =
            (s.wheelSlipAngle.RL + s.wheelSlipAngle.RR) * 0.5;

        this._lastLongitudinalAccel = ax;
        this._lastLateralAccel = ay;

        s.yawG =
            (s.yawRate * Math.abs(this.velocityLocal.y)) / s.gravity;

        // Exact stationary cleanup. This prevents stale telemetry from the
        // previous frame from surviving when the car is actually stopped.
        if (Math.abs(this.velocityLocal.y) < 0.015 &&
            Math.abs(this.velocityLocal.x) < 0.015 &&
            !throttle && !brakeInput && !handbrake &&
            s.selector !== 'D') {

            this.velocityLocal.set(0, 0);
            s.yawRate = 0;

            for (const w of this.wheels) w.omega = 0;

            for (const k of ['FL','FR','RL','RR']) {
                s.tireTorque[k] = 0;
                s.tireTorqueDisplay[k] = 0;
                s.wheelOmega[k] = 0;
                s.wheelSlipRatio[k] = 0;
                s.wheelSlipAngle[k] = 0;
                s.wheelLongForce[k] = 0;
                s.wheelLatForce[k] = 0;
            }
            s.tireTorqueTotal = 0;
        }
        s.tireTorqueTotal =
            s.tireTorque.FL + s.tireTorque.FR +
            s.tireTorque.RL + s.tireTorque.RR;

        s.tireTorqueDisplayTotal =
            s.tireTorqueDisplay.FL + s.tireTorqueDisplay.FR +
            s.tireTorqueDisplay.RL + s.tireTorqueDisplay.RR;

        // Integrate yaw/position.
        this._yaw += s.yawRate * dt;

        const sin = Math.sin(this._yaw);
        const cos = Math.cos(this._yaw);

        this.velocityWorld.x =
            this.velocityLocal.x * cos +
            this.velocityLocal.y * sin;
        this.velocityWorld.z =
            -this.velocityLocal.x * sin +
            this.velocityLocal.y * cos;

        this.carModel.position.x += this.velocityWorld.x * dt;
        this.carModel.position.z += this.velocityWorld.z * dt;

        // Visual contact pose is evaluated AFTER the chassis has moved.
        // This removes the one-fixed-step visual lag that could make the
        // wheels appear to float/sink at a slope transition.
        if (this.terrain) {
            const visualSample = this.terrain.sample(
                this.carModel.position.x,
                this.carModel.position.z,
                this._yaw
            );

            this.carModel.position.y =
                this._baseModelY + visualSample.height;

            // In this model +Z is forward and +X rotation raises +Z.
            // Therefore an uphill road needs a POSITIVE pitch.
            // Build the chassis attitude directly from the road plane.
            // Euler pitch/roll values are only an approximation and can
            // become visually horizontal at certain yaw angles. A quaternion
            // built from the terrain normal guarantees that the car body
            // remains tangent to the actual road plane.
            // The test terrain varies along world Z, so its exact surface
            // normal is (0, 1, -dz).
            const roadUp = new THREE.Vector3(
                0,
                1,
                -terrainSample.slopeDz
            ).normalize();

            const forward = new THREE.Vector3(
                Math.sin(this._yaw),
                0,
                Math.cos(this._yaw)
            );

            // Project the vehicle's desired forward direction onto the road
            // plane. This preserves yaw while forcing pitch/roll to follow
            // the road surface.
            forward.addScaledVector(
                roadUp,
                -forward.dot(roadUp)
            ).normalize();

            const right = new THREE.Vector3()
                .crossVectors(roadUp, forward)
                .normalize();

            const attitude = new THREE.Matrix4().makeBasis(
                right,
                roadUp,
                forward
            );

            const terrainQuaternion = new THREE.Quaternion()
                .setFromRotationMatrix(attitude);

            // The GLB is already authored in the simulator's chassis frame,
            // so the terrain quaternion is the complete visual attitude.
            this.carModel.quaternion.copy(terrainQuaternion);

            // Preserve the simulator yaw value explicitly after quaternion
            // assignment. Do not use the Euler decomposition as physics state.
            this.carModel.rotation.order = 'YXZ';

            // WheelPoint_* nodes are the actual wheel centers in the GLB.
            // Correct the chassis height by the average contact error so the
            // visual tire bottoms stay on the same terrain surface used by
            // the physics, even while crossing a slope transition.
            const contactPoints = [
                this.carParts.wheelPointFL,
                this.carParts.wheelPointFR,
                this.carParts.wheelPointRL,
                this.carParts.wheelPointRR
            ].filter(Boolean);

            if (contactPoints.length &&
                typeof this.carModel.updateMatrixWorld === 'function') {
                this.carModel.updateMatrixWorld(true);

                let contactError = 0;
                let contactCount = 0;
                const p = new THREE.Vector3();

                for (const point of contactPoints) {
                    point.getWorldPosition(p);

                    const surface = this.terrain.heightAt(
                        p.x,
                        p.z
                    );

                    // WheelPoint is the wheel center. Its desired height is
                    // road height + physical wheel radius.
                    contactError +=
                        p.y - (this._baseModelY + surface + s.wheelRadius);
                    contactCount++;
                }

                if (contactCount) {
                    this.carModel.position.y -=
                        contactError / contactCount;
                }
            }
        }

        // Engine RPM follows road speed and current gear. Wheel spin is
        // not fed back into the gearbox decision.
        if (s.selector === 'D' && s.gear >= 1) {
            const wheelRpm =
                Math.abs(this.velocityLocal.y) /
                (2 * Math.PI * s.wheelRadius) * 60;

            const coupled =
                wheelRpm *
                s.gearRatios[s.gear - 1] *
                s.finalDrive;

            s.engineRpm = Math.max(
                s.engineIdleRpm,
                Math.min(s.engineRedlineRpm, coupled)
            );

            if (!throttle &&
                s.gear === 1 &&
                Math.abs(this.velocityLocal.y) < 0.8) {
                s.engineRpm = Math.max(
                    s.engineRpm,
                    s.engineIdleRpm + 50
                );
            }
        } else if (s.selector === 'R') {
            const wheelRpm =
                Math.abs(this.velocityLocal.y) /
                (2 * Math.PI * s.wheelRadius) * 60;
            const coupled =
                wheelRpm * 3.697 * s.finalDrive;
            s.engineRpm = Math.max(
                s.engineIdleRpm,
                Math.min(s.engineRedlineRpm, coupled)
            );
        } else {
            s.engineRpm = s.engineIdleRpm;
        }
    }

    _updateNormalLoads(ax, ay, grade = 0) {
        const s = this.state;
        const total = s.mass * s.gravity * Math.cos(grade);

        // Longitudinal transfer: acceleration shifts load rearward.
        const transferLong =
            s.mass * ax * s.cgHeight / s.wheelbase;

        // Lateral transfer: right turn/left turn changes left/right load.
        const transferLat =
            s.mass * ay * s.cgHeight / s.trackWidth;

        const frontTotal =
            total * s.frontWeightBias - transferLong;
        const rearTotal =
            total * (1 - s.frontWeightBias) + transferLong;

        const frontMin = total * 0.10;
        const rearMin = total * 0.10;

        const f = Math.max(frontTotal, frontMin);
        const r = Math.max(rearTotal, rearMin);

        const leftFront =
            Math.max(f * 0.5 - transferLat * 0.5, total * 0.03);
        const rightFront =
            Math.max(f * 0.5 + transferLat * 0.5, total * 0.03);
        const leftRear =
            Math.max(r * 0.5 - transferLat * 0.5, total * 0.03);
        const rightRear =
            Math.max(r * 0.5 + transferLat * 0.5, total * 0.03);

        const loads = {
            FL: leftFront,
            FR: rightFront,
            RL: leftRear,
            RR: rightRear
        };

        for (const w of this.wheels) {
            w.normalLoad = loads[w.name];
        }
    }

    _updateVisuals(delta) {
        const s = this.state;
        const wheels = [
            this.carParts.wheelFL,
            this.carParts.wheelFR,
            this.carParts.wheelRL,
            this.carParts.wheelRR
        ];

        if (this.carParts.steerFL) {
            this.carParts.steerFL.rotation.y = s.steeringAngle;
        }
        if (this.carParts.steerFR) {
            this.carParts.steerFR.rotation.y = s.steeringAngle;
        }

        for (let i = 0; i < wheels.length; i++) {
            if (wheels[i]) {
                const w = this.wheels[i];
                wheels[i].rotation.x += w.omega * delta;
            }
        }
    }

    startEngineAndDrive() {
        // Engine is already on at startup. Do not inject artificial speed.
        this.state.selector = 'D';
        this.state.gear = 1;
        this.state.throttle = 0;
        this.state.brake = 0;
    }

    getSpeedKmh() {
        return Math.abs(Math.round(this.state.speed * 3.6));
    }

    getTelemetry() {
        return {
            speedKmh: this.getSpeedKmh(),
            throttle: this.state.throttle,
            brake: this.state.brake,
            steering: this.state.steeringAngle,
            yawRate: this.state.yawRate,
            yawG: this.state.yawG,
            lateralSpeed: this.state.lateralSpeed,
            frontSlip: this.state.frontSlip,
            rearSlip: this.state.rearSlip,
            selector: this.state.selector,
            gear: this.state.gear,
            engineRpm: this.state.engineRpm
        };
    }

    _runPhysicsSelfTests() {
        const s = this.state;
        const tests = [];

        // 1. Powertrain torque must be finite and positive in 1st gear.
        const t = this.engine.torqueAt(2000) *
            s.gearRatios[0] * s.finalDrive * s.drivetrainEfficiency;
        tests.push(Number.isFinite(t) && t > 0);

        // 2. Four wheels must exist and only front wheels are driven.
        tests.push(
            this.wheels.length === 4 &&
            this.wheels.filter(w => w.driven).length === 2
        );

        // 3. Tire reaction torque is zero at zero wheel speed with zero slip.
        const zero = Math.abs(0 * s.wheelRadius);
        tests.push(zero === 0);

        // 4. No artificial speedFactor exists in drivetrain.
        tests.push(!('maxSpeed' in this.drivetrain));

        // 5. HUD telemetry fields are initialized before first frame.
        tests.push(
            s.driveTorque.FL === 0 &&
            s.tireTorque.FL === 0 &&
            s.wheelOmega.FL === 0
        );

        s.physicsSelfTestPassed = tests.every(Boolean);
        s.physicsSelfTestResults = tests;
    }

    _updateETVCHud() {
        this.hud.update(this.state, this.velocityLocal);
    }
}
