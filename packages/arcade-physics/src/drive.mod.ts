import {defineAnthaMod} from '@antha/engine';
import {actOnBinding} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {getEnumValues} from '@augment-vir/common';
import {createRoadSurface, getPhysicsStepSeconds, readCarControls} from '@evir/driving-common';
import {type ArcadePhysicsState} from './arcade-physics-state.js';
import {cityLayout} from './city-layout.js';
import {ShiftDirection, shiftGear, toggleAutomatic, type DrivetrainState} from './drivetrain.js';
import {GearBinding} from './gear-binding.js';
import {RecoverBinding} from './recover-binding.js';
import {getBodyLean, recoverVehicle, stepVehicle} from './vehicle.js';

const gearActions: Readonly<
    Record<
        GearBinding,
        (params: Readonly<{drivetrain: DrivetrainState; forwardSpeed: number}>) => DrivetrainState
    >
> = {
    [GearBinding.ShiftUp]({drivetrain, forwardSpeed}) {
        return shiftGear({
            direction: ShiftDirection.Up,
            drivetrain,
            forwardSpeed,
        });
    },
    [GearBinding.ShiftDown]({drivetrain, forwardSpeed}) {
        return shiftGear({
            direction: ShiftDirection.Down,
            drivetrain,
            forwardSpeed,
        });
    },
    [GearBinding.ToggleAutomatic]({drivetrain}) {
        return toggleAutomatic(drivetrain);
    },
};

/** Turns player one's inputs into car controls and gear changes, then moves the car. */
export function createDriveMod() {
    const roadSurface = createRoadSurface(cityLayout);

    return defineAnthaMod<ArcadePhysicsState>({
        modName: 'arcade-physics-drive',
        execute({msSinceLastExecute, state}) {
            if (!state.car) {
                return;
            }

            const activeBindings = state.activeBindings?.[LocalPlayerPosition.One];
            const car = actOnBinding({
                activeBinding: activeBindings?.[RecoverBinding.Recover],
            })
                ? recoverVehicle({
                      getWheelContact: roadSurface.getWheelContact,
                      vehicle: state.car,
                  })
                : state.car;

            state.carControls = readCarControls(activeBindings);
            state.car = stepVehicle({
                controls: state.carControls,
                dtSeconds: getPhysicsStepSeconds(msSinceLastExecute),
                surface: roadSurface,
                vehicle: {
                    ...car,
                    drivetrain: getEnumValues(GearBinding).reduce((drivetrain, binding) => {
                        return actOnBinding({
                            activeBinding: activeBindings?.[binding],
                        })
                            ? gearActions[binding]({
                                  drivetrain,
                                  forwardSpeed: car.speed,
                              })
                            : drivetrain;
                    }, car.drivetrain),
                },
            });
            state.carBodyLean = getBodyLean(state.car);
        },
    });
}
