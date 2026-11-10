import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {
    chooseAutomaticGear,
    type DrivetrainState,
    Gear,
    getPedals,
    initialDrivetrain,
    redlineRpm,
    ShiftDirection,
    shiftGear,
    stepDrivetrain,
    toggleAutomatic,
} from './drivetrain.js';

function runDrivetrain({
    drivetrain,
    seconds,
    throttle,
    wheelSpeed,
}: Readonly<{
    drivetrain: DrivetrainState;
    seconds: number;
    throttle: number;
    wheelSpeed: number;
}>) {
    const dtSeconds = 1 / 240;

    return createArray(Math.round(seconds / dtSeconds), () => undefined).reduce<
        ReturnType<typeof stepDrivetrain>
    >(
        (current) => {
            return stepDrivetrain({
                drivetrain: current.drivetrain,
                dtSeconds,
                throttle,
                wheelSpeed,
            });
        },
        {
            driveForce: 0,
            drivetrain,
        },
    );
}

describe(stepDrivetrain.name, () => {
    it('cuts power past the rev limiter', () => {
        function getDriveForce(wheelSpeed: number) {
            return runDrivetrain({
                drivetrain: initialDrivetrain,
                seconds: 1,
                throttle: 1,
                wheelSpeed,
            }).driveForce;
        }

        /** First gear at about redline, then well past the limiter. */
        assert.isAbove(getDriveForce(21), 0);
        assert.isBelow(getDriveForce(25), 0);
    });

    it('revs freely mid-shift without driving the wheels', () => {
        const result = runDrivetrain({
            drivetrain: {
                ...initialDrivetrain,
                isAutomatic: false,
                shiftSecondsLeft: 2,
            },
            seconds: 1,
            throttle: 1,
            wheelSpeed: 0,
        });

        assert.strictEquals(result.driveForce, 0);
        assert.isAbove(result.drivetrain.rpm, redlineRpm);
    });

    it('holds a steady rpm below redline at part throttle in neutral', () => {
        const neutral = {
            ...initialDrivetrain,
            gear: Gear.Neutral,
        };
        const settled = runDrivetrain({
            drivetrain: neutral,
            seconds: 10,
            throttle: 0.4,
            wheelSpeed: 0,
        }).drivetrain;
        const later = runDrivetrain({
            drivetrain: settled,
            seconds: 1,
            throttle: 0.4,
            wheelSpeed: 0,
        }).drivetrain;

        assert.isBelow(settled.rpm, redlineRpm);
        assert.isApproximately(later.rpm, settled.rpm, 10);
    });
});

describe(shiftGear.name, () => {
    it('refuses reverse while moving', () => {
        const neutral = shiftGear({
            direction: ShiftDirection.Down,
            drivetrain: initialDrivetrain,
            forwardSpeed: 10,
        });

        assert.deepEquals(
            [
                neutral.gear,
                shiftGear({
                    direction: ShiftDirection.Down,
                    drivetrain: neutral,
                    forwardSpeed: 10,
                }).gear,
            ],
            [
                Gear.Neutral,
                Gear.Neutral,
            ],
        );
    });
});

describe(getPedals.name, () => {
    it('swaps the pedals in the automatic reverse only', () => {
        const controls = {
            brake: 1,
            throttle: 0,
        };

        assert.deepEquals(
            [
                getPedals({
                    controls,
                    drivetrain: {
                        ...initialDrivetrain,
                        gear: Gear.Reverse,
                    },
                }),
                getPedals({
                    controls,
                    drivetrain: {
                        ...initialDrivetrain,
                        gear: Gear.Reverse,
                        isAutomatic: false,
                    },
                }),
            ],
            [
                {
                    brake: 0,
                    throttle: 1,
                },
                controls,
            ],
        );
    });
});

describe(toggleAutomatic.name, () => {
    it('leaves neutral for first when switching to automatic, and keeps gear otherwise', () => {
        const manualNeutral = {
            ...initialDrivetrain,
            gear: Gear.Neutral,
            isAutomatic: false,
        };
        const automatic = toggleAutomatic(manualNeutral);

        assert.deepEquals(
            [
                automatic.isAutomatic,
                automatic.gear,
                toggleAutomatic(automatic).isAutomatic,
                toggleAutomatic({
                    ...manualNeutral,
                    gear: Gear.Third,
                }).gear,
            ],
            [
                true,
                Gear.First,
                false,
                Gear.Third,
            ],
        );
    });
});

describe(chooseAutomaticGear.name, () => {
    it('picks first gear on throttle from a stop in reverse', () => {
        const result = chooseAutomaticGear({
            controls: {
                brake: 0,
                throttle: 1,
            },
            drivetrain: {
                ...initialDrivetrain,
                gear: Gear.Reverse,
            },
            forwardSpeed: 0,
        });

        assert.strictEquals(result.gear, Gear.First);
    });
});
