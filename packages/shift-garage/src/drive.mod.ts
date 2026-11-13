import {defineAnthaMod} from '@antha/engine';
import {actOnBinding} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {readCarControls} from '@evir/driving-common/src/drive-binding.js';
import {getPhysicsStepSeconds} from '@evir/driving-common/src/physics-step.js';
import {garageSpawn, isInGarage} from './arena-layout.js';
import {GarageBinding} from './garage-binding.js';
import {arenaWorld, findParkedCarAt} from './garage-parking.js';
import {type GarageState} from './garage-state.js';
import {
    createVehicleSimulation,
    getVehicleView,
    recoverVehicle,
    stepVehicleSimulation,
    takeParkedVehicle,
    toggleHeadlights,
    type VehicleSimulation,
} from './physics/vehicle-sim.js';

/**
 * Reads player one's inputs, swaps cars when the driven one pulls up to a parked one, then moves
 * the car.
 */
export function createDriveMod() {
    return defineAnthaMod<GarageState>({
        modName: 'garage-drive',
        execute({msSinceLastExecute, state}) {
            if (!state.vehicle || !state.garage) {
                return;
            }

            const activeBindings = state.activeBindings?.[LocalPlayerPosition.One];
            const parkedVehicles = state.garage.parkedVehicles;

            function isPressed(binding: GarageBinding) {
                return actOnBinding({
                    activeBinding: activeBindings?.[binding],
                });
            }

            const actions: ReadonlyArray<
                (vehicle: Readonly<VehicleSimulation>) => VehicleSimulation | undefined
            > = [
                (vehicle) => {
                    return isPressed(GarageBinding.ReturnToGarage)
                        ? createVehicleSimulation({
                              heading: garageSpawn.heading,
                              point: garageSpawn.point,
                              preset: vehicle.preset,
                          })
                        : undefined;
                },
                (vehicle) => {
                    return isPressed(GarageBinding.Recover)
                        ? recoverVehicle({
                              vehicle,
                              world: arenaWorld,
                          })
                        : undefined;
                },
                (vehicle) => {
                    const parkedPreset = findParkedCarAt({
                        currentPreset: vehicle.preset,
                        point: getVehicleView(vehicle).position,
                    });

                    return parkedPreset
                        ? takeParkedVehicle({
                              driven: vehicle,
                              parked: parkedVehicles[parkedPreset],
                          })
                        : undefined;
                },
                (vehicle) => {
                    return isPressed(GarageBinding.ToggleHeadlights)
                        ? toggleHeadlights(vehicle)
                        : undefined;
                },
            ];
            const vehicle = actions.reduce<VehicleSimulation>(
                (current, action) => action(current) ?? current,
                state.vehicle,
            );
            if (isPressed(GarageBinding.ToggleManualShifting)) {
                state.isManualShifting = !state.isManualShifting;
            }
            const controls = readCarControls(activeBindings);

            state.carControls = controls;
            state.vehicle = stepVehicleSimulation({
                dtSeconds: getPhysicsStepSeconds(msSinceLastExecute),
                inputs: {
                    ...controls,
                    gearChange:
                        (isPressed(GarageBinding.ShiftUp) ? 1 : 0) -
                        (isPressed(GarageBinding.ShiftDown) ? 1 : 0),
                    isManual: state.isManualShifting,
                    clutchPedal: activeBindings?.[GarageBinding.Clutch]?.value ?? 0,
                },
                vehicle,
                world: arenaWorld,
            });
            state.vehicleView = getVehicleView(state.vehicle);
            state.garage = {
                isInGarage: isInGarage(state.vehicleView.position),
                parkedVehicles,
            };
        },
    });
}
