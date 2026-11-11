import {assert} from '@augment-vir/assert';
import {createArray, getEnumValues} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {getFlatWheelContact} from '@evir/driving-common/src/road-network.js';
import {type VehicleView} from '../vehicle-view.js';
import {CarPreset} from './vehicle-preset.js';
import {
    createVehicleSimulation,
    getVehicleView,
    stepVehicleSimulation,
    type VehicleInputs,
    type VehicleSimulation,
} from './vehicle-sim.js';

const world = {
    getWheelContact: getFlatWheelContact,
    walls: [],
};
const idleInputs: VehicleInputs = {
    brake: 0,
    handbrake: 0,
    isBoostHeld: false,
    roll: 0,
    steer: 0,
    throttle: 0,
};

function drive({
    inputs,
    seconds,
    vehicle,
}: Readonly<{
    vehicle: VehicleSimulation;
    inputs: Readonly<VehicleInputs>;
    seconds: number;
}>) {
    return createArray(Math.round(seconds * 60), () => undefined).reduce((current) => {
        return stepVehicleSimulation({
            dtSeconds: 1 / 60,
            inputs,
            vehicle: current,
            world,
        });
    }, vehicle);
}

describe(stepVehicleSimulation.name, () => {
    getEnumValues(CarPreset).forEach((preset) => {
        it(`settles ${preset} on the ground and drives it forward`, () => {
            const settled = drive({
                inputs: idleInputs,
                seconds: 2,
                vehicle: createVehicleSimulation({
                    heading: 0,
                    point: {
                        x: 0,
                        z: 0,
                    },
                    preset,
                }),
            });
            const settledView = getVehicleView(settled);

            assert.isBelow(Math.abs(settledView.forwardSpeed), 0.2);
            assert.isFalse(settledView.isCrashing);
            assert.strictEquals(settledView.groundedWheelCount, 4);

            const driven = getVehicleView(
                drive({
                    inputs: {
                        ...idleInputs,
                        throttle: 1,
                    },
                    seconds: 3,
                    vehicle: settled,
                }),
            );

            assert.isAbove(driven.forwardSpeed, 5);
        });
    });

    it('locks the wheels when the brakes are slammed at speed, but not when slow', () => {
        function getBrakingSkid(boostSeconds: number) {
            const moving = drive({
                inputs: {
                    ...idleInputs,
                    isBoostHeld: true,
                    throttle: 1,
                },
                seconds: boostSeconds,
                vehicle: drive({
                    inputs: idleInputs,
                    seconds: 2,
                    vehicle: createVehicleSimulation({
                        heading: 0,
                        point: {
                            x: 0,
                            z: 0,
                        },
                        preset: CarPreset.Sedan,
                    }),
                }),
            });
            const braking = getVehicleView(
                drive({
                    inputs: {
                        ...idleInputs,
                        brake: 1,
                    },
                    seconds: 0.1,
                    vehicle: moving,
                }),
            );

            return {
                speed: getVehicleView(moving).forwardSpeed,
                slip: Math.max(
                    ...Object.values(braking.wheels).map((wheel) => {
                        return wheel.slip;
                    }),
                ),
            };
        }

        const slow = getBrakingSkid(1);
        const fast = getBrakingSkid(6);

        assert.isBelow(slow.speed, 15);
        assert.isAbove(fast.speed, 25);
        assert.isBelow(slow.slip, 0.5);
        assert.isAbove(fast.slip, 1);
    });
});

describe('clutch and shifting', () => {
    function driveSedan(steps: ReadonlyArray<Readonly<{inputs: VehicleInputs; seconds: number}>>) {
        return steps.reduce<{
            vehicle: VehicleSimulation;
            views: VehicleView[];
        }>(
            (history, step) => {
                const views = createArray(Math.round(step.seconds * 60), () => undefined).reduce(
                    (stepViews) => {
                        const current = stepViews.vehicle;
                        const next = stepVehicleSimulation({
                            dtSeconds: 1 / 60,
                            inputs: step.inputs,
                            vehicle: current,
                            world,
                        });

                        return {
                            vehicle: next,
                            views: [
                                ...stepViews.views,
                                getVehicleView(next),
                            ],
                        };
                    },
                    {
                        vehicle: history.vehicle,
                        views: history.views,
                    },
                );

                return views;
            },
            {
                vehicle: createVehicleSimulation({
                    heading: 0,
                    point: {
                        x: 0,
                        z: 0,
                    },
                    preset: CarPreset.Sedan,
                }),
                views: [],
            },
        );
    }

    it('idles at a stop and eases into each automatic upshift', () => {
        const {views} = driveSedan([
            {
                inputs: idleInputs,
                seconds: 1,
            },
            {
                inputs: {
                    ...idleInputs,
                    throttle: 1,
                },
                seconds: 5,
            },
        ]);
        const rpmSteps = views.slice(1).map((view, index) => {
            return Math.abs(view.engine.kiloRpm - (views[index]?.engine.kiloRpm ?? 0));
        });

        assert.isAbove(views[59]?.engine.kiloRpm ?? 0, 0.5);
        assert.isAbove(views.filter((view) => view.engine.isShifting).length, 0);
        assert.isBelow(Math.max(...rpmSteps.slice(60)), 0.3);
    });

    it('shifts one gear per manual press and only reverses in reverse gear', () => {
        const manualInputs: VehicleInputs = {
            ...idleInputs,
            isManual: true,
        };
        const {views} = driveSedan([
            {
                inputs: {
                    ...manualInputs,
                    brake: 1,
                },
                seconds: 1,
            },
            {
                inputs: {
                    ...manualInputs,
                    gearChange: 1,
                },
                seconds: 1 / 60,
            },
            {
                inputs: manualInputs,
                seconds: 0.5,
            },
            {
                inputs: {
                    ...manualInputs,
                    gearChange: -1,
                },
                seconds: 1 / 60,
            },
            {
                inputs: manualInputs,
                seconds: 0.5,
            },
            {
                inputs: {
                    ...manualInputs,
                    gearChange: -1,
                },
                seconds: 1 / 60,
            },
            {
                inputs: manualInputs,
                seconds: 0.5,
            },
            {
                inputs: {
                    ...manualInputs,
                    gearChange: -1,
                },
                seconds: 1 / 60,
            },
            {
                inputs: {
                    ...manualInputs,
                    throttle: 1,
                },
                seconds: 2,
            },
        ]);
        const gears = views.map((view) => view.engine.gearLabel);

        assert.deepEquals(
            {
                afterBraking: {
                    forwardSpeed: Math.abs(views[59]?.forwardSpeed ?? 1) < 0.2,
                    gear: gears[59],
                },
                gears: gears.filter((gear, index) => gear !== gears[index - 1]),
                mode: views.at(-1)?.engine.shiftModeLabel,
            },
            {
                afterBraking: {
                    forwardSpeed: true,
                    gear: '1',
                },
                gears: [
                    '1',
                    '2',
                    '1',
                    'N',
                    'R',
                ],
                mode: 'M',
            },
        );
        assert.isBelow(views.at(-1)?.forwardSpeed ?? 0, -1);
    });

    it('engine brakes harder the further a downshift over-revs the engine', () => {
        const manualInputs: VehicleInputs = {
            ...idleInputs,
            isManual: true,
        };
        const speedsAfterDownshifts = [
            1,
            2,
        ].map((downshiftCount) => {
            const {views} = driveSedan([
                {
                    inputs: {
                        ...idleInputs,
                        throttle: 1,
                    },
                    seconds: 6,
                },
                ...createArray(downshiftCount, () => {
                    return [
                        {
                            inputs: {
                                ...manualInputs,
                                gearChange: -1,
                            },
                            seconds: 1 / 60,
                        },
                        {
                            inputs: manualInputs,
                            seconds: 0.3,
                        },
                    ];
                }).flat(),
                {
                    inputs: manualInputs,
                    seconds: 1,
                },
            ]);

            return views.at(-1)?.forwardSpeed ?? 0;
        });

        assert.isBelow(speedsAfterDownshifts[1] ?? 0, (speedsAfterDownshifts[0] ?? 0) - 1);
    });
});
