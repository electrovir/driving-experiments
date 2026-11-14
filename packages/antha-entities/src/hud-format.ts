import {carPresets, VehicleKind, type CarPreset} from './physics/vehicle-preset.js';

const kphPerMetersPerSecond = 3.6;

/**
 * Km/h of the car's speed along its nose. Reversing reads as positive since a speedometer has no
 * sign.
 */
export function toKph(forwardSpeed: number) {
    return Math.abs(forwardSpeed) * kphPerMetersPerSecond;
}

export type PresetGauges = {
    /** Hover cars have no engine to read RPM from. */
    hasTachometer: boolean;
    /** Thousands of RPM where the tachometer's red band starts. Zero without a tachometer. */
    redlineKiloRpm: number;
};

export function getPresetGauges(preset: CarPreset): PresetGauges {
    const tuning = carPresets[preset];

    return {
        hasTachometer: tuning.vehicle.kind === VehicleKind.Wheeled,
        redlineKiloRpm:
            tuning.vehicle.kind === VehicleKind.Wheeled
                ? (tuning.vehicle.motor.torqueCurve.at(-1)?.time ?? 0)
                : 0,
    };
}
