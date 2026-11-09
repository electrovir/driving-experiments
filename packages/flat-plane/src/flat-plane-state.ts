import {type AnthaModsState} from '@antha/engine';
import {type createAnthaInputBindingsMod, type createAnthaReadRawInputMod} from '@antha/input';
import {type CarControls, type CarState} from './car.js';
import {type DriveBinding} from './drive-binding.js';

export type FlatPlaneState = AnthaModsState<
    [
        ReturnType<typeof createAnthaReadRawInputMod>,
        ReturnType<typeof createAnthaInputBindingsMod<DriveBinding>>,
    ]
> & {
    car: CarState;
    /** The controls the car moved with this frame, after clamping. */
    carControls: CarControls;
};
