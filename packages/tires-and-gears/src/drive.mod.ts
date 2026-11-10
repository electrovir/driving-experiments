import {defineAnthaMod} from '@antha/engine';
import {actOnBinding} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {getEnumValues} from '@augment-vir/common';
import {
    DriveBinding,
    getPhysicsStepSeconds,
    keyboardDeviceKey,
    readCarControls,
} from '@evir/driving-common';
import {convertDuration, type AnyDuration} from 'date-vir';
import {ShiftDirection, shiftGear, toggleAutomatic, type DrivetrainState} from './drivetrain.js';
import {GearBinding} from './gear-binding.js';
import {type TiresAndGearsState} from './tires-and-gears-state.js';
import {getBodyLean, stepVehicle} from './vehicle.js';

/** How long a steering key must be held to reach full input. */
const keyboardSteerRamp: AnyDuration = {
    milliseconds: 500,
};

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
    return defineAnthaMod<TiresAndGearsState>({
        modName: 'tires-and-gears-drive',
        execute({msSinceLastExecute, state}) {
            if (!state.car) {
                return;
            }

            const activeBindings = state.activeBindings?.[LocalPlayerPosition.One];
            const car = state.car;

            const controls = readCarControls(activeBindings);
            const steerBinding =
                activeBindings?.[
                    controls.steer < 0 ? DriveBinding.SteerLeft : DriveBinding.SteerRight
                ];
            const isKeyboardSteer =
                !!steerBinding?.rawInputs.length &&
                steerBinding.rawInputs.every((input) => input.deviceKey === keyboardDeviceKey);

            state.carControls = {
                ...controls,
                /**
                 * A key is all or nothing, so holding it eases the steering in. A stick's whole
                 * throw stands in for a steering wheel's full turn, so small stick movements get
                 * finer steering.
                 */
                steer: isKeyboardSteer
                    ? controls.steer *
                      Math.min(
                          1,
                          steerBinding.holdDuration.milliseconds /
                              convertDuration(keyboardSteerRamp, {
                                  milliseconds: true,
                              }).milliseconds,
                      )
                    : Math.sign(controls.steer) * controls.steer ** 2,
            };
            state.car = stepVehicle({
                controls: state.carControls,
                dtSeconds: getPhysicsStepSeconds(msSinceLastExecute),
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
