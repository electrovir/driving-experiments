import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {DriveBinding, readCarControls} from './drive-binding.js';

function createActiveBinding({
    holdMilliseconds = 0,
    value,
}: Readonly<{value: number; holdMilliseconds?: number}>) {
    return {
        actCount: 0,
        holdDuration: {
            milliseconds: holdMilliseconds,
        },
        lastActDuration: {
            milliseconds: 0,
        },
        rawInputs: [],
        value,
    };
}

describe(readCarControls.name, () => {
    it('gives zeros for undefined bindings', () => {
        const zeros = {
            brake: 0,
            handbrake: 0,
            steer: 0,
            throttle: 0,
        };

        assert.deepEquals(readCarControls(undefined), zeros);
        assert.deepEquals(readCarControls({}), zeros);
    });
    it('clamps pedals when several inputs add up', () => {
        assert.deepEquals(
            readCarControls({
                [DriveBinding.Brake]: createActiveBinding({
                    value: 2,
                }),
                [DriveBinding.Handbrake]: createActiveBinding({
                    value: 3,
                }),
                [DriveBinding.Throttle]: createActiveBinding({
                    value: 1.5,
                }),
            }),
            {
                brake: 1,
                handbrake: 1,
                steer: 0,
                throttle: 1,
            },
        );
    });
    it('steers toward the newest of the opposing inputs, within range', () => {
        assert.deepEquals(
            readCarControls({
                [DriveBinding.SteerLeft]: createActiveBinding({
                    holdMilliseconds: 100,
                    value: 2,
                }),
                [DriveBinding.SteerRight]: createActiveBinding({
                    holdMilliseconds: 500,
                    value: 0.5,
                }),
            }).steer,
            -1,
        );
        assert.strictEquals(
            readCarControls({
                [DriveBinding.SteerRight]: createActiveBinding({
                    value: 0.5,
                }),
            }).steer,
            0.5,
        );
    });
});
