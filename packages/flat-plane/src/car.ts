import {clamp} from '@augment-vir/common';
import {type CarControls, type CarPose} from '@evir/driving-common';

/** A car on the ground plane. */
export type CarState = CarPose & {
    /** Meters per second along the heading. Negative while reversing. */
    speed: number;
    /** Meters per second sideways while sliding. Positive slides toward the car's right. */
    lateralSpeed: number;
};

export const initialCarState: CarState = {
    heading: 0,
    lateralSpeed: 0,
    speed: 0,
    steerAngle: 0,
    x: 0,
    z: 0,
};

const wheelBase = 2.6;
const engineAcceleration = 10;
const brakeDeceleration = 22;
/** Weaker than the foot brake because it only locks the rear wheels. */
const handbrakeDeceleration = 6;
const reverseAcceleration = 6;
const maxForwardSpeed = 40;
const maxReverseSpeed = 10;
const airDrag = 0.004;
const rollingResistance = 0.4;
const maxSteerAngle = 0.6;
/** Steering narrows as speed rises so the car can't spin out at full lock. */
const steerFalloffSpeed = 12;
/** Below this speed the brake input reverses instead of braking. */
const stoppedSpeed = 0.1;
/**
 * How fast the tires cancel sideways sliding, per second. High enough that normal driving barely
 * slides.
 */
const tireGrip = 30;
/** Locked rear wheels hold the road far worse, so the car keeps sliding the way it was going. */
const handbrakeGrip = 1;
/** Extra turn rate while the handbrake is on, from the rear end swinging out. */
const handbrakeTurnBoost = 0.5;

function getAcceleration({speed, controls}: Readonly<{speed: number; controls: CarControls}>) {
    if (speed > stoppedSpeed) {
        return (
            controls.throttle * engineAcceleration -
            controls.brake * brakeDeceleration -
            controls.handbrake * handbrakeDeceleration
        );
    } else if (speed < -stoppedSpeed) {
        return (
            controls.throttle * brakeDeceleration -
            controls.brake * reverseAcceleration +
            controls.handbrake * handbrakeDeceleration
        );
    } else {
        /** A held handbrake keeps a stopped car from pulling away in either direction. */
        return (
            (controls.throttle * engineAcceleration - controls.brake * reverseAcceleration) *
            (1 - controls.handbrake)
        );
    }
}

function headingVectors(heading: number) {
    return {
        forward: {
            x: Math.sin(heading),
            z: Math.cos(heading),
        },
        /**
         * Turning right is a negative rotation about +y, so the car's right side faces -x at
         * heading 0.
         */
        right: {
            x: -Math.cos(heading),
            z: Math.sin(heading),
        },
    };
}

/**
 * A bicycle model with sideways sliding. The car turns where its front wheels point, but its
 * momentum keeps going the old way until the tires grip it back in line. Normal grip hides the
 * slide; the handbrake drops rear grip so the car drifts.
 */
export function stepCar({
    car,
    controls,
    dtSeconds,
}: Readonly<{
    car: Readonly<CarState>;
    controls: Readonly<CarControls>;
    dtSeconds: number;
}>) {
    const before = headingVectors(car.heading);
    const velocityX = before.forward.x * car.speed + before.right.x * car.lateralSpeed;
    const velocityZ = before.forward.z * car.speed + before.right.z * car.lateralSpeed;
    const steerAngle =
        (controls.steer * maxSteerAngle) / (1 + Math.abs(car.speed) / steerFalloffSpeed);
    /** Turning right is a negative rotation about +y. */
    const heading =
        car.heading -
        (car.speed / wheelBase) *
            Math.tan(steerAngle) *
            (1 + controls.handbrake * handbrakeTurnBoost) *
            dtSeconds;
    const after = headingVectors(heading);
    /** The car's momentum, measured against its new heading. */
    const carriedSpeed = velocityX * after.forward.x + velocityZ * after.forward.z;
    const carriedLateralSpeed = velocityX * after.right.x + velocityZ * after.right.z;
    const resistance =
        carriedSpeed * Math.abs(carriedSpeed) * airDrag + carriedSpeed * rollingResistance;
    const rawSpeed = clamp(
        carriedSpeed +
            (getAcceleration({
                controls,
                speed: carriedSpeed,
            }) -
                resistance) *
                dtSeconds,
        {
            max: maxForwardSpeed,
            min: -maxReverseSpeed,
        },
    );
    /** Braking and drag stop the car at zero instead of flipping it into reverse in one step. */
    const speed = carriedSpeed * rawSpeed < 0 ? 0 : rawSpeed;
    const grip = tireGrip + (handbrakeGrip - tireGrip) * controls.handbrake;
    const lateralSpeed = carriedLateralSpeed * Math.exp(-grip * dtSeconds);

    return {
        heading,
        lateralSpeed,
        speed,
        steerAngle,
        x: car.x + (after.forward.x * speed + after.right.x * lateralSpeed) * dtSeconds,
        z: car.z + (after.forward.z * speed + after.right.z * lateralSpeed) * dtSeconds,
    };
}
