import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {curveKey, evaluateCurve} from './animation-curve.js';

describe(evaluateCurve.name, () => {
    const curve = [
        curveKey({
            time: 0,
            value: 1,
        }),
        curveKey({
            time: 10,
            value: 3,
        }),
    ];

    it('holds the end values outside the keys', () => {
        assert.deepEquals(
            [
                evaluateCurve(curve, -5),
                evaluateCurve(curve, 20),
            ],
            [
                1,
                3,
            ],
        );
    });
    it('eases between flat keys', () => {
        assert.isTrue(Math.abs(evaluateCurve(curve, 5) - 2) < 1e-9);
        assert.isBelow(evaluateCurve(curve, 2.5), 1.5);
    });
    it('returns 0 for an empty curve', () => {
        assert.strictEquals(evaluateCurve([], 3), 0);
    });
});
