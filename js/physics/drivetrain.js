export class FWDDrivetrain {
    constructor(config) {
        this.ratios = config.gearRatios.slice();
        this.finalDrive = config.finalDrive;
        this.efficiency = config.drivetrainEfficiency;
        this.wheelRadius = config.wheelRadius || 0.34;
        this.wheelInertia = config.wheelInertia || 1.8;
    }

    engineWheelTorque(engineTorque, gear, throttle) {
        if (gear < 1) return 0;
        const ratio = this.ratios[gear - 1] || 0;
        // Wheel torque is determined by
        // engine torque × current gear × final drive.
        return engineTorque * ratio * this.finalDrive * this.efficiency * throttle;
    }

    reverseWheelTorque(engineTorque, throttle) {
        return engineTorque * 3.697 * this.finalDrive * this.efficiency * throttle;
    }
}
