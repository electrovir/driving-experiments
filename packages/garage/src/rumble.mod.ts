import {defineAnthaMod} from '@antha/engine';
import {check} from '@augment-vir/assert';
import {type GarageState} from './garage-state.js';
import {getRumble, type Rumble, type RumbleSnapshot} from './rumble-targets.js';

/**
 * Each effect outlasts a frame, so a dropped frame doesn't leave a gap; the next frame's effect
 * replaces it.
 */
const effectMilliseconds = 100;

function getActuators() {
    return navigator
        .getGamepads()
        .filter(check.isTruthy)
        .map(
            /** Some browsers leave this out even though the DOM types say it's always there. */
            (gamepad) => {
                return gamepad.vibrationActuator satisfies GamepadHapticActuator as
                    | GamepadHapticActuator
                    | undefined;
            },
        )
        .filter(check.isTruthy);
}

/** Rumbles every connected gamepad from `state.vehicleView`. */
export function createGarageRumbleMod() {
    const runtime: {
        previous: RumbleSnapshot | undefined;
        isRumbling: boolean;
    } = {
        isRumbling: false,
        previous: undefined,
    };

    function play(rumble: Readonly<Rumble>) {
        getActuators().forEach((actuator) => {
            actuator
                .playEffect('dual-rumble', {
                    duration: effectMilliseconds,
                    strongMagnitude: rumble.strong,
                    weakMagnitude: rumble.weak,
                })
                /** A missed rumble isn't worth interrupting the frame over. */
                .catch(() => undefined);
        });
    }

    return defineAnthaMod<GarageState>({
        modName: 'garage-rumble',
        cleanup() {
            if (runtime.isRumbling) {
                play({
                    strong: 0,
                    weak: 0,
                });
            }
            runtime.previous = undefined;
            runtime.isRumbling = false;
        },
        execute({msSinceLastExecute, state}) {
            if (!state.vehicleView) {
                return;
            }

            const {rumble, snapshot} = getRumble({
                msSinceLastFrame: msSinceLastExecute,
                previous: runtime.previous,
                view: state.vehicleView,
            });
            runtime.previous = snapshot;

            const isRumbling = rumble.strong > 0.01 || rumble.weak > 0.01;
            if (isRumbling || runtime.isRumbling) {
                play(
                    isRumbling
                        ? rumble
                        : {
                              strong: 0,
                              weak: 0,
                          },
                );
            }
            runtime.isRumbling = isRumbling;
        },
    });
}
