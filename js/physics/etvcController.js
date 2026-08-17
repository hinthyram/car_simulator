export class ETVCController {
    constructor(config) {
        this.enabled = !!config.eTVCEnabled;
        this.targetYawGain = config.eTVCTargetYawGain;
        this.correctionGain = config.eTVCTorqueGain;
        this.limit = config.eTVCCorrectionLimit;
        this.maxBrakeTorque = config.eTVCMaxVectorBrakeTorque;
    }

    calculate(state, speed) {
        const v = Math.max(Math.abs(speed), 0);
        state.eTVCTargetYaw =
            v > 0.5 ? (v / state.wheelbase) * Math.tan(state.steeringAngle) : 0;

        if (!this.enabled || state.selector !== 'D' || v < 1.0) {
            state.eTVCTorqueCorrection = 0;
            return 0;
        }

        const error = state.eTVCTargetYaw - state.yawRate;
        let correction = Math.max(
            -this.limit,
            Math.min(this.limit, error * this.targetYawGain * this.correctionGain)
        );

        // Deadband prevents floating-point yaw noise from commanding a
        // measurable brake torque on a straight, centered vehicle.
        if (Math.abs(correction) < 0.005) correction = 0;

        state.eTVCTorqueCorrection = correction;
        return correction;
    }

    setEnabled(state, value) {
        this.enabled = !!value;
        state.eTVCEnabled = this.enabled;
        if (!this.enabled) state.eTVCTorqueCorrection = 0;
    }

    toggle(state) {
        this.setEnabled(state, !this.enabled);
    }

    distribute(state, totalDriveTorque, speed) {
        const correction = this.calculate(state, speed);

        if (!this.enabled || state.selector !== 'D') {
            return {
                FL: totalDriveTorque * 0.5,
                FR: totalDriveTorque * 0.5,
                brakeFL: 0,
                brakeFR: 0
            };
        }

        // Drive torque vectoring remains available whenever positive drive
        // torque exists.
        const bias = Math.max(-0.38, Math.min(0.38, correction));
        const left = totalDriveTorque * (0.5 - bias);
        const right = totalDriveTorque * (0.5 + bias);

        // With W released, vector braking is the actuator. This is what lets
        // e-TVC influence yaw during lift-off/coast.
        const vectorBrake =
            Math.abs(correction) >= 0.005
                ? Math.abs(correction) * this.maxBrakeTorque
                : 0;

        return {
            FL: left,
            FR: right,
            brakeFL: correction > 0 ? vectorBrake : 0,
            brakeFR: correction < 0 ? vectorBrake : 0
        };
    }
}
