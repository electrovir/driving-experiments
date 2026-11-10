import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {type CarControls} from '@evir/driving-common';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {Gear} from './drivetrain.js';
import {initialVehicleState, stepVehicle, type VehicleState} from './vehicle.js';

const noControls: CarControls = {
    brake: 0,
    handbrake: 0,
    steer: 0,
    throttle: 0,
};

function driveFor({
    controls,
    seconds,
    vehicle = initialVehicleState,
}: Readonly<{
    vehicle?: Readonly<VehicleState> | undefined;
    controls: Readonly<Partial<CarControls>>;
    seconds: number;
}>) {
    const dtSeconds = 1 / 60;

    return createArray(Math.round(seconds / dtSeconds), () => undefined).reduce<VehicleState>(
        (current) => {
            return stepVehicle({
                controls: {
                    ...noControls,
                    ...controls,
                },
                dtSeconds,
                vehicle: current,
            });
        },
        vehicle,
    );
}

/** About 100 km/h in a straight line. */
const cruising = driveFor({
    controls: {
        throttle: 1,
    },
    seconds: 8,
});

describe(stepVehicle.name, () => {
    it('stays put with no input', () => {
        const vehicle = driveFor({
            controls: {},
            seconds: 3,
        });

        assert.isBelow(Math.hypot(vehicle.x, vehicle.z, vehicle.heading), 1e-6);
    });

    it('drives straight and shifts up on its own', () => {
        assert.isAbove(cruising.speed, 15);
        assert.isBelow(Math.abs(cruising.x), 1e-6);
        assert.notStrictEquals(cruising.drivetrain.gear, Gear.First);
    });

    it('shifts weight onto the front tires under braking', () => {
        const vehicle = driveFor({
            controls: {
                brake: 1,
            },
            seconds: 0.5,
            vehicle: cruising,
        });

        assert.isAbove(
            vehicle.tires[WheelPosition.FrontLeft].load,
            initialVehicleState.tires[WheelPosition.FrontLeft].load * 1.2,
        );
        assert.isBelow(
            vehicle.tires[WheelPosition.RearLeft].load,
            initialVehicleState.tires[WheelPosition.RearLeft].load * 0.8,
        );
    });

    it('turns tighter when braking into a turn', () => {
        function getCurvature(controls: Readonly<Partial<CarControls>>) {
            const vehicle = driveFor({
                controls: {
                    steer: 0.05,
                    ...controls,
                },
                seconds: 0.6,
                vehicle: cruising,
            });

            return vehicle.yawRate / vehicle.speed;
        }

        assert.isAbove(
            getCurvature({
                brake: 0.4,
            }),
            getCurvature({}) * 1.1,
        );
    });

    it('slides the rear out with the handbrake', () => {
        function getSlide(handbrake: number) {
            return driveFor({
                controls: {
                    handbrake,
                    steer: 0.5,
                },
                seconds: 0.8,
                vehicle: cruising,
            }).lateralSpeed;
        }

        assert.isAbove(Math.abs(getSlide(1)), Math.abs(getSlide(0)) * 3);
    });

    it('reverses when holding the brake from a stop', () => {
        const vehicle = driveFor({
            controls: {
                brake: 1,
            },
            seconds: 2,
        });

        assert.strictEquals(vehicle.drivetrain.gear, Gear.Reverse);
        assert.isBelow(vehicle.speed, -2);
    });
});
