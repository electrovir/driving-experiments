import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {toKph} from './hud-format.js';

describe(toKph.name, () => {
    it('converts meters per second and drops the sign', () => {
        assert.strictEquals(toKph(10), 36);
        assert.strictEquals(toKph(-10), 36);
    });
});
