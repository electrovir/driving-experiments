import {type BodyAcceleration, type RigidBody} from './rigid-body.js';
import {
    addVectors,
    clamp01,
    createVector,
    crossVectors,
    dotVectors,
    getVectorLength,
    inverseRotateVector,
    normalizeVector,
    rotateVector,
    scaleVector,
    zeroVector,
    type Vector3,
} from './vector.js';
import {type AssistTuning, type FlipTuning} from './vehicle-preset.js';

const xAxis = createVector({
    x: 1,
    y: 0,
    z: 0,
});
const yAxis = createVector({
    x: 0,
    y: 1,
    z: 0,
});
const zAxis = createVector({
    x: 0,
    y: 0,
    z: 1,
});
/** What an assist or flip needs to know about the body's motion, in its own axes and the world's. */
function getBodyFrame(body: Readonly<RigidBody>) {
    return {
        forward: rotateVector(body.rotation, zAxis),
        localAngularVelocity: inverseRotateVector(body.rotation, body.angularVelocity),
        localVelocity: inverseRotateVector(body.rotation, body.velocity),
        right: rotateVector(body.rotation, xAxis),
        up: rotateVector(body.rotation, yAxis),
    };
}

/** `Mathf.Sign` treats 0 as positive. */
function unitySign(value: number) {
    return value < 0 ? -1 : 1;
}

/** Returns whichever has the larger magnitude, keeping its sign. Same as Randomation's `F.MaxAbs`. */
function maxAbs({left, right}: Readonly<{left: number; right: number}>) {
    return Math.abs(left) >= Math.abs(right) ? left : right;
}

/**
 * Same as Randomation Vehicle Physics' `VehicleAssist`: drift spin and straightening, drift push,
 * and downforce. `groundNormal` is the average of the grounded wheels' normals.
 */
export function getAssistAcceleration({
    accel,
    body,
    brake,
    groundNormal,
    groundedWheelCount,
    steer,
    tuning,
}: Readonly<{
    body: Readonly<RigidBody>;
    tuning: Readonly<AssistTuning>;
    groundedWheelCount: number;
    groundNormal: Readonly<Vector3>;
    accel: number;
    brake: number;
    steer: number;
}>): BodyAcceleration {
    const frame = getBodyFrame(body);
    const speed = getVectorLength(body.velocity);
    const velocityDirection = speed > 0 ? scaleVector(body.velocity, 1 / speed) : zeroVector;

    /**
     * Randomation also rolls a stopped car off its side or roof here. The garage leaves that to its
     * stuck-car reset instead, so a tipped car never visibly pushes itself back over.
     */
    if (groundedWheelCount === 0) {
        return {
            angular: zeroVector,
            linear: zeroVector,
        };
    }

    const targetTurnSpeed =
        steer *
        tuning.driftSpinSpeed *
        (frame.localVelocity.z < 0
            ? unitySign(
                  maxAbs({
                      left: accel,
                      right: -brake,
                  }),
              )
            : 1);
    const spin =
        (targetTurnSpeed - frame.localAngularVelocity.y) *
        tuning.driftSpinAssist *
        clamp01(Math.abs(frame.localVelocity.x) ** tuning.driftSpinExponent / 10);
    const rightVelocityDot = dotVectors({
        left: frame.right,
        right: velocityDirection,
    });
    const straighten =
        tuning.straightenAssist > 0 &&
        steer === 0 &&
        Math.abs(rightVelocityDot) < 0.1 &&
        speed ** 2 > 5
            ? rightVelocityDot * 100 * unitySign(frame.localVelocity.z) * tuning.driftSpinAssist
            : 0;
    const push = Math.abs(
        (accel - brake) *
            Math.abs(frame.localVelocity.x) *
            tuning.driftPush *
            (1 -
                Math.abs(
                    dotVectors({
                        left: frame.forward,
                        right: velocityDirection,
                    }),
                )),
    );
    const groundLeft = crossVectors({
        left: frame.forward,
        right: groundNormal,
    });
    const downforce = scaleVector(
        frame.up,
        -clamp01(Math.abs(frame.localVelocity.z) / 20) * tuning.downforce,
    );

    return {
        angular: rotateVector(
            body.rotation,
            createVector({
                x: 0,
                y: tuning.driftSpinAssist > 0 ? spin + straighten : 0,
                z: 0,
            }),
        ),
        linear: addVectors(
            scaleVector(groundLeft, push * unitySign(frame.localVelocity.x)),
            scaleVector(frame.forward, push * unitySign(frame.localVelocity.z)),
            downforce,
        ),
    };
}

/** The air controls, each from -1 to 1. */
export type FlipInputs = {
    /** Positive pitches the nose down. */
    pitch: number;
    /** Positive turns right. */
    yaw: number;
    /** Positive raises the right side. */
    roll: number;
};

/**
 * One axis of `FlipControl.ApplyFlip`: spin toward the input, braking first if spinning the other
 * way.
 */
function getFlipAxis({
    angularVelocity,
    input,
    power,
}: Readonly<{input: number; power: number; angularVelocity: number}>) {
    return input !== 0 &&
        Math.abs(angularVelocity) > 1 &&
        Math.sign(input * unitySign(power)) !== Math.sign(angularVelocity)
        ? -angularVelocity * Math.abs(power)
        : input * power - angularVelocity * (1 - Math.abs(input)) * Math.abs(power);
}

/**
 * Randomation Vehicle Physics' `FlipControl` while airborne, minus its landing correction: the car
 * tumbles however it left the ground instead of turning itself to land on its wheels.
 */
export function getFlipAcceleration({
    body,
    inputs,
    tuning,
}: Readonly<{
    body: Readonly<RigidBody>;
    tuning: Readonly<FlipTuning>;
    inputs: Readonly<FlipInputs>;
}>): BodyAcceleration {
    const frame = getBodyFrame(body);
    const angular = frame.localAngularVelocity;
    const flip = createVector({
        x:
            tuning.flipPower.x === 0
                ? 0
                : getFlipAxis({
                      angularVelocity: angular.x,
                      input: inputs.pitch,
                      power: tuning.flipPower.x,
                  }),
        y:
            tuning.flipPower.y === 0
                ? 0
                : getFlipAxis({
                      angularVelocity: angular.y,
                      input: inputs.yaw,
                      power: tuning.flipPower.y,
                  }),
        z:
            tuning.flipPower.z === 0
                ? 0
                : getFlipAxis({
                      angularVelocity: angular.z,
                      input: inputs.roll,
                      power: tuning.flipPower.z,
                  }),
    });
    return {
        angular: rotateVector(body.rotation, flip),
        linear: zeroVector,
    };
}

/** The ground's average normal under the grounded wheels, or the car's own up when airborne. */
export function averageNormals(
    normals: ReadonlyArray<Readonly<Vector3>>,
    fallback: Readonly<Vector3>,
) {
    return normals.length
        ? normalizeVector(addVectors(...normals))
        : {
              ...fallback,
          };
}
