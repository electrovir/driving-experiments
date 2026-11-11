import {evaluateCurve} from './animation-curve.js';
import {type DriveForce} from './drivetrain.js';
import {
    addAccelerations,
    getAccelerationAtPoint,
    getPointVelocity,
    getWorldPoint,
    gravity,
    noAcceleration,
    type BodyAcceleration,
    type BodyContact,
    type BodyShape,
    type RigidBody,
} from './rigid-body.js';
import {
    addVectors,
    clamp01,
    createAxisAngleQuaternion,
    createVector,
    dotVectors,
    getVectorLength,
    integrateRotation,
    lerpNumber,
    lerpVectors,
    multiplyQuaternions,
    normalizeVector,
    projectOnPlane,
    rotateVector,
    scaleVector,
    subtractVectors,
    zeroVector,
    type Quaternion,
    type Vector3,
} from './vector.js';
import {forwardFrictionCurve, type WheelTuning} from './vehicle-preset.js';
import {findWallPenetration, probeGround, type VehicleWorld} from './vehicle-world.js';

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
const degreesToRadians = Math.PI / 180;
/**
 * Grip where a wheel's suspension has bottomed out on its bump stops, so a car that lands or hits a
 * bump hard sheds speed, more the harder it hits.
 */
const bumpStopFriction = 0.5;

/** A wheel that has broken off and bounces around on its own. */
export type LooseWheel = {
    position: Vector3;
    velocity: Vector3;
    rotation: Quaternion;
    angularVelocity: Vector3;
};

/** Mirrors the fields of Randomation Vehicle Physics' `Wheel` that carry over between steps. */
export type WheelState = {
    /** Lerps toward the steering input times the wheel's steer factor. */
    steer: number;
    /** From 0 pressed all the way up to 1 hanging all the way down. */
    travel: number;
    rawRpm: number;
    currentRpm: number;
    feedbackRpm: number;
    spinAngle: number;
    frictionForce: Vector3;
    /** From 1 when full down to 0 when flat. */
    tirePressure: number;
    isDeflating: boolean;
    isPopped: boolean;
    airLeak: number;
    damage: number;
    loose: LooseWheel | undefined;
    contact: {point: Vector3; normal: Vector3} | undefined;
    /** Same as Randomation's `Suspension.compression`: 0 pressed all the way up, 1 hanging free. */
    compression: number;
    forwardSlip: number;
    sidewaysSlip: number;
};

export function createWheelState(): WheelState {
    return {
        airLeak: 0,
        compression: 1,
        contact: undefined,
        currentRpm: 0,
        damage: 0,
        feedbackRpm: 0,
        forwardSlip: 0,
        frictionForce: zeroVector,
        isDeflating: false,
        isPopped: false,
        loose: undefined,
        rawRpm: 0,
        sidewaysSlip: 0,
        spinAngle: 0,
        steer: 0,
        tirePressure: 1,
        travel: 1,
    };
}

export function getWheelRadius(wheel: Readonly<WheelState>, tuning: Readonly<WheelTuning>) {
    return wheel.isPopped
        ? tuning.rimRadius
        : lerpNumber({
              from: tuning.rimRadius,
              to: tuning.tireRadius,
              amount: wheel.tirePressure,
          });
}

/** The wheel's steering angle in radians, Ackermann included. */
function getSteerRadians({
    side,
    steer,
    tuning,
}: Readonly<{steer: number; tuning: Readonly<WheelTuning>; side: number}>) {
    const ackermann =
        Math.sign(steer) === side ? 1 + tuning.ackermannFactor : 1 - tuning.ackermannFactor;

    return steer * tuning.steerRange * ackermann * degreesToRadians;
}

/** Where the wheel's hub is and which way it faces, in the physics' frame. */
export function getWheelPose({
    body,
    shape,
    side,
    tuning,
    wheel,
}: Readonly<{
    wheel: Readonly<WheelState>;
    tuning: Readonly<WheelTuning>;
    side: number;
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
}>) {
    if (wheel.loose) {
        return {
            position: wheel.loose.position,
            rotation: wheel.loose.rotation,
        };
    }

    const steered = multiplyQuaternions({
        left: body.rotation,
        right: createAxisAngleQuaternion(
            yAxis,
            getSteerRadians({
                side,
                steer: wheel.steer,
                tuning,
            }),
        ),
    });

    return {
        position: addVectors(
            getWorldPoint({
                body,
                localPoint: tuning.pivot,
                shape,
            }),
            rotateVector(
                body.rotation,
                createVector({
                    x: 0,
                    y: -tuning.suspensionDistance * wheel.travel,
                    z: 0,
                }),
            ),
        ),
        rotation: multiplyQuaternions({
            left: steered,
            right: createAxisAngleQuaternion(xAxis, wheel.spinAngle),
        }),
    };
}

/** What the car asks of one wheel on one step. */
export type WheelInputs = {
    accel: number;
    brake: number;
    ebrake: number;
    burnout: number;
    burnoutSpin: number;
    steerInput: number;
    /** The car's steering after its speed limit, before each wheel's steer factor. */
    steerTarget: number;
    steerRate: number;
    forwardSpeed: number;
};

/**
 * Same as Randomation Vehicle Physics' `Wheel.FixedUpdate` and `Suspension.FixedUpdate` for one
 * wheel. Returns the wheel's push on the body and any hard contacts for the body to resolve.
 */
export function stepWheel({
    body,
    drive,
    dtSeconds,
    inputs,
    shape,
    side,
    tuning,
    wheel,
    world,
}: Readonly<{
    wheel: Readonly<WheelState>;
    tuning: Readonly<WheelTuning>;
    /** 1 for wheels on the car's right, -1 on its left. */
    side: number;
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    world: Readonly<VehicleWorld>;
    drive: Readonly<DriveForce>;
    inputs: Readonly<WheelInputs>;
    dtSeconds: number;
}>): {wheel: WheelState; acceleration: BodyAcceleration; contacts: BodyContact[]} {
    if (wheel.loose) {
        return {
            acceleration: noAcceleration,
            contacts: [],
            wheel: {
                ...wheel,
                contact: undefined,
                loose: stepLooseWheel({
                    dtSeconds,
                    loose: wheel.loose,
                    radius: getWheelRadius(wheel, tuning),
                    world,
                }),
            },
        };
    }

    const radius = getWheelRadius(wheel, tuning);
    const circumference = Math.PI * 2 * radius;
    const steer = lerpNumber({
        from: wheel.steer,
        to: inputs.steerTarget * tuning.steerFactor,
        amount: inputs.steerRate,
    });
    const up = rotateVector(body.rotation, yAxis);
    const springDirection = scaleVector(up, -1);
    const pivot = getWorldPoint({
        body,
        localPoint: tuning.pivot,
        shape,
    });
    const extended = addVectors(pivot, scaleVector(springDirection, tuning.suspensionDistance));
    const ground = probeGround({
        /**
         * RVP finds a wheel's ground with a ray cast down from the top of its suspension, so the
         * wheel rides up onto any step below that and only a taller one stops it like a wall. A
         * wall stops a wheel whose bottom sits more than a radius below the step, so this puts the
         * bottom one radius below the suspension's top.
         */
        bottom: pivot.y - radius,
        point: extended,
        radius,
        world,
    });
    const contactDistance = up.y > 0.3 ? (pivot.y - ground.height) / up.y - radius : Infinity;
    const isGrounded = contactDistance <= tuning.suspensionDistance;
    const compression = isGrounded ? clamp01(contactDistance / tuning.suspensionDistance) : 1;
    const travel =
        compression < wheel.travel || isGrounded
            ? compression
            : lerpNumber({
                  from: wheel.travel,
                  to: compression,
                  amount: tuning.extendSpeed * dtSeconds,
              });
    const center = addVectors(
        pivot,
        scaleVector(springDirection, tuning.suspensionDistance * travel),
    );
    const contactPoint = createVector({
        x: center.x,
        y: ground.height,
        z: center.z,
    });
    const steered = multiplyQuaternions({
        left: body.rotation,
        right: createAxisAngleQuaternion(
            yAxis,
            getSteerRadians({
                side,
                steer,
                tuning,
            }),
        ),
    });
    const forward = normalizeVector(
        projectOnPlane({
            vector: rotateVector(steered, zAxis),
            normal: ground.normal,
        }),
    );
    const right = normalizeVector(
        projectOnPlane({
            vector: rotateVector(steered, xAxis),
            normal: ground.normal,
        }),
    );
    /** Randomation's prefabs measure and apply tire friction at the wheel's center, not the ground. */
    const pointVelocity = getPointVelocity(body, center);
    const forwardVelocity = dotVectors({
        left: pointVelocity,
        right: forward,
    });
    const sidewaysVelocity = dotVectors({
        left: pointVelocity,
        right,
    });

    const targetRpm = tuning.isDriven ? drive.rpm : 0;
    const brakeAmount =
        tuning.brakeForce *
        (inputs.forwardSpeed > 0 ? inputs.brake : clamp01(inputs.accel)) *
        (targetRpm === 0 ? 1 : 1 - inputs.burnout);
    const ebrakeAmount = tuning.ebrakeForce * inputs.ebrake;
    const torque = tuning.isDriven
        ? lerpNumber({
              from: drive.torque,
              to: Math.abs(inputs.accel),
              amount: inputs.burnout,
          })
        : 0;
    const rawRpm = isGrounded
        ? (forwardVelocity / circumference) * (Math.PI * 100)
        : lerpNumber({
              from: wheel.rawRpm,
              to: targetRpm,
              amount: torque + brakeAmount + ebrakeAmount,
          });
    const currentRpm = lerpNumber({
        from: rawRpm,
        to: lerpNumber({
            from: lerpNumber({
                from: rawRpm,
                to: targetRpm,
                amount: torque,
            }),
            to: 0,
            amount: Math.max(brakeAmount, ebrakeAmount),
        }),
        amount: torque + brakeAmount + ebrakeAmount,
    });
    const forwardSlip = isGrounded ? 0.01 * (rawRpm - currentRpm) : 0;
    const sidewaysSlip = isGrounded ? sidewaysVelocity * 0.1 : 0;

    const tire = {
        airLeak:
            wheel.isDeflating && isGrounded
                ? wheel.airLeak +
                  Math.max(Math.abs(currentRpm) * 0.001, getVectorLength(body.velocity) * 0.1)
                : wheel.airLeak,
        tirePressure: wheel.isDeflating
            ? Math.max(0, wheel.tirePressure - dtSeconds * 0.5)
            : wheel.tirePressure,
    };

    const nextWheel: WheelState = {
        ...wheel,
        ...tire,
        compression,
        contact: isGrounded
            ? {
                  normal: ground.normal,
                  point: contactPoint,
              }
            : undefined,
        currentRpm,
        feedbackRpm: lerpNumber({
            from: currentRpm,
            to: rawRpm,
            amount: tuning.feedbackRpmBias,
        }),
        forwardSlip,
        isPopped: wheel.isPopped || (tire.airLeak > 1000 && tire.tirePressure === 0),
        rawRpm,
        sidewaysSlip,
        spinAngle: (wheel.spinAngle + currentRpm * dtSeconds * degreesToRadians) % (Math.PI * 2),
        steer,
        travel,
    };

    const wallContacts: BodyContact[] = [
        ground.wall
            ? {
                  depth: ground.wall.depth,
                  friction: 0.3,
                  normal: ground.wall.outward,
                  point: center,
              }
            : undefined,
        getWheelWallContact({
            center,
            radius,
            world,
        }),
    ].filter((contact) => contact != undefined);

    if (!isGrounded) {
        return {
            acceleration: noAcceleration,
            contacts: wallContacts,
            wheel: {
                ...nextWheel,
                frictionForce: lerpVectors({
                    from: wheel.frictionForce,
                    to: zeroVector,
                    amount: 0.5,
                }),
            },
        };
    }

    const travelVelocity = dotVectors({
        left: getPointVelocity(body, contactPoint),
        right: ground.normal,
    });
    const springForce = scaleVector(
        ground.normal,
        tuning.springForce *
            ((1 - compression) ** Math.max(1, tuning.springExponent) -
                tuning.springDamping * Math.max(-1, Math.min(1, travelVelocity))),
    );
    const burnoutGripFactor =
        inputs.burnout > 0 && targetRpm !== 0 && ebrakeAmount === 0
            ? (1 - inputs.burnout) * (1 - Math.abs(inputs.accel))
            : 1;
    const forwardForce =
        evaluateCurve(forwardFrictionCurve, Math.abs(forwardSlip)) *
        -Math.sign(forwardSlip) *
        (nextWheel.isPopped ? 0.5 : tuning.forwardFriction);
    const sidewaysForce =
        evaluateCurve(tuning.sidewaysFrictionCurve, Math.abs(sidewaysSlip - forwardSlip)) *
        -Math.sign(sidewaysSlip) *
        (nextWheel.isPopped ? 0.5 : tuning.sidewaysFriction) *
        burnoutGripFactor;
    const frictionMultiplier =
        0.5 + (1 - compression) * 0.5 * clamp01(Math.abs(sidewaysVelocity) * 10);
    const frictionForce = lerpVectors({
        from: wheel.frictionForce,
        to: scaleVector(
            addVectors(scaleVector(forward, forwardForce), scaleVector(right, sidewaysForce)),
            frictionMultiplier,
        ),
        amount: 0.5,
    });
    const burnoutSpinForce =
        inputs.burnout > 0 && tuning.isDriven
            ? scaleVector(
                  forward,
                  -side *
                      inputs.steerInput *
                      inputs.burnoutSpin *
                      currentRpm *
                      Math.min(0.1, torque) *
                      0.001 *
                      inputs.burnout *
                      (nextWheel.isPopped ? 0.5 : 1),
              )
            : zeroVector;
    const hardContact: BodyContact | undefined =
        contactDistance < 0
            ? {
                  depth: -contactDistance * up.y,
                  friction: bumpStopFriction,
                  normal: up,
                  point: contactPoint,
              }
            : undefined;

    return {
        acceleration: addAccelerations(
            getAccelerationAtPoint({
                body,
                force: springForce,
                point: contactPoint,
                shape,
            }),
            getAccelerationAtPoint({
                body,
                force: frictionForce,
                point: center,
                shape,
            }),
            getAccelerationAtPoint({
                body,
                force: burnoutSpinForce,
                point: pivot,
                shape,
            }),
        ),
        contacts: hardContact
            ? [
                  ...wallContacts,
                  hardContact,
              ]
            : wallContacts,
        wheel: {
            ...nextWheel,
            frictionForce,
        },
    };
}

/** Keeps a tire's outside from passing through the garage walls. */
function getWheelWallContact({
    center,
    radius,
    world,
}: Readonly<{
    center: Readonly<Vector3>;
    radius: number;
    world: Readonly<VehicleWorld>;
}>): BodyContact | undefined {
    const penetration = findWallPenetration({
        margin: radius,
        point: center,
        world,
    });

    return penetration
        ? {
              ...penetration,
              friction: 0.3,
              point: center,
          }
        : undefined;
}

/** A broken-off wheel falls, bounces, and rolls to a stop. */
function stepLooseWheel({
    dtSeconds,
    loose,
    radius,
    world,
}: Readonly<{
    loose: Readonly<LooseWheel>;
    radius: number;
    world: Readonly<VehicleWorld>;
    dtSeconds: number;
}>): LooseWheel {
    const velocity = addVectors(
        loose.velocity,
        createVector({
            x: 0,
            y: -gravity * dtSeconds,
            z: 0,
        }),
    );
    const moved = addVectors(loose.position, scaleVector(velocity, dtSeconds));
    const ground = probeGround({
        bottom: moved.y - radius,
        point: moved,
        radius,
        world,
    });
    const wall =
        findWallPenetration({
            margin: radius,
            point: moved,
            world,
        }) ??
        (ground.wall
            ? {
                  depth: ground.wall.depth,
                  normal: ground.wall.outward,
              }
            : undefined);
    const isOnGround = moved.y - radius < ground.height;
    const afterGround = isOnGround
        ? {
              position: createVector({
                  x: moved.x,
                  y: ground.height + radius,
                  z: moved.z,
              }),
              velocity: createVector({
                  x: velocity.x * 0.99,
                  y: Math.max(velocity.y, -velocity.y * 0.3),
                  z: velocity.z * 0.99,
              }),
          }
        : {
              position: moved,
              velocity,
          };
    const wallSpeed = wall
        ? dotVectors({
              left: afterGround.velocity,
              right: wall.normal,
          })
        : 0;
    const settled = wall
        ? {
              position: addVectors(afterGround.position, scaleVector(wall.normal, wall.depth)),
              velocity:
                  wallSpeed < 0
                      ? subtractVectors({
                            left: afterGround.velocity,
                            right: scaleVector(wall.normal, wallSpeed * 1.4),
                        })
                      : afterGround.velocity,
          }
        : afterGround;
    const angularVelocity = scaleVector(loose.angularVelocity, isOnGround ? 0.98 : 1);

    return {
        angularVelocity,
        position: settled.position,
        rotation: integrateRotation({
            angularVelocity,
            dtSeconds,
            rotation: loose.rotation,
        }),
        velocity: settled.velocity,
    };
}

/**
 * Each wheel's share of the car's mass. A real wheel and tire is a few percent of a car, enough
 * that spinning them up or braking them in the air tips the car a little.
 */
const wheelMassFraction = 0.015;

/**
 * The twist an airborne car's body gets back from its wheels speeding up or slowing down: throttle
 * lifts the nose and braking spinning wheels drops it. Randomation has no such effect.
 */
export function getWheelSpinReaction({
    body,
    dtSeconds,
    next,
    previous,
    shape,
    tunings,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    previous: Readonly<Record<string, Readonly<WheelState>>>;
    next: Readonly<Record<string, Readonly<WheelState>>>;
    tunings: Readonly<Record<string, Readonly<WheelTuning>>>;
    dtSeconds: number;
}>): BodyAcceleration {
    if (!dtSeconds) {
        return noAcceleration;
    }
    /** Wheel inertia relative to the car's mass, since the body's inertia is per unit mass too. */
    const spinChange = Object.keys(next).reduce((sum, position) => {
        const wheel = next[position];
        const before = previous[position];
        const tuning = tunings[position];
        if (!wheel || !before || !tuning || wheel.loose || before.loose) {
            return sum;
        }
        const radius = getWheelRadius(wheel, tuning);

        return (
            sum +
            wheelMassFraction *
                0.5 *
                radius ** 2 *
                (wheel.currentRpm - before.currentRpm) *
                degreesToRadians
        );
    }, 0);

    return {
        angular: rotateVector(
            body.rotation,
            createVector({
                x: (-spinChange / dtSeconds) * shape.inverseInertia.x,
                y: 0,
                z: 0,
            }),
        ),
        linear: zeroVector,
    };
}
