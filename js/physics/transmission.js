import * as THREE from 'three';

export class AutomaticDCT {
    constructor(config) {
        this.ratios = config.gearRatios.slice();
        this.finalDrive = config.finalDrive;
        this.upshiftRpm = config.autoUpshiftRpm;
        this.downshiftRpm = config.autoDownshiftRpm;
        this.shiftTime = config.shiftTime;
        this.cooldownTime = 0.35;
    }

    changeRange(state, direction, speed) {
        const ranges = ['P', 'R', 'N', 'D'];
        let i = ranges.indexOf(state.selector);
        if (i < 0) i = 3;

        const next = ranges[Math.max(0, Math.min(ranges.length - 1, i + direction))];

        // A moving car cannot be put into P/R/N by the range selector.
        if (Math.abs(speed) > 0.8 &&
            (next === 'P' || next === 'R' || next === 'N')) {
            return false;
        }

        if (next === state.selector) return false;

        state.selector = next;
        state.shiftTimer = 0;
        state.shiftCooldown = 0;
        state.gear = next === 'D' ? Math.max(1, state.gear || 1) : 0;
        return true;
    }

    update(state, dt, throttle, engine, vehicleSpeed) {
        state.shiftCooldown = Math.max(0, state.shiftCooldown - dt);
        const speed = Math.abs(vehicleSpeed);

        if (state.selector === 'R') {
            state.shiftTimer = 0;
            state.gear = 0;

            // Reverse has its own fixed reduction. Engine RPM follows road
            // speed instead of being artificially pinned to idle.
            const reverseWheelRpm =
                speed / (2 * Math.PI * state.wheelRadius) * 60;
            const reverseRpm =
                reverseWheelRpm * 3.697 * this.finalDrive;

            state.engineRpm = THREE.MathUtils.clamp(
                Math.max(engine.idleRpm, reverseRpm),
                engine.idleRpm,
                engine.redlineRpm
            );
            return;
        }

        if (state.selector !== 'D') {
            state.shiftTimer = 0;
            state.gear = 0;
            state.engineRpm = engine.idleRpm;
            return;
        }

        if (state.gear < 1) state.gear = 1;

        // IMPORTANT:
        // Use chassis speed, not driven-wheel omega, for the base DCT shift
        // decision. Wheel omega contains tire slip and can otherwise make
        // the gearbox bounce 1↔2 at low speed.
        const wheelRpm = speed / (2 * Math.PI * state.wheelRadius) * 60;
        const coupledRpm =
            wheelRpm * this.ratios[state.gear - 1] * this.finalDrive;

        state.engineRpm = THREE.MathUtils.clamp(
            Math.max(engine.idleRpm, coupledRpm),
            engine.idleRpm,
            engine.redlineRpm
        );

        if (state.shiftTimer > 0) {
            state.shiftTimer = Math.max(0, state.shiftTimer - dt);
            return;
        }

        if (state.shiftCooldown > 0) return;

        let next = state.gear;

        if (throttle) {
            if (state.engineRpm >= this.upshiftRpm &&
                state.gear < this.ratios.length) {
                next = state.gear + 1;
            } else if (state.engineRpm < 2100 && state.gear > 1) {
                next = state.gear - 1;
            }
        } else {
            // Lift-off: hold the gear longer; downshift only when it is
            // genuinely useful for engine braking.
            if (state.engineRpm < this.downshiftRpm &&
                state.gear > 1) {
                next = state.gear - 1;
            }
        }

        if (next < state.gear) {
            const nextRpm =
                wheelRpm * this.ratios[next - 1] * this.finalDrive;

            if (nextRpm > engine.redlineRpm * 0.97) {
                next = state.gear;
            }
        }

        if (next !== state.gear) {
            state.gear = next;
            state.shiftTimer = this.shiftTime;
            state.shiftCooldown = this.cooldownTime;
        }
    }
}
