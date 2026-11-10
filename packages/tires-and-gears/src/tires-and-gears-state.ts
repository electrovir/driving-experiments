import {type AnthaModsState} from '@antha/engine';
import {type createAnthaInputBindingsMod, type createAnthaReadRawInputMod} from '@antha/input';
import {type CarBodyLean, type CarControls, type DriveBinding} from '@evir/driving-common';
import {type GearBinding} from './gear-binding.js';
import {type VehicleState} from './vehicle.js';

export type TiresAndGearsState = AnthaModsState<
    [
        ReturnType<typeof createAnthaReadRawInputMod>,
        ReturnType<typeof createAnthaInputBindingsMod<DriveBinding | GearBinding>>,
    ]
> & {
    car: VehicleState;
    carBodyLean: CarBodyLean;
    /** The controls the car moved with this frame, after clamping. */
    carControls: CarControls;
};
