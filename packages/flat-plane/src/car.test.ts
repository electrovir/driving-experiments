import {assert, assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {type CarControls} from '@evir/driving-common';
import {initialCarState, stepCar, type CarState} from './car.js';

const noControls: CarControls = {
    brake: 0,
    handbrake: 0,
    steer: 0,
    throttle: 0,
};

function driveFor({
    car = initialCarState,
    controls,
    seconds,
}: Readonly<{
    car?: Readonly<CarState> | undefined;
    controls: Readonly<Partial<CarControls>>;
    seconds: number;
}>) {
    const dtSeconds = 1 / 60;
    const stepCount = Math.round(seconds / dtSeconds);

    return createArray(stepCount, () => undefined).reduce<CarState>((current) => {
        return stepCar({
            car: current,
            controls: {
                ...noControls,
                ...controls,
            },
            dtSeconds,
        });
    }, car);
}

describe(stepCar.name, () => {
    it('drives straight ahead along +z', () => {
        const car = driveFor({
            controls: {
                throttle: 1,
            },
            seconds: 2,
        });

        assert.isAbove(car.z, 5);
        assert.isBelow(Math.abs(car.x), 1e-9);
    });

    it('turns toward -x when steering right', () => {
        const car = driveFor({
            controls: {
                steer: 1,
                throttle: 1,
            },
            seconds: 2,
        });

        assert.isBelow(car.x, -1);
    });

    it('stops at zero when braking instead of reversing', () => {
        const moving = driveFor({
            controls: {
                throttle: 1,
            },
            seconds: 2,
        });
        const braked = stepCar({
            car: moving,
            controls: {
                ...noControls,
                brake: 1,
            },
            dtSeconds: 10,
        });

        assert.strictEquals(braked.speed, 0);
    });

    it('reverses when braking from a stop', () => {
        const car = driveFor({
            controls: {
                brake: 1,
            },
            seconds: 1,
        });

        assert.isBelow(car.speed, 0);
        assert.isBelow(car.z, 0);
    });

    it('slows a reversing car faster with throttle or handbrake than coasting', () => {
        const reversing = driveFor({
            controls: {
                brake: 1,
            },
            seconds: 1,
        });
        const [
            coasting,
            withThrottle,
            withHandbrake,
        ] = [
            {},
            {
                throttle: 1,
            },
            {
                handbrake: 1,
            },
        ].map((controls) => {
            return driveFor({
                car: reversing,
                controls,
                seconds: 0.2,
            }).speed;
        });

        assert.isBelow(reversing.speed, 0);
        assert.isAbove(assertWrap.isDefined(withThrottle), assertWrap.isDefined(coasting));
        assert.isAbove(assertWrap.isDefined(withHandbrake), assertWrap.isDefined(coasting));
    });

    it('holds a stopped car still under throttle while the handbrake is on', () => {
        const car = driveFor({
            controls: {
                handbrake: 1,
                throttle: 1,
            },
            seconds: 1,
        });

        assert.strictEquals(car.speed, 0);
    });

    it('slides sideways when turning on the handbrake', () => {
        const moving = driveFor({
            controls: {
                throttle: 1,
            },
            seconds: 3,
        });
        const gripping = driveFor({
            car: moving,
            controls: {
                steer: 1,
            },
            seconds: 0.5,
        });
        const sliding = driveFor({
            car: moving,
            controls: {
                handbrake: 1,
                steer: 1,
            },
            seconds: 0.5,
        });

        assert.isAbove(Math.abs(sliding.lateralSpeed), Math.abs(gripping.lateralSpeed) * 3);
    });
});
