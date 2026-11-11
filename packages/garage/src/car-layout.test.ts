import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {getBodyBounds, getSceneBoxCenter, mapWheelPositions} from './car-layout.js';

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

describe(getSceneBoxCenter.name, () => {
    it('negates x to move from the physics frame to the scene frame', () => {
        assert.deepEquals(getSceneBoxCenter(box), {
            x: -1,
            y: 0.5,
            z: 2,
        });
    });
});

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
                maxX: 3.5,
                maxY: 1.25,
                maxZ: 3,
                minX: -1.5,
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
