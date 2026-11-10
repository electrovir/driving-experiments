import {type AnthaModsState} from '@antha/engine';
import {type createAnthaInputBindingsMod, type createAnthaReadRawInputMod} from '@antha/input';
import {type CarControls, type DriveBinding} from '@evir/driving-common';
import {type CarState} from './car.js';

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
