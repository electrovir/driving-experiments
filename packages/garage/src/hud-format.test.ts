import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {getBarFraction, getPresetGauges, toKph} from './hud-format.js';
import {CarPreset} from './physics/vehicle-preset.js';

describe(toKph.name, () => {
    it('converts meters per second and drops the sign', () => {
        assert.strictEquals(toKph(10), 36);
        assert.strictEquals(toKph(-10), 36);
    });
});

describe(getBarFraction.name, () => {
    it('clamps into the bar', () => {
        assert.strictEquals(getBarFraction(0.25), 0.25);
        assert.strictEquals(getBarFraction(-1), 0);
        assert.strictEquals(getBarFraction(3), 1);
    });
});

describe(getPresetGauges.name, () => {
    it('skips the tachometer for hover and shows health only for damage cars', () => {
        assert.isFalse(getPresetGauges(CarPreset.Hover).hasTachometer);
        assert.isTrue(getPresetGauges(CarPreset.Sedan).hasTachometer);
        assert.isTrue(getPresetGauges(CarPreset.Muscle).hasHealth);
        assert.isFalse(getPresetGauges(CarPreset.Sedan).hasHealth);
    });

    it('reads the redline from the engine', () => {
        assert.isAbove(getPresetGauges(CarPreset.Sedan).redlineKiloRpm, 0);
        assert.strictEquals(getPresetGauges(CarPreset.Hover).redlineKiloRpm, 0);
    });
});
