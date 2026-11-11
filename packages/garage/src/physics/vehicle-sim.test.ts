import {assert} from '@augment-vir/assert';
import {createArray, getEnumValues} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {getFlatWheelContact} from '@evir/driving-common/src/road-network.js';
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
});
