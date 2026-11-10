import {convertDuration, type AnyDuration} from 'date-vir';
import {wrapAngle, type CarPose} from './car-pose.js';

/**
 * Where the chase camera aims. It trails the car's heading so the camera swings wide in turns, and
 * trails the body's height so it rises with a jump without shaking along with every bump.
 */
export type ChaseCamera = {
    heading: number;
    /** Radians per second. */
    turnRate: number;
    /** Meters above the ground. */
    height: number;
    /** Meters per second. */
    climbRate: number;
};

/**
 * While the car turns steadily, the camera's heading trails the car's by the angle the car turns in
 * this much time. Larger values give a looser camera.
 */
const headingSmoothTime: AnyDuration = {
    milliseconds: 120,
};
/** Slower than the suspension bounces, so they still show on screen. */
const heightSmoothTime: AnyDuration = {
    milliseconds: 400,
};

/**
 * Moves `value` toward `target` with a critically damped spring: it eases in instead of jumping,
 * then settles without overshooting. This is the same spring as Unity's `SmoothDamp`, solved
 * exactly so it behaves the same at any frame rate.
 */
function smoothDamp({
    dtSeconds,
    gap,
    rate,
    smoothTime,
}: Readonly<{
    /** The value minus its target. */
    gap: number;
    rate: number;
    smoothTime: Readonly<AnyDuration>;
    dtSeconds: number;
}>) {
    const stiffness =
        2 /
        convertDuration(smoothTime, {
            seconds: true,
        }).seconds;
    const momentum = rate + gap * stiffness;
    const decay = Math.exp(-stiffness * dtSeconds);

    return {
        gap: (gap + momentum * dtSeconds) * decay,
        rate: (rate - momentum * stiffness * dtSeconds) * decay,
    };
}

/** Moves the chase camera one frame toward the car's heading and body height. */
export function followCar({
    bodyHeight,
    car,
    chase,
    dtSeconds,
}: Readonly<{
    car: Readonly<Pick<CarPose, 'heading'>>;
    /** Meters the body sits above where it rests on flat ground. */
    bodyHeight: number;
    chase: Readonly<ChaseCamera>;
    dtSeconds: number;
}>) {
    const headingGap = chase.heading - car.heading;
    const turn = smoothDamp({
        dtSeconds,
        /** Turn the short way around, even when the car's heading has wound up over several laps. */
        gap: wrapAngle(headingGap),
        rate: chase.turnRate,
        smoothTime: headingSmoothTime,
    });
    const climb = smoothDamp({
        dtSeconds,
        gap: chase.height - bodyHeight,
        rate: chase.climbRate,
        smoothTime: heightSmoothTime,
    });

    return {
        climbRate: climb.rate,
        heading: car.heading + turn.gap,
        height: bodyHeight + climb.gap,
        turnRate: turn.rate,
    };
}
