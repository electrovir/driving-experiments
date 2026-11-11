import {clamp} from '@augment-vir/common';
import {carPresets, VehicleKind, type CarPreset} from './physics/vehicle-preset.js';

const kphPerMetersPerSecond = 3.6;

/**
 * Km/h of the car's speed along its nose. Reversing reads as positive since a speedometer has no
 * sign.
 */
export function toKph(forwardSpeed: number) {
    return Math.abs(forwardSpeed) * kphPerMetersPerSecond;
}

/** Fraction of a bar to fill, kept between 0 and 1 so a bad value can't overflow the bar. */
export function getBarFraction(amount: number) {
    return clamp(amount, {
        max: 1,
        min: 0,
    });
}

export type PresetGauges = {
    /** Hover cars have no engine to read RPM from. */
    hasTachometer: boolean;
    hasHealth: boolean;
    /** Thousands of RPM where the tachometer's red band starts. Zero without a tachometer. */
    redlineKiloRpm: number;
};

export function getPresetGauges(preset: CarPreset): PresetGauges {
    const tuning = carPresets[preset];

    return {
        hasHealth: !!tuning.hasDamage,
        hasTachometer: tuning.vehicle.kind === VehicleKind.Wheeled,
        redlineKiloRpm:
            tuning.vehicle.kind === VehicleKind.Wheeled
                ? (tuning.vehicle.motor.torqueCurve.at(-1)?.time ?? 0)
                : 0,
    };
}
