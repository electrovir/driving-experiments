import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {clipCameraToBox} from './garage-camera.js';

const box = {
    maxX: 5,
    maxY: 3,
    maxZ: 5,
    minX: -5,
    minZ: -5,
};
const pivot = {
    x: 0,
    y: 1,
    z: 0,
};

describe(clipCameraToBox.name, () => {
    it('leaves a camera inside the box where it is', () => {
        const camera = {
            x: 1,
            y: 2,
            z: -3,
        };

        assert.deepEquals(
            clipCameraToBox({
                box,
                camera,
                pivot,
            }),
            camera,
        );
    });

    it('pulls a camera behind a wall back along its line to the pivot', () => {
        assert.deepEquals(
            clipCameraToBox({
                box,
                camera: {
                    x: 0,
                    y: 1,
                    z: -10,
                },
                pivot,
            }),
            {
                x: 0,
                y: 1,
                z: -5,
            },
        );
    });

    it('stops at the nearest of several limits', () => {
        const clipped = clipCameraToBox({
            box,
            camera: {
                x: 10,
                y: 5,
                z: -2,
            },
            pivot,
        });

        assert.strictEquals(clipped.y, 3);
        assert.strictEquals(clipped.x, 5);
    });
});
