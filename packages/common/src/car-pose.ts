import {type PartialWithUndefined} from '@augment-vir/common';

/** Where a car sits on the ground plane. Heading 0 faces +z and positive headings turn toward +x. */
export type CarPose = {
    x: number;
    z: number;
    heading: number;
    /** The front wheels' angle in radians. Positive turns right. */
    steerAngle: number;
    /** Seconds left that other cars pass through this one. The car blinks meanwhile. */
    ghostSeconds?: number | undefined;
    /** Where the body scraped along the ground since the last frame. */
    sparks?: ReadonlyArray<Readonly<CarSpark>> | undefined;
};

/** A spot where the body scrapes along the ground fast enough to throw sparks. */
export type CarSpark = Record<'position' | 'velocity', Record<'x' | 'y' | 'z', number>>;

/** Wraps `angle` into radians from negative pi to pi, so the short way around is the sign. */
export function wrapAngle(angle: number) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export enum WheelPosition {
    FrontLeft = 'front-left',
    FrontRight = 'front-right',
    RearLeft = 'rear-left',
    RearRight = 'rear-right',
}

/** Meters, from the wheel's center to its tread. */
export const wheelRadius = 0.33;

/** A rotation, as a unit quaternion. */
export type Quaternion = {
    x: number;
    y: number;
    z: number;
    w: number;
};

/** A spot on the car, in meters from the ground below its center. */
export type CarPoint = {
    forward: number;
    right: number;
    up: number;
};

/** The boxes the car's body is built from. The physics collides with their edges. */
export const carBoxes: ReadonlyArray<
    Readonly<{
        center: Readonly<CarPoint>;
        length: number;
        width: number;
        height: number;
    }>
> = [
    {
        center: {
            forward: 0,
            right: 0,
            up: 0.7,
        },
        height: 0.6,
        length: 4,
        width: 1.8,
    },
    {
        center: {
            forward: -0.3,
            right: 0,
            up: 1.27,
        },
        height: 0.55,
        length: 2,
        width: 1.5,
    },
];

/**
 * How the body sits on its springs. Without the optional heights, the scene keeps the wheels
 * planted.
 */
export type CarBodyLean = (
    | {
          /** Radians. Positive dips the nose. */
          pitch: number;
          /** Radians. Positive leans toward the car's right side. */
          roll: number;
          tilt?: undefined;
      }
    | {
          /**
           * The body's full rotation from facing its heading, for a body that can tumble. Turns the
           * car's own axes, with +x its left side, +y up, and +z forward.
           */
          tilt: Quaternion;
          pitch?: undefined;
          roll?: undefined;
      }
) &
    PartialWithUndefined<{
        /** Meters the body sits above where it rests on flat ground. */
        height: number;
        /**
         * Meters each wheel's center sits above where it rests. Measured along the body's own up
         * when the lean has a `tilt`, and straight up otherwise.
         */
        wheelHeights: Record<WheelPosition, number>;
    }>;
