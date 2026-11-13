const kphPerMetersPerSecond = 3.6;

/**
 * Km/h of the car's speed along its nose. Reversing reads as positive since a speedometer has no
 * sign.
 */
export function toKph(forwardSpeed: number) {
    return Math.abs(forwardSpeed) * kphPerMetersPerSecond;
}
