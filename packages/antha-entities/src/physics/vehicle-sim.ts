import {
    createArray,
    getEnumValues,
    mapObjectValues,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {type CarControls} from '@evir/driving-common/src/car-controls.js';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {type GroundPoint} from '@evir/driving-common/src/track-layout.js';
import {convertDuration, type AnyDuration} from 'date-vir';
import {type VehicleImpact, type VehicleView, type WheelView} from '../vehicle-view.js';
import {evaluateCurve, getCurveEndTime} from './animation-curve.js';
import {averageNormals, getAssistAcceleration, getFlipAcceleration} from './assist.js';
import {
    createMotorState,
    createTransmissionState,
    getGearLabel,
    stepEngineRpm,
    stepGasMotor,
    stepTransmission,
    type DriveSituation,
    type MotorState,
    type ShiftRequest,
    type TransmissionState,
} from './drivetrain.js';
import {createHoverPadState, getHoverDrive, stepHoverPad, type HoverPadState} from './hover.js';
import {
    addAccelerations,
    createBodyShape,
    getWorldPoint,
    gravity,
    integratePosition,
    integrateVelocity,
    resolveContacts,
    type BodyContact,
    type BodyShape,
    type RigidBody,
} from './rigid-body.js';
import {getSkirtAcceleration} from './skirt.js';
import {
    addVectors,
    clamp01,
    createAxisAngleQuaternion,
    createVector,
    dotVectors,
    getVectorLength,
    inverseRotateVector,
    lerpNumber,
    mirrorQuaternion,
    mirrorVector,
    rotateVector,
    scaleVector,
    subtractVectors,
    zeroVector,
    type Vector3,
} from './vector.js';
import {
    carPresets,
    TransmissionKind,
    VehicleKind,
    type CarPreset,
    type CarPresetTuning,
    type HoverTuning,
    type WheeledTuning,
} from './vehicle-preset.js';
import {probeGround, type VehicleWorld} from './vehicle-world.js';
import {
    createWheelState,
    getWheelPose,
    getWheelSpinReaction,
    stepWheel,
    type WheelState,
} from './wheel.js';

const yAxis = createVector({
    x: 0,
    y: 1,
    z: 0,
});
const maxSubstepSeconds = 0.01;
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
/** Hits closer together than this count as one, like Randomation's `VehicleDamage`. */
const hitCooldownSeconds = 0.1;
const spawnClearance = 0.05;
const hoverPadRadius = 0.3;

const wheelSides: Readonly<Record<WheelPosition, number>> = {
    [WheelPosition.FrontLeft]: -1,
    [WheelPosition.FrontRight]: 1,
    [WheelPosition.RearLeft]: -1,
    [WheelPosition.RearRight]: 1,
};

/** The driver's inputs for one frame. */
export type VehicleInputs = CarControls & {
    isBoostHeld: boolean;
    /** From -1 to 1. Positive raises the right side. */
    roll: number;
} & PartialWithUndefined<ShiftRequest>;

/** The physics' whole state. Everything is in the physics' mirrored frame; see `mirrorVector`. */
export type VehicleSimulation = {
    preset: CarPreset;
    shape: BodyShape;
    body: RigidBody;
    wheels: Record<WheelPosition, WheelState>;
    pads: Record<WheelPosition, HoverPadState>;
    motor: MotorState;
    /** The engine's own speed, which the tachometer shows. See {@link stepEngineRpm}. */
    engineRpm: number;
    transmission: TransmissionState;
    hover: Pick<ReturnType<typeof getHoverDrive>, 'pitch' | 'throttle'>;
    isBoosting: boolean;
    burnout: number;
    isReversing: boolean;
    areHeadlightsOn: boolean;
    hitCooldownSeconds: number;
    /** How long the car has lain tipped over and nearly still. */
    stuckSeconds: number;
    /** Seconds left that the car blinks after being set back on its wheels. */
    blinkSeconds: number;
    /** Hits since the frame began, already in the scene's frame. */
    impacts: VehicleImpact[];
    lastInputs: VehicleInputs;
};

const idleInputs: VehicleInputs = {
    brake: 0,
    handbrake: 0,
    isBoostHeld: false,
    roll: 0,
    steer: 0,
    throttle: 0,
};

/** How high the body's origin sits above the ground when the car is resting on it. */
function getRestHeight(tuning: Readonly<CarPresetTuning>) {
    return tuning.vehicle.kind === VehicleKind.Hover
        ? Math.max(
              ...Object.values(tuning.vehicle.pads).map(
                  (pad) => (tuning.vehicle as HoverTuning).hoverDistance * 0.6 - pad.pivot.y,
              ),
          )
        : Math.max(
              ...Object.values(tuning.vehicle.wheels).map(
                  (wheel) => wheel.tireRadius + wheel.suspensionDistance - wheel.pivot.y,
              ),
          );
}

/** Builds a fresh car at rest, from its origin's spot and yaw in the physics' frame. */
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
    const centerOfMass = addVectors(origin, rotateVector(rotation, shape.centerOfMassOffset));

    return {
        areHeadlightsOn: !!tuning.hasHeadlights,
        body: {
            angularVelocity: zeroVector,
            centerOfMass,
            rotation,
            velocity: zeroVector,
        },
        blinkSeconds: 0,
        burnout: 0,
        engineRpm: 0,
        hitCooldownSeconds: 0,
        stuckSeconds: 0,
        hover: {
            pitch: 0,
            throttle: 0,
        },
        impacts: [],
        isBoosting: false,
        isReversing: false,
        lastInputs: idleInputs,
        motor: createMotorState(),
        pads: mapObjectValues(wheelSides, () => createHoverPadState()),
        preset,
        shape,
        transmission:
            tuning.vehicle.kind === VehicleKind.Wheeled
                ? createTransmissionState(tuning.vehicle.transmission)
                : {
                      clutch: 1,
                      gearIndex: 0,
                      ratio: 1,
                      shiftSeconds: 0,
                  },
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
    const sceneForward = rotateVector(createAxisAngleQuaternion(yAxis, heading), {
        x: 0,
        y: 0,
        z: 1,
    });
    const forward = mirrorVector(sceneForward);

    return createAtPose({
        groundHeight,
        point: {
            x: -point.x,
            z: point.z,
        },
        preset,
        yaw: Math.atan2(forward.x, forward.z),
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
    const forward = rotateVector(vehicle.body.rotation, {
        x: 0,
        y: 0,
        z: 1,
    });

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

/** A fresh `preset` car at rest, upright where `vehicle` is and facing the way it faces. */
function createInPlace({
    preset,
    vehicle,
    world,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    preset: CarPreset;
    world: Readonly<VehicleWorld>;
}>) {
    const origin = getBodyOrigin(vehicle);

    return createAtPose({
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
        preset,
        yaw: getYaw(vehicle),
    });
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

/** Puts the car back on its wheels where it is, facing the way it was. Same as RVP's reset. */
export function recoverVehicle({
    vehicle,
    world,
}: Readonly<{vehicle: Readonly<VehicleSimulation>; world: Readonly<VehicleWorld>}>) {
    const fresh = createInPlace({
        preset: vehicle.preset,
        vehicle,
        world,
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

/** Meters per second a hit on the car's body must reach, overall and into the body, to count. */
export const minHitSpeed = 1;

/**
 * Records one hit on the car's body, in the physics' frame, for sparks and crash sounds. Hits
 * during the last one's cooldown, or too soft to count, are ignored.
 */
export function applyHit({
    contact,
    hitVelocity,
    vehicle,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    contact: Readonly<Pick<BodyContact, 'point' | 'normal'>>;
    /** The ground's velocity relative to the car's hit point. Points into the car. */
    hitVelocity: Readonly<Vector3>;
}>): VehicleSimulation {
    const speed = getVectorLength(hitVelocity);

    if (
        vehicle.hitCooldownSeconds > 0 ||
        speed <= minHitSpeed ||
        dotVectors({
            left: hitVelocity,
            right: contact.normal,
        }) <= minHitSpeed
    ) {
        return vehicle;
    }

    const isCrash =
        speed ** 2 > 20 &&
        dotVectors({
            left: contact.normal,
            right: scaleVector(hitVelocity, 1 / speed),
        }) > 0.2;
    const impact: VehicleImpact = {
        isCrash,
        normal: mirrorVector(contact.normal),
        position: mirrorVector(contact.point),
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
    };
}

/** The driver's manual shifting, which only a car with a gearbox obeys. */
function getShiftRequest({
    inputs,
    tuning,
}: Readonly<{
    inputs: Readonly<VehicleInputs>;
    tuning: Readonly<CarPresetTuning>;
}>): ShiftRequest {
    const isManual =
        !!inputs.isManual &&
        tuning.vehicle.kind === VehicleKind.Wheeled &&
        tuning.vehicle.transmission.kind === TransmissionKind.Gearbox;

    return {
        clutchPedal: isManual ? clamp01(inputs.clutchPedal ?? 0) : 0,
        gearChange: inputs.gearChange ?? 0,
        isManual,
    };
}

function getGroundedCount(vehicle: Readonly<VehicleSimulation>) {
    return carPresets[vehicle.preset].vehicle.kind === VehicleKind.Hover
        ? Object.values(vehicle.pads).filter((pad) => pad.contact).length
        : Object.values(vehicle.wheels).filter((wheel) => wheel.contact).length;
}

/** Burnout, reversing, and boost: the car-wide state `VehicleParent` and `Motor` keep. */
function stepDriverState({
    dtSeconds,
    inputs,
    vehicle,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    inputs: Readonly<VehicleInputs>;
    dtSeconds: number;
}>) {
    const tuning = carPresets[vehicle.preset];
    const forwardSpeed = inverseRotateVector(vehicle.body.rotation, vehicle.body.velocity).z;
    const groundedWheelCount = getGroundedCount(vehicle);
    const isHover = tuning.vehicle.kind === VehicleKind.Hover;
    const burnoutThreshold =
        tuning.vehicle.kind === VehicleKind.Wheeled ? tuning.vehicle.burnoutThreshold : -1;
    const isBurningOut =
        groundedWheelCount > 0 &&
        !isHover &&
        burnoutThreshold >= 0 &&
        inputs.throttle > burnoutThreshold &&
        inputs.brake > burnoutThreshold;
    const burnoutTarget = isBurningOut
        ? ((5 - Math.min(5, Math.abs(forwardSpeed))) / 5) * inputs.throttle
        : 0;
    const lerpedBurnout = lerpNumber({
        from: vehicle.burnout,
        to: burnoutTarget,
        amount: dtSeconds * 5,
    });
    const burnout = !isBurningOut && lerpedBurnout < 0.01 ? 0 : lerpedBurnout;
    const isManual = getShiftRequest({
        inputs,
        tuning,
    }).isManual;
    /** A manual car reverses by its gear, and its brake pedal only ever brakes. */
    const isReversing =
        !isManual &&
        burnout === 0 &&
        ((inputs.brake > 0 && forwardSpeed < 1) ||
            (forwardSpeed < 0 &&
                vehicle.isReversing &&
                /**
                 * Throttle brakes while reversing, and braking never quite stops the car, so
                 * without this a car with no gearbox to shift into first stays in reverse.
                 */
                !(inputs.throttle > 0 && forwardSpeed > -1)));
    const hoverInput = inputs.throttle - inputs.brake;
    /** Follows the pedals rather than the motion, so throttle while rolling backward boosts forward. */
    const isDrivingBackward = isHover
        ? hoverInput < 0 || (hoverInput === 0 && forwardSpeed < 0)
        : isManual
          ? vehicle.transmission.ratio < 0
          : inputs.throttle === 0 && isReversing;

    return {
        boostBoost: evaluateCurve(tuning.boostPowerCurve, Math.abs(forwardSpeed)),
        /** 1 pushes the car forward, -1 backward. */
        boostDirection: isDrivingBackward ? -1 : 1,
        burnout,
        forwardSpeed,
        groundedWheelCount,
        isBoosting: inputs.isBoostHeld,
        /**
         * Boost pushes off the ground, so it needs a driven wheel, or a hover pad, touching it. Its
         * flames and sound still follow the button.
         */
        isBoostPushing:
            inputs.isBoostHeld &&
            (isHover
                ? groundedWheelCount > 0
                : getEnumValues(WheelPosition).some((position) => {
                      return (
                          tuning.vehicle.kind === VehicleKind.Wheeled &&
                          tuning.vehicle.wheels[position].isDriven &&
                          !!vehicle.wheels[position].contact
                      );
                  })),
        isReversing,
    };
}

/**
 * Slowing in meters per second squared that a rolling car gets from its tires, from its engine
 * while no pedal is pressed, and per squared meter per second of speed from the air. Randomation
 * has none of these: its bodies have no drag and a wheel with no throttle spins freely, so a car
 * coasts forever.
 */
const rollingResistance = 0.15;
const engineBraking = 0.8;
const airDrag = 0.0004;
/**
 * Slowing in meters per second squared per redline that the wheels would spin the engine past its
 * redline, as after shifting down too far. It applies whatever the pedals do.
 */
const overRevBraking = 25;

/** Engine-side RPM coming back from the driven wheels through the current gear. */
function getEngineFeedbackRpm({
    tuning,
    vehicle,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    tuning: Readonly<WheeledTuning>;
}>) {
    const drivenPositions = getEnumValues(WheelPosition).filter(
        (position) => tuning.wheels[position].isDriven,
    );

    return drivenPositions.length
        ? (drivenPositions.reduce(
              (sum, position) => sum + vehicle.wheels[position].feedbackRpm,
              0,
          ) /
              drivenPositions.length) *
              vehicle.transmission.ratio
        : 0;
}

/**
 * How a car on its wheels slows along its length while coasting. It never pushes the car past a
 * stop, so a car at rest stays at rest.
 */
function getCoastAcceleration({
    driver,
    dtSeconds,
    inputs,
    vehicle,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    driver: Readonly<
        Pick<ReturnType<typeof stepDriverState>, 'forwardSpeed' | 'groundedWheelCount'>
    >;
    inputs: Readonly<Pick<VehicleInputs, 'throttle' | 'brake'>>;
    dtSeconds: number;
}>) {
    const tuning = carPresets[vehicle.preset].vehicle;

    /** The engine's first run reports no elapsed time, and the stop-at-zero cap below divides by it. */
    if (!dtSeconds || tuning.kind === VehicleKind.Hover) {
        return zeroVector;
    }

    /** How much of the engine the wheels feel: none in neutral or with the clutch open. */
    const engineCoupling = vehicle.transmission.ratio === 0 ? 0 : vehicle.transmission.clutch;
    const overRev = Math.max(
        0,
        Math.abs(
            getEngineFeedbackRpm({
                tuning,
                vehicle,
            }),
        ) /
            (getCurveEndTime(tuning.motor.torqueCurve) * 1000) -
            1,
    );
    const slowing =
        (rollingResistance +
            ((inputs.throttle || inputs.brake ? 0 : engineBraking) + overRevBraking * overRev) *
                engineCoupling +
            airDrag * driver.forwardSpeed ** 2) *
        Math.min(1, driver.groundedWheelCount / getEnumValues(WheelPosition).length);

    return rotateVector(
        vehicle.body.rotation,
        createVector({
            x: 0,
            y: 0,
            z:
                -Math.sign(driver.forwardSpeed) *
                Math.min(slowing, Math.abs(driver.forwardSpeed) / dtSeconds),
        }),
    );
}

/**
 * Pushes the car through one short physics step without moving its body along its velocity:
 * whatever does that afterward (Box3D in the game, {@link stepVehicleSimulation} otherwise) also
 * handles the body's collisions, reporting them only through `isBodyTouching`. Wheels and hover
 * pads pressed into the ground through `world` can still lift the body out of it.
 */
export function accelerateVehicle({
    dtSeconds,
    inputs,
    isBodyTouching,
    vehicle,
    world,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    inputs: Readonly<VehicleInputs>;
    dtSeconds: number;
    world: Readonly<VehicleWorld>;
    /** Whether the car's body, not its wheels, touched anything in the last step. */
    isBodyTouching: boolean;
}>): VehicleSimulation {
    const tuning = carPresets[vehicle.preset];
    const driver = stepDriverState({
        dtSeconds,
        inputs,
        vehicle,
    });
    const situation: DriveSituation = {
        accel: inputs.throttle,
        boostBoost: driver.boostBoost,
        brake: inputs.brake,
        burnout: driver.burnout,
        forwardSpeed: driver.forwardSpeed,
        groundedWheelCount: driver.groundedWheelCount,
        isBoosting: driver.isBoostPushing,
        isReversing: driver.isReversing,
    };
    const powered =
        tuning.vehicle.kind === VehicleKind.Hover
            ? stepHoverCar({
                  dtSeconds,
                  driver,
                  inputs,
                  tuning: tuning.vehicle,
                  vehicle,
                  world,
              })
            : stepWheeledCar({
                  dtSeconds,
                  inputs,
                  situation,
                  tuning: tuning.vehicle,
                  vehicle,
                  world,
              });
    const groundedNormals = [
        ...Object.values(powered.wheels),
        ...Object.values(powered.pads),
    ].flatMap((part) => (part.contact ? [part.contact.normal] : []));
    const assist = getAssistAcceleration({
        accel: inputs.throttle,
        body: vehicle.body,
        brake: inputs.brake,
        groundNormal: averageNormals(groundedNormals, rotateVector(vehicle.body.rotation, yAxis)),
        groundedWheelCount: groundedNormals.length,
        steer: inputs.steer,
        tuning: tuning.assist,
    });
    const flip =
        groundedNormals.length === 0
            ? [
                  getFlipAcceleration({
                      body: vehicle.body,
                      inputs: {
                          pitch: inputs.throttle - inputs.brake,
                          roll: inputs.roll,
                          yaw: inputs.steer,
                      },
                      tuning: tuning.flip,
                  }),
              ]
            : [];
    const accelerated = integrateVelocity({
        acceleration: addAccelerations(
            ...powered.accelerations,
            assist,
            ...flip,
            getSkirtAcceleration({
                body: vehicle.body,
                dtSeconds,
                preset: vehicle.preset,
                shape: vehicle.shape,
                world,
            }),
            {
                angular: zeroVector,
                linear: addVectors(
                    createVector({
                        x: 0,
                        y: -gravity,
                        z: 0,
                    }),
                    driver.isBoostPushing
                        ? rotateVector(
                              vehicle.body.rotation,
                              createVector({
                                  x: 0,
                                  y: 0,
                                  z: tuning.boostThrust * driver.boostDirection,
                              }),
                          )
                        : zeroVector,
                    getCoastAcceleration({
                        driver,
                        dtSeconds,
                        inputs,
                        vehicle,
                    }),
                ),
            },
        ),
        body: vehicle.body,
        dtSeconds,
        linearDrag: tuning.linearDrag,
    });
    const resolved = resolveContacts({
        body: isBodyTouching
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
        contacts: powered.contacts,
        shape: vehicle.shape,
    });
    return {
        ...vehicle,
        ...powered.parts,
        body: resolved,
        burnout: driver.burnout,
        hitCooldownSeconds: Math.max(0, vehicle.hitCooldownSeconds - dtSeconds),
        isBoosting: driver.isBoosting,
        isReversing: driver.isReversing,
        pads: powered.pads,
        wheels: powered.wheels,
    };
}

function stepWheeledCar({
    dtSeconds,
    inputs,
    situation,
    tuning,
    vehicle,
    world,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    tuning: Readonly<WheeledTuning>;
    inputs: Readonly<VehicleInputs>;
    situation: Readonly<DriveSituation>;
    dtSeconds: number;
    world: Readonly<VehicleWorld>;
}>) {
    const drivenPositions = getEnumValues(WheelPosition).filter(
        (position) => tuning.wheels[position].isDriven,
    );
    const engineFeedbackRpm = getEngineFeedbackRpm({
        tuning,
        vehicle,
    });
    const motor = stepGasMotor({
        feedbackRpm: engineFeedbackRpm,
        motor: vehicle.motor,
        situation,
        tuning: tuning.motor,
    });
    const maxKiloRpm = getCurveEndTime(tuning.motor.torqueCurve);
    const shiftRequest = getShiftRequest({
        inputs,
        tuning: carPresets[vehicle.preset],
    });
    const drivetrain = stepTransmission({
        drivenWheelCount: drivenPositions.length,
        dtSeconds,
        engineFeedbackRpm,
        engineRpm: vehicle.engineRpm,
        maxKiloRpm,
        motor,
        shiftRequest,
        situation,
        transmission: vehicle.transmission,
        tuning: tuning.transmission,
    });
    const steerTarget =
        inputs.steer * evaluateCurve(tuning.steerCurve, Math.abs(situation.forwardSpeed));
    const stepped = mapObjectValues(vehicle.wheels, (position, wheel) => {
        return stepWheel({
            body: vehicle.body,
            drive: drivetrain.wheelDrive,
            dtSeconds,
            inputs: {
                accel: inputs.throttle,
                /** Randomation brakes with the gas pedal while rolling backward. */
                brake:
                    shiftRequest.isManual || situation.forwardSpeed > 0
                        ? inputs.brake
                        : clamp01(inputs.throttle),
                burnout: situation.burnout,
                burnoutSpin: tuning.burnoutSpin,
                ebrake: inputs.handbrake,
                forwardSpeed: situation.forwardSpeed,
                steerInput: inputs.steer,
                steerRate: tuning.steerRate,
                steerTarget,
            },
            shape: vehicle.shape,
            side: wheelSides[position],
            tuning: tuning.wheels[position],
            wheel,
            world,
        });
    });

    const wheels = mapObjectValues(stepped, (position, result) => result.wheel);
    const isAirborne = Object.values(wheels).every((wheel) => !wheel.contact);

    return {
        accelerations: [
            ...Object.values(stepped).map((result) => result.acceleration),
            ...(isAirborne
                ? [
                      getWheelSpinReaction({
                          body: vehicle.body,
                          dtSeconds,
                          next: wheels,
                          previous: vehicle.wheels,
                          shape: vehicle.shape,
                          tunings: tuning.wheels,
                      }),
                  ]
                : []),
        ],
        contacts: Object.values(stepped).flatMap((result) => result.contacts),
        pads: vehicle.pads,
        parts: {
            engineRpm: stepEngineRpm({
                clutchPedal: shiftRequest.clutchPedal,
                dtSeconds,
                engineRpm: vehicle.engineRpm,
                maxKiloRpm,
                throttle: motor.throttle,
                transmission: drivetrain.transmission,
                wheelRpm: engineFeedbackRpm,
            }),
            motor,
            transmission: drivetrain.transmission,
        },
        wheels,
    };
}

function stepHoverCar({
    driver,
    inputs,
    tuning,
    vehicle,
    world,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    tuning: Readonly<HoverTuning>;
    inputs: Readonly<VehicleInputs>;
    driver: Readonly<ReturnType<typeof stepDriverState>>;
    dtSeconds: number;
    world: Readonly<VehicleWorld>;
}>) {
    const drive = getHoverDrive({
        accel: inputs.throttle,
        boostBoost: driver.boostBoost,
        brake: inputs.brake,
        forwardSpeed: driver.forwardSpeed,
        isBoosting: driver.isBoostPushing,
        steer: inputs.steer,
        tuning,
    });
    const stepped = mapObjectValues(vehicle.pads, (position) => {
        return stepHoverPad({
            accel: inputs.throttle,
            body: vehicle.body,
            brake: inputs.brake,
            drive,
            ebrake: inputs.handbrake,
            forwardSpeed: driver.forwardSpeed,
            pad: tuning.pads[position],
            shape: vehicle.shape,
            tuning,
            world,
        });
    });

    return {
        accelerations: Object.values(stepped).map((result) => result.acceleration),
        contacts: [],
        pads: mapObjectValues(stepped, (position, result) => result.pad),
        parts: {
            hover: {
                pitch: drive.pitch,
                throttle: drive.throttle,
            },
        },
        wheels: vehicle.wheels,
    };
}

/**
 * Counts how long the car has lain tipped over and nearly still, and sets it back on its wheels
 * once that's lasted long enough. Also runs down the blink after a recovery.
 */
export function stepVehicleRecovery({
    dtSeconds,
    vehicle,
    world,
}: Readonly<{
    vehicle: Readonly<VehicleSimulation>;
    dtSeconds: number;
    world: Readonly<VehicleWorld>;
}>): VehicleSimulation {
    const isStuck =
        rotateVector(vehicle.body.rotation, yAxis).y < minUprightUp &&
        getVectorLength(vehicle.body.velocity) < stuckSpeed;
    const stuckSeconds = isStuck ? vehicle.stuckSeconds + dtSeconds : 0;

    return stuckSeconds <
        convertDuration(recoveryDelay, {
            seconds: true,
        }).seconds
        ? {
              ...vehicle,
              blinkSeconds: Math.max(0, vehicle.blinkSeconds - dtSeconds),
              stuckSeconds,
          }
        : recoverVehicle({
              vehicle,
              world,
          });
}

/**
 * Advances the car by one frame with its own integrator, where its body touches nothing. The game
 * moves the car with Box3D instead; this settles parked cars, which only rest on their wheels.
 * Impacts reset at the start of each frame.
 */
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
    const substepCount = Math.max(1, Math.ceil(dtSeconds / maxSubstepSeconds));
    const stepped = createArray(substepCount, () => undefined).reduce<VehicleSimulation>(
        (current, unused, index) => {
            const accelerated = accelerateVehicle({
                dtSeconds: dtSeconds / substepCount,
                /** A shift press is one gear, not one per substep. */
                inputs: index
                    ? {
                          ...inputs,
                          gearChange: 0,
                      }
                    : inputs,
                isBodyTouching: false,
                vehicle: current,
                world,
            });

            return {
                ...accelerated,
                body: integratePosition({
                    body: accelerated.body,
                    dtSeconds: dtSeconds / substepCount,
                }),
            };
        },
        {
            ...vehicle,
            impacts: [],
            lastInputs: inputs,
        },
    );

    return stepVehicleRecovery({
        dtSeconds,
        vehicle: stepped,
        world,
    });
}

function getWheelViews(vehicle: Readonly<VehicleSimulation>): Record<WheelPosition, WheelView> {
    const tuning = carPresets[vehicle.preset].vehicle;

    if (tuning.kind === VehicleKind.Hover) {
        return mapObjectValues(vehicle.pads, (position, pad) => {
            const position3 = getWorldPoint({
                body: vehicle.body,
                localPoint: tuning.pads[position].pivot,
                shape: vehicle.shape,
            });

            return {
                compression: pad.contact ? 1 - pad.compression : 0,
                contactNormal: mirrorVector(pad.contact?.normal ?? yAxis),
                contactPoint: mirrorVector(
                    pad.contact?.point ??
                        createVector({
                            x: position3.x,
                            y: position3.y - tuning.hoverDistance,
                            z: position3.z,
                        }),
                ),
                isGrounded: !!pad.contact,
                position: mirrorVector(position3),
                radius: hoverPadRadius,
                rotation: mirrorQuaternion(vehicle.body.rotation),
                slip: 0,
                width: hoverPadRadius,
            };
        });
    }

    return mapObjectValues(vehicle.wheels, (position, wheel) => {
        const wheelTuning = tuning.wheels[position];
        const pose = getWheelPose({
            body: vehicle.body,
            shape: vehicle.shape,
            side: wheelSides[position],
            tuning: wheelTuning,
            wheel,
        });

        return {
            compression: wheel.contact ? 1 - wheel.compression : 0,
            contactNormal: mirrorVector(wheel.contact?.normal ?? yAxis),
            contactPoint: mirrorVector(
                wheel.contact?.point ??
                    subtractVectors({
                        left: pose.position,
                        right: createVector({
                            x: 0,
                            y: wheelTuning.tireRadius,
                            z: 0,
                        }),
                    }),
            ),
            isGrounded: !!wheel.contact,
            position: mirrorVector(pose.position),
            radius: wheelTuning.tireRadius,
            rotation: mirrorQuaternion(pose.rotation),
            slip: Math.abs(
                Math.abs(wheel.sidewaysSlip) >= Math.abs(wheel.forwardSlip)
                    ? wheel.sidewaysSlip
                    : wheel.forwardSlip,
            ),
            width: wheelTuning.tireWidth,
        };
    });
}

/** Everything the scene, sound, and HUD read, in the scene's frame. */
export function getVehicleView(vehicle: Readonly<VehicleSimulation>): VehicleView {
    const tuning = carPresets[vehicle.preset];
    const forwardSpeed = inverseRotateVector(vehicle.body.rotation, vehicle.body.velocity).z;
    const inputs = vehicle.lastInputs;
    const isHover = tuning.vehicle.kind === VehicleKind.Hover;

    return {
        boost: {
            isBoosting: vehicle.isBoosting,
        },
        engine:
            tuning.vehicle.kind === VehicleKind.Hover
                ? {
                      gearLabel: 'Hover',
                      isShifting: false,
                      shiftModeLabel: '',
                      kiloRpm:
                          vehicle.hover.pitch * getCurveEndTime(tuning.vehicle.forceCurve) * 0.1,
                      pitch: vehicle.hover.pitch,
                      throttle: vehicle.hover.throttle,
                  }
                : {
                      gearLabel: getGearLabel({
                          transmission: vehicle.transmission,
                          tuning: tuning.vehicle.transmission,
                      }),
                      isShifting: vehicle.transmission.shiftSeconds > 0,
                      kiloRpm: vehicle.engineRpm * 0.001,
                      pitch: clamp01(
                          vehicle.engineRpm /
                              (getCurveEndTime(tuning.vehicle.motor.torqueCurve) * 1000),
                      ),
                      shiftModeLabel:
                          tuning.vehicle.transmission.kind === TransmissionKind.Gearbox
                              ? getShiftRequest({
                                    inputs,
                                    tuning,
                                }).isManual
                                  ? 'M'
                                  : 'A'
                              : '',
                      throttle: clamp01(vehicle.motor.throttle),
                  },
        forwardSpeed,
        groundedWheelCount: getGroundedCount(vehicle),
        impacts: vehicle.impacts,
        blinkSeconds: vehicle.blinkSeconds,
        lights: {
            areHeadlightsOn: vehicle.areHeadlightsOn,
            brake: vehicle.isReversing
                ? forwardSpeed < 0
                    ? clamp01(inputs.throttle)
                    : 0
                : inputs.brake,
            isReversing: isHover
                ? forwardSpeed < -0.5 && inputs.throttle - inputs.brake < 0
                : vehicle.transmission.ratio < 0,
        },
        position: mirrorVector(getBodyOrigin(vehicle)),
        preset: vehicle.preset,
        rotation: mirrorQuaternion(vehicle.body.rotation),
        velocity: mirrorVector(vehicle.body.velocity),
        wheels: getWheelViews(vehicle),
    };
}
