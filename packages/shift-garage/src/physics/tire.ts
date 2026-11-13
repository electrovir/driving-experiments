import {type TireTuning} from './vehicle-preset.js';

/**
 * Below this forward speed, slip is measured against this speed instead. Shift divides by the
 * forward speed itself, which makes slip, and so the tire force, flip between extremes for a car
 * creeping or at rest.
 */
const minSlipSpeed = 1;

export type TireForce = {
    /** Newtons along the wheel's heading. */
    longitudinal: number;
    /** Newtons toward the wheel's right. */
    lateral: number;
    /** How much faster the tread turns than the ground passes under it. Negative while braking. */
    slipRatio: number;
    /** How close the tire is to letting go: 1 at the friction limit, more once past it. */
    saturation: number;
};

/**
 * Same as Shift's `brush_tire_model`: a brush tire whose combined slip force rises with slip until
 * it reaches the friction limit, then holds there.
 */
export function getBrushTireForce({
    forwardSpeed,
    load,
    sideSpeed,
    treadSpeed,
    tuning,
}: Readonly<{
    /** Meters per second the wheel's mount moves along the wheel's heading. */
    forwardSpeed: number;
    /** Meters per second the wheel's mount moves toward the wheel's right. */
    sideSpeed: number;
    /** The wheel's spin times its radius. */
    treadSpeed: number;
    /** Newtons pressing the tire into the ground. */
    load: number;
    tuning: Readonly<Pick<TireTuning, 'longitudinalStiffness' | 'lateralStiffness' | 'grip'>>;
}>): TireForce {
    const slipSpeed = Math.max(Math.abs(forwardSpeed), minSlipSpeed);
    const slipRatio = (treadSpeed - forwardSpeed) / slipSpeed;
    const longitudinalSlip = tuning.longitudinalStiffness * slipRatio;
    const lateralSlip = -tuning.lateralStiffness * (sideSpeed / slipSpeed);
    const slip = Math.hypot(longitudinalSlip, lateralSlip);
    const frictionLimit = tuning.grip * load;
    const saturation = frictionLimit > 0.001 ? slip / (3 * frictionLimit) : 0;
    const force =
        saturation <= 1
            ? frictionLimit * (3 * saturation - 3 * saturation ** 2 + saturation ** 3)
            : frictionLimit;

    return slip > 1e-4
        ? {
              lateral: (force * lateralSlip) / slip,
              longitudinal: (force * longitudinalSlip) / slip,
              saturation,
              slipRatio,
          }
        : {
              lateral: 0,
              longitudinal: 0,
              saturation,
              slipRatio,
          };
}
