import {assert} from '@augment-vir/assert';
import {type PartialWithUndefined} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {CarPreset} from './physics/vehicle-preset.js';
import {getRumble} from './rumble-targets.js';

function makeView({
    compression = 0.5,
    isGrounded = true,
    isShifting = false,
    slip = 0,
}: PartialWithUndefined<{
    compression: number;
    isGrounded: boolean;
    isShifting: boolean;
    slip: number;
}>) {
    const wheel = {
        compression,
        isDetached: false,
        isGrounded,
        slip,
    };

    return {
        engine: {
            isShifting,
        },
        groundedWheelCount: isGrounded ? 4 : 0,
        impacts: [],
        preset: CarPreset.Sedan,
        wheels: {
            [WheelPosition.FrontLeft]: wheel,
            [WheelPosition.FrontRight]: wheel,
            [WheelPosition.RearLeft]: wheel,
            [WheelPosition.RearRight]: wheel,
        },
    } as unknown as Parameters<typeof getRumble>[0]['view'];
}

describe(getRumble.name, () => {
    it('jolts on landing and fades over the next frames', () => {
        const airborne = getRumble({
            msSinceLastFrame: 16,
            previous: undefined,
            view: makeView({
                isGrounded: false,
            }),
        });
        const landed = getRumble({
            msSinceLastFrame: 16,
            previous: airborne.snapshot,
            view: makeView({}),
        });
        const later = getRumble({
            msSinceLastFrame: 100,
            previous: landed.snapshot,
            view: makeView({}),
        });

        assert.strictEquals(airborne.rumble.strong, 0);
        assert.isAbove(landed.rumble.strong, 0.5);
        assert.isBelow(later.rumble.strong, landed.rumble.strong);
    });

    it('buzzes while the wheels spin but not with no previous frame to compare a shift to', () => {
        const spinning = getRumble({
            msSinceLastFrame: 16,
            previous: undefined,
            view: makeView({
                isShifting: true,
                slip: 4,
            }),
        });

        assert.deepEquals(spinning.rumble, {
            strong: 0,
            weak: 0.5,
        });
    });
});
