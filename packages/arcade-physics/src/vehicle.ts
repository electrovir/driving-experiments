// cspell:word carphysics
/**
 * The tire and body physics are ported from carphysics2d's `Car.js`
 * (https://github.com/spacejack/carphysics2d, MIT, see `LICENSE-carphysics2d`), which adapts Marco
 * Monster's "Car Physics for Games". The engine force comes from our drivetrain instead of a fixed
 * force, and each axle's sideways grip shares a friction circle with its braking or drive force.
 */

import {
    clamp,
    createArray,
    getObjectTypedValues,
    mapObjectValues,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {
    type CarBodyLean,
    type CarControls,
    type CarPoint,
    type CarPose,
    type CarSpark,
    type GetWheelContact,
    type ObstacleEdge,
    type Quaternion,
    type WheelContact,
} from '@evir/driving-common';
import {convertDuration, type AnyDuration} from 'date-vir';
/**
 * The package index also loads the 3D scene, whose CommonJS dependencies the test browser can't
 * import.
 */
import {carBoxes, WheelPosition, wheelRadius} from '@evir/driving-common/src/car-pose.js';
import {getFlatWheelContact} from '@evir/driving-common/src/road-network.js';
import {
    chooseAutomaticGear,
    getPedals,
    initialDrivetrain,
    stepDrivetrain,
    type DrivetrainState,
} from './drivetrain.js';

const gravity = 9.81;
const mass = 1200;
/** Total brake force at full pedal, as a multiple of the car's weight. */
const brakeStrength = 0.95;
/** How much of a tire's grip is left once it slides, as when the handbrake locks the rear tires. */
const lockedGrip = 0.7;
/** Friction coefficient. Each axle can push at most this times its load, in any direction. */
const tireGrip = 1.2;
/**
 * Radians of slip angle over which a tire's grip fades to sliding grip. Fading from the tire's peak
 * instead washes the front out under full steer, so the rear never breaks loose into a drift.
 */
const gripFadeSlipAngles = {
    start: 0.7,
    end: 1.5,
};
/** Newtons of sideways force per radian of slip, per newton of load. */
const frontCorneringStiffness = 15;
const rearCorneringStiffness = 15.6;
/** Extra rear grip, so the car runs wide at the limit instead of spinning. */
const rearGripBias = 1.25;
/** How much of the full rigid-body weight shift the handling feels. */
const weightTransfer = 0.5;
const airDrag = 0.42;
const rollingResistance = 180;
/**
 * Brakes and rolling resistance push against the direction of travel, which flips sign every step
 * at a standstill. Ramping them in over this speed lets them hold the car still instead.
 */
const holdingSpeed = 0.4;
/** Radians of front wheel angle at full steer when parked. */
const maxSteerAngle = 0.6;
/** Steering input per second, so neither a key nor a flicked stick snaps the car into a turn. */
const steerRate = 4;
/** Faster than {@link steerRate} so letting go straightens the car promptly. */
const steerReturnRate = 8;
/** Stick-to-wheel exponent. Above 1, small stick movements make finer corrections. */
const steerCurve = 2;
/** The suspension takes a moment to settle, so weight follows the car's acceleration with this lag. */
const loadSettle: AnyDuration = {
    milliseconds: 120,
};
const trackWidth = 1.6;
const centerOfMassHeight = 0.55;
/** Meters ahead of the center of mass. */
const frontAxleOffset = 1.2;
/** Meters behind the center of mass. */
const rearAxleOffset = 1.4;
const wheelBase = frontAxleOffset + rearAxleOffset;
/** Kilogram square meters, from the usual estimate of mass times both axle distances. */
const yawInertia = mass * frontAxleOffset * rearAxleOffset;
/** Kilogram square meters. Pitching swings the same masses as yawing. */
const pitchInertia = yawInertia;
/** Kilogram square meters. The body is much narrower than it is long. */
const rollInertia = 550;

/** Meters each spring compresses under the car's weight at rest. Both axles sag equally. */
const restingSag = 0.09;
/** Meters past {@link restingSag} that a spring compresses before hitting its bump stop. */
const springTravel = 0.12;
/** How many times stiffer the bump stop is than the spring. */
const bumpStopStiffness = 5;
/**
 * Fraction of the bump stop's push that remains while the spring stretches back off it. Bump stops
 * are rubber that soaks up a hard landing instead of throwing the car back into the air.
 */
const bumpStopRebound = 0.1;
/** Fraction of critical damping while a spring squashes, so a bump settles in about one bounce. */
const dampingRatio = 0.35;
/**
 * How many times harder a damper resists stretching than squashing, as real ones do. Without it the
 * springs fling the body up after every bump.
 */
const reboundDamping = 3;
/**
 * Kilograms per wheel that ride below the springs: the wheel, tire, brake, and hub. Their weight is
 * what throws a wheel up into its bump stop when it hits a bump fast.
 */
const wheelMass = 35;
/** Newtons per meter that a tire squashes. */
const tireStiffness = 200_000;
/** Newton seconds per meter. A tire barely damps its own bounce. */
const tireDamping = 500;
/** Meters a tire squashes before its rim hits the ground through it. */
const rimStrikeSquash = 0.07;
/** How many times stiffer the rim is than the tire, once the tire has squashed flat against it. */
const rimStiffness = 20;
/**
 * Fraction of the rim's push that remains while the rim lifts back off the ground. A rim strike is
 * a dead thud that soaks up the hit instead of bouncing the wheel back.
 */
const rimRebound = 0.1;
/** Newtons per meter that a wheel or the body presses into a wall. */
const wallStiffness = 400_000;
/**
 * Newton seconds per meter. Crumpling metal soaks up a crash, so a wall stops the car instead of
 * throwing it back.
 */
const wallDamping = 30_000;
/**
 * A wheel that bounces off the ground keeps its grip this long. The ground lookup only sees where
 * the wheel is, so without it a bump would cost a moment of grip that a real tire wouldn't lose.
 */
const airGrip: AnyDuration = {
    milliseconds: 80,
};
/** The body's up must point less skyward than this for the car to count as tipped over. */
const minUprightUp = 0.3;
/** Meters per second below which a tipped car counts as stuck. */
const stuckSpeed = 1;
/** How long a car lies stuck on its side or roof before it's set back on its wheels. */
const recoveryDelay: AnyDuration = {
    seconds: 2,
};
/** Meters above the ground that a recovered car drops from, so it lands instead of starting in it. */
const recoveryDrop = 0.3;
/** How long a recovered car stays a ghost, so a car it was set down on top of can drive clear. */
const recoveryGhost: AnyDuration = {
    seconds: 2,
};
/** Newtons per meter that the body's edges press into the ground when it scrapes or lands on them. */
const scrapeStiffness = 200_000;
/**
 * Newtons per meter that the floor presses into an obstacle's sharp edge. The floor takes its share
 * of the weight at one spot on the edge, where the edge points spread theirs over several, and
 * making those as stiff flips the car off the steep ramp.
 */
const floorStiffness = 1_000_000;
/** Newton seconds per meter. */
const scrapeDamping = 8000;
/**
 * Fraction of the ground's push on the body that remains while the body lifts back off. Sheet metal
 * crumples instead of springing back, so a car that lands on it stays down.
 */
const scrapeRebound = 0.1;
/** Friction coefficient of the body sliding on the ground. */
const scrapeGrip = 0.5;
/** Meters per second the body must slide along the ground to throw sparks. */
const sparkSpeed = 3;
/** Meters around each of the body's edge points that collide with walls. */
const edgeRadius = 0.1;
/**
 * The clutch locks and slips in small rpm steps, and a bump stop pushes the body hard enough that
 * fewer steps throw it off a ramp much higher than it should go, so the physics runs this many
 * times a second.
 */
const minStepsPerSecond = 480;

/** Body-frame acceleration, in meters per second squared. */
export type BodyAcceleration = {
    forward: number;
    right: number;
};

/** Body-frame offset from the center of mass, in meters. */
export type BodyOffset = {
    forward: number;
    right: number;
};

/** Where a wheel sits relative to the center of mass, in meters. */
export const wheelOffsets: Readonly<Record<WheelPosition, Readonly<BodyOffset>>> = {
    [WheelPosition.FrontLeft]: {
        forward: frontAxleOffset,
        right: -trackWidth / 2,
    },
    [WheelPosition.FrontRight]: {
        forward: frontAxleOffset,
        right: trackWidth / 2,
    },
    [WheelPosition.RearLeft]: {
        forward: -rearAxleOffset,
        right: -trackWidth / 2,
    },
    [WheelPosition.RearRight]: {
        forward: -rearAxleOffset,
        right: trackWidth / 2,
    },
};

/** Newtons on each of the axle's wheels when parked on flat ground. */
function getRestingWheelLoad(offset: Readonly<BodyOffset>) {
    return (
        (mass * gravity * (offset.forward > 0 ? rearAxleOffset : frontAxleOffset)) / wheelBase / 2
    );
}

const springs = mapObjectValues(wheelOffsets, (position, offset) => {
    const restingLoad = getRestingWheelLoad(offset);
    /** Newtons per meter. */
    const stiffness = restingLoad / restingSag;

    return {
        /** Newton seconds per meter. */
        damping: 2 * dampingRatio * Math.sqrt(stiffness * (restingLoad / gravity)),
        /**
         * Meters the tire squashes when parked. Wheel heights count from there, so a parked car's
         * wheels sit at zero.
         */
        restingTireSquash: (restingLoad + wheelMass * gravity) / tireStiffness,
        stiffness,
    };
});

/** Meters, or meters per second, along each world axis, with +y up. */
type Vector = {
    x: number;
    y: number;
    z: number;
};

const zeroVector: Vector = {
    x: 0,
    y: 0,
    z: 0,
};

function addVectors(...vectors: ReadonlyArray<Readonly<Vector>>) {
    return vectors.reduce<Vector>((sum, vector) => {
        return {
            x: sum.x + vector.x,
            y: sum.y + vector.y,
            z: sum.z + vector.z,
        };
    }, zeroVector);
}

function scaleVector(vector: Readonly<Vector>, factor: number): Vector {
    return {
        x: vector.x * factor,
        y: vector.y * factor,
        z: vector.z * factor,
    };
}

function getVectorLength(vector: Readonly<Vector>) {
    return Math.hypot(vector.x, vector.y, vector.z);
}

function dot({first, second}: Readonly<Record<'first' | 'second', Readonly<Vector>>>) {
    return first.x * second.x + first.y * second.y + first.z * second.z;
}

function cross({first, second}: Readonly<Record<'first' | 'second', Readonly<Vector>>>): Vector {
    return {
        x: first.y * second.z - first.z * second.y,
        y: first.z * second.x - first.x * second.z,
        z: first.x * second.y - first.y * second.x,
    };
}

function rotateVector(rotation: Readonly<Quaternion>, vector: Readonly<Vector>) {
    const twice = scaleVector(
        cross({
            first: rotation,
            second: vector,
        }),
        2,
    );

    return addVectors(
        vector,
        scaleVector(twice, rotation.w),
        cross({
            first: rotation,
            second: twice,
        }),
    );
}

function invertRotation(rotation: Readonly<Quaternion>): Quaternion {
    return {
        w: rotation.w,
        x: -rotation.x,
        y: -rotation.y,
        z: -rotation.z,
    };
}

/** The rotation that turns by `second` and then by `first`. */
function combineRotations({
    first,
    second,
}: Readonly<Record<'first' | 'second', Readonly<Quaternion>>>): Quaternion {
    return {
        w: first.w * second.w - first.x * second.x - first.y * second.y - first.z * second.z,
        x: first.w * second.x + first.x * second.w + first.y * second.z - first.z * second.y,
        y: first.w * second.y - first.x * second.z + first.y * second.w + first.z * second.x,
        z: first.w * second.z + first.x * second.y - first.y * second.x + first.z * second.w,
    };
}

/** Positive headings turn from +z toward +x, which is a positive turn about +y. */
function getHeadingRotation(heading: number): Quaternion {
    return {
        w: Math.cos(heading / 2),
        x: 0,
        y: Math.sin(heading / 2),
        z: 0,
    };
}

/** The car's body as one rigid box, free to tumble. */
export type VehicleBody = {
    /** Meters. The center of mass. */
    position: Vector;
    /** Meters per second. */
    velocity: Vector;
    /** Turns the car's own axes, with +x its left side, +y up, and +z forward, into the world's. */
    orientation: Quaternion;
    /** Radians per second about each world axis. */
    spin: Vector;
};

/** Unit directions in the world. */
export function getBodyAxes(orientation: Readonly<Quaternion>) {
    return {
        forward: rotateVector(orientation, {
            x: 0,
            y: 0,
            z: 1,
        }),
        right: rotateVector(orientation, {
            x: -1,
            y: 0,
            z: 0,
        }),
        up: rotateVector(orientation, {
            x: 0,
            y: 1,
            z: 0,
        }),
    };
}

type BodyAxes = ReturnType<typeof getBodyAxes>;

/** From the center of mass to a spot on the car, in world directions. */
function getArm(axes: Readonly<BodyAxes>, point: Readonly<CarPoint>) {
    return addVectors(
        scaleVector(axes.forward, point.forward),
        scaleVector(axes.right, point.right),
        scaleVector(axes.up, point.up - centerOfMassHeight),
    );
}

function getPointVelocity(body: Readonly<VehicleBody>, arm: Readonly<Vector>) {
    return addVectors(
        body.velocity,
        cross({
            first: body.spin,
            second: arm,
        }),
    );
}

/** Kilogram square meters about each of the car's own axes. */
const bodyInertia: Vector = {
    x: pitchInertia,
    y: yawInertia,
    z: rollInertia,
};

/**
 * Points along the body's edges that collide with the ground and walls, leaving out any buried in
 * another box.
 */
const edgePoints = carBoxes
    .flatMap((box) => {
        return [
            -1,
            0,
            1,
        ].flatMap((along) => {
            return [
                -1,
                1,
            ].flatMap((across) => {
                return [
                    -1,
                    1,
                ].map((vertical): CarPoint => {
                    return {
                        forward: box.center.forward + (along * box.length) / 2,
                        right: box.center.right + (across * box.width) / 2,
                        up: box.center.up + (vertical * box.height) / 2,
                    };
                });
            });
        });
    })
    .filter((point) => {
        return !carBoxes.some((box) => {
            return (
                Math.abs(point.forward - box.center.forward) < box.length / 2 &&
                Math.abs(point.right - box.center.right) < box.width / 2 &&
                Math.abs(point.up - box.center.up) < box.height / 2
            );
        });
    });

/** One wheel's bounce, as of the last step. */
export type WheelSuspension = {
    /** Meters the bottom of the wheel sits above where it rests, along the body's up. */
    height: number;
    /** Meters per second, relative to the body. */
    heightRate: number;
    /** Meters the tire is squashed. */
    tireSquash: number;
    /** How long the wheel has been off the ground. */
    airSeconds: number;
};

/** A two-axle car whose tires push sideways in proportion to how far they slip, up to their grip. */
export type VehicleState = CarPose & {
    /** Meters per second along the heading. Negative while reversing. */
    speed: number;
    /** Meters per second sideways. Positive slides toward the car's right. */
    lateralSpeed: number;
    /** Radians per second. Positive turns right. */
    yawRate: number;
    /** The steering input after easing, from -1 to 1. */
    steer: number;
    /** The acceleration the suspension has settled toward, which sets how weight shifts. */
    loadAcceleration: BodyAcceleration;
    drivetrain: DrivetrainState;
    body: VehicleBody;
    wheels: Record<WheelPosition, WheelSuspension>;
    /** How long the car has lain tipped over and nearly still. */
    stuckSeconds: number;
};

/** The {@link VehicleState} fields that follow from the body. */
function describeBody(body: Readonly<VehicleBody>) {
    const axes = getBodyAxes(body.orientation);
    /** The scene draws the car from the spot below its center of mass, in the body's own down. */
    const base = addVectors(body.position, scaleVector(axes.up, -centerOfMassHeight));

    return {
        heading: Math.atan2(axes.forward.x, axes.forward.z),
        lateralSpeed: dot({
            first: body.velocity,
            second: axes.right,
        }),
        speed: dot({
            first: body.velocity,
            second: axes.forward,
        }),
        x: base.x,
        /** Turning right is a negative rotation about +y. */
        yawRate: -dot({
            first: body.spin,
            second: axes.up,
        }),
        z: base.z,
    };
}

/** A car level on flat ground, rolling straight ahead. */
export function createVehicleState({
    heading = 0,
    height = 0,
    speed = 0,
    x = 0,
    z = 0,
}: Readonly<
    PartialWithUndefined<{
        heading: number;
        /** Meters above where the body rests, with the wheels hanging at their resting spots. */
        height: number;
        speed: number;
        x: number;
        z: number;
    }>
>): VehicleState {
    const orientation = getHeadingRotation(heading);
    const body: VehicleBody = {
        orientation,
        position: {
            x,
            y: centerOfMassHeight + height,
            z,
        },
        spin: zeroVector,
        velocity: scaleVector(getBodyAxes(orientation).forward, speed),
    };

    return {
        ...describeBody(body),
        body,
        drivetrain: initialDrivetrain,
        loadAcceleration: {
            forward: 0,
            right: 0,
        },
        steer: 0,
        steerAngle: 0,
        stuckSeconds: 0,
        wheels: mapObjectValues(wheelOffsets, () => {
            return {
                airSeconds: 0,
                height: 0,
                heightRate: 0,
                tireSquash: 0,
            };
        }),
    };
}

export const initialVehicleState = createVehicleState({});

function easeSteer({
    steer,
    target,
    dtSeconds,
}: Readonly<{steer: number; target: number; dtSeconds: number}>) {
    const isReturning = Math.abs(target) < Math.abs(steer) || target * steer < 0;
    const maxChange = (isReturning ? steerReturnRate : steerRate) * dtSeconds;

    return (
        steer +
        clamp(target - steer, {
            max: maxChange,
            min: -maxChange,
        })
    );
}

/** Newtons on each axle. */
function getAxleLoads(loadAcceleration: Readonly<BodyAcceleration>) {
    /** Speeding up pushes weight onto the rear and braking onto the front. */
    const shift =
        (weightTransfer * mass * loadAcceleration.forward * centerOfMassHeight) / wheelBase;

    return {
        front: Math.max(0, (mass * gravity * rearAxleOffset) / wheelBase - shift),
        rear: Math.max(0, (mass * gravity * frontAxleOffset) / wheelBase + shift),
    };
}

/**
 * Sideways tire force, in newtons, from a linear slip curve cut off at whatever grip the axle's
 * forward force leaves. Past its peak, a tire's grip fades toward `slidingGrip` as it slides.
 */
function getCorneringForce({
    forwardForce,
    grip,
    slidingGrip,
    slipSpeed,
    slipAngle,
    stiffness,
    load,
    dtSeconds,
    pointMass,
}: Readonly<{
    forwardForce: number;
    grip: number;
    slidingGrip: number;
    slipSpeed: number;
    slipAngle: number;
    stiffness: number;
    load: number;
    dtSeconds: number;
    pointMass: number;
}>) {
    const slide = clamp(
        (Math.abs(slipAngle) - gripFadeSlipAngles.start) /
            (gripFadeSlipAngles.end - gripFadeSlipAngles.start),
        {
            max: 1,
            min: 0,
        },
    );
    const maxForce = Math.min(
        Math.sqrt(
            Math.max(0, ((grip + (slidingGrip - grip) * slide) * load) ** 2 - forwardForce ** 2),
        ),
        /**
         * Near a standstill the slip angle swings wildly from tiny sideways speeds. Friction can
         * only stop the tire's sideways motion, never reverse it, so cap the force at that.
         */
        (pointMass * Math.abs(slipSpeed)) / dtSeconds,
    );

    return clamp(-stiffness * slipAngle * load, {
        max: maxForce,
        min: -maxForce,
    });
}

/**
 * Radians of front wheel angle at full steer. Turning harder than the tires grip only spins the
 * car, so the lock shrinks with speed to the angle of the tightest turn the tires can hold.
 */
function getSteerLock(speed: number) {
    return Math.min(
        maxSteerAngle,
        tireGrip / frontCorneringStiffness +
            (wheelBase * tireGrip * gravity) / Math.max(speed ** 2, 1),
    );
}

/** How heavy the car feels to a sideways push at this distance from its center of mass. */
function getPointMass(offset: number) {
    return 1 / (1 / mass + offset ** 2 / yawInertia);
}

/** Walls only push, so anything bouncing off one leaves it. */
function getWallForce({
    velocity,
    wall,
}: Readonly<{
    velocity: Readonly<Vector>;
    wall: Readonly<WheelContact['wall']>;
}>): Vector {
    if (!wall) {
        return zeroVector;
    }

    const push = Math.max(
        0,
        wallStiffness * wall.depth -
            wallDamping * (velocity.x * wall.outward.x + velocity.z * wall.outward.z),
    );

    return {
        x: wall.outward.x * push,
        y: 0,
        z: wall.outward.z * push,
    };
}

/** Fraction of the bump stop's push that remains, which is less while the spring stretches off it. */
function getBumpStopRebound(heightRate: number) {
    return heightRate < 0 ? bumpStopRebound : 1;
}

/**
 * Newtons of friction per meter per second of slide that resist the body's slide velocity, so the
 * friction fades out as the slide stops instead of flipping direction.
 */
function getScrapeFriction({press, slideSpeed}: Readonly<{press: number; slideSpeed: number}>) {
    return slideSpeed > 0
        ? (scrapeGrip * press * Math.tanh(slideSpeed / holdingSpeed)) / slideSpeed
        : 0;
}

/** Each wheel's spring and tire forces, in newtons. */
function getWheelForces({
    axes,
    dtSeconds,
    getWheelContact,
    vehicle,
}: Readonly<{
    axes: Readonly<BodyAxes>;
    dtSeconds: number;
    getWheelContact: GetWheelContact;
    vehicle: Readonly<VehicleState>;
}>) {
    return mapObjectValues(wheelOffsets, (position, offset) => {
        const wheel = vehicle.wheels[position];
        const spring = springs[position];
        const arm = getArm(axes, {
            ...offset,
            up: wheel.height,
        });
        const bottom = addVectors(vehicle.body.position, arm);
        const contact = getWheelContact({
            point: {
                x: bottom.x,
                z: bottom.z,
            },
            radius: wheelRadius,
            wheelBottom: bottom.y,
        });
        const mountVelocity = getPointVelocity(vehicle.body, arm);
        const compression = wheel.height + restingSag;
        /**
         * Pushes the body up and the wheel down. The bump stop caps how far the spring squashes,
         * and the same stiffness stops the wheel dropping past full length.
         */
        const springForce =
            spring.stiffness * compression +
            spring.stiffness *
                bumpStopStiffness *
                (Math.max(0, compression - restingSag - springTravel) *
                    getBumpStopRebound(wheel.heightRate) +
                    Math.min(0, compression)) +
            spring.damping * wheel.heightRate * (wheel.heightRate < 0 ? reboundDamping : 1);
        const tireSquash = contact.height - bottom.y + spring.restingTireSquash;
        const rimSquash = tireSquash - rimStrikeSquash;
        /** Tires only push, so a wheel thrown upward leaves the ground. */
        const tireForce =
            tireSquash > 0
                ? Math.max(
                      0,
                      tireStiffness *
                          (tireSquash +
                              rimStiffness *
                                  Math.max(0, rimSquash) *
                                  (tireSquash < wheel.tireSquash ? rimRebound : 1)) -
                          tireDamping * (mountVelocity.y + axes.up.y * wheel.heightRate),
                  )
                : 0;
        const groundForce = scaleVector(
            {
                x: contact.push.x,
                y: 1,
                z: contact.push.z,
            },
            tireForce,
        );
        /**
         * The spring only gives along the body's up, so the rest of the ground's push goes straight
         * into the body.
         */
        const upShare = dot({
            first: groundForce,
            second: axes.up,
        });
        /** How much of the tire's push grows as the wheel sinks along the body's down. */
        const tireLeverage = tireForce > 0 ? Math.max(0, (axes.up.y * upShare) / tireForce) : 0;
        /** A tire is round, so the ground's push on it, from any angle, points at its hub. */
        const hubArm = addVectors(arm, scaleVector(axes.up, wheelRadius));
        /**
         * A wall hits the bumper beside the wheel, near the center of mass, so it tips the car
         * little.
         */
        const wallArm = getArm(axes, {
            ...offset,
            up: centerOfMassHeight,
        });

        return {
            airSeconds: tireForce > 0 ? 0 : wheel.airSeconds + dtSeconds,
            arm,
            forces: [
                {
                    arm: hubArm,
                    force: addVectors(groundForce, scaleVector(axes.up, springForce - upShare)),
                },
                {
                    arm: wallArm,
                    force: getWallForce({
                        velocity: getPointVelocity(vehicle.body, wallArm),
                        wall: contact.wall,
                    }),
                },
            ],
            /** Newton seconds per meter that the wheel's forces resist its rising. */
            damping:
                spring.damping * (wheel.heightRate < 0 ? reboundDamping : 1) +
                tireDamping * tireLeverage,
            springForce,
            /** Newtons per meter that the wheel's forces push it back down as it rises. */
            stiffness:
                spring.stiffness *
                    (1 +
                        bumpStopStiffness *
                            (compression > restingSag + springTravel
                                ? getBumpStopRebound(wheel.heightRate)
                                : compression < 0
                                  ? 1
                                  : 0)) +
                tireStiffness *
                    (1 +
                        (rimSquash > 0
                            ? rimStiffness * (tireSquash < wheel.tireSquash ? rimRebound : 1)
                            : 0)) *
                    tireLeverage,
            tireSquash,
            upShare,
            upSpeed:
                dot({
                    first: mountVelocity,
                    second: axes.up,
                }) + wheel.heightRate,
        };
    });
}

/** The ground and walls pushing on the body's edges, in newtons, when it scrapes, lands, or crashes. */
function getEdgeForces({
    axes,
    body,
    getWheelContact,
}: Readonly<{
    axes: Readonly<BodyAxes>;
    body: Readonly<VehicleBody>;
    getWheelContact: GetWheelContact;
}>) {
    return edgePoints.map((point) => {
        const arm = getArm(axes, point);
        const spot = addVectors(body.position, arm);
        const sideContact = getWheelContact({
            point: {
                x: spot.x,
                z: spot.z,
            },
            radius: edgeRadius,
            wheelBottom: spot.y,
        });
        /**
         * The contact treats anything sunk far below an obstacle's top as beside it, as a wheel
         * would be, but the body can come down onto an obstacle's edge from above, so it leaves by
         * whichever way out is shorter.
         */
        const topContact = sideContact.wall
            ? getWheelContact({
                  point: {
                      x: spot.x,
                      z: spot.z,
                  },
                  radius: edgeRadius,
                  wheelBottom: Infinity,
              })
            : undefined;
        const contact =
            topContact && topContact.height - spot.y < (sideContact.wall?.depth ?? 0)
                ? topContact
                : sideContact;
        const velocity = getPointVelocity(body, arm);
        const depth = contact.height - spot.y;
        /** A slope rises to meet a spot sliding up it, so only rising faster than it lifts off. */
        const liftSpeed = velocity.y + contact.push.x * velocity.x + contact.push.z * velocity.z;
        const press =
            depth > 0
                ? Math.max(
                      0,
                      scrapeStiffness * depth * (liftSpeed > 0 ? scrapeRebound : 1) -
                          scrapeDamping * liftSpeed,
                  )
                : 0;
        const slideSpeed = Math.hypot(velocity.x, velocity.z);
        const friction = getScrapeFriction({
            press,
            slideSpeed,
        });

        return {
            arm,
            spark:
                press > 0 && slideSpeed > sparkSpeed
                    ? {
                          position: spot,
                          velocity,
                      }
                    : undefined,
            force: addVectors(
                {
                    x: contact.push.x * press - velocity.x * friction,
                    y: press,
                    z: contact.push.z * press - velocity.z * friction,
                },
                getWallForce({
                    velocity,
                    wall: contact.wall,
                }),
            ),
        };
    });
}

/** The box whose bottom is the car's floor. */
const floorBox = carBoxes.reduce((lowest, box) => {
    return box.center.up - box.height / 2 < lowest.center.up - lowest.height / 2 ? box : lowest;
});
/** Meters around the car past which no obstacle edge can reach its floor. */
const floorReach =
    Math.hypot(floorBox.length, floorBox.width) / 2 + Math.abs(floorBox.center.forward);

/**
 * The car's floor pressing down onto an obstacle's sharp edge. The edge points check the ground
 * only at a few spots, so a raised edge can slip between them, most of all while the car leans.
 */
function getFloorForces({
    axes,
    body,
    obstacleEdges,
}: Readonly<{
    axes: Readonly<BodyAxes>;
    body: Readonly<VehicleBody>;
    obstacleEdges: ReadonlyArray<Readonly<ObstacleEdge>>;
}>) {
    function toCarPoint(point: Readonly<Vector>): CarPoint {
        const offset = addVectors(point, scaleVector(body.position, -1));

        return {
            forward: dot({
                first: offset,
                second: axes.forward,
            }),
            right: dot({
                first: offset,
                second: axes.right,
            }),
            up:
                dot({
                    first: offset,
                    second: axes.up,
                }) + centerOfMassHeight,
        };
    }

    const floor = floorBox.center.up - floorBox.height / 2;

    return obstacleEdges
        .filter((edge) => {
            return (
                Math.min(edge.start.x, edge.end.x) - floorReach < body.position.x &&
                Math.max(edge.start.x, edge.end.x) + floorReach > body.position.x &&
                Math.min(edge.start.z, edge.end.z) - floorReach < body.position.z &&
                Math.max(edge.start.z, edge.end.z) + floorReach > body.position.z
            );
        })
        .flatMap((edge) => {
            const start = toCarPoint(edge.start);
            const end = toCarPoint(edge.end);
            /** The fractions along the edge where it enters and leaves the box. */
            const inside = (
                [
                    [
                        'forward',
                        floorBox.length,
                    ],
                    [
                        'right',
                        floorBox.width,
                    ],
                    [
                        'up',
                        floorBox.height,
                    ],
                ] as const
            ).reduce<
                Record<'enter' | 'exit', number> &
                    PartialWithUndefined<Record<'enterFace' | 'exitFace', keyof CarPoint>>
            >(
                (
                    range,
                    [
                        key,
                        size,
                    ],
                ) => {
                    const from = start[key] - floorBox.center[key];
                    const change = end[key] - start[key];

                    if (change === 0) {
                        return Math.abs(from) < size / 2
                            ? range
                            : {
                                  enter: 1,
                                  exit: 0,
                              };
                    }

                    const first = (-size / 2 - from) / change;
                    const second = (size / 2 - from) / change;

                    return {
                        ...range,
                        ...(Math.min(first, second) > range.enter
                            ? {
                                  enter: Math.min(first, second),
                                  enterFace: key,
                              }
                            : {}),
                        ...(Math.max(first, second) < range.exit
                            ? {
                                  exit: Math.max(first, second),
                                  exitFace: key,
                              }
                            : {}),
                    };
                },
                {
                    enter: 0,
                    exit: 1,
                },
            );

            if (inside.enter >= inside.exit) {
                return [];
            }

            const deepest = [
                {
                    face: inside.enterFace,
                    fraction: inside.enter,
                },
                {
                    face: inside.exitFace,
                    fraction: inside.exit,
                },
            ]
                .map(({face, fraction}) => {
                    return {
                        face,
                        point: {
                            forward: start.forward + (end.forward - start.forward) * fraction,
                            right: start.right + (end.right - start.right) * fraction,
                            up: start.up + (end.up - start.up) * fraction,
                        },
                    };
                })
                .reduce((highest, next) => (next.point.up > highest.point.up ? next : highest));
            const depth = deepest.point.up - floor;

            /** Deeper than halfway in, the edge is past the floor, and the edge points push it out. */
            if (depth > floorBox.height / 2) {
                return [];
            }

            const arm = getArm(axes, deepest.point);
            const velocity = getPointVelocity(body, arm);
            const upSpeed = dot({
                first: velocity,
                second: axes.up,
            });
            /**
             * Where the edge crosses one of the box's faces, the spot it presses at slides along
             * the edge as the car moves, so a sloped edge rises to meet the floor and only rising
             * faster than it lifts off.
             */
            const liftSpeed = deepest.face
                ? upSpeed -
                  ((end.up - start.up) *
                      dot({
                          first: velocity,
                          second: axes[deepest.face],
                      })) /
                      (end[deepest.face] - start[deepest.face])
                : upSpeed;
            const press = Math.max(
                0,
                floorStiffness * depth * (liftSpeed > 0 ? scrapeRebound : 1) -
                    scrapeDamping * liftSpeed,
            );
            const slide = addVectors(velocity, scaleVector(axes.up, -upSpeed));
            const slideSpeed = getVectorLength(slide);
            const friction = getScrapeFriction({
                press,
                slideSpeed,
            });

            return [
                {
                    arm,
                    force: addVectors(scaleVector(axes.up, press), scaleVector(slide, -friction)),
                    spark:
                        press > 0 && slideSpeed > sparkSpeed
                            ? {
                                  position: addVectors(body.position, arm),
                                  velocity,
                              }
                            : undefined,
                },
            ];
        });
}

/** Turns the spin by the torque, worked out in the car's own axes where its inertia is simple. */
function stepSpin({
    dtSeconds,
    orientation,
    spin,
    torque,
}: Readonly<{
    dtSeconds: number;
    orientation: Readonly<Quaternion>;
    spin: Readonly<Vector>;
    torque: Readonly<Vector>;
}>) {
    const ownSpin = rotateVector(invertRotation(orientation), spin);
    const ownTorque = rotateVector(invertRotation(orientation), torque);
    /** A spinning body's momentum swings its spin between axes, which tumbles a flipping car. */
    const gyroscopic = cross({
        first: ownSpin,
        second: {
            x: ownSpin.x * bodyInertia.x,
            y: ownSpin.y * bodyInertia.y,
            z: ownSpin.z * bodyInertia.z,
        },
    });

    return rotateVector(orientation, {
        x: ownSpin.x + ((ownTorque.x - gyroscopic.x) / bodyInertia.x) * dtSeconds,
        y: ownSpin.y + ((ownTorque.y - gyroscopic.y) / bodyInertia.y) * dtSeconds,
        z: ownSpin.z + ((ownTorque.z - gyroscopic.z) / bodyInertia.z) * dtSeconds,
    });
}

function turnOrientation({
    dtSeconds,
    orientation,
    spin,
}: Readonly<{
    dtSeconds: number;
    orientation: Readonly<Quaternion>;
    spin: Readonly<Vector>;
}>): Quaternion {
    const turn = combineRotations({
        first: {
            ...scaleVector(spin, dtSeconds / 2),
            w: 0,
        },
        second: orientation,
    });
    const turned = {
        w: orientation.w + turn.w,
        x: orientation.x + turn.x,
        y: orientation.y + turn.y,
        z: orientation.z + turn.z,
    };
    const length = Math.hypot(turned.w, turned.x, turned.y, turned.z);

    return {
        w: turned.w / length,
        x: turned.x / length,
        y: turned.y / length,
        z: turned.z / length,
    };
}

function stepPhysics({
    controls,
    dtSeconds,
    getWheelContact,
    obstacleEdges,
    vehicle,
}: Readonly<{
    controls: Readonly<CarControls>;
    dtSeconds: number;
    getWheelContact: GetWheelContact;
    obstacleEdges: ReadonlyArray<Readonly<ObstacleEdge>>;
    vehicle: Readonly<VehicleState>;
}>) {
    const axes = getBodyAxes(vehicle.body.orientation);
    const wheelForces = getWheelForces({
        axes,
        dtSeconds,
        getWheelContact,
        vehicle,
    });
    /**
     * An axle keeps its grip while either wheel touches, since the touching wheel takes the lifted
     * one's weight.
     */
    const isGrounded: Readonly<Record<WheelPosition, boolean>> = mapObjectValues(
        wheelForces,
        (position, {airSeconds}) => {
            return (
                airSeconds <
                convertDuration(airGrip, {
                    seconds: true,
                }).seconds
            );
        },
    );
    const groundedShare =
        getObjectTypedValues(isGrounded).filter(Boolean).length /
        getObjectTypedValues(isGrounded).length;
    /** Tires on a car tipped onto its side touch the ground with their sidewalls, which don't grip. */
    const uprightness = clamp(axes.up.y, {
        max: 1,
        min: 0,
    });
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
    const holding = Math.tanh(vehicle.speed / holdingSpeed);
    const loads = getAxleLoads(vehicle.loadAcceleration);
    const gripLoads = {
        front:
            isGrounded[WheelPosition.FrontLeft] || isGrounded[WheelPosition.FrontRight]
                ? loads.front * uprightness
                : 0,
        rear:
            isGrounded[WheelPosition.RearLeft] || isGrounded[WheelPosition.RearRight]
                ? loads.rear * uprightness
                : 0,
    };
    const brakeForce = pedals.brake * brakeStrength * mass * gravity * holding;
    const rearGrip = tireGrip * rearGripBias;
    const frontForwardForce = clamp((-brakeForce * loads.front) / (loads.front + loads.rear), {
        max: tireGrip * gripLoads.front,
        min: -tireGrip * gripLoads.front,
    });
    const rollingRearForwardForce = clamp(
        engine.driveForce - (brakeForce * loads.rear) / (loads.front + loads.rear),
        {
            max: rearGrip * gripLoads.rear,
            min: -rearGrip * gripLoads.rear,
        },
    );

    /** The axles move sideways faster or slower than the body as it yaws. */
    const frontSideSpeed = vehicle.lateralSpeed + frontAxleOffset * vehicle.yawRate;
    const rearSideSpeed = vehicle.lateralSpeed - rearAxleOffset * vehicle.yawRate;
    const wheelAngle =
        Math.sign(vehicle.steer) *
        Math.abs(vehicle.steer) ** steerCurve *
        getSteerLock(vehicle.speed);
    const travelSteerAngle = wheelAngle * Math.sign(vehicle.speed);
    const frontCornering = getCorneringForce({
        dtSeconds,
        forwardForce: frontForwardForce,
        grip: tireGrip,
        load: gripLoads.front,
        pointMass: getPointMass(frontAxleOffset),
        slidingGrip: tireGrip * lockedGrip,
        slipAngle: Math.atan2(frontSideSpeed, Math.abs(vehicle.speed)) - travelSteerAngle,
        slipSpeed: frontSideSpeed * Math.cos(wheelAngle) - vehicle.speed * Math.sin(wheelAngle),
        stiffness: frontCorneringStiffness,
    });
    const rollingRearCornering = getCorneringForce({
        dtSeconds,
        forwardForce: rollingRearForwardForce,
        grip: rearGrip,
        load: gripLoads.rear,
        pointMass: getPointMass(rearAxleOffset),
        /** Rear tires that kept fading as they slid would spin the car out of every throttle drift. */
        slidingGrip: rearGrip,
        slipAngle: Math.atan2(rearSideSpeed, Math.abs(vehicle.speed)),
        slipSpeed: rearSideSpeed,
        stiffness: rearCorneringStiffness,
    });
    /**
     * Locked tires slide, so all of their grip pulls straight against the way they're sliding.
     * Spending it along the body instead would leave too little to stop a spin.
     */
    const rearSlideSpeed = Math.hypot(vehicle.speed, rearSideSpeed);
    const lockedRearForce =
        rearSlideSpeed > 0
            ? (rearGrip * lockedGrip * gripLoads.rear * Math.tanh(rearSlideSpeed / holdingSpeed)) /
              rearSlideSpeed
            : 0;
    const rearForwardForce =
        rollingRearForwardForce +
        (-lockedRearForce * vehicle.speed - rollingRearForwardForce) * controls.handbrake;
    const rearCornering =
        rollingRearCornering +
        (-lockedRearForce * rearSideSpeed - rollingRearCornering) * controls.handbrake;

    const cos = Math.cos(wheelAngle);
    const sin = Math.sin(wheelAngle);

    /** An axle's tires push where they touch the ground. */
    function getAxleArm(positions: ReadonlyArray<WheelPosition>) {
        const touching = positions.filter((position) => isGrounded[position]);
        const pushing = touching.length ? touching : positions;

        return scaleVector(
            addVectors(...pushing.map((position) => wheelForces[position].arm)),
            1 / pushing.length,
        );
    }

    const bodyForces = [
        ...getEdgeForces({
            axes,
            body: vehicle.body,
            getWheelContact,
        }),
        ...getFloorForces({
            axes,
            body: vehicle.body,
            obstacleEdges,
        }),
    ];
    const forces = [
        {
            arm: getAxleArm([
                WheelPosition.FrontLeft,
                WheelPosition.FrontRight,
            ]),
            /** The front tires push along and across their own steered direction. */
            force: addVectors(
                scaleVector(axes.forward, frontForwardForce * cos - frontCornering * sin),
                scaleVector(axes.right, frontForwardForce * sin + frontCornering * cos),
            ),
        },
        {
            arm: getAxleArm([
                WheelPosition.RearLeft,
                WheelPosition.RearRight,
            ]),
            force: addVectors(
                scaleVector(axes.forward, rearForwardForce),
                scaleVector(axes.right, rearCornering),
            ),
        },
        ...getObjectTypedValues(wheelForces).flatMap((wheel) => wheel.forces),
        ...bodyForces,
    ];
    /** Everything but gravity, which only pulls at the center of mass. */
    const pushForce = addVectors(
        ...forces.map(({force}) => force),
        scaleVector(vehicle.body.velocity, -airDrag * getVectorLength(vehicle.body.velocity)),
        scaleVector(axes.forward, -rollingResistance * holding * groundedShare),
    );
    const velocity = addVectors(vehicle.body.velocity, scaleVector(pushForce, dtSeconds / mass), {
        x: 0,
        y: -gravity * dtSeconds,
        z: 0,
    });
    const spin = stepSpin({
        dtSeconds,
        orientation: vehicle.body.orientation,
        spin: vehicle.body.spin,
        torque: addVectors(
            ...forces.map(({arm, force}) => {
                return cross({
                    first: arm,
                    second: force,
                });
            }),
        ),
    });
    const body: VehicleBody = {
        orientation: turnOrientation({
            dtSeconds,
            orientation: vehicle.body.orientation,
            spin,
        }),
        position: addVectors(vehicle.body.position, scaleVector(velocity, dtSeconds)),
        spin,
        velocity,
    };
    const nextAxes = getBodyAxes(body.orientation);
    const settle =
        1 -
        Math.exp(
            -dtSeconds /
                convertDuration(loadSettle, {
                    seconds: true,
                }).seconds,
        );

    return {
        ...vehicle,
        ...describeBody(body),
        body,
        drivetrain: engine.drivetrain,
        sparks: bodyForces.flatMap(({spark}): CarSpark[] => {
            return spark
                ? [
                      spark,
                  ]
                : [];
        }),
        loadAcceleration: {
            forward:
                vehicle.loadAcceleration.forward +
                (dot({
                    first: pushForce,
                    second: axes.forward,
                }) /
                    mass -
                    vehicle.loadAcceleration.forward) *
                    settle,
            right:
                vehicle.loadAcceleration.right +
                (dot({
                    first: pushForce,
                    second: axes.right,
                }) /
                    mass -
                    vehicle.loadAcceleration.right) *
                    settle,
        },
        steerAngle: wheelAngle,
        wheels: mapObjectValues(
            wheelForces,
            (
                position,
                {airSeconds, damping, springForce, stiffness, tireSquash, upShare, upSpeed},
            ): WheelSuspension => {
                const wheel = vehicle.wheels[position];
                /**
                 * The wheel slides along the body's up, so it moves with the body in every other
                 * direction. It's light and its tire, rim, and bump stop are stiff, so a plain step
                 * overshoots into a chatter that pumps energy in or out at random. This implicit
                 * step aims at where the forces will be instead, which keeps it calm.
                 */
                const nextUpSpeed =
                    upSpeed +
                    (dtSeconds *
                        (upShare -
                            springForce -
                            wheelMass * gravity * axes.up.y -
                            dtSeconds * stiffness * wheel.heightRate)) /
                        (wheelMass + dtSeconds * damping + dtSeconds ** 2 * stiffness);
                const nextMountUpSpeed = dot({
                    first: getPointVelocity(
                        body,
                        getArm(nextAxes, {
                            ...wheelOffsets[position],
                            up: wheel.height,
                        }),
                    ),
                    second: nextAxes.up,
                });
                const heightRate = nextUpSpeed - nextMountUpSpeed;

                return {
                    airSeconds,
                    height: wheel.height + heightRate * dtSeconds,
                    heightRate,
                    tireSquash,
                };
            },
        ),
    };
}

const flatSurface = {
    getWheelContact: getFlatWheelContact,
    obstacleEdges: [],
};

/**
 * Moves the car one frame. Each axle's tires push sideways in proportion to their slip angle until
 * they run out of grip, and braking or drive force on an axle uses up some of that grip.
 */
export function stepVehicle({
    controls,
    dtSeconds,
    surface = flatSurface,
    vehicle,
}: Readonly<{
    controls: Readonly<CarControls>;
    dtSeconds: number;
    /** Flat ground with no obstacles when omitted. */
    surface?:
        | Readonly<{
              getWheelContact: GetWheelContact;
              /** The sharp edges of whatever `getWheelContact` raises off the ground. */
              obstacleEdges: ReadonlyArray<Readonly<ObstacleEdge>>;
          }>
        | undefined;
    vehicle: Readonly<VehicleState>;
}>) {
    /**
     * Dividing by a zero `dtSeconds` in the tire slip-friction cap turns the whole state into
     * `NaN`.
     */
    if (dtSeconds <= 0) {
        return vehicle;
    }

    const steer = easeSteer({
        dtSeconds,
        steer: vehicle.steer,
        target: controls.steer,
    });
    const stepCount = Math.max(1, Math.ceil(dtSeconds * minStepsPerSecond));
    const stepped = createArray(stepCount, () => undefined).reduce<VehicleState>(
        (current) => {
            const next = stepPhysics({
                controls,
                dtSeconds: dtSeconds / stepCount,
                getWheelContact: surface.getWheelContact,
                obstacleEdges: surface.obstacleEdges,
                vehicle: current,
            });

            return {
                ...next,
                sparks: [
                    ...(current.sparks ?? []),
                    ...next.sparks,
                ],
            };
        },
        {
            ...vehicle,
            sparks: [],
            drivetrain: chooseAutomaticGear({
                controls,
                drivetrain: vehicle.drivetrain,
                forwardSpeed: vehicle.speed,
            }),
            steer,
        },
    );
    const isStuck =
        getBodyAxes(stepped.body.orientation).up.y < minUprightUp &&
        getVectorLength(stepped.body.velocity) < stuckSpeed;
    const stuckSeconds = isStuck ? stepped.stuckSeconds + dtSeconds : 0;

    if (
        stuckSeconds <
        convertDuration(recoveryDelay, {
            seconds: true,
        }).seconds
    ) {
        return {
            ...stepped,
            ghostSeconds: Math.max(0, (vehicle.ghostSeconds ?? 0) - dtSeconds),
            stuckSeconds,
        };
    }

    return recoverVehicle({
        getWheelContact: surface.getWheelContact,
        vehicle: stepped,
    });
}

/**
 * Sets the car upright on its wheels where it is, facing the same way, and stops it. It stays a
 * ghost for a few seconds after. The gear and automatic or manual choice carry over.
 */
export function recoverVehicle({
    getWheelContact = getFlatWheelContact,
    vehicle,
}: Readonly<{
    /** Flat ground when omitted. */
    getWheelContact?: GetWheelContact | undefined;
    vehicle: Readonly<VehicleState>;
}>) {
    const uprightAxes = getBodyAxes(getHeadingRotation(vehicle.heading));
    /** Clears whatever the wheels would rest on, such as a curb or the ramp. */
    const groundHeight = Math.max(
        ...getObjectTypedValues(wheelOffsets).map((offset) => {
            const point = addVectors(
                vehicle.body.position,
                addVectors(
                    scaleVector(uprightAxes.forward, offset.forward),
                    scaleVector(uprightAxes.right, offset.right),
                ),
            );

            return getWheelContact({
                point,
                radius: wheelRadius,
                wheelBottom: vehicle.body.position.y,
            }).height;
        }),
    );

    return {
        ...createVehicleState({
            heading: vehicle.heading,
            height: groundHeight + recoveryDrop,
            x: vehicle.x,
            z: vehicle.z,
        }),
        drivetrain: vehicle.drivetrain,
        ghostSeconds: convertDuration(recoveryGhost, {
            seconds: true,
        }).seconds,
    };
}

/** Newtons on each tire, for display. The handling uses only the front-to-rear shift. */
export function getTireLoads(vehicle: Readonly<Pick<VehicleState, 'loadAcceleration'>>) {
    const axleLoads = getAxleLoads(vehicle.loadAcceleration);

    return mapObjectValues(wheelOffsets, (position, offset) => {
        /** Turning pushes weight onto the outside wheels. */
        const lateralTransfer =
            (-Math.sign(offset.right) *
                mass *
                vehicle.loadAcceleration.right *
                centerOfMassHeight) /
            trackWidth /
            2;

        return Math.max(
            0,
            (offset.forward > 0 ? axleLoads.front : axleLoads.rear) / 2 + lateralTransfer,
        );
    });
}

/** How the body sits, for the scene to draw. */
export function getBodyLean(
    vehicle: Readonly<Pick<VehicleState, 'body' | 'heading' | 'wheels'>>,
): CarBodyLean {
    return {
        height:
            vehicle.body.position.y -
            getBodyAxes(vehicle.body.orientation).up.y * centerOfMassHeight,
        tilt: combineRotations({
            first: invertRotation(getHeadingRotation(vehicle.heading)),
            second: vehicle.body.orientation,
        }),
        wheelHeights: mapObjectValues(vehicle.wheels, (position, wheel) => {
            return wheel.height;
        }),
    };
}
