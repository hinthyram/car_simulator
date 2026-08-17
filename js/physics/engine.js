export class EngineModel {
    constructor(config) {
        this.idleRpm = config.engineIdleRpm;
        this.redlineRpm = config.engineRedlineRpm;
        this.maxTorque = config.engineMaxTorque;
    }

    torqueAt(rpm) {
        const r = Math.max(this.idleRpm, Math.min(this.redlineRpm, rpm));

        if (r < 1500) return 300;
        if (r < 2100) return 300 + (r - 1500) * (100 / 600);
        if (r <= 4700) return this.maxTorque;

        const falloff = (r - 4700) / (this.redlineRpm - 4700);
        return this.maxTorque * (1 - 0.25 * Math.max(0, Math.min(1, falloff)));
    }
}
