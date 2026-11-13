import {
    createArray,
    getEnumValues,
    getObjectTypedValues,
    mapObjectValues,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {type CarControls} from '@evir/driving-common/src/car-controls.js';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {type GroundPoint} from '@evir/driving-common/src/track-layout.js';
import {convertDuration, type AnyDuration} from 'date-vir';
import {type VehicleImpact, type VehicleView, type WheelView} from '../vehicle-view.js';
import {
    angularVelocityToRpm,
    getTotalRatio,
    rpmToAngularVelocity,
    splitAxleTorque,
    stepEngine,
} from './powertrain.js';
import {
    addAccelerations,
    createBodyShape,
    getAccelerationAtPoint,
    getLocalPoint,
    getPointVelocity,
    getWorldPoint,
    gravity,
    integratePosition,
    integrateVelocity,
    resolveContacts,
    type BodyAcceleration,
    type BodyContact,
    type BodyShape,
    type RigidBody,
} from './rigid-body.js';
import {getBrushTireForce} from './tire.js';
import {
    addVectors,
    clamp01,
    createAxisAngleQuaternion,
    createVector,
    dotVectors,
    getVectorLength,
    inverseRotateVector,
    lerpNumber,
    multiplyQuaternions,
    rotateVector,
    scaleVector,
    subtractVectors,
    zeroVector,
    type Quaternion,
    type Vector3,
} from './vector.js';
import {
    AbsChannels,
    Axle,
    carPresets,
    wheelAxles,
    wheelSides,
    type BodyBox,
    type CarPreset,
    type CarPresetTuning,
} from './vehicle-preset.js';
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
/** Shift runs its physics at 240 Hz; its stiff springs and tires need steps this short. */
const maxSubstepSeconds = 1 / 240;
/**
 * Newtons of air drag per squared meter per second: half the air's density times a car's drag
 * coefficient and frontal area. Shift has no air drag and leaves its body under Godot's default
 * damping, which slows a car in proportion to its speed and so caps it far below its gearing.
 */
const airDrag = 0.43;
/** Sheet metal and glass scraping on the road. */
const bodyFriction = 0.3;
/**
 * Fraction of its spin per second a car loses while its body touches something. A real car's body
 * crumples and scrapes as it rolls, which a rigid box tumbling on its corners doesn't.
 */
const crushSpinDamping = 2;
/**
 * Fraction of its sliding speed per second a car loses while its body touches something. Without
 * it, the scraping body turns its slide into more spin and the car keeps rolling over.
 */
const crushSlideDamping = 3;
/** Hits closer together than this count as one. */
const hitCooldownSeconds = 0.1;
/** Body points this far above the ground under the car can't be touching anything. */
const groundCheckReach = 3;
/** Walls farther than this from the car can't reach it. */
const wallCheckReach = 6;
const spawnClearance = 0.05;
/** A suspension ray pointing less downward than this, or meeting ground this steep, misses. */
const minRayFacing = 0.2;
/** Same as Shift's airborne wheel drag, Newton meters per radian per second. */
const airborneWheelDrag = 0.001;
/** Below this many meters per second, the automatic gearbox may swap between drive and reverse. */
const directionChangeSpeed = 0.5;
/** Fraction of the redline the automatic gearbox shifts up at. */
const upshiftFraction = 0.9;
/** Fraction of the redline the automatic gearbox shifts down below. */
const downshiftFraction = 0.4;
/** Fraction of the redline above idle at which the automatic clutch is fully engaged. */
const launchFraction = 0.25;
/** RPM below idle at which the idle governor is at full throttle. */
const idleGovernorRange = 200;
/** In order, the gearbox's reverse and neutral slots. See `DrivetrainTuning.gears`. */
const reverseGearIndex = 0;
const neutralGearIndex = 1;
const firstGearIndex = 2;

/** Which wheels share one ABS valve. */
const absChannelWheels: Readonly<Record<AbsChannels, ReadonlyArray<ReadonlyArray<WheelPosition>>>> =
    {
        [AbsChannels.Two]: [
            [
                WheelPosition.FrontLeft,
                WheelPosition.FrontRight,
            ],
            [
                WheelPosition.RearLeft,
                WheelPosition.RearRight,
            ],
        ],
        [AbsChannels.Three]: [
            [
                WheelPosition.FrontLeft,
            ],
            [
                WheelPosition.FrontRight,
            ],
            [
                WheelPosition.RearLeft,
                WheelPosition.RearRight,
            ],
        ],
        [AbsChannels.Four]: getEnumValues(WheelPosition).map((position) => {
            return [
                position,
            ];
        }),
    };

/** The driver's manual shifting. */
export type ShiftRequest = {
    isManual: boolean;
    /** 1 to shift up a gear this step, -1 to shift down, 0 to hold. Only read while manual. */
    gearChange: number;
    /** From 0 released to 1 fully pressed. Only read while manual. */
    clutchPedal: number;
};

/** The driver's inputs for one frame. */
export type VehicleInputs = CarControls & PartialWithUndefined<ShiftRequest>;

/** Where a wheel's suspension ray meets the ground. */
export type WheelContact = {
    point: Vector3;
    /** Out of the ground. */
    normal: Vector3;
    /** Meters the spring is squeezed. */
    compression: number;
};

export type WheelState = {
    /** Radians per second, positive rolling forward. */
    angularVelocity: number;
    /** Radians the wheel has rolled, for drawing it. */
    spinAngle: number;
    /** Radians, positive toward the car's left. */
    steerAngle: number;
    contact: WheelContact | undefined;
    slipRatio: number;
    /** See `TireForce.saturation`. */
    saturation: number;
    /** Fraction of the brake pedal that reaches this wheel through ABS. */
    absPressure: number;
    isAbsActive: boolean;
};

/** The physics' whole state, in the scene's world coordinates. */
export type VehicleSimulation = {
    preset: CarPreset;
    shape: BodyShape;
    body: RigidBody;
    wheels: Record<WheelPosition, WheelState>;
    /** Radians per second. */
    engineAngularVelocity: number;
    /** Index into `DrivetrainTuning.gears`. */
    gearIndex: number;
    /** The gear being shifted into while `shiftSeconds` counts down. */
    nextGearIndex: number;
    shiftSeconds: number;
    /** The automatic gearbox is in reverse, so throttle and brake swap. */
    isReversing: boolean;
    /** Throttle the engine got last step, after the idle governor and traction control. */
    throttle: number;
    /** Brake pedal last step, after throttle and brake swap in reverse. */
    brake: number;
    /** Fraction of the driver's throttle traction control lets through. */
    tractionFactor: number;
    isTractionControlActive: boolean;
    isCrashing: boolean;
    areHeadlightsOn: boolean;
    hitCooldownSeconds: number;
    /** How long the car has lain tipped over and nearly still. */
    stuckSeconds: number;
    /** Seconds left that the car blinks after being set back on its wheels. */
    blinkSeconds: number;
    /** Hits since the frame began. */
    impacts: VehicleImpact[];
    lastInputs: VehicleInputs;
};

const idleInputs: VehicleInputs = {
    brake: 0,
    handbrake: 0,
    steer: 0,
    throttle: 0,
};

/** Car frame point each wheel's suspension ray starts from. */
function getWheelMount({
    position,
    tuning,
}: Readonly<{
    position: WheelPosition;
    tuning: Readonly<CarPresetTuning>;
}>) {
    const axle = tuning.axles[wheelAxles[position]];

    return createVector({
        x: axle.halfTrack * wheelSides[position],
        y: axle.mountY,
        z: axle.mountZ,
    });
}

/** How high the body's origin sits above the ground with its springs fully extended. */
function getRestHeight(tuning: Readonly<CarPresetTuning>) {
    return Math.max(
        ...getObjectTypedValues(tuning.axles).map(
            (axle) => tuning.suspension.restLength - axle.mountY,
        ),
    );
}

function createWheelState(): WheelState {
    return {
        absPressure: 1,
        angularVelocity: 0,
        contact: undefined,
        isAbsActive: false,
        saturation: 0,
        slipRatio: 0,
        spinAngle: 0,
        steerAngle: 0,
    };
}

/** Builds a fresh car at rest, from its origin's spot and yaw. */
function createAtPose({
    groundHeight,
    point,
    preset,
    yaw,
}: Readonly<{
    preset: CarPreset;
    point: Readonly<GroundPoint>;
    yaw: number;
    groundHeight: number;
}>): VehicleSimulation {
    const tuning = carPresets[preset];
    const shape = createBodyShape({
        bodyBoxes: tuning.bodyBoxes,
        centerOfMassOffset: tuning.centerOfMassOffset,
    });
    const rotation = createAxisAngleQuaternion(yAxis, yaw);
    const origin = createVector({
        x: point.x,
        y: groundHeight + getRestHeight(tuning) + spawnClearance,
        z: point.z,
    });

    return {
        areHeadlightsOn: !!tuning.hasHeadlights,
        blinkSeconds: 0,
        body: {
            angularVelocity: zeroVector,
            centerOfMass: addVectors(origin, rotateVector(rotation, shape.centerOfMassOffset)),
            rotation,
            velocity: zeroVector,
        },
        brake: 0,
        engineAngularVelocity: rpmToAngularVelocity(tuning.engine.idleRpm),
        gearIndex: firstGearIndex,
        hitCooldownSeconds: 0,
        impacts: [],
        isCrashing: false,
        isReversing: false,
        isTractionControlActive: false,
        lastInputs: idleInputs,
        nextGearIndex: firstGearIndex,
        preset,
        shape,
        shiftSeconds: 0,
        stuckSeconds: 0,
        throttle: 0,
        tractionFactor: 1,
        wheels: mapObjectValues(wheelSides, () => createWheelState()),
    };
}

/**
 * A new car at rest. `point` and `heading` are in the scene's frame, where heading 0 faces +z.
 * `groundHeight` defaults to flat ground at 0.
 */
export function createVehicleSimulation({
    groundHeight = 0,
    heading,
    point,
    preset,
}: Readonly<{
    preset: CarPreset;
    point: Readonly<GroundPoint>;
    heading: number;
    groundHeight?: number | undefined;
}>): VehicleSimulation {
    return createAtPose({
        groundHeight,
        point,
        preset,
        yaw: heading,
    });
}

function getBodyOrigin(vehicle: Readonly<VehicleSimulation>) {
    return getWorldPoint({
        body: vehicle.body,
        localPoint: zeroVector,
        shape: vehicle.shape,
    });
}

function getYaw(vehicle: Readonly<VehicleSimulation>) {
    const forward = rotateVector(vehicle.body.rotation, zAxis);

    return Math.abs(forward.x) + Math.abs(forward.z) < 1e-6 ? 0 : Math.atan2(forward.x, forward.z);
}

function getGroundHeightAt(point: Readonly<Vector3>, world: Readonly<VehicleWorld>) {
    return probeGround({
        bottom: point.y,
        point,
        radius: 0.5,
        world,
    }).height;
}

/** The body's up must point less skyward than this for the car to count as tipped over. */
const minUprightUp = 0.3;
/** Meters per second below which a tipped car counts as stuck. */
const stuckSpeed = 1;
/** How long a car lies stuck on its side or roof before it's set back on its wheels. */
const recoveryDelay: AnyDuration = {
    seconds: 2,
};
/** How long a car blinks after being set back on its wheels. */
const recoveryBlink: AnyDuration = {
    seconds: 2,
};

/** Puts the car back on its wheels where it is, facing the way it was. */
export function recoverVehicle({
    vehicle,
    world,
}: Readonly<{vehicle: Readonly<VehicleSimulation>; world: Readonly<VehicleWorld>}>) {
    const origin = getBodyOrigin(vehicle);
    const fresh = createAtPose({
        groundHeight: getGroundHeightAt(
            addVectors(
                origin,
                createVector({
                    x: 0,
                    y: 2,
                    z: 0,
                }),
            ),
            world,
        ),
        point: origin,
        preset: vehicle.preset,
        yaw: getYaw(vehicle),
    });

    return {
        ...fresh,
        areHeadlightsOn: vehicle.areHeadlightsOn,
        blinkSeconds: convertDuration(recoveryBlink, {
            seconds: true,
        }).seconds,
    };
}

/**
 * Puts the driver in a parked car as they drive into it. The parked car stays where it is but turns
 * to face the way the driven car faced and takes over its motion, so the drive carries on
 * unbroken.
 */
export function takeParkedVehicle({
    driven,
    parked,
}: Readonly<{
    driven: Readonly<VehicleSimulation>;
    parked: Readonly<VehicleSimulation>;
}>) {
    return {
        ...parked,
        body: {
            ...parked.body,
            angularVelocity: driven.body.angularVelocity,
            rotation: driven.body.rotation,
            velocity: driven.body.velocity,
        },
    };
}

export function toggleHeadlights(vehicle: Readonly<VehicleSimulation>): VehicleSimulation {
    return {
        ...vehicle,
        areHeadlightsOn: !vehicle.areHeadlightsOn,
    };
}

/** A box's corners, its edge midpoints, and the center of its bottom. */
function getBoxSamplePoints(box: Readonly<BodyBox>) {
    const signs = [
        -1,
        0,
        1,
    ];

    return signs
        .flatMap((xSign) => {
            return signs.flatMap((ySign) => {
                return signs.map((zSign) => {
                    return [
                        xSign,
                        ySign,
                        zSign,
                    ];
                });
            });
        })
        .filter((offsets) => offsets.filter((sign) => sign !== 0).length >= 2 || offsets[1] === -1)
        .map(
            ([
                xSign = 0,
                ySign = 0,
                zSign = 0,
            ]) => {
                return createVector({
                    x: box.center.x + box.halfSize.x * xSign,
                    y: box.center.y + box.halfSize.y * ySign,
                    z: box.center.z + box.halfSize.z * zSign,
                });
            },
        );
}

/** Where the body itself, not its wheels, presses into the ground or a wall. */
function getBodyContacts({
    body,
    bodyBoxes,
    samplePoints,
    shape,
    world,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    bodyBoxes: ReadonlyArray<Readonly<BodyBox>>;
    samplePoints: ReadonlyArray<Readonly<Vector3>>;
    world: Readonly<VehicleWorld>;
}>): BodyContact[] {
    const groundUnderCar = getGroundHeightAt(body.centerOfMass, world);
    const pointContacts = samplePoints.flatMap((localPoint): BodyContact[] => {
        const point = getWorldPoint({
            body,
            localPoint,
            shape,
        });
        const wall = findWallPenetration({
            margin: 0,
            point,
            world,
        });
        const wallContacts: BodyContact[] = wall
            ? [
                  {
                      ...wall,
                      friction: bodyFriction,
                      point,
                  },
              ]
            : [];

        if (point.y > groundUnderCar + groundCheckReach) {
            return wallContacts;
        }

        const ground = probeGround({
            bottom: point.y,
            point,
            radius: 0.05,
            world,
        });
        const depth = (ground.height - point.y) * ground.normal.y;

        return [
            ...wallContacts,
            ...(depth > 0
                ? [
                      {
                          depth,
                          friction: bodyFriction,
                          normal: ground.normal,
                          point,
                      },
                  ]
                : []),
            ...(ground.wall
                ? [
                      {
                          depth: ground.wall.depth,
                          friction: bodyFriction,
                          normal: ground.wall.outward,
                          point,
                      },
                  ]
                : []),
        ];
    });

    return [
        ...pointContacts,
        ...getWallEdgeContacts({
            body,
            bodyBoxes,
            shape,
            world,
        }),
    ];
}

/**
 * A wall's corner can poke into the car without any of the car's own points entering the wall, so
 * this checks the wall's vertical edges against the car's boxes too.
 */
function getWallEdgeContacts({
    body,
    bodyBoxes,
    shape,
    world,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    bodyBoxes: ReadonlyArray<Readonly<BodyBox>>;
    world: Readonly<VehicleWorld>;
}>): BodyContact[] {
    return world.walls.flatMap((wall) => {
        if (
            Math.abs(wall.center.x - body.centerOfMass.x) > wall.halfSize.x + wallCheckReach ||
            Math.abs(wall.center.z - body.centerOfMass.z) > wall.halfSize.z + wallCheckReach
        ) {
            return [];
        }

        const height = Math.max(0, Math.min(wall.height, body.centerOfMass.y));

        return [
            [
                -1,
                -1,
            ],
            [
                -1,
                1,
            ],
            [
                1,
                -1,
            ],
            [
                1,
                1,
            ],
        ].flatMap(
            ([
                xSign = 0,
                zSign = 0,
            ]): BodyContact[] => {
                const point = createVector({
                    x: wall.center.x + wall.halfSize.x * xSign,
                    y: height,
                    z: wall.center.z + wall.halfSize.z * zSign,
                });
                const local = getLocalPoint({
                    body,
                    shape,
                    worldPoint: point,
                });
                const deepest = bodyBoxes
                    .map((box) => getBoxExit(box, local))
                    .reduce<
                        ReturnType<typeof getBoxExit>
                    >((best, exit) => (exit && (!best || exit.depth > best.depth) ? exit : best), undefined);

                return deepest
                    ? [
                          {
                              depth: deepest.depth,
                              friction: bodyFriction,
                              normal: scaleVector(rotateVector(body.rotation, deepest.normal), -1),
                              point,
                          },
                      ]
                    : [];
            },
        );
    });
}

/** The shortest way out of a box for a point inside it, in the box's frame. */
function getBoxExit(box: Readonly<BodyBox>, point: Readonly<Vector3>) {
    const offset = subtractVectors({
        left: point,
        right: box.center,
    });
    const exits = [
        {
            depth: box.halfSize.x - Math.abs(offset.x),
            normal: createVector({
                x: Math.sign(offset.x) || 1,
                y: 0,
                z: 0,
            }),
        },
        {
            depth: box.halfSize.y - Math.abs(offset.y),
            normal: createVector({
                x: 0,
                y: Math.sign(offset.y) || 1,
                z: 0,
            }),
        },
        {
            depth: box.halfSize.z - Math.abs(offset.z),
            normal: createVector({
                x: 0,
                y: 0,
                z: Math.sign(offset.z) || 1,
            }),
        },
    ];

    return exits.every((exit) => exit.depth > 0)
        ? exits.reduce((best, exit) => (exit.depth < best.depth ? exit : best))
        : undefined;
}

const samplePointsByPreset = mapObjectValues(carPresets, (preset, tuning) => {
    return tuning.bodyBoxes.flatMap((box) => getBoxSamplePoints(box));
});

/** One hit of the body on the ground or a wall. */
function applyHit({
    contact,
    hitVelocity,
    vehicle,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    contact: Readonly<BodyContact>;
    /** The ground's velocity relative to the car's hit point. Points into the car. */
    hitVelocity: Readonly<Vector3>;
}>): VehicleSimulation {
    const speed = getVectorLength(hitVelocity);
    const hitDirection = scaleVector(hitVelocity, 1 / speed);
    const isCrash =
        speed ** 2 > 20 &&
        dotVectors({
            left: contact.normal,
            right: hitDirection,
        }) > 0.2;
    const impact: VehicleImpact = {
        isCrash,
        normal: contact.normal,
        position: contact.point,
        speed: Math.max(
            0,
            dotVectors({
                left: hitVelocity,
                right: contact.normal,
            }),
        ),
    };

    return {
        ...vehicle,
        hitCooldownSeconds,
        impacts: [
            ...vehicle.impacts,
            impact,
        ],
        isCrashing:
            vehicle.isCrashing ||
            (isCrash && getObjectTypedValues(vehicle.wheels).every((wheel) => !wheel.contact)),
    };
}

function moveToward({
    from,
    maxDelta,
    to,
}: Readonly<{
    from: number;
    to: number;
    maxDelta: number;
}>) {
    return Math.abs(to - from) <= maxDelta ? to : from + Math.sign(to - from) * maxDelta;
}

function getGearRatio(vehicle: Readonly<VehicleSimulation>) {
    return vehicle.shiftSeconds > 0
        ? 0
        : getTotalRatio({
              gearIndex: vehicle.gearIndex,
              tuning: carPresets[vehicle.preset].drivetrain,
          });
}

function getAxleTorqueShare({
    axle,
    tuning,
}: Readonly<{
    axle: Axle;
    tuning: Readonly<CarPresetTuning>;
}>) {
    return axle === Axle.Front
        ? tuning.drivetrain.frontTorqueShare
        : 1 - tuning.drivetrain.frontTorqueShare;
}

const drivenWheelsByPreset = mapObjectValues(carPresets, (preset, tuning) => {
    return getEnumValues(WheelPosition).filter((position) => {
        return (
            getAxleTorqueShare({
                axle: wheelAxles[position],
                tuning,
            }) > 0
        );
    });
});

/**
 * What the driver's pedals and the gearbox ask of the car this step. Shift leaves the clutch and
 * every shift to the player; this drives them for a keyboard or gamepad unless `isManual`.
 */
function getDriverCommand({
    forwardSpeed,
    inputs,
    vehicle,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    inputs: Readonly<VehicleInputs>;
    forwardSpeed: number;
}>) {
    const tuning = carPresets[vehicle.preset];
    const isManual = !!inputs.isManual;
    const isStopped = Math.abs(forwardSpeed) < directionChangeSpeed;
    const isReversing = isManual
        ? vehicle.gearIndex === reverseGearIndex
        : isStopped
          ? vehicle.isReversing
              ? inputs.throttle <= inputs.brake
              : inputs.brake > inputs.throttle
          : vehicle.isReversing;
    const isSwapped = !isManual && isReversing;
    const engineRpm = angularVelocityToRpm(vehicle.engineAngularVelocity);
    const drivenWheels = drivenWheelsByPreset[vehicle.preset];
    /**
     * Spinning wheels alone would upshift, and the open clutch mid-shift lets the wheels fall back
     * to road speed, which downshifts again, so the gearbox never stops shifting.
     */
    const drivenWheelRpm = angularVelocityToRpm(
        Math.min(
            drivenWheels.reduce(
                (sum, position) => sum + vehicle.wheels[position].angularVelocity,
                0,
            ) / drivenWheels.length,
            Math.max(0, forwardSpeed) / tuning.tire.radius,
        ) *
            getTotalRatio({
                gearIndex: vehicle.gearIndex,
                tuning: tuning.drivetrain,
            }),
    );
    const topGearIndex = tuning.drivetrain.gears.length - 1;
    const plannedGear = vehicle.shiftSeconds > 0 ? vehicle.nextGearIndex : vehicle.gearIndex;
    const automaticGear = isReversing
        ? reverseGearIndex
        : vehicle.gearIndex < firstGearIndex
          ? firstGearIndex
          : drivenWheelRpm > tuning.engine.maxRpm * upshiftFraction &&
              vehicle.gearIndex < topGearIndex
            ? vehicle.gearIndex + 1
            : drivenWheelRpm < tuning.engine.maxRpm * downshiftFraction &&
                vehicle.gearIndex > firstGearIndex
              ? vehicle.gearIndex - 1
              : vehicle.gearIndex;

    return {
        brake: clamp01(isSwapped ? inputs.throttle : inputs.brake),
        clutchEngagement: Math.min(
            isManual ? 1 - clamp01(inputs.clutchPedal ?? 0) : 1,
            clamp01((engineRpm - tuning.engine.idleRpm) / (tuning.engine.maxRpm * launchFraction)),
        ),
        gear: isManual
            ? Math.max(0, Math.min(topGearIndex, plannedGear + Math.sign(inputs.gearChange ?? 0)))
            : automaticGear,
        isReversing,
        throttle: clamp01(isSwapped ? inputs.brake : inputs.throttle),
    };
}

/** Same as Shift's `Transmission.process`, but every shift takes the same time. */
function stepGearbox({
    dtSeconds,
    requestedGear,
    vehicle,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    requestedGear: number;
    dtSeconds: number;
}>): Pick<VehicleSimulation, 'gearIndex' | 'nextGearIndex' | 'shiftSeconds'> {
    if (vehicle.shiftSeconds > 0) {
        const shiftSeconds = Math.max(0, vehicle.shiftSeconds - dtSeconds);

        return {
            gearIndex: shiftSeconds ? vehicle.gearIndex : vehicle.nextGearIndex,
            nextGearIndex: vehicle.nextGearIndex,
            shiftSeconds,
        };
    }

    return requestedGear === vehicle.gearIndex
        ? {
              gearIndex: vehicle.gearIndex,
              nextGearIndex: vehicle.gearIndex,
              shiftSeconds: 0,
          }
        : {
              gearIndex: vehicle.gearIndex,
              nextGearIndex: requestedGear,
              shiftSeconds: convertDuration(carPresets[vehicle.preset].drivetrain.shiftDuration, {
                  seconds: true,
              }).seconds,
          };
}

/** Where a ray from `mount` along `-up` meets the ground under `probePoint`, as a plane. */
function intersectGround({
    mount,
    probePoint,
    radius,
    restLength,
    up,
    world,
}: Readonly<{
    mount: Readonly<Vector3>;
    up: Readonly<Vector3>;
    probePoint: Readonly<Vector3>;
    restLength: number;
    radius: number;
    world: Readonly<VehicleWorld>;
}>) {
    const ground = probeGround({
        bottom: mount.y - restLength * up.y,
        point: probePoint,
        radius,
        world,
    });
    const facing = dotVectors({
        left: ground.normal,
        right: up,
    });
    const distance =
        dotVectors({
            left: ground.normal,
            right: createVector({
                x: mount.x - probePoint.x,
                y: mount.y - ground.height,
                z: mount.z - probePoint.z,
            }),
        }) / facing;

    return facing < minRayFacing || distance > restLength
        ? undefined
        : {
              distance,
              normal: ground.normal,
              point: subtractVectors({
                  left: mount,
                  right: scaleVector(up, distance),
              }),
          };
}

/**
 * Same as Shift's suspension `RayCast3D`: straight down the car's own up axis from the mount, as
 * long as the spring fully extended. The ground is probed at the ray's end, then again where it
 * hits, so slopes and steps land the hit in the right place.
 */
function castSuspensionRay(params: Readonly<Parameters<typeof intersectGround>[0]>) {
    const first = intersectGround({
        ...params,
        probePoint: subtractVectors({
            left: params.mount,
            right: scaleVector(params.up, params.restLength),
        }),
    });

    return first
        ? intersectGround({
              ...params,
              probePoint: first.point,
          })
        : undefined;
}

/** Same as Shift's `Steering.process` with Ackermann geometry, steering the front wheels. */
function getSteerTargets({
    forwardSpeed,
    steer,
    tuning,
}: Readonly<{
    /** From -1 for full left to 1 for full right. */
    steer: number;
    forwardSpeed: number;
    tuning: Readonly<CarPresetTuning>;
}>): Record<WheelPosition, number> {
    const steering = tuning.steering;
    /** Shift's steering input is positive to the left. */
    const lock =
        (Math.max(
            -steering.maxAngle,
            Math.min(steering.maxAngle, (-steer * steering.wheelTravel) / steering.ratio),
        ) *
            (Math.PI / 180)) /
        (1 + steering.speedFactor * Math.abs(forwardSpeed));
    const front = tuning.axles[Axle.Front];
    const wheelBase = front.mountZ - tuning.axles[Axle.Rear].mountZ;
    const turnRadius = wheelBase / Math.tan(Math.max(Math.abs(lock), 1e-6));
    const inner = Math.atan(wheelBase / Math.max(turnRadius - front.halfTrack, 0.01));
    const outer = Math.atan(wheelBase / (turnRadius + front.halfTrack));
    /**
     * Shift gives the wheel on the outside of the turn the inner wheel's sharper angle. The inner
     * wheel follows the tighter circle, so it gets the sharper angle here.
     */
    const leftAngle = lerpNumber({
        amount: steering.ackermannFactor,
        from: Math.abs(lock),
        to: lock > 0 ? inner : outer,
    });
    const rightAngle = lerpNumber({
        amount: steering.ackermannFactor,
        from: Math.abs(lock),
        to: lock > 0 ? outer : inner,
    });

    return {
        [WheelPosition.FrontLeft]: Math.sign(lock) * leftAngle,
        [WheelPosition.FrontRight]: Math.sign(lock) * rightAngle,
        [WheelPosition.RearLeft]: 0,
        [WheelPosition.RearRight]: 0,
    };
}

/** A wheel's turned axes and the speeds its tire reads. */
function getWheelFrame({
    body,
    mount,
    steerAngle,
}: Readonly<{
    body: Readonly<RigidBody>;
    mount: Readonly<Vector3>;
    steerAngle: number;
}>) {
    const rotation = multiplyQuaternions({
        left: body.rotation,
        right: createAxisAngleQuaternion(yAxis, steerAngle),
    });
    const forward = rotateVector(rotation, zAxis);
    /** Shift's tire axis is Godot's +x, the wheel's right, which is -x in the car frame here. */
    const right = rotateVector(rotation, scaleVector(xAxis, -1));
    const velocity = getPointVelocity(body, mount);

    return {
        forward,
        forwardSpeed: dotVectors({
            left: velocity,
            right: forward,
        }),
        right,
        rotation,
        sideSpeed: dotVectors({
            left: velocity,
            right,
        }),
    };
}

/** Same as Shift's ABS: each channel lets off the brakes while its worst wheel locks. */
function stepAbs({
    dtSeconds,
    tuning,
    wheels,
}: Readonly<{
    wheels: Readonly<Record<WheelPosition, Readonly<WheelState>>>;
    tuning: Readonly<CarPresetTuning>;
    dtSeconds: number;
}>): Record<WheelPosition, WheelState> {
    const abs = tuning.abs;

    if (!abs) {
        return wheels;
    }

    return absChannelWheels[abs.channels].reduce<Record<WheelPosition, WheelState>>(
        (current, channel) => {
            const lead = wheels[channel[0] ?? WheelPosition.FrontLeft];
            /**
             * Shift picks the channel's highest slip and flips its thresholds, so ABS never lets
             * off. Locking is negative slip, so the most negative wheel decides here.
             */
            const slip = Math.min(
                0,
                ...channel.flatMap((position) => {
                    return wheels[position].contact ? [wheels[position].slipRatio] : [];
                }),
            );
            const isAbsActive =
                slip < abs.slipApply || (slip <= abs.slipRelease && lead.isAbsActive);
            const absPressure = isAbsActive
                ? moveToward({
                      from: lead.absPressure,
                      maxDelta: abs.releaseRate * dtSeconds,
                      to: abs.pedalTarget,
                  })
                : moveToward({
                      from: lead.absPressure,
                      maxDelta: abs.applyRate * dtSeconds,
                      to: 1,
                  });

            return channel.reduce((next, position) => {
                return {
                    ...next,
                    [position]: {
                        ...next[position],
                        absPressure,
                        isAbsActive,
                    },
                };
            }, current);
        },
        {
            ...wheels,
        },
    );
}

/**
 * Same as Shift's `WORST_SLIP` traction control. Shift scales wheel torque after the wheels have
 * already spun up with it, so its traction control never acts; this cuts the throttle instead.
 */
function stepTractionControl({
    dtSeconds,
    vehicle,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    dtSeconds: number;
}>): Pick<VehicleSimulation, 'tractionFactor' | 'isTractionControlActive'> {
    const tuning = carPresets[vehicle.preset].tractionControl;

    if (!tuning) {
        return {
            isTractionControlActive: false,
            tractionFactor: 1,
        };
    }

    const worstSlip = Math.max(
        0,
        ...drivenWheelsByPreset[vehicle.preset].flatMap((position) => {
            return vehicle.wheels[position].contact ? [vehicle.wheels[position].slipRatio] : [];
        }),
    );
    const isTractionControlActive =
        worstSlip > tuning.slipEngage ||
        (worstSlip >= tuning.slipRecover && vehicle.isTractionControlActive);

    return {
        isTractionControlActive,
        tractionFactor: isTractionControlActive
            ? moveToward({
                  from: vehicle.tractionFactor,
                  maxDelta: tuning.cutRate * dtSeconds,
                  to: tuning.torqueFactor,
              })
            : moveToward({
                  from: vehicle.tractionFactor,
                  maxDelta: tuning.restoreRate * dtSeconds,
                  to: 1,
              }),
    };
}

/** One wheel's suspension, before the anti-roll bars. */
type WheelSuspension = {
    mount: Vector3;
    contact: WheelContact | undefined;
};

/**
 * Same as Shift's `Suspension.process`: a spring sized from the wheel's share of the weight and its
 * ride frequency, a damper sized from the damper ratio, and the axle's anti-roll bar. Returns
 * Newtons up the car's own axis.
 */
function getSpringForce({
    antiRoll,
    body,
    position,
    suspension,
    tuning,
    up,
}: Readonly<{
    body: Readonly<RigidBody>;
    position: WheelPosition;
    suspension: Readonly<WheelSuspension>;
    antiRoll: number;
    up: Readonly<Vector3>;
    tuning: Readonly<CarPresetTuning>;
}>) {
    if (!suspension.contact) {
        return 0;
    }

    const axle = tuning.axles[wheelAxles[position]];
    const wheelMass = (tuning.mass * axle.weightShare) / 2;
    const stiffness = wheelMass * (2 * Math.PI * axle.rideFrequency) ** 2;
    const damping = tuning.suspension.damperRatio * 2 * Math.sqrt(stiffness * wheelMass);
    const speed = dotVectors({
        left: getPointVelocity(body, suspension.contact.point),
        right: up,
    });
    const damperForce =
        damping * Math.abs(speed) ** tuning.suspension.velocityExponent * Math.sign(speed);

    /** Shift lets the spring pull the car down into the ground; a tire can only push. */
    return Math.max(0, stiffness * suspension.contact.compression - damperForce + antiRoll);
}

/**
 * Same as Shift's anti-roll bar: each wheel pushes back by the axle's stiffness times how much more
 * it's squeezed than the other. Shift has the sign backward, so its bars add roll.
 */
function getAntiRoll({
    position,
    suspensions,
    tuning,
}: Readonly<{
    position: WheelPosition;
    suspensions: Readonly<Record<WheelPosition, Readonly<WheelSuspension>>>;
    tuning: Readonly<CarPresetTuning>;
}>) {
    const axle = wheelAxles[position];
    const opposite = getEnumValues(WheelPosition).find(
        (other) => other !== position && wheelAxles[other] === axle,
    );
    const own = suspensions[position].contact?.compression ?? 0;
    const other = opposite ? (suspensions[opposite].contact?.compression ?? 0) : own;

    return tuning.axles[axle].antiRollStiffness * (own - other);
}

/**
 * Bisection steps, each halving the range; enough to pin wheel and clutch speeds far below what
 * shows.
 */
const rootIterations = 24;

/**
 * Where an increasing function crosses zero between `low` and `high`, or the nearer end when it
 * doesn't cross there.
 */
function findIncreasingRoot({
    getValue,
    high,
    low,
}: Readonly<{
    getValue: (input: number) => number;
    low: number;
    high: number;
}>) {
    const range = createArray(rootIterations, () => undefined).reduce(
        (current) => {
            const middle = (current.low + current.high) / 2;

            return getValue(middle) > 0
                ? {
                      high: middle,
                      low: current.low,
                  }
                : {
                      high: current.high,
                      low: middle,
                  };
        },
        {
            high,
            low,
        },
    );

    return (range.low + range.high) / 2;
}

/**
 * Same as Shift's wheel spin step, solved implicitly: the tire's force is taken at the wheel's new
 * spin. Shift steps it explicitly, which a stiff tire on a light wheel only survives at its own 240
 * Hz, and which overshoots across the tire's grip peak. Brakes and rolling resistance hold a
 * stopped wheel rather than spin it backward.
 */
function spinWheel({
    angularVelocity,
    driveTorque,
    dtSeconds,
    getLongitudinalForce,
    maxForce,
    resistTorque,
    tire,
}: Readonly<{
    angularVelocity: number;
    driveTorque: number;
    resistTorque: number;
    /** `undefined` while the wheel is in the air. */
    getLongitudinalForce: ((angularVelocity: number) => number) | undefined;
    /** The most force the tire can push with. */
    maxForce: number;
    tire: Readonly<CarPresetTuning['tire']>;
    dtSeconds: number;
}>) {
    const reach =
        (dtSeconds * (Math.abs(driveTorque) + resistTorque + tire.radius * maxForce)) /
            tire.inertia +
        1e-6;

    return findIncreasingRoot({
        getValue(next) {
            return (
                tire.inertia * (next - angularVelocity) +
                dtSeconds *
                    (tire.radius * (getLongitudinalForce?.(next) ?? 0) +
                        resistTorque * Math.sign(next) -
                        driveTorque)
            );
        },
        high: angularVelocity + reach,
        low: angularVelocity - reach,
    });
}

/** Moves the car through one short physics step, in Shift's order. */
function substep({
    dtSeconds,
    inputs,
    vehicle,
    world,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    inputs: Readonly<VehicleInputs>;
    dtSeconds: number;
    world: Readonly<VehicleWorld>;
}>): VehicleSimulation {
    const tuning = carPresets[vehicle.preset];
    const body = vehicle.body;
    const up = rotateVector(body.rotation, yAxis);
    const forwardSpeed = inverseRotateVector(body.rotation, body.velocity).z;
    const driver = getDriverCommand({
        forwardSpeed,
        inputs,
        vehicle,
    });
    const gearbox = stepGearbox({
        dtSeconds,
        requestedGear: driver.gear,
        vehicle,
    });
    const ratio = getGearRatio({
        ...vehicle,
        ...gearbox,
    });
    const suspensions = mapObjectValues(vehicle.wheels, (position): WheelSuspension => {
        const mount = getWorldPoint({
            body,
            localPoint: getWheelMount({
                position,
                tuning,
            }),
            shape: vehicle.shape,
        });
        const hit =
            up.y < minRayFacing
                ? undefined
                : castSuspensionRay({
                      mount,
                      probePoint: mount,
                      radius: tuning.tire.radius,
                      restLength: tuning.suspension.restLength,
                      up,
                      world,
                  });

        return {
            contact: hit
                ? {
                      compression: Math.max(
                          0,
                          Math.min(
                              tuning.suspension.maxCompression,
                              tuning.suspension.restLength - hit.distance,
                          ),
                      ),
                      normal: hit.normal,
                      point: hit.point,
                  }
                : undefined,
            mount,
        };
    });
    const steerTargets = getSteerTargets({
        forwardSpeed,
        steer: inputs.steer,
        tuning,
    });
    const wheelBrakeTorque = tuning.maxBrakeTorque / getEnumValues(WheelPosition).length;
    const axleTires = mapObjectValues(tuning.axles, (axle, axleTuning) => {
        return {
            ...tuning.tire,
            grip: tuning.tire.grip * axleTuning.tireScale,
            lateralStiffness: tuning.tire.lateralStiffness * axleTuning.tireScale,
        };
    });
    const axleBrakeTorque: Readonly<Record<Axle, number>> = {
        [Axle.Front]: (tuning.maxBrakeTorque * tuning.frontBrakeShare) / 2,
        [Axle.Rear]: (tuning.maxBrakeTorque * (1 - tuning.frontBrakeShare)) / 2,
    };
    const tireInputs = mapObjectValues(vehicle.wheels, (position, wheel) => {
        const suspension = suspensions[position];
        const steerAngle = moveToward({
            from: wheel.steerAngle,
            maxDelta: tuning.steering.turnSpeed * dtSeconds,
            to: steerTargets[position],
        });
        const frame = getWheelFrame({
            body,
            mount: suspension.mount,
            steerAngle,
        });
        const load = getSpringForce({
            antiRoll: getAntiRoll({
                position,
                suspensions,
                tuning,
            }),
            body,
            position,
            suspension,
            tuning,
            up,
        });

        return {
            frame,
            getTireForce: suspension.contact
                ? (angularVelocity: number) => {
                      return getBrushTireForce({
                          forwardSpeed: frame.forwardSpeed,
                          load,
                          sideSpeed: frame.sideSpeed,
                          treadSpeed: angularVelocity * tuning.tire.radius,
                          tuning: axleTires[wheelAxles[position]],
                      });
                  }
                : undefined,
            load,
            resistTorque:
                axleBrakeTorque[wheelAxles[position]] * driver.brake * wheel.absPressure +
                (wheelAxles[position] === Axle.Rear ? wheelBrakeTorque * inputs.handbrake : 0) +
                (suspension.contact
                    ? tuning.tire.rollingResistance * load * tuning.tire.radius
                    : airborneWheelDrag * Math.abs(wheel.angularVelocity)),
            steerAngle,
        };
    });
    const drivenWheels = drivenWheelsByPreset[vehicle.preset];
    const engineRpm = angularVelocityToRpm(vehicle.engineAngularVelocity);
    const traction = stepTractionControl({
        dtSeconds,
        vehicle,
    });
    const throttle = Math.max(
        driver.throttle * traction.tractionFactor,
        clamp01((tuning.engine.idleRpm - engineRpm) / idleGovernorRange),
    );
    /** Each wheel's new spin with `wheelTorque` reaching the driven axles. */
    function getWheelSpins(wheelTorque: number) {
        const driveTorques = getEnumValues(Axle).reduce<Partial<Record<WheelPosition, number>>>(
            (torques, axle) => {
                const [
                    left,
                    right,
                ] = getEnumValues(WheelPosition).filter(
                    (position) => wheelAxles[position] === axle,
                );
                if (!left || !right) {
                    return torques;
                }
                const [
                    leftTorque,
                    rightTorque,
                ] = splitAxleTorque({
                    kind: tuning.axles[axle].differential,
                    slips: [
                        vehicle.wheels[left].slipRatio,
                        vehicle.wheels[right].slipRatio,
                    ],
                    torque:
                        wheelTorque *
                        getAxleTorqueShare({
                            axle,
                            tuning,
                        }),
                    tuning: tuning.drivetrain,
                });

                return {
                    ...torques,
                    [left]: leftTorque,
                    [right]: rightTorque,
                };
            },
            {},
        );

        return mapObjectValues(vehicle.wheels, (position, wheel) => {
            const getTireForce = tireInputs[position].getTireForce;

            return spinWheel({
                angularVelocity: wheel.angularVelocity,
                driveTorque: driveTorques[position] ?? 0,
                dtSeconds,
                getLongitudinalForce: getTireForce
                    ? (spin) => getTireForce(spin).longitudinal
                    : undefined,
                maxForce: getTireForce
                    ? axleTires[wheelAxles[position]].grip * tireInputs[position].load
                    : 0,
                resistTorque: tireInputs[position].resistTorque,
                tire: tuning.tire,
            });
        });
    }
    function getEngineSpin(clutchTorque: number) {
        return stepEngine({
            clutchTorque,
            dtSeconds,
            engineAngularVelocity: vehicle.engineAngularVelocity,
            throttle,
            tuning: tuning.engine,
        });
    }
    function getDrivenSpin(clutchTorque: number) {
        const spins = getWheelSpins(clutchTorque * ratio * tuning.drivetrain.efficiency);

        return (
            (ratio * drivenWheels.reduce((sum, position) => sum + spins[position], 0)) /
            drivenWheels.length
        );
    }
    const maxClutchTorque =
        gearbox.shiftSeconds > 0 || Math.abs(ratio) < 1e-4
            ? 0
            : tuning.drivetrain.maxClutchTorque * driver.clutchEngagement;
    /**
     * Shift's `Motor.get_clutch_torque` aims to lock the engine to the wheels using the bare
     * wheels' inertia, which slips under load and overshoots once the tires let go. This finds the
     * torque that leaves both at one speed after the step, or the clutch's limit when it can't.
     */
    const clutchTorque = maxClutchTorque
        ? findIncreasingRoot({
              getValue(torque) {
                  return getDrivenSpin(torque) - getEngineSpin(torque);
              },
              high: maxClutchTorque,
              low: -maxClutchTorque,
          })
        : 0;
    const engineAngularVelocity = getEngineSpin(clutchTorque);
    const wheelSpins = getWheelSpins(clutchTorque * ratio * tuning.drivetrain.efficiency);
    const steppedWheels = mapObjectValues(vehicle.wheels, (position, wheel) => {
        const tireInput = tireInputs[position];
        const angularVelocity = wheelSpins[position];
        const tireForce = tireInput.getTireForce?.(angularVelocity);

        return {
            acceleration:
                tireForce && suspensions[position].contact
                    ? addAccelerations(
                          getAccelerationAtPoint({
                              body,
                              force: scaleVector(up, tireInput.load / tuning.mass),
                              point: suspensions[position].mount,
                              shape: vehicle.shape,
                          }),
                          getAccelerationAtPoint({
                              body,
                              force: scaleVector(
                                  addVectors(
                                      scaleVector(tireInput.frame.forward, tireForce.longitudinal),
                                      scaleVector(tireInput.frame.right, tireForce.lateral),
                                  ),
                                  1 / tuning.mass,
                              ),
                              point: suspensions[position].contact.point,
                              shape: vehicle.shape,
                          }),
                      )
                    : undefined,
            wheel: {
                ...wheel,
                angularVelocity,
                contact: suspensions[position].contact,
                saturation: tireForce?.saturation ?? 0,
                slipRatio: tireForce?.slipRatio ?? 0,
                spinAngle: (wheel.spinAngle + angularVelocity * dtSeconds) % (2 * Math.PI),
                steerAngle: tireInput.steerAngle,
            } satisfies WheelState,
        };
    });
    const wheels = stepAbs({
        dtSeconds,
        tuning,
        wheels: mapObjectValues(steppedWheels, (position, stepped) => stepped.wheel),
    });
    const accelerated = integrateVelocity({
        acceleration: addAccelerations(
            ...getObjectTypedValues(steppedWheels).flatMap((stepped) => {
                return stepped.acceleration ? [stepped.acceleration] : [];
            }),
            {
                angular: zeroVector,
                linear: addVectors(
                    createVector({
                        x: 0,
                        y: -gravity,
                        z: 0,
                    }),
                    scaleVector(
                        body.velocity,
                        (-airDrag * getVectorLength(body.velocity)) / tuning.mass,
                    ),
                ),
            } satisfies BodyAcceleration,
        ),
        body,
        dtSeconds,
    });
    const bodyContacts = getBodyContacts({
        body: accelerated,
        bodyBoxes: tuning.bodyBoxes,
        samplePoints: samplePointsByPreset[vehicle.preset],
        shape: vehicle.shape,
        world,
    });
    const resolved = resolveContacts({
        body: bodyContacts.length
            ? {
                  ...accelerated,
                  angularVelocity: scaleVector(
                      accelerated.angularVelocity,
                      Math.exp(-crushSpinDamping * dtSeconds),
                  ),
                  velocity: {
                      ...accelerated.velocity,
                      x: accelerated.velocity.x * Math.exp(-crushSlideDamping * dtSeconds),
                      z: accelerated.velocity.z * Math.exp(-crushSlideDamping * dtSeconds),
                  },
              }
            : accelerated,
        contacts: bodyContacts,
        shape: vehicle.shape,
    });
    const hardest = bodyContacts.reduce<{contact: BodyContact; velocity: Vector3} | undefined>(
        (best, contact) => {
            const velocity = scaleVector(getPointVelocity(accelerated, contact.point), -1);
            return dotVectors({
                left: velocity,
                right: contact.normal,
            }) > 1 &&
                (!best || getVectorLength(velocity) > getVectorLength(best.velocity))
                ? {
                      contact,
                      velocity,
                  }
                : best;
        },
        undefined,
    );
    const moved: VehicleSimulation = {
        ...vehicle,
        ...gearbox,
        ...traction,
        body: integratePosition({
            body: resolved,
            dtSeconds,
        }),
        brake: driver.brake,
        engineAngularVelocity,
        hitCooldownSeconds: Math.max(0, vehicle.hitCooldownSeconds - dtSeconds),
        isReversing: driver.isReversing,
        throttle,
        wheels,
    };
    const hit =
        hardest && moved.hitCooldownSeconds === 0 && getVectorLength(hardest.velocity) ** 2 > 1
            ? applyHit({
                  contact: hardest.contact,
                  hitVelocity: hardest.velocity,
                  vehicle: moved,
              })
            : moved;

    return {
        ...hit,
        isCrashing: hit.isCrashing && getGroundedCount(hit) === 0,
    };
}

function getGroundedCount(vehicle: Readonly<VehicleSimulation>) {
    return getObjectTypedValues(vehicle.wheels).filter((wheel) => wheel.contact).length;
}

/** Advances the car by one frame. Impacts reset at the start of each frame. */
export function stepVehicleSimulation({
    dtSeconds,
    inputs,
    vehicle,
    world,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    inputs: Readonly<VehicleInputs>;
    dtSeconds: number;
    world: Readonly<VehicleWorld>;
}>): VehicleSimulation {
    const substepCount = Math.max(1, Math.ceil(dtSeconds / maxSubstepSeconds - 1e-9));
    const stepped = createArray(substepCount, () => undefined).reduce<VehicleSimulation>(
        (current, unused, index) => {
            return substep({
                dtSeconds: dtSeconds / substepCount,
                /** A shift press is one gear, not one per substep. */
                inputs: index
                    ? {
                          ...inputs,
                          gearChange: 0,
                      }
                    : inputs,
                vehicle: current,
                world,
            });
        },
        {
            ...vehicle,
            impacts: [],
            lastInputs: inputs,
        },
    );
    const isStuck =
        rotateVector(stepped.body.rotation, yAxis).y < minUprightUp &&
        getVectorLength(stepped.body.velocity) < stuckSpeed;
    const stuckSeconds = isStuck ? stepped.stuckSeconds + dtSeconds : 0;

    return stuckSeconds <
        convertDuration(recoveryDelay, {
            seconds: true,
        }).seconds
        ? {
              ...stepped,
              blinkSeconds: Math.max(0, stepped.blinkSeconds - dtSeconds),
              stuckSeconds,
          }
        : recoverVehicle({
              vehicle: stepped,
              world,
          });
}

function getGearLabel(gearIndex: number) {
    return gearIndex === reverseGearIndex
        ? 'R'
        : gearIndex === neutralGearIndex
          ? 'N'
          : `${gearIndex - firstGearIndex + 1}`;
}

function getWheelViews(vehicle: Readonly<VehicleSimulation>): Record<WheelPosition, WheelView> {
    const tuning = carPresets[vehicle.preset];
    const up = rotateVector(vehicle.body.rotation, yAxis);

    return mapObjectValues(vehicle.wheels, (position, wheel) => {
        const mount = getWorldPoint({
            body: vehicle.body,
            localPoint: getWheelMount({
                position,
                tuning,
            }),
            shape: vehicle.shape,
        });
        const contactPoint =
            wheel.contact?.point ??
            subtractVectors({
                left: mount,
                right: scaleVector(up, tuning.suspension.restLength),
            });
        const rotation: Quaternion = multiplyQuaternions({
            left: multiplyQuaternions({
                left: vehicle.body.rotation,
                right: createAxisAngleQuaternion(yAxis, wheel.steerAngle),
            }),
            right: createAxisAngleQuaternion(xAxis, wheel.spinAngle),
        });

        return {
            compression: wheel.contact
                ? wheel.contact.compression / tuning.suspension.maxCompression
                : 0,
            contactNormal: wheel.contact?.normal ?? yAxis,
            contactPoint,
            isGrounded: !!wheel.contact,
            position: addVectors(contactPoint, scaleVector(up, tuning.tire.radius)),
            radius: tuning.tire.radius,
            rimRadius: tuning.tire.rimRadius,
            rotation,
            slip: wheel.saturation,
            width: tuning.tire.width,
        };
    });
}

/** Everything the scene, sound, and HUD read. */
export function getVehicleView(vehicle: Readonly<VehicleSimulation>): VehicleView {
    const tuning = carPresets[vehicle.preset];
    const engineRpm = angularVelocityToRpm(vehicle.engineAngularVelocity);

    return {
        blinkSeconds: vehicle.blinkSeconds,
        boost: {
            isBoosting: false,
        },
        engine: {
            gearLabel: getGearLabel(vehicle.gearIndex),
            isShifting: vehicle.shiftSeconds > 0,
            kiloRpm: engineRpm * 0.001,
            pitch: clamp01(engineRpm / tuning.engine.maxRpm),
            shiftModeLabel: vehicle.lastInputs.isManual ? 'M' : 'A',
            throttle: clamp01(vehicle.throttle),
        },
        forwardSpeed: inverseRotateVector(vehicle.body.rotation, vehicle.body.velocity).z,
        groundedWheelCount: getGroundedCount(vehicle),
        impacts: vehicle.impacts,
        isCrashing: vehicle.isCrashing,
        lights: {
            areHeadlightsOn: vehicle.areHeadlightsOn,
            brake: vehicle.brake,
            isReversing: vehicle.gearIndex === reverseGearIndex,
        },
        position: getBodyOrigin(vehicle),
        preset: vehicle.preset,
        rotation: vehicle.body.rotation,
        velocity: vehicle.body.velocity,
        wheels: getWheelViews(vehicle),
    };
}
