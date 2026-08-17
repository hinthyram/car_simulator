export class TireModel {
    constructor(config) {
        this.mu = config.tireMu;
        this.corneringStiffness = config.corneringStiffness;
        this.relaxation = config.tireRelaxation;
    }

    force(wheel, bodyVx, bodyVz, yawRate, steer, normalLoad, dt,
          driveTorque = 0, brakeTorque = 0) {

        const c = Math.cos(steer);
        const s = Math.sin(steer);

        // Contact-patch velocity in chassis coordinates.
        const wx = bodyVx - yawRate * wheel.z;
        const wz = bodyVz + yawRate * wheel.x;

        // Contact-patch velocity in the wheel coordinate system.
        const vxw = c * wx + s * wz;
        const vzw = -s * wx + c * wz;

        const forwardSpeed = Math.max(Math.abs(vzw), 0.35);
        const slipAngle = Math.atan2(vxw, forwardSpeed);

        // Road speed and wheel speed are kept separate.
        const wheelLinear = wheel.omega * wheel.radius;
        const denom = Math.max(Math.abs(vzw), 0.75);
        const slipRatio =
            (wheelLinear - vzw) / denom;

        // Longitudinal force comes from wheel torque. It is capped by
        // available asphalt friction instead of letting wheel inertia make
        // the chassis oscillate between positive and negative force.
        const rollingDirection =
            Math.abs(vzw) > 0.05
                ? Math.sign(vzw)
                : Math.sign(
                    driveTorque ||
                    wheelLinear ||
                    1
                );

        const brakeForce =
            brakeTorque > 0
                ? rollingDirection * brakeTorque / wheel.radius
                : 0;

        const torqueForce =
            (driveTorque / wheel.radius) - brakeForce;

        let fx = Math.max(
            -normalLoad * this.mu,
            Math.min(normalLoad * this.mu, torqueForce)
        );

        // Lateral tire force.
        let fy =
            -normalLoad *
            this.mu *
            Math.tanh(
                Math.tan(slipAngle) *
                this.corneringStiffness
            );

        // Friction circle.
        const cap = normalLoad * this.mu;
        const mag = Math.hypot(fx, fy);

        if (mag > cap && mag > 0) {
            const k = cap / mag;
            fx *= k;
            fy *= k;
        }

        // Back to chassis coordinates.
        const bodyFx = c * fy + s * fx;
        const bodyFz = c * fx - s * fy;

        const tireReactionTorque =
            fx * wheel.radius;

        // Relaxed slip telemetry only.
        const a =
            1 - Math.exp(-this.relaxation * dt);
        wheel.displaySlip +=
            (slipRatio - wheel.displaySlip) * a;

        return {
            fx,
            fy,
            bodyFx,
            bodyFz,
            slipRatio,
            slipAngle,
            roadSpeed: vzw,
            tireReactionTorque
        };
    }
}
