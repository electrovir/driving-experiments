import {defineAnthaMod} from '@antha/engine';
import {actOnBinding} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {readCarControls} from '@evir/driving-common/src/drive-binding.js';
import {getPhysicsStepSeconds} from '@evir/driving-common/src/physics-step.js';
import {garageSpawn, isInGarage} from './arena-layout.js';
import {GarageBinding} from './garage-binding.js';
import {findParkedCarAt} from './garage-parking.js';
import {type GarageState} from './garage-state.js';
import {createArenaVehicleWorld} from './physics-entities.js';
import {
    createVehicleSimulation,
    getVehicleView,
    recoverVehicle,
    stepVehicleRecovery,
    takeParkedVehicle,
    toggleHeadlights,
    type VehicleSimulation,
} from './physics/vehicle-sim.js';

/**
 * Reads player one's inputs and swaps cars when the driven one pulls up to a parked one. The car's
 * entity moves it.
 */
export function createDriveMod() {
    return defineAnthaMod<GarageState>({
        modName: 'garage-drive',
        execute({msSinceLastExecute, state}) {
            if (!state.vehicle || !state.garage || !state.entityStore) {
                return;
            }

            const world = createArenaVehicleWorld(state.entityStore.physicsWorld);

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
                              world,
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
            const rollLeft = activeBindings?.[GarageBinding.RollLeft]?.value ?? 0;
            const rollRight = activeBindings?.[GarageBinding.RollRight]?.value ?? 0;

            const inputs = {
                ...controls,
                gearChange:
                    (isPressed(GarageBinding.ShiftUp) ? 1 : 0) -
                    (isPressed(GarageBinding.ShiftDown) ? 1 : 0) +
                    (state.vehicleInputs?.gearChange ?? 0),
                isManual: state.isManualShifting,
                isBoostHeld: (activeBindings?.[GarageBinding.Boost]?.value ?? 0) > 0,
                clutchPedal: activeBindings?.[GarageBinding.Clutch]?.value ?? 0,
                roll: Math.max(-1, Math.min(1, rollLeft - rollRight)),
            };

            state.carControls = controls;
            state.vehicleInputs = inputs;
            state.vehicle = stepVehicleRecovery({
                dtSeconds: getPhysicsStepSeconds(msSinceLastExecute),
                vehicle: {
                    ...vehicle,
                    impacts: [],
                    lastInputs: inputs,
                },
                world,
            });
            state.garage = {
                isInGarage: isInGarage(getVehicleView(state.vehicle).position),
                parkedVehicles,
            };
        },
    });
}
