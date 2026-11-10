import {
    clamp,
    createArray,
    getObjectTypedEntries,
    getObjectTypedValues,
    mapObjectValues,
} from '@augment-vir/common';
import {type CarControls, type CarPose} from '@evir/driving-common';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {convertDuration, type AnyDuration} from 'date-vir';
import {
    chooseAutomaticGear,
    getPedals,
    initialDrivetrain,
    stepDrivetrain,
    type DrivetrainState,
} from './drivetrain.js';
import {getTireForce, getTireGrip, peakSlipAngle} from './tire.js';

enum Axle {
    Front = 'front',
    Rear = 'rear',
}

enum Side {
    Left = 'left',
    Right = 'right',
}

const gravity = 9.81;
const mass = 1200;
/** Resistance to turning, in kilogram square meters. */
const yawInertia = 2000;
const trackWidth = 1.6;
/** The higher the center of mass, the more weight shifts as the car speeds up, brakes, and turns. */
const centerOfMassHeight = 0.5;
/** Total brake force at full pedal, as a multiple of the car's weight. */
const brakeStrength = 0.95;
const airDrag = 0.42;
const rollingResistance = 180;
/** Rolling resistance fades in over this speed so it doesn't jitter the car at a standstill. */
const rollingResistanceFadeSpeed = 0.5;
const maxSteerAngle = 0.6;
/** Meters per second. Keeps the steering lock math from dividing by zero at a standstill. */
const minLockSpeed = 1;
/** Radians per second, so keyboard steering doesn't snap the wheels to full lock. */
const steerRate = 3;
/**
 * The suspension takes a moment to settle, so the weight on each tire follows the car's
 * acceleration with this lag. It also keeps the load from feeding back on itself within a step.
 */
const loadTransfer: AnyDuration = {
    milliseconds: 80,
};
/** Radians of body lean per meter per second squared of acceleration. */
const bodyLeanPerAcceleration = 0.005;
/** Tire forces are stiff, so the physics runs in steps at least this many times per second. */
const minStepsPerSecond = 240;
/** A tire never carries less than this, in Newtons, even when the car leans hard off it. */
const minLoad = 50;

/** Per-axle layout. Front is +forward. */
const axles: Readonly<
    Record<
        Axle,
        {
            /** Meters ahead of the center of mass. */
            forwardOffset: number;
            /** Share of the brake force, from 0 to 1. */
            brakeShare: number;
            /** Share of the engine's force, from 0 to 1. */
            driveShare: number;
            /** Share of the side-to-side weight shift this axle's springs carry, from 0 to 1. */
            lateralLoadTransferShare: number;
            /** How much of the steering angle the axle's wheels turn by. */
            steerShare: number;
            /** How much the handbrake locks the axle's wheels. */
            handbrakeShare: number;
        }
    >
> = {
    [Axle.Front]: {
        brakeShare: 0.8,
        driveShare: 0,
        forwardOffset: 1.2,
        handbrakeShare: 0,
        lateralLoadTransferShare: 0.75,
        steerShare: 1,
    },
    [Axle.Rear]: {
        brakeShare: 0.2,
        driveShare: 1,
        forwardOffset: -1.4,
        handbrakeShare: 1,
        lateralLoadTransferShare: 0.25,
        steerShare: 0,
    },
};

const wheelBase = axles[Axle.Front].forwardOffset - axles[Axle.Rear].forwardOffset;

const sideRightOffsets: Readonly<Record<Side, number>> = {
    [Side.Left]: -trackWidth / 2,
    [Side.Right]: trackWidth / 2,
};

const wheels: Readonly<Record<WheelPosition, Readonly<{axle: Axle; side: Side}>>> = {
    [WheelPosition.FrontLeft]: {
        axle: Axle.Front,
        side: Side.Left,
    },
    [WheelPosition.FrontRight]: {
        axle: Axle.Front,
        side: Side.Right,
    },
    [WheelPosition.RearLeft]: {
        axle: Axle.Rear,
        side: Side.Left,
    },
    [WheelPosition.RearRight]: {
        axle: Axle.Rear,
        side: Side.Right,
    },
};

/** Where a wheel sits relative to the center of mass, in meters, for drawing the tire loads. */
export function getWheelOffset(position: WheelPosition) {
    return {
        forward: axles[wheels[position].axle].forwardOffset,
        right: sideRightOffsets[wheels[position].side],
    };
}

/** What one tire is doing, for display. */
export type TireReading = {
    /** Newtons. */
    load: number;
    /** From 0 to 1, how much of the tire's grip is in use. */
    gripUsage: number;
};

/** Body-frame acceleration, in meters per second squared. */
export type BodyAcceleration = {
    forward: number;
    right: number;
};

/** A car with four tires, an engine, and a gearbox. */
export type VehicleState = CarPose & {
    /** Meters per second along the heading. Negative while reversing. */
    speed: number;
    /** Meters per second sideways. Positive slides toward the car's right. */
    lateralSpeed: number;
    /** Radians per second. Positive turns right. */
    yawRate: number;
    /** The acceleration the suspension has settled toward, which sets how weight shifts. */
    loadAcceleration: BodyAcceleration;
    drivetrain: DrivetrainState;
    tires: Record<WheelPosition, TireReading>;
};

function getTireLoad({
    loadAcceleration,
    position,
}: Readonly<{loadAcceleration: Readonly<BodyAcceleration>; position: WheelPosition}>) {
    const axle = axles[wheels[position].axle];
    const offset = getWheelOffset(position);
    const staticLoad =
        (mass * gravity * (wheelBase - Math.abs(axle.forwardOffset))) / wheelBase / 2;
    /** Speeding up pushes weight onto the rear and braking onto the front. */
    const longitudinalTransfer =
        (-Math.sign(offset.forward) * mass * loadAcceleration.forward * centerOfMassHeight) /
        wheelBase /
        2;
    /** Turning pushes weight onto the outside wheels. */
    const lateralTransfer =
        (-Math.sign(offset.right) *
            axle.lateralLoadTransferShare *
            mass *
            loadAcceleration.right *
            centerOfMassHeight) /
        trackWidth;

    return Math.max(minLoad, staticLoad + longitudinalTransfer + lateralTransfer);
}

const atRest: BodyAcceleration = {
    forward: 0,
    right: 0,
};

export const initialVehicleState: VehicleState = {
    drivetrain: initialDrivetrain,
    heading: 0,
    lateralSpeed: 0,
    loadAcceleration: atRest,
    speed: 0,
    steerAngle: 0,
    tires: mapObjectValues(wheels, (position) => {
        return {
            gripUsage: 0,
            load: getTireLoad({
                loadAcceleration: atRest,
                position,
            }),
        };
    }),
    x: 0,
    yawRate: 0,
    z: 0,
};

function stepPhysics({
    controls,
    dtSeconds,
    vehicle,
}: Readonly<{
    controls: Readonly<CarControls>;
    dtSeconds: number;
    vehicle: Readonly<VehicleState>;
}>) {
    const pedals = getPedals({
        controls,
        drivetrain: vehicle.drivetrain,
    });
    const engine = stepDrivetrain({
        drivetrain: vehicle.drivetrain,
        dtSeconds,
        throttle: pedals.throttle,
        wheelSpeed: vehicle.speed,
    });
    const loads = mapObjectValues(wheels, (position) => {
        return getTireLoad({
            loadAcceleration: vehicle.loadAcceleration,
            position,
        });
    });
    /**
     * An open differential pushes both wheels of an axle equally, so once the lighter wheel starts
     * to spin, the other can't be pushed any harder than it.
     */
    const differentialLimits = mapObjectValues(axles, (axleName) => {
        return Math.min(
            ...getObjectTypedEntries(wheels)
                .filter(
                    ([
                        ,
                        wheel,
                    ]) => wheel.axle === axleName,
                )
                .map(([position]) => getTireGrip(loads[position])),
        );
    });
    const tireForces = mapObjectValues(wheels, (position, wheel) => {
        const axle = axles[wheel.axle];
        const offset = getWheelOffset(position);
        const load = loads[position];
        /** The car's spin adds to each corner's speed. */
        const pointForwardSpeed = vehicle.speed - vehicle.yawRate * offset.right;
        const pointRightSpeed = vehicle.lateralSpeed + vehicle.yawRate * offset.forward;
        const wheelAngle = vehicle.steerAngle * axle.steerShare;
        const cos = Math.cos(wheelAngle);
        const sin = Math.sin(wheelAngle);
        const tire = getTireForce({
            /** ABS never brakes a wheel harder than its tire can grip, so the wheel keeps rolling. */
            brakeForce: Math.min(
                (pedals.brake * brakeStrength * mass * gravity * axle.brakeShare) / 2,
                getTireGrip(load),
            ),
            driveForce: clamp((engine.driveForce * axle.driveShare) / 2, {
                max: differentialLimits[wheel.axle],
                min: -differentialLimits[wheel.axle],
            }),
            lateralSpeed: -pointForwardSpeed * sin + pointRightSpeed * cos,
            load,
            lockAmount: controls.handbrake * axle.handbrakeShare,
            longitudinalSpeed: pointForwardSpeed * cos + pointRightSpeed * sin,
        });
        const forward = tire.longitudinal * cos - tire.lateral * sin;
        const right = tire.longitudinal * sin + tire.lateral * cos;

        return {
            forward,
            gripUsage: tire.gripUsage,
            load,
            right,
            /** Positive turns the car right. */
            torque: offset.forward * right - offset.right * forward,
        };
    });
    const totals = getObjectTypedValues(tireForces).reduce(
        (sum, tire) => {
            return {
                forward: sum.forward + tire.forward,
                right: sum.right + tire.right,
                torque: sum.torque + tire.torque,
            };
        },
        {
            forward: 0,
            right: 0,
            torque: 0,
        },
    );
    const groundSpeed = Math.hypot(vehicle.speed, vehicle.lateralSpeed);
    const acceleration: BodyAcceleration = {
        forward:
            (totals.forward -
                airDrag * groundSpeed * vehicle.speed -
                rollingResistance * Math.tanh(vehicle.speed / rollingResistanceFadeSpeed)) /
            mass,
        right: (totals.right - airDrag * groundSpeed * vehicle.lateralSpeed) / mass,
    };
    const yawRate = vehicle.yawRate + (totals.torque / yawInertia) * dtSeconds;
    /** The car's frame turns under its own momentum, which shows up as these cross terms. */
    const speed =
        vehicle.speed + (acceleration.forward + yawRate * vehicle.lateralSpeed) * dtSeconds;
    const lateralSpeed =
        vehicle.lateralSpeed + (acceleration.right - yawRate * vehicle.speed) * dtSeconds;
    /** Turning right is a negative rotation about +y. */
    const heading = vehicle.heading - yawRate * dtSeconds;
    const loadTransferFraction =
        1 -
        Math.exp(
            -dtSeconds /
                convertDuration(loadTransfer, {
                    seconds: true,
                }).seconds,
        );

    return {
        ...vehicle,
        drivetrain: engine.drivetrain,
        heading,
        lateralSpeed,
        loadAcceleration: {
            forward:
                vehicle.loadAcceleration.forward +
                (acceleration.forward - vehicle.loadAcceleration.forward) * loadTransferFraction,
            right:
                vehicle.loadAcceleration.right +
                (acceleration.right - vehicle.loadAcceleration.right) * loadTransferFraction,
        },
        speed,
        tires: mapObjectValues(tireForces, (position, tire) => {
            return {
                gripUsage: tire.gripUsage,
                load: tire.load,
            };
        }),
        /** The car's right side faces -x at heading 0. */
        x: vehicle.x + (Math.sin(heading) * speed - Math.cos(heading) * lateralSpeed) * dtSeconds,
        yawRate,
        z: vehicle.z + (Math.cos(heading) * speed + Math.sin(heading) * lateralSpeed) * dtSeconds,
    };
}

/**
 * Moves the car with four tires whose grip follows the weight on them. Braking shifts weight onto
 * the front tires and lifting off the throttle does too, so the rear can let go mid-corner.
 */
export function stepVehicle({
    controls,
    dtSeconds,
    vehicle,
}: Readonly<{
    controls: Readonly<CarControls>;
    dtSeconds: number;
    vehicle: Readonly<VehicleState>;
}>) {
    /** Which way the front wheels are moving over the ground, relative to where the car points. */
    const frontTravelAngle = Math.atan2(
        vehicle.lateralSpeed + vehicle.yawRate * axles[Axle.Front].forwardOffset,
        Math.max(Math.abs(vehicle.speed), minLockSpeed),
    );
    /**
     * Full input asks for enough lock to turn at the tires' limit, so a stick's whole throw stays
     * usable at speed. Lock toward the way the front is sliding opens up further, so a slide can
     * still be caught by steering into it.
     */
    const lockAtSpeed =
        peakSlipAngle +
        (wheelBase * gravity) /
            Math.max(Math.hypot(vehicle.speed, vehicle.lateralSpeed), minLockSpeed) ** 2;
    const steerLock = Math.min(
        maxSteerAngle,
        Math.max(lockAtSpeed, Math.sign(controls.steer) * frontTravelAngle + peakSlipAngle),
    );
    const targetSteerAngle = controls.steer * steerLock;
    const maxSteerChange = steerRate * dtSeconds;
    const stepCount = Math.max(1, Math.ceil(dtSeconds * minStepsPerSecond));

    return createArray(stepCount, () => undefined).reduce<VehicleState>(
        (current) => {
            return stepPhysics({
                controls,
                dtSeconds: dtSeconds / stepCount,
                vehicle: current,
            });
        },
        {
            ...vehicle,
            drivetrain: chooseAutomaticGear({
                controls,
                drivetrain: vehicle.drivetrain,
                forwardSpeed: vehicle.speed,
            }),
            steerAngle:
                vehicle.steerAngle +
                clamp(targetSteerAngle - vehicle.steerAngle, {
                    max: maxSteerChange,
                    min: -maxSteerChange,
                }),
        },
    );
}

/** How far the body leans on its springs, from the acceleration that shifts the weight. */
export function getBodyLean(vehicle: Readonly<Pick<VehicleState, 'loadAcceleration'>>) {
    return {
        pitch: -vehicle.loadAcceleration.forward * bodyLeanPerAcceleration,
        roll: -vehicle.loadAcceleration.right * bodyLeanPerAcceleration,
    };
}
