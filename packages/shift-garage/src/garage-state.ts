import {type AnthaModsState} from '@antha/engine';
import {type createAnthaInputBindingsMod, type createAnthaReadRawInputMod} from '@antha/input';
import {type CarControls} from '@evir/driving-common/src/car-controls.js';
import {type DriveBinding} from '@evir/driving-common/src/drive-binding.js';
import {type GarageBinding} from './garage-binding.js';
import {type CarPreset} from './physics/vehicle-preset.js';
import {type VehicleSimulation} from './physics/vehicle-sim.js';
import {type RouteRun} from './route-run.js';
import {type VehicleView} from './vehicle-view.js';

export type GarageState = AnthaModsState<
    [
        ReturnType<typeof createAnthaReadRawInputMod>,
        ReturnType<typeof createAnthaInputBindingsMod<DriveBinding | GarageBinding>>,
    ]
> & {
    /** The physics' own state. Everything else should read {@link GarageState.vehicleView}. */
    vehicle: VehicleSimulation;
    vehicleView: VehicleView;
    /** The controls the car moved with this frame, after clamping. */
    carControls: CarControls;
    garage: GarageMenu;
    /** Whether the driver shifts gears themselves. It stays set across car swaps. */
    isManualShifting: boolean;
    routeRun: RouteRun;
};

export type GarageMenu = {
    /** Whether the car is in the stalls or on their apron, for the HUD. */
    isInGarage: boolean;
    /** Every stall's display car. The one being driven isn't drawn. */
    parkedVehicles: Readonly<Record<CarPreset, VehicleSimulation>>;
};
