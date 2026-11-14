import {evaluateCurve, getCurveEndTime} from './animation-curve.js';
import {
    addAccelerations,
    getAccelerationAtPoint,
    getPointVelocity,
    getWorldPoint,
    noAcceleration,
    type BodyAcceleration,
    type BodyShape,
    type RigidBody,
} from './rigid-body.js';
import {
    addVectors,
    clamp01,
    createVector,
    dotVectors,
    rotateVector,
    scaleVector,
    type Vector3,
} from './vector.js';
import {type HoverPadTuning, type HoverTuning} from './vehicle-preset.js';
import {probeGround, type VehicleWorld} from './vehicle-world.js';

export type HoverPadState = {
    /** Same as Randomation's hover `compression`: 0 against the ground, 1 at the edge of its reach. */
    compression: number;
    contact: {point: Vector3; normal: Vector3} | undefined;
};

export function createHoverPadState(): HoverPadState {
    return {
        compression: 1,
        contact: undefined,
    };
}

/** The car-wide part of Randomation Vehicle Physics' `HoverMotor` and `HoverSteer`. */
export function getHoverDrive({
    accel,
    boostBoost,
    brake,
    forwardSpeed,
    isBoosting,
    steer,
    tuning,
}: Readonly<{
    tuning: Readonly<HoverTuning>;
    accel: number;
    brake: number;
    steer: number;
    forwardSpeed: number;
    isBoosting: boolean;
    boostBoost: number;
}>) {
    const input = accel - brake;
    const boostMultiplier = isBoosting ? 1 + boostBoost : 1;

    return {
        /** From 0 to 1, for the engine sound. */
        pitch:
            Math.max(Math.abs(input), Math.abs(steer) * 0.5) *
            (1 - evaluateCurve(tuning.forceCurve, Math.abs(forwardSpeed))),
        steerRate:
            steer * evaluateCurve(tuning.steerCurve, Math.abs(forwardSpeed)) * tuning.steerRate,
        targetForce:
            Math.abs(input) *
            evaluateCurve(
                tuning.forceCurve,
                Math.abs(forwardSpeed) - (isBoosting ? boostBoost : 0),
            ) *
            tuning.power *
            boostMultiplier,
        targetSpeed: input * getCurveEndTime(tuning.forceCurve) * boostMultiplier,
        throttle: Math.abs(input),
    };
}

/** Same as Randomation Vehicle Physics' `HoverWheel.FixedUpdate` for one pad. */
export function stepHoverPad({
    body,
    brake,
    drive,
    ebrake,
    forwardSpeed,
    accel,
    pad,
    shape,
    tuning,
    world,
}: Readonly<{
    pad: Readonly<HoverPadTuning>;
    tuning: Readonly<HoverTuning>;
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    world: Readonly<VehicleWorld>;
    drive: Readonly<
        Pick<ReturnType<typeof getHoverDrive>, 'steerRate' | 'targetForce' | 'targetSpeed'>
    >;
    accel: number;
    brake: number;
    ebrake: number;
    forwardSpeed: number;
}>): {pad: HoverPadState; acceleration: BodyAcceleration} {
    const up = rotateVector(
        body.rotation,
        createVector({
            x: 0,
            y: 1,
            z: 0,
        }),
    );
    const forward = rotateVector(
        body.rotation,
        createVector({
            x: 0,
            y: 0,
            z: 1,
        }),
    );
    const right = rotateVector(
        body.rotation,
        createVector({
            x: 1,
            y: 0,
            z: 0,
        }),
    );
    const position = getWorldPoint({
        body,
        localPoint: pad.pivot,
        shape,
    });
    const ground = probeGround({
        bottom: position.y,
        point: position,
        radius: 0.1,
        world,
    });
    const distance = up.y > 0.3 ? (position.y - ground.height) / up.y : Infinity;
    const isGrounded = distance <= tuning.hoverDistance;

    if (!isGrounded) {
        return {
            acceleration: noAcceleration,
            pad: createHoverPadState(),
        };
    }

    const compression = clamp01(distance / tuning.hoverDistance);
    const velocity = getPointVelocity(body, position);
    const travelVelocity = dotVectors({
        left: velocity,
        right: up,
    });
    const forwardVelocity = dotVectors({
        left: velocity,
        right: forward,
    });
    const sidewaysVelocity = dotVectors({
        left: velocity,
        right,
    });
    const floatForce = scaleVector(
        up,
        tuning.floatForce *
            ((1 - compression) ** Math.max(1, tuning.floatExponent) -
                tuning.floatDamping * Math.max(-1, Math.min(1, travelVelocity))),
    );
    const bufferForce =
        distance < tuning.bufferDistance
            ? scaleVector(
                  up,
                  -tuning.bufferFloatForce *
                      (distance / tuning.bufferDistance) *
                      Math.max(-1, Math.min(0, travelVelocity)),
              )
            : createVector({
                  x: 0,
                  y: 0,
                  z: 0,
              });
    const brakeAmount =
        (forwardSpeed > 0 ? brake : clamp01(accel)) * tuning.brakeForce +
        ebrake * tuning.ebrakeForce;
    const driveForce = scaleVector(
        addVectors(
            scaleVector(
                forward,
                Math.max(-1, Math.min(1, drive.targetSpeed)) * drive.targetForce -
                    brakeAmount *
                        Math.max(5, Math.abs(forwardVelocity)) *
                        Math.sign(forwardVelocity),
            ),
            scaleVector(
                right,
                drive.steerRate * pad.steerFactor - sidewaysVelocity * tuning.sideFriction,
            ),
        ),
        1 - compression,
    );

    return {
        acceleration: addAccelerations(
            getAccelerationAtPoint({
                body,
                force: addVectors(floatForce, bufferForce, driveForce),
                point: position,
                shape,
            }),
        ),
        pad: {
            compression,
            contact: {
                normal: ground.normal,
                point: createVector({
                    x: position.x,
                    y: ground.height,
                    z: position.z,
                }),
            },
        },
    };
}
