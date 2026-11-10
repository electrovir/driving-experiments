import {defineAnthaMod} from '@antha/engine';
import {LocalPlayerPosition} from '@antha/util';
import {getPhysicsStepSeconds, readCarControls} from '@evir/driving-common';
import {stepCar} from './car.js';
import {type FlatPlaneState} from './flat-plane-state.js';

/** Turns player one's inputs into car controls and moves the car. */
export function createDriveMod() {
    return defineAnthaMod<FlatPlaneState>({
        modName: 'flat-plane-drive',
        execute({msSinceLastExecute, state}) {
            if (!state.car) {
                return;
            }

            state.carControls = readCarControls(state.activeBindings?.[LocalPlayerPosition.One]);
            state.car = stepCar({
                car: state.car,
                controls: state.carControls,
                dtSeconds: getPhysicsStepSeconds(msSinceLastExecute),
            });
        },
    });
}
