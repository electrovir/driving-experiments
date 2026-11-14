import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {getPresetGauges, toKph} from './hud-format.js';
import {CarPreset} from './physics/vehicle-preset.js';

describe(toKph.name, () => {
    it('converts meters per second and drops the sign', () => {
        assert.strictEquals(toKph(10), 36);
        assert.strictEquals(toKph(-10), 36);
    });
});

describe(getPresetGauges.name, () => {
    it('skips the tachometer for hover', () => {
        assert.isFalse(getPresetGauges(CarPreset.Hover).hasTachometer);
        assert.isTrue(getPresetGauges(CarPreset.Sedan).hasTachometer);
    });

    it('reads the redline from the engine', () => {
        assert.isAbove(getPresetGauges(CarPreset.Sedan).redlineKiloRpm, 0);
        assert.strictEquals(getPresetGauges(CarPreset.Hover).redlineKiloRpm, 0);
    });
});
