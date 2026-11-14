import {createArray} from '@augment-vir/common';
import {
    addVectors,
    clamp01,
    clampVectorLength,
    createVector,
    crossVectors,
    dotVectors,
    getVectorLength,
    integrateRotation,
    inverseRotateVector,
    projectOnPlane,
    rotateVector,
    scaleVector,
    subtractVectors,
    zeroVector,
    type Quaternion,
    type Vector3,
} from './vector.js';
import {type BodyBox} from './vehicle-preset.js';

/** Meters per second squared. */
export const gravity = 9.81;
/** Unity's default cap, which Randomation Vehicle Physics' tuning relies on. */
const maxAngularSpeed = 7;
/** Unity's default angular drag. */
const angularDrag = 0.05;
const contactIterations = 4;
/** Penetration left alone so resting contacts don't jitter. */
const penetrationSlop = 0.01;

/** A rigid body in the physics' frame. Every force on it is an acceleration, so mass never matters. */
export type RigidBody = {
    centerOfMass: Vector3;
    rotation: Quaternion;
    velocity: Vector3;
    /** World radians per second. */
    angularVelocity: Vector3;
};

export type BodyShape = {
    centerOfMassOffset: Vector3;
    /** Per unit mass, about the body's own axes. */
    inverseInertia: Vector3;
};

export type BodyAcceleration = {
    linear: Vector3;
    /** World radians per second squared. */
    angular: Vector3;
};

export const noAcceleration: Readonly<BodyAcceleration> = {
    angular: zeroVector,
    linear: zeroVector,
};

/** A point of the body pressing into something. */
export type BodyContact = {
    point: Vector3;
    /** Out of the surface, toward the body. */
    normal: Vector3;
    depth: number;
    friction: number;
};

/** Solid boxes of even density, like the colliders Unity derives a car's inertia from. */
export function createBodyShape({
    bodyBoxes,
    centerOfMassOffset,
}: Readonly<{
    bodyBoxes: ReadonlyArray<Readonly<BodyBox>>;
    centerOfMassOffset: Readonly<Vector3>;
}>): BodyShape {
    const weighted = bodyBoxes.map((box) => {
        return {
            box,
            volume: box.halfSize.x * box.halfSize.y * box.halfSize.z,
        };
    });
    const totalVolume = weighted.reduce((sum, entry) => sum + entry.volume, 0);
    const inertia = weighted.reduce((sum, {box, volume}) => {
        const offset = subtractVectors({
            left: box.center,
            right: centerOfMassOffset,
        });
        const half = box.halfSize;

        return addVectors(
            sum,
            scaleVector(
                createVector({
                    x: (half.y ** 2 + half.z ** 2) / 3 + offset.y ** 2 + offset.z ** 2,
                    y: (half.x ** 2 + half.z ** 2) / 3 + offset.x ** 2 + offset.z ** 2,
                    z: (half.x ** 2 + half.y ** 2) / 3 + offset.x ** 2 + offset.y ** 2,
                }),
                volume / totalVolume,
            ),
        );
    }, zeroVector);

    return {
        centerOfMassOffset: {
            ...centerOfMassOffset,
        },
        inverseInertia: createVector({
            x: 1 / inertia.x,
            y: 1 / inertia.y,
            z: 1 / inertia.z,
        }),
    };
}

/** Where a point given relative to the body's origin, in its own axes, is in the world. */
export function getWorldPoint({
    body,
    localPoint,
    shape,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    localPoint: Readonly<Vector3>;
}>) {
    return addVectors(
        body.centerOfMass,
        rotateVector(
            body.rotation,
            subtractVectors({
                left: localPoint,
                right: shape.centerOfMassOffset,
            }),
        ),
    );
}

/** The world point turned back into the body's own axes, relative to its origin. */
export function getLocalPoint({
    body,
    shape,
    worldPoint,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    worldPoint: Readonly<Vector3>;
}>) {
    return addVectors(
        inverseRotateVector(
            body.rotation,
            subtractVectors({
                left: worldPoint,
                right: body.centerOfMass,
            }),
        ),
        shape.centerOfMassOffset,
    );
}

export function getPointVelocity(body: Readonly<RigidBody>, point: Readonly<Vector3>) {
    return addVectors(
        body.velocity,
        crossVectors({
            left: body.angularVelocity,
            right: subtractVectors({
                left: point,
                right: body.centerOfMass,
            }),
        }),
    );
}

function applyInverseInertia({
    body,
    shape,
    vector,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    vector: Readonly<Vector3>;
}>) {
    const local = inverseRotateVector(body.rotation, vector);

    return rotateVector(
        body.rotation,
        createVector({
            x: local.x * shape.inverseInertia.x,
            y: local.y * shape.inverseInertia.y,
            z: local.z * shape.inverseInertia.z,
        }),
    );
}

/** Same as Unity's `AddForceAtPosition` with `ForceMode.Acceleration`. */
export function getAccelerationAtPoint({
    body,
    force,
    point,
    shape,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    force: Readonly<Vector3>;
    point: Readonly<Vector3>;
}>): BodyAcceleration {
    return {
        angular: applyInverseInertia({
            body,
            shape,
            vector: crossVectors({
                left: subtractVectors({
                    left: point,
                    right: body.centerOfMass,
                }),
                right: force,
            }),
        }),
        linear: {
            ...force,
        },
    };
}

export function addAccelerations(
    ...accelerations: ReadonlyArray<Readonly<BodyAcceleration>>
): BodyAcceleration {
    return {
        angular: addVectors(...accelerations.map((acceleration) => acceleration.angular)),
        linear: addVectors(...accelerations.map((acceleration) => acceleration.linear)),
    };
}

export function integrateVelocity({
    acceleration,
    body,
    dtSeconds,
    linearDrag,
}: Readonly<{
    body: Readonly<RigidBody>;
    acceleration: Readonly<BodyAcceleration>;
    dtSeconds: number;
    linearDrag: number;
}>): RigidBody {
    return {
        ...body,
        angularVelocity: clampVectorLength(
            scaleVector(
                addVectors(body.angularVelocity, scaleVector(acceleration.angular, dtSeconds)),
                clamp01(1 - angularDrag * dtSeconds),
            ),
            maxAngularSpeed,
        ),
        velocity: scaleVector(
            addVectors(body.velocity, scaleVector(acceleration.linear, dtSeconds)),
            clamp01(1 - linearDrag * dtSeconds),
        ),
    };
}

export function integratePosition({
    body,
    dtSeconds,
}: Readonly<{
    body: Readonly<RigidBody>;
    dtSeconds: number;
}>): RigidBody {
    return {
        ...body,
        centerOfMass: addVectors(body.centerOfMass, scaleVector(body.velocity, dtSeconds)),
        rotation: integrateRotation({
            angularVelocity: body.angularVelocity,
            dtSeconds,
            rotation: body.rotation,
        }),
    };
}

/**
 * How much a push at `offset` from the center of mass, along `direction`, is resisted: the push
 * needed to change that point's speed by 1 is this many times what moving the center alone takes.
 */
export function getImpulseResistance({
    body,
    direction,
    offset,
    shape,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    offset: Readonly<Vector3>;
    direction: Readonly<Vector3>;
}>) {
    return (
        1 +
        dotVectors({
            left: direction,
            right: crossVectors({
                left: applyInverseInertia({
                    body,
                    shape,
                    vector: crossVectors({
                        left: offset,
                        right: direction,
                    }),
                }),
                right: offset,
            }),
        })
    );
}

function applyImpulse({
    body,
    impulse,
    offset,
    shape,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    offset: Readonly<Vector3>;
    impulse: Readonly<Vector3>;
}>): RigidBody {
    return {
        ...body,
        angularVelocity: addVectors(
            body.angularVelocity,
            applyInverseInertia({
                body,
                shape,
                vector: crossVectors({
                    left: offset,
                    right: impulse,
                }),
            }),
        ),
        velocity: addVectors(body.velocity, impulse),
    };
}

function resolveContact({
    body,
    contact,
    shape,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    contact: Readonly<BodyContact>;
}>): RigidBody {
    const offset = subtractVectors({
        left: contact.point,
        right: body.centerOfMass,
    });
    const normalSpeed = dotVectors({
        left: getPointVelocity(body, contact.point),
        right: contact.normal,
    });

    if (normalSpeed >= 0) {
        return body;
    }

    /** A car's body crumples instead of bouncing, so a hit only stops its push into the surface. */
    const normalImpulse =
        -normalSpeed /
        getImpulseResistance({
            body,
            direction: contact.normal,
            offset,
            shape,
        });
    const bounced = applyImpulse({
        body,
        impulse: scaleVector(contact.normal, normalImpulse),
        offset,
        shape,
    });
    const slide = projectOnPlane({
        vector: getPointVelocity(bounced, contact.point),
        normal: contact.normal,
    });
    const slideSpeed = getVectorLength(slide);

    if (slideSpeed < 1e-6) {
        return bounced;
    }

    const tangent = scaleVector(slide, 1 / slideSpeed);
    const frictionImpulse = Math.min(
        slideSpeed /
            getImpulseResistance({
                body,
                direction: tangent,
                offset,
                shape,
            }),
        contact.friction * normalImpulse,
    );

    return applyImpulse({
        body: bounced,
        impulse: scaleVector(tangent, -frictionImpulse),
        offset,
        shape,
    });
}

/** Stops every contact from pressing further in, with friction, then lifts the body back out. */
export function resolveContacts({
    body,
    contacts,
    shape,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    contacts: ReadonlyArray<Readonly<BodyContact>>;
}>): RigidBody {
    if (!contacts.length) {
        return body;
    }

    const resolved = createArray(contactIterations, () => undefined).reduce<RigidBody>(
        (current) => {
            return contacts.reduce((next, contact) => {
                return resolveContact({
                    body: next,
                    contact,
                    shape,
                });
            }, current);
        },
        body,
    );
    const correction = contacts
        .toSorted((left, right) => right.depth - left.depth)
        .reduce((total, contact) => {
            const remaining =
                contact.depth -
                penetrationSlop -
                dotVectors({
                    left: total,
                    right: contact.normal,
                });

            return remaining > 0
                ? addVectors(total, scaleVector(contact.normal, remaining * 0.8))
                : total;
        }, zeroVector);

    return {
        ...resolved,
        centerOfMass: addVectors(resolved.centerOfMass, correction),
    };
}
