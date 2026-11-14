import {type Quaternion} from '@evir/driving-common/src/car-pose.js';

export type {Quaternion} from '@evir/driving-common/src/car-pose.js';

export type Vector3 = {
    x: number;
    y: number;
    z: number;
};

export const zeroVector: Readonly<Vector3> = {
    x: 0,
    y: 0,
    z: 0,
};

export const identityQuaternion: Readonly<Quaternion> = {
    w: 1,
    x: 0,
    y: 0,
    z: 0,
};

export function createVector({x, y, z}: Readonly<{x: number; y: number; z: number}>): Vector3 {
    return {
        x,
        y,
        z,
    };
}

export function addVectors(...vectors: ReadonlyArray<Readonly<Vector3>>): Vector3 {
    return vectors.reduce<Vector3>(
        (sum, vector) => {
            return {
                x: sum.x + vector.x,
                y: sum.y + vector.y,
                z: sum.z + vector.z,
            };
        },
        {
            ...zeroVector,
        },
    );
}

export function subtractVectors({
    left,
    right,
}: Readonly<{left: Readonly<Vector3>; right: Readonly<Vector3>}>): Vector3 {
    return {
        x: left.x - right.x,
        y: left.y - right.y,
        z: left.z - right.z,
    };
}

export function scaleVector(vector: Readonly<Vector3>, scale: number): Vector3 {
    return {
        x: vector.x * scale,
        y: vector.y * scale,
        z: vector.z * scale,
    };
}

export function dotVectors({
    left,
    right,
}: Readonly<{left: Readonly<Vector3>; right: Readonly<Vector3>}>) {
    return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function crossVectors({
    left,
    right,
}: Readonly<{left: Readonly<Vector3>; right: Readonly<Vector3>}>): Vector3 {
    return {
        x: left.y * right.z - left.z * right.y,
        y: left.z * right.x - left.x * right.z,
        z: left.x * right.y - left.y * right.x,
    };
}

export function getVectorLength(vector: Readonly<Vector3>) {
    return Math.sqrt(
        dotVectors({
            left: vector,
            right: vector,
        }),
    );
}

/** Same as Unity's `Vector3.normalized`: a vector too short to have a direction becomes zero. */
export function normalizeVector(vector: Readonly<Vector3>): Vector3 {
    const length = getVectorLength(vector);
    return length > 1e-5
        ? scaleVector(vector, 1 / length)
        : {
              ...zeroVector,
          };
}

export function lerpNumber({
    from,
    to,
    amount,
}: Readonly<{from: number; to: number; amount: number}>) {
    return from + (to - from) * Math.min(1, Math.max(0, amount));
}

/** Same as {@link lerpNumber} but without clamping `amount`, like Unity's `Mathf.LerpUnclamped`. */
export function lerpNumberUnclamped({
    from,
    to,
    amount,
}: Readonly<{from: number; to: number; amount: number}>) {
    return from + (to - from) * amount;
}

export function lerpVectors({
    from,
    to,
    amount,
}: Readonly<{from: Readonly<Vector3>; to: Readonly<Vector3>; amount: number}>) {
    return {
        x: lerpNumber({
            from: from.x,
            to: to.x,
            amount,
        }),
        y: lerpNumber({
            from: from.y,
            to: to.y,
            amount,
        }),
        z: lerpNumber({
            from: from.z,
            to: to.z,
            amount,
        }),
    };
}

export function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

/** Same as Unity's `Vector3.ClampMagnitude`. */
export function clampVectorLength(vector: Readonly<Vector3>, maxLength: number): Vector3 {
    const length = getVectorLength(vector);
    return length > maxLength
        ? scaleVector(vector, maxLength / length)
        : {
              ...vector,
          };
}

/** Removes the part of `vector` along the unit vector `normal`. */
export function projectOnPlane({
    vector,
    normal,
}: Readonly<{vector: Readonly<Vector3>; normal: Readonly<Vector3>}>) {
    return subtractVectors({
        left: vector,
        right: scaleVector(
            normal,
            dotVectors({
                left: vector,
                right: normal,
            }),
        ),
    });
}

/** Same as C#'s `Math.Sign`: zero stays zero, unlike Unity's `Mathf.Sign`. */
export function signOrZero(value: number) {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** Same as Unity's `Mathf.Sign`: zero counts as positive. */
export function signWithZeroPositive(value: number) {
    return value >= 0 ? 1 : -1;
}

export function multiplyQuaternions({
    left,
    right,
}: Readonly<{left: Readonly<Quaternion>; right: Readonly<Quaternion>}>) {
    return {
        w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
        x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
        y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
        z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    };
}

export function conjugateQuaternion(quaternion: Readonly<Quaternion>): Quaternion {
    return {
        w: quaternion.w,
        x: -quaternion.x,
        y: -quaternion.y,
        z: -quaternion.z,
    };
}

export function normalizeQuaternion(quaternion: Readonly<Quaternion>): Quaternion {
    const length = Math.hypot(quaternion.w, quaternion.x, quaternion.y, quaternion.z);
    return length > 1e-9
        ? {
              w: quaternion.w / length,
              x: quaternion.x / length,
              y: quaternion.y / length,
              z: quaternion.z / length,
          }
        : {
              ...identityQuaternion,
          };
}

/** A right-handed rotation of `angle` radians about the unit vector `axis`. */
export function createAxisAngleQuaternion(axis: Readonly<Vector3>, angle: number): Quaternion {
    const halfSine = Math.sin(angle / 2);
    return {
        w: Math.cos(angle / 2),
        x: axis.x * halfSine,
        y: axis.y * halfSine,
        z: axis.z * halfSine,
    };
}

export function rotateVector(quaternion: Readonly<Quaternion>, vector: Readonly<Vector3>): Vector3 {
    const axis = {
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
    };
    const doubledCross = scaleVector(
        crossVectors({
            left: axis,
            right: vector,
        }),
        2,
    );
    return addVectors(
        vector,
        scaleVector(doubledCross, quaternion.w),
        crossVectors({
            left: axis,
            right: doubledCross,
        }),
    );
}

/** Turns a world direction into `quaternion`'s own axes. */
export function inverseRotateVector(quaternion: Readonly<Quaternion>, vector: Readonly<Vector3>) {
    return rotateVector(conjugateQuaternion(quaternion), vector);
}

/** Turns `rotation` by `angularVelocity` (world radians per second) for `dtSeconds`. */
export function integrateRotation({
    angularVelocity,
    dtSeconds,
    rotation,
}: Readonly<{
    rotation: Quaternion;
    angularVelocity: Vector3;
    dtSeconds: number;
}>) {
    const angle = getVectorLength(angularVelocity) * dtSeconds;
    return angle < 1e-9
        ? {
              ...rotation,
          }
        : normalizeQuaternion(
              multiplyQuaternions({
                  left: createAxisAngleQuaternion(normalizeVector(angularVelocity), angle),
                  right: rotation,
              }),
          );
}

/**
 * The physics runs mirrored from the scene, with +x to the car's right like Unity, so the
 * Randomation Vehicle Physics math ports unchanged. Mirroring x is its own inverse.
 */
export function mirrorVector(vector: Readonly<Vector3>): Vector3 {
    return {
        x: -vector.x,
        y: vector.y,
        z: vector.z,
    };
}

/** Same as {@link mirrorVector} for a rotation: mirroring x negates the y and z rotation parts. */
export function mirrorQuaternion(quaternion: Readonly<Quaternion>): Quaternion {
    return {
        w: quaternion.w,
        x: quaternion.x,
        y: -quaternion.y,
        z: -quaternion.z,
    };
}

/**
 * Same as {@link mirrorVector} for an angular velocity. A spin's axis flips the opposite way from a
 * position, so mirroring x negates its y and z instead.
 */
export function mirrorAngularVelocity(angularVelocity: Readonly<Vector3>): Vector3 {
    return {
        x: angularVelocity.x,
        y: -angularVelocity.y,
        z: -angularVelocity.z,
    };
}
