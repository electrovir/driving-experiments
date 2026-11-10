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
        isStickAiming: false,
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
    it('aims where the stick points and swings straight back on release', () => {
        const orbit = createOrbit({
            isDragging: false,
        });

        function holdStick(lookStick: Readonly<{x: number; y: number}> | undefined) {
            createArray(60, () => undefined).forEach(() => {
                updateCameraOrbit({
                    dtSeconds: 1 / 60,
                    lookStick,
                    orbit,
                    pitchRange,
                });
            });

            return Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw));
        }

        assert.isBelow(
            Math.abs(
                holdStick({
                    x: 1,
                    y: 0,
                }) +
                    Math.PI / 2,
            ),
            0.01,
        );
        assert.isBelow(
            Math.abs(
                holdStick({
                    x: 0.55,
                    y: 0,
                }) +
                    Math.PI / 4,
            ),
            0.01,
        );
        assert.isBelow(
            Math.abs(
                Math.abs(
                    holdStick({
                        x: 0,
                        y: 1,
                    }),
                ) - Math.PI,
            ),
            0.01,
        );
        assert.isBelow(Math.abs(holdStick(undefined)), 0.01);
    });
    it('ignores a stick resting below the aim dead zone', () => {
        const orbit = createOrbit({
            isDragging: false,
            yaw: 0.3,
        });

        updateCameraOrbit({
            dtSeconds: 1 / 60,
            lookStick: {
                x: 0.05,
                y: 0,
            },
            orbit,
            pitchRange,
        });

        assert.strictEquals(orbit.yaw, 0.3);
        assert.isFalse(orbit.isStickAiming);
    });
    it('applies a drag instead of stick aiming when both arrive in one frame', () => {
        const orbit = createOrbit({
            isDragging: false,
            isStickAiming: true,
            pendingDrag: {
                x: 100,
                y: 0,
            },
        });

        updateCameraOrbit({
            dtSeconds: 1 / 60,
            lookStick: {
                x: 1,
                y: 0,
            },
            orbit,
            pitchRange,
        });

        assert.isFalse(orbit.isStickAiming);
        assert.strictEquals(orbit.yaw, -100 * 0.005);
    });
});
