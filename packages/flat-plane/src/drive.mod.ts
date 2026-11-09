import {defineAnthaMod} from '@antha/engine';
import {getAxisValue, getDirectionalInput} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {clamp} from '@augment-vir/common';
import {convertDuration, type AnyDuration} from 'date-vir';
import {stepCar} from './car.js';
import {DriveBinding} from './drive-binding.js';
import {type FlatPlaneState} from './flat-plane-state.js';

/**
 * The engine loop runs on `requestAnimationFrame`, so the gap between runs grows to seconds while
 * the tab is hidden. Capping it keeps the car from jumping when the tab comes back.
 */
const maxPhysicsStep: AnyDuration = {
    milliseconds: 50,
};

/** Turns player one's inputs into car controls and moves the car. */
export function createDriveMod() {
    return defineAnthaMod<FlatPlaneState>({
        modName: 'flat-plane-drive',
        execute({msSinceLastExecute, state}) {
            if (!state.car) {
                return;
            }

            const bindings = state.activeBindings?.[LocalPlayerPosition.One];
            /**
             * Antha adds up every held input bound to a control, so holding two keys for one
             * control reads as 2.
             */
            const pedalRange = {
                max: 1,
                min: 0,
            };

            state.carControls = {
                brake: clamp(bindings?.[DriveBinding.Brake]?.value ?? 0, pedalRange),
                handbrake: clamp(bindings?.[DriveBinding.Handbrake]?.value ?? 0, pedalRange),
                steer: clamp(
                    getAxisValue({
                        negative: getDirectionalInput({
                            activeBindings: bindings,
                            bindingName: DriveBinding.SteerLeft,
                        }),
                        positive: getDirectionalInput({
                            activeBindings: bindings,
                            bindingName: DriveBinding.SteerRight,
                        }),
                    }),
                    {
                        max: 1,
                        min: -1,
                    },
                ),
                throttle: clamp(bindings?.[DriveBinding.Throttle]?.value ?? 0, pedalRange),
            };
            state.car = stepCar({
                car: state.car,
                controls: state.carControls,
                dtSeconds: Math.min(
                    convertDuration(maxPhysicsStep, {
                        seconds: true,
                    }).seconds,
                    convertDuration(
                        {
                            milliseconds: msSinceLastExecute,
                        },
                        {
                            seconds: true,
                        },
                    ).seconds,
                ),
            });
        },
    });
}
