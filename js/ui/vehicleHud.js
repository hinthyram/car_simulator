export class VehicleHUD {
    constructor() {
        this.el = document.getElementById('etvcHud');
        this.settingsEl = this.el ? this.el.querySelector('.torque-settings') : null;

        this.settings = {
            engine: true,
            drive: true,
            brake: true,
            tire: true
        };

        this._loadSettings();
        this._bindSettings();
        this._applySettings();
        this._updateSettingsInputs();
    }

    _loadSettings() {
        try {
            const saved = JSON.parse(
                localStorage.getItem('carSimTorqueHudSettingsV5')
            );
            if (saved && typeof saved === 'object') {
                for (const key of ['engine','drive','brake','tire']) {
                    if (typeof saved[key] === 'boolean') {
                        this.settings[key] = saved[key];
                    }
                }
            }
        } catch (_) {}
    }

    _saveSettings() {
        try {
            localStorage.setItem(
                'carSimTorqueHudSettingsV5',
                JSON.stringify(this.settings)
            );
        } catch (_) {}
    }

    _bindSettings() {
        if (!this.settingsEl) return;

        for (const key of ['engine','drive','brake','tire']) {
            const input = this.settingsEl.querySelector('#show' +
                key.charAt(0).toUpperCase() + key.slice(1) + 'Torque');

            if (input) {
                input.checked = this.settings[key];
                input.addEventListener('change', () => {
                    this.settings[key] = input.checked;
                    this._applySettings();
                    this._saveSettings();
                });
            }
        }
    }

    _updateSettingsInputs() {
        if (!this.settingsEl) return;
        for (const key of ['engine','drive','brake','tire']) {
            const input = this.settingsEl.querySelector('#show' +
                key.charAt(0).toUpperCase() + key.slice(1) + 'Torque');
            if (input) input.checked = this.settings[key];
        }
    }

    _applySettings() {
        if (!this.el) return;

        for (const key of ['engine','drive','brake','tire']) {
            const visible = this.settings[key];
            this.el.querySelectorAll('.' + key + '-torque-block')
                .forEach(el => {
                    // Blocks retain their grid/flex CSS; never overwrite
                    // display with flex, which previously broke the HUD.
                    el.style.display = visible ? '' : 'none';
                });
        }

        const empty = this.el.querySelector('.torque-empty');
        if (empty) {
            empty.style.display =
                Object.values(this.settings).some(Boolean) ? 'none' : 'block';
        }
    }

    update(state, velocityLocal) {
        if (!this.el) return;

        state.hudTorqueDisplay = { ...this.settings };

        const q = selector => this.el.querySelector(selector);
        const set = (selector, value) => {
            const el = q(selector);
            if (el) el.textContent = value;
        };
        const fmt = value => {
            const n = Number.isFinite(value) ? value : 0;
            // Stable integer formatting: no 0 <-> floating-point visual noise.
            return Math.round(n).toLocaleString('en-US') + ' Nm';
        };

        if (!q('.etvc-status')) return;

        q('.etvc-status').textContent =
            state.eTVCEnabled ? 'ACTIVE' : 'OFF';

        const target = (state.eTVCTargetYaw || 0) * 180 / Math.PI;
        const actual = (state.yawRate || 0) * 180 / Math.PI;
        q('.etvc-yaw').textContent = target.toFixed(1) + '°/s';
        q('.etvc-actual-yaw').textContent = actual.toFixed(1) + '°/s';
        q('.etvc-error').textContent = (target - actual).toFixed(1) + '°/s';

        const gearEl = q('.gear-status');
        if (gearEl) {
            gearEl.textContent =
                state.selector === 'D'
                    ? `D${Math.max(1, state.gear)}`
                    : state.selector;
        }

        const rpmEl = q('.engine-rpm');
        if (rpmEl) {
            rpmEl.textContent =
                `${Math.round(Number.isFinite(state.engineRpm) ? state.engineRpm : 0)} rpm`;
        }

        const correctionEl = q('.etvc-correction');
        if (correctionEl) {
            const correction =
                Number.isFinite(state.eTVCTorqueCorrection)
                    ? state.eTVCTorqueCorrection * 100
                    : 0;
            correctionEl.textContent = correction.toFixed(1) + '%';
        }

        set('.engine-value', fmt(state.engineTorque));
        set('.drive-fl', fmt(state.driveTorque.FL));
        set('.drive-fr', fmt(state.driveTorque.FR));
        set('.drive-rl', fmt(state.driveTorque.RL));
        set('.drive-rr', fmt(state.driveTorque.RR));
        set('.drive-total', fmt(state.driveTorqueTotal));

        set('.brake-fl', fmt(state.brakeTorque.FL));
        set('.brake-fr', fmt(state.brakeTorque.FR));
        set('.brake-rl', fmt(state.brakeTorque.RL));
        set('.brake-rr', fmt(state.brakeTorque.RR));
        set('.brake-total', fmt(state.brakeTorqueTotal));

        set('.tire-fl', fmt(state.tireTorqueDisplay.FL));
        set('.tire-fr', fmt(state.tireTorqueDisplay.FR));
        set('.tire-rl', fmt(state.tireTorqueDisplay.RL));
        set('.tire-rr', fmt(state.tireTorqueDisplay.RR));
        set('.tire-total', fmt(state.tireTorqueDisplayTotal));

        set(
            '.wheel-speed',
            (Math.abs(velocityLocal.y) * 3.6).toFixed(1) + ' km/h'
        );

        q('.etvc-toggle').textContent =
            'e-TVC: ' + (state.eTVCEnabled ? 'ON' : 'OFF') + ' (CLICK)';
    }
}
