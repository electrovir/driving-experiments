import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {updateCameraOrbit, type CameraOrbit} from './camera-orbit.js';

const pitchRange = {
    max: 1,
    min: -0.2,
};

function createOrbit(overrides: Readonly<Partial<CameraOrbit>>): CameraOrbit {
    return {
        destroy() {},
        isDragging: true,
        pendingDrag: {
            x: 0,
            y: 0,
        },
        pitch: 0,
        secondsSinceRelease: 0,
        yaw: 0,
        ...overrides,
    };
}

describe(updateCameraOrbit.name, () => {
    it('responds to a drag back right away after dragging past the pitch limit', () => {
        const orbit = createOrbit({
            pendingDrag: {
                x: 0,
                y: 1000,
            },
        });

        updateCameraOrbit({
            dtSeconds: 1 / 60,
            orbit,
            pitchRange,
        });
        assert.strictEquals(orbit.pitch, pitchRange.max);

        orbit.pendingDrag.y = -10;
        updateCameraOrbit({
            dtSeconds: 1 / 60,
            orbit,
            pitchRange,
        });
        assert.isBelow(orbit.pitch, pitchRange.max);
    });
    it('eases back the short way around after the user lets go', () => {
        const orbit = createOrbit({
            isDragging: false,
            pitch: 0.5,
            yaw: Math.PI * 2 - 0.5,
        });

        createArray(60 * 5, () => undefined).forEach(() => {
            updateCameraOrbit({
                dtSeconds: 1 / 60,
                orbit,
                pitchRange,
            });
        });

        assert.isBelow(Math.abs(orbit.yaw), 0.01);
        assert.isBelow(Math.abs(orbit.pitch), 0.01);
        assert.isBelow(orbit.yaw, 0);
    });
});
