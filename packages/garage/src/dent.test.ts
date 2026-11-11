import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {applyDent, getDentSegments, isRepair} from './dent.js';

const impact = {
    dentPoint: {
        x: 0,
        y: 0,
        z: 0,
    },
    dentStrength: 4,
    dentTranslation: {
        x: 0,
        y: 0,
        z: -1,
    },
};

describe(applyDent.name, () => {
    it('pushes a vertex at the impact the full capped distance along the translation', () => {
        const positions = new Float32Array([
            0,
            0,
            0.0001,
        ]);

        assert.isTrue(
            applyDent({
                boxCenter: {
                    x: 0,
                    y: 0,
                    z: 0,
                },
                impact,
                positions,
            }),
        );
        assert.isAbove(positions[2] ?? 0, 0.0001 - 0.05);
        assert.isBelow(positions[2] ?? 0, 0.0001);
    });

    it('leaves vertices far from the impact alone', () => {
        const positions = new Float32Array([
            0,
            0,
            40,
        ]);

        assert.isFalse(
            applyDent({
                boxCenter: {
                    x: 0,
                    y: 0,
                    z: 0,
                },
                impact,
                positions,
            }),
        );
        assert.strictEquals(positions[2], 40);
    });

    it('measures from the impact using the box offset', () => {
        const positions = new Float32Array([
            0,
            0,
            0,
        ]);

        assert.isFalse(
            applyDent({
                boxCenter: {
                    x: 0,
                    y: 0,
                    z: 40,
                },
                impact,
                positions,
            }),
        );
    });
});

describe(getDentSegments.name, () => {
    it('adds cells with size and caps them', () => {
        assert.deepEquals(
            getDentSegments({
                x: 0.1,
                y: 1,
                z: 100,
            }),
            {
                depth: 10,
                height: 4,
                width: 1,
            },
        );
    });
});

describe(isRepair.name, () => {
    it('is true only when health jumps back up', () => {
        assert.isTrue(
            isRepair({
                health: 1,
                previousHealth: 0.4,
            }),
        );
        assert.isFalse(
            isRepair({
                health: 0.4,
                previousHealth: 1,
            }),
        );
    });
});
