import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {
    getDamageSmokeRate,
    getHeading,
    getLampStrengths,
    getSparkBursts,
    getTireSmokeRate,
    takeEmission,
} from './effect-rates.js';
import {type VehicleImpact} from './vehicle-view.js';

const origin = {
    x: 0,
    y: 0,
    z: 0,
};

function createImpact(overrides: Partial<VehicleImpact>): VehicleImpact {
    return {
        dentPoint: origin,
        dentStrength: 1,
        dentTranslation: origin,
        isCrash: false,
        normal: origin,
        position: origin,
        speed: 0,
        ...overrides,
    };
}

describe(getHeading.name, () => {
    it('reads yaw from the rotation, with 0 facing +z', () => {
        assert.strictEquals(
            getHeading({
                w: 1,
                x: 0,
                y: 0,
                z: 0,
            }),
            0,
        );
        assert.isAbove(
            getHeading({
                w: Math.SQRT1_2,
                x: 0,
                y: Math.SQRT1_2,
                z: 0,
            }),
            1.5,
        );
    });
});

describe(takeEmission.name, () => {
    it('carries the fraction so slow rates still emit', () => {
        const first = takeEmission({
            carry: 0,
            dtSeconds: 0.1,
            ratePerSecond: 15,
        });
        const second = takeEmission({
            carry: first.carry,
            dtSeconds: 0.1,
            ratePerSecond: 15,
        });

        assert.strictEquals(first.count, 1);
        assert.strictEquals(second.count, 2);
    });
});

describe(getTireSmokeRate.name, () => {
    it('is silent below the skid threshold and in the air', () => {
        assert.strictEquals(
            getTireSmokeRate({
                isGrounded: true,
                slip: 0.4,
            }),
            0,
        );
        assert.strictEquals(
            getTireSmokeRate({
                isGrounded: false,
                slip: 1,
            }),
            0,
        );
        assert.isAbove(
            getTireSmokeRate({
                isGrounded: true,
                slip: 1,
            }),
            0,
        );
    });
});

describe(getDamageSmokeRate.name, () => {
    it('grows as health falls and starts only once damaged', () => {
        assert.strictEquals(getDamageSmokeRate(0.9), 0);
        assert.isAbove(getDamageSmokeRate(0.2), getDamageSmokeRate(0.6));
    });
});

describe(getSparkBursts.name, () => {
    it('keeps crashes and fast scrapes, hardest first', () => {
        const bursts = getSparkBursts([
            createImpact({
                speed: 1,
            }),
            createImpact({
                speed: 5,
            }),
            createImpact({
                isCrash: true,
                speed: 9,
            }),
        ]);

        assert.deepEquals(
            bursts.map(({impact}) => impact.speed),
            [
                9,
                5,
            ],
        );
        assert.isAbove(bursts[0]?.count ?? 0, bursts[1]?.count ?? 0);
    });

    it('caps how many impacts spark in one frame', () => {
        assert.isLengthExactly(
            getSparkBursts(
                createArray(40, () => {
                    return createImpact({
                        speed: 10,
                    });
                }),
            ),
            6,
        );
    });
});

describe(getLampStrengths.name, () => {
    it('brightens the brake lamps with the pedal and lights reverse only while reversing', () => {
        const idle = getLampStrengths({
            areHeadlightsOn: false,
            brake: 0,
            isReversing: false,
        });
        const braking = getLampStrengths({
            areHeadlightsOn: true,
            brake: 1,
            isReversing: true,
        });

        assert.isAbove(braking.brake, idle.brake);
        assert.isAbove(braking.headlight, idle.headlight);
        assert.strictEquals(idle.reverse, 0);
        assert.isAbove(braking.reverse, 0);
    });
});
