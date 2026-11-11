import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {CarPreset} from './physics/vehicle-preset.js';
import {
    OneShotSound,
    engineVoices,
    getEngineTargets,
    getScreechTargets,
    getSoundEvents,
    getWindTargets,
    type SoundSnapshot,
} from './sound-targets.js';

const origin = {
    x: 0,
    y: 0,
    z: 0,
};

function makeWheel(overrides: {
    slip?: number;
    isGrounded?: boolean;
    isTirePopped?: boolean;
    isDetached?: boolean;
}) {
    return {
        isDetached: false,
        isGrounded: true,
        isTirePopped: false,
        slip: 0,
        ...overrides,
    };
}

function makeWheels(overrides: Partial<Record<WheelPosition, Parameters<typeof makeWheel>[0]>>) {
    return {
        [WheelPosition.FrontLeft]: makeWheel(overrides[WheelPosition.FrontLeft] ?? {}),
        [WheelPosition.FrontRight]: makeWheel(overrides[WheelPosition.FrontRight] ?? {}),
        [WheelPosition.RearLeft]: makeWheel(overrides[WheelPosition.RearLeft] ?? {}),
        [WheelPosition.RearRight]: makeWheel(overrides[WheelPosition.RearRight] ?? {}),
    };
}

/** The tests only read the fields they set, so the rest of the view is left out. */
function asView<View>(value: unknown) {
    return value as View;
}

function makeEventView(
    overrides: Partial<{
        preset: CarPreset;
        isShifting: boolean;
        isBoosting: boolean;
        wheels: ReturnType<typeof makeWheels>;
        impacts: ReadonlyArray<{speed: number; isCrash: boolean}>;
    }>,
) {
    return {
        boost: {
            isBoosting: overrides.isBoosting ?? false,
        },
        engine: {
            isShifting: overrides.isShifting ?? false,
        },
        impacts: overrides.impacts ?? [],
        preset: overrides.preset ?? CarPreset.Sedan,
        wheels: overrides.wheels ?? makeWheels({}),
    } as unknown as Parameters<typeof getSoundEvents>[0]['view'];
}

const quietSnapshot: SoundSnapshot = {
    detachedWheels: [],
    isBoosting: false,
    isShifting: false,
    poppedWheels: [],
    preset: CarPreset.Sedan,
};

describe(getEngineTargets.name, () => {
    function targets(pitch: number, health = 1, preset = CarPreset.Sedan) {
        return getEngineTargets({
            timeSeconds: 0.01,
            view: asView<Parameters<typeof getEngineTargets>[0]['view']>({
                engine: {
                    pitch,
                    throttle: pitch,
                },
                health,
                preset,
            }),
        });
    }

    it('follows RVP volume and spans the voice pitch range', () => {
        const idle = targets(0);
        const full = targets(1);
        assert.strictEquals(idle.frequency, engineVoices[CarPreset.Sedan].minHz);
        assert.strictEquals(full.frequency, engineVoices[CarPreset.Sedan].maxHz);
        assert.isAbove(full.gain, idle.gain);
        assert.isAbove(full.filterFrequency, idle.filterFrequency);
    });

    it('is silent once the engine has no health', () => {
        assert.isFalse(targets(0.5, 0).isAudible);
    });

    it('wobbles pitch on damageable cars only', () => {
        assert.notStrictEquals(
            targets(0.5, 0.5, CarPreset.Muscle).frequency,
            targets(0.5, 1, CarPreset.Muscle).frequency,
        );
        assert.strictEquals(
            targets(0.5, 0.5, CarPreset.Sedan).frequency,
            targets(0.5, 1, CarPreset.Sedan).frequency,
        );
    });
});

describe(getScreechTargets.name, () => {
    function screech(
        preset: CarPreset,
        wheels: ReturnType<typeof makeWheels>,
        groundedWheelCount = 4,
    ) {
        return getScreechTargets({
            view: asView<Parameters<typeof getScreechTargets>[0]['view']>({
                groundedWheelCount,
                preset,
                wheels,
            }),
        });
    }

    it('is silent below the slip threshold and loud at full slip', () => {
        assert.strictEquals(
            screech(
                CarPreset.Sedan,
                makeWheels({
                    [WheelPosition.RearLeft]: {
                        slip: 0.4,
                    },
                }),
            ).gain,
            0,
        );
        assert.strictEquals(
            screech(
                CarPreset.Sedan,
                makeWheels({
                    [WheelPosition.RearLeft]: {
                        slip: 6,
                    },
                }),
            ).gain,
            1,
        );
    });

    it('ignores airborne and detached wheels, and hover cars', () => {
        const skidding = makeWheels({
            [WheelPosition.RearLeft]: {
                isGrounded: false,
                slip: 1,
            },
            [WheelPosition.RearRight]: {
                isDetached: true,
                slip: 1,
            },
        });
        assert.strictEquals(screech(CarPreset.Sedan, skidding).gain, 0);
        assert.strictEquals(
            screech(
                CarPreset.Hover,
                makeWheels({
                    [WheelPosition.RearLeft]: {
                        slip: 1,
                    },
                }),
            ).gain,
            0,
        );
    });

    it('fades with fewer grounded wheels and flags rim skids', () => {
        const result = screech(
            CarPreset.Sedan,
            makeWheels({
                [WheelPosition.RearLeft]: {
                    isTirePopped: true,
                    slip: 6,
                },
            }),
            2,
        );
        assert.strictEquals(result.gain, 0.5);
        assert.isTrue(result.isRim);
    });
});

describe(getWindTargets.name, () => {
    it('rises with speed in any direction', () => {
        const slow = getWindTargets({
            view: {
                velocity: origin,
            },
        });
        const fast = getWindTargets({
            view: {
                velocity: {
                    ...origin,
                    x: 30,
                },
            },
        });
        assert.strictEquals(slow.gain, 0);
        assert.isAbove(fast.gain, 0);
        assert.isAbove(fast.filterFrequency, slow.filterFrequency);
    });
});

describe(getSoundEvents.name, () => {
    it('fires no edges on the first frame or right after a preset change', () => {
        const view = makeEventView({
            isBoosting: true,
            isShifting: true,
        });
        assert.deepEquals(
            getSoundEvents({
                previous: undefined,
                view,
            }).oneShots,
            [],
        );
        assert.deepEquals(
            getSoundEvents({
                previous: {
                    ...quietSnapshot,
                    preset: CarPreset.Muscle,
                },
                view,
            }).oneShots,
            [],
        );
    });

    it('fires on rising edges only', () => {
        const view = makeEventView({
            isBoosting: true,
            isShifting: true,
            wheels: makeWheels({
                [WheelPosition.FrontLeft]: {
                    isTirePopped: true,
                },
                [WheelPosition.RearRight]: {
                    isDetached: true,
                },
            }),
        });
        const first = getSoundEvents({
            previous: quietSnapshot,
            view,
        });
        assert.deepEquals(
            first.oneShots.map((event) => event.sound),
            [
                OneShotSound.ShiftBlip,
                OneShotSound.BoostStart,
                OneShotSound.TirePop,
                OneShotSound.WheelDetach,
            ],
        );
        assert.deepEquals(
            getSoundEvents({
                previous: first.snapshot,
                view,
            }).oneShots,
            [],
        );
    });

    it('plays a boost end puff when boosting stops', () => {
        assert.deepEquals(
            getSoundEvents({
                previous: {
                    ...quietSnapshot,
                    isBoosting: true,
                },
                view: makeEventView({}),
            }).oneShots,
            [
                {
                    sound: OneShotSound.BoostEnd,
                    volume: 1,
                },
            ],
        );
    });

    it('scales impact volume by speed like RVP and separates crashes from scrapes', () => {
        assert.deepEquals(
            getSoundEvents({
                previous: quietSnapshot,
                view: makeEventView({
                    impacts: [
                        {
                            isCrash: true,
                            speed: 4,
                        },
                        {
                            isCrash: false,
                            speed: 30,
                        },
                    ],
                }),
            }).oneShots,
            [
                {
                    sound: OneShotSound.Crash,
                    volume: 0.4,
                },
                {
                    sound: OneShotSound.Scrape,
                    volume: 1,
                },
            ],
        );
    });
});
