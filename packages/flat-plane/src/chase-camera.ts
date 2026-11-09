import {convertDuration, type AnyDuration} from 'date-vir';
import {type CarState} from './car.js';

/** The chase camera's heading, which trails the car's so the camera swings wide in turns. */
export type ChaseCamera = {
    heading: number;
    /** Radians per second. */
    turnRate: number;
};

/**
 * While the car turns steadily, the camera trails it by about this much of the turn. Larger values
 * give a looser camera.
 */
const headingSmoothTime: AnyDuration = {
    milliseconds: 120,
};

/**
 * Turns the chase camera toward the car's heading with a critically damped spring: it eases into a
 * turn instead of jumping, then settles without overshooting. This is the same spring as Unity's
 * `SmoothDamp`, solved exactly so it behaves the same at any frame rate.
 */
export function followCar({
    car,
    chase,
    dtSeconds,
}: Readonly<{
    car: Readonly<CarState>;
    chase: Readonly<ChaseCamera>;
    dtSeconds: number;
}>) {
    const stiffness =
        2 /
        convertDuration(headingSmoothTime, {
            seconds: true,
        }).seconds;
    const headingGap = chase.heading - car.heading;
    /** Turn the short way around, even when the car's heading has wound up over several laps. */
    const wrappedHeadingGap = Math.atan2(Math.sin(headingGap), Math.cos(headingGap));
    const momentum = chase.turnRate + wrappedHeadingGap * stiffness;
    const decay = Math.exp(-stiffness * dtSeconds);

    return {
        heading: car.heading + (wrappedHeadingGap + momentum * dtSeconds) * decay,
        turnRate: (chase.turnRate - momentum * stiffness * dtSeconds) * decay,
    };
}
