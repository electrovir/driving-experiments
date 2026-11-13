import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {getBodyBounds, mapWheelPositions} from './car-layout.js';

const box = {
    center: {
        x: 1,
        y: 0.5,
        z: 2,
    },
    halfSize: {
        x: 0.5,
        y: 0.25,
        z: 1,
    },
};

describe(getBodyBounds.name, () => {
    it('spans every box in the scene frame', () => {
        assert.deepEquals(
            getBodyBounds([
                box,
                {
                    ...box,
                    center: {
                        x: -3,
                        y: 1,
                        z: -2,
                    },
                },
            ]),
            {
                maxX: 1.5,
                maxY: 1.25,
                maxZ: 3,
                minX: -3.5,
                minY: 0.25,
                minZ: -3,
            },
        );
    });
});

describe(mapWheelPositions.name, () => {
    it('builds one value per wheel', () => {
        assert.isLengthExactly(Object.keys(mapWheelPositions((position) => position)), 4);
    });
});
