// cspell:words torsen understeer
import {type PartialWithUndefined} from '@augment-vir/common';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {type AnyDuration} from 'date-vir';
import {curveKey, type AnimationCurve} from './animation-curve.js';
import {type Vector3} from './vector.js';

/**
 * Every car in the garage. `Sedan` is based on Shift's BMW E30 tuning; the rest are variations on
 * it that show off Shift's other drivetrain and differential options.
 */
export enum CarPreset {
    Sedan = 'sedan',
    Drift = 'drift',
    Muscle = 'muscle',
    Stunt = 'stunt',
    Rally = 'rally',
    MonsterTruck = 'monster-truck',
}

export enum Axle {
    Front = 'front',
    Rear = 'rear',
}

/** How an axle's differential splits torque between its two wheels. Same as Shift's `DiffType`. */
export enum DifferentialKind {
    /** Always half to each wheel. */
    Open = 'open',
    /** Up to the torque bias ratio more to the wheel that grips. */
    Torsen = 'torsen',
    /** A clutch pack that locks harder the more torque goes through it. */
    ClutchLsd = 'clutch-lsd',
}

/** Which wheels share one ABS valve. Same as Shift's `ABSChannelMode`. */
export enum AbsChannels {
    /** One valve per axle. */
    Two = 'two',
    /** One valve per front wheel, one for the whole rear axle. */
    Three = 'three',
    Four = 'four',
}

/**
 * A box the car's body is built from, in the car frame: +x left, +y up, +z forward, in meters from
 * the body's origin.
 */
export type BodyBox = {
    center: Vector3;
    halfSize: Vector3;
};

export type AxleTuning = {
    /** Car frame z of the axle's suspension mounts. */
    mountZ: number;
    /** Car frame y of the axle's suspension mounts, where each ground ray starts. */
    mountY: number;
    /** Half the distance between the axle's two wheels. */
    halfTrack: number;
    /** Fraction of the car's weight this axle carries, which sizes its springs. */
    weightShare: number;
    /** Hertz the axle bounces at on its springs. */
    rideFrequency: number;
    /** Newtons per meter of compression difference across the axle. 0 for no anti-roll bar. */
    antiRollStiffness: number;
    /**
     * Multiplies the tire's grip and lateral stiffness on this axle, as a wider tire would. Rear
     * tires that out-grip the fronts make the car understeer at the limit instead of spinning.
     */
    tireScale: number;
    differential: DifferentialKind;
};

export type SuspensionTuning = {
    /** Meters from the mount to the ground with the spring fully extended. */
    restLength: number;
    maxCompression: number;
    /** 1 is critical damping. */
    damperRatio: number;
    /** 1 makes damping force linear in suspension speed. */
    velocityExponent: number;
};

/** Shift's brush tire model. */
export type TireTuning = {
    radius: number;
    rimRadius: number;
    width: number;
    /** Kilogram square meters, the whole wheel's. */
    inertia: number;
    rollingResistance: number;
    /** Newtons per unit of slip ratio. */
    longitudinalStiffness: number;
    /** Newtons per unit of slip angle's tangent. */
    lateralStiffness: number;
    /** The friction coefficient. */
    grip: number;
};

export type SteeringTuning = {
    /** Degrees the front wheels turn at most. */
    maxAngle: number;
    /** Degrees the steering wheel turns from center to full lock. */
    wheelTravel: number;
    /** Steering wheel degrees per wheel degree. */
    ratio: number;
    /** Radians per second a front wheel turns toward where it's steered. */
    turnSpeed: number;
    /** 0 steers both front wheels the same; 1 is full Ackermann geometry. */
    ackermannFactor: number;
    /**
     * Steering lock shrinks by `1 + speedFactor × speed`, so a keyboard's full lock doesn't spin
     * the car at speed.
     */
    speedFactor: number;
};

export type AbsTuning = {
    channels: AbsChannels;
    /** A channel's slip ratio below this lets off its brakes. */
    slipApply: number;
    /** A channel's slip ratio above this brakes fully again. */
    slipRelease: number;
    /** Fraction of the brake pedal a channel holds while letting off. */
    pedalTarget: number;
    /** Pedal fraction per second a channel lets off at. */
    releaseRate: number;
    /** Pedal fraction per second a channel brakes harder at. */
    applyRate: number;
};

export type TractionControlTuning = {
    /** The worst driven wheel's slip ratio above this cuts torque. */
    slipEngage: number;
    /** Every driven wheel's slip ratio below this restores torque. */
    slipRecover: number;
    /** Fraction of the engine's torque kept while cutting. */
    torqueFactor: number;
    /** Torque fraction per second the cut comes in at. */
    cutRate: number;
    /** Torque fraction per second it recovers at. */
    restoreRate: number;
};

export type EngineTuning = {
    /** Newton meters at the torque curve's peak. */
    maxTorque: number;
    maxRpm: number;
    idleRpm: number;
    /** Kilogram square meters. */
    inertia: number;
    /** Fraction of `maxTorque` over the fraction of `maxRpm`. */
    torqueCurve: AnimationCurve;
    /**
     * Newton meters the engine drags itself down by with the throttle closed: `constant + linear ×
     * n + quadratic × n²`, where `n` is the fraction of `maxRpm`.
     */
    friction: Record<'constant' | 'linear' | 'quadratic', number>;
};

export type DrivetrainTuning = {
    /** In order: reverse, neutral, then each forward gear. */
    gears: ReadonlyArray<number>;
    finalDrive: number;
    /** Newton meters. */
    maxClutchTorque: number;
    efficiency: number;
    /** Fraction of the torque the front axle gets: 0 for rear-wheel drive, 1 for front. */
    frontTorqueShare: number;
    /** Torsen differentials only: most times more torque one wheel can get than the other. */
    torqueBiasRatio: number;
    /** Clutch LSDs only: Newton meters the clutches lock with before any torque goes through. */
    lsdPreload: number;
    /** Clutch LSDs only: lock per Newton meter of torque through the differential. */
    lsdRamp: number;
    /** How long the drive is cut while changing gear. */
    shiftDuration: AnyDuration;
};

export type CarPresetTuning = {
    label: string;
    description: string;
    /** Kilograms. */
    mass: number;
    centerOfMassOffset: Vector3;
    bodyBoxes: ReadonlyArray<Readonly<BodyBox>>;
    axles: Readonly<Record<Axle, Readonly<AxleTuning>>>;
    suspension: Readonly<SuspensionTuning>;
    tire: Readonly<TireTuning>;
    steering: Readonly<SteeringTuning>;
    /** Newton meters across all four wheels. */
    maxBrakeTorque: number;
    /** Fraction of {@link CarPresetTuning.maxBrakeTorque} on the front wheels. */
    frontBrakeShare: number;
    engine: Readonly<EngineTuning>;
    drivetrain: Readonly<DrivetrainTuning>;
} & PartialWithUndefined<{
    abs: Readonly<AbsTuning>;
    tractionControl: Readonly<TractionControlTuning>;
    hasHeadlights: boolean;
}>;

export const wheelAxles: Readonly<Record<WheelPosition, Axle>> = {
    [WheelPosition.FrontLeft]: Axle.Front,
    [WheelPosition.FrontRight]: Axle.Front,
    [WheelPosition.RearLeft]: Axle.Rear,
    [WheelPosition.RearRight]: Axle.Rear,
};

/** +1 for the car's left side, which is +x in the car frame. */
export const wheelSides: Readonly<Record<WheelPosition, number>> = {
    [WheelPosition.FrontLeft]: 1,
    [WheelPosition.FrontRight]: -1,
    [WheelPosition.RearLeft]: 1,
    [WheelPosition.RearRight]: -1,
};

/** Shift's `e30curve.tres`. */
const e30TorqueCurve: AnimationCurve = [
    curveKey({
        time: 0,
        value: 0.069,
        inTangent: 0,
        outTangent: 0.75323457,
    }),
    curveKey({
        time: 0.048,
        value: 0.29,
        inTangent: 2.5426915,
    }),
    curveKey({
        time: 0.12,
        value: 0.54,
        inTangent: 2.0723069,
    }),
    curveKey({
        time: 0.26,
        value: 0.783,
        inTangent: 0.8418261,
    }),
    curveKey({
        time: 0.388,
        value: 0.897,
        inTangent: 0.63129985,
    }),
    curveKey({
        time: 0.515,
        value: 0.966,
        inTangent: 0.42882746,
    }),
    curveKey({
        time: 0.642,
        value: 1,
        inTangent: -0.02690968,
    }),
    curveKey({
        time: 0.795,
        value: 0.914,
        inTangent: -1.1716069,
    }),
    curveKey({
        time: 0.92750925,
        value: 0.75,
        inTangent: -1.5533131,
    }),
    curveKey({
        time: 1,
        value: 0.535,
        inTangent: -5.557742,
    }),
];

const carBodyBoxes: ReadonlyArray<Readonly<BodyBox>> = [
    {
        center: {
            x: 0,
            y: -0.05,
            z: 0,
        },
        halfSize: {
            x: 0.85,
            y: 0.28,
            z: 1.9,
        },
    },
    {
        center: {
            x: 0,
            y: 0.45,
            z: -0.25,
        },
        halfSize: {
            x: 0.72,
            y: 0.24,
            z: 0.95,
        },
    },
];

const defaultAbs: Readonly<AbsTuning> = {
    applyRate: 4,
    channels: AbsChannels.Four,
    pedalTarget: 0.25,
    releaseRate: 20,
    slipApply: -0.15,
    slipRelease: -0.08,
};

/** Shift's defaults from `values.gd`. */
const defaultTractionControl: Readonly<TractionControlTuning> = {
    cutRate: 6,
    restoreRate: 2,
    slipEngage: 0.14,
    slipRecover: 0.08,
    torqueFactor: 0.3,
};

const e30Axle: Readonly<AxleTuning> = {
    antiRollStiffness: 0,
    differential: DifferentialKind.Open,
    halfTrack: 0.7,
    mountY: -0.1,
    mountZ: 1.285,
    rideFrequency: 1.5,
    tireScale: 1,
    weightShare: 0.53,
};

/**
 * Shift's `e30.tres`, with the defaults from `values.gd` for what it leaves unset. Its brakes, ABS,
 * steering, and rear tires are tuned like a real road car's, since Shift's own values lock the rear
 * wheels under braking and spin the car at the limit.
 */
const sedanTuning: Readonly<CarPresetTuning> = {
    abs: defaultAbs,
    axles: {
        [Axle.Front]: e30Axle,
        [Axle.Rear]: {
            ...e30Axle,
            mountZ: -1.285,
            tireScale: 1.1,
            weightShare: 0.47,
        },
    },
    bodyBoxes: carBodyBoxes,
    centerOfMassOffset: {
        x: 0,
        y: -0.1,
        z: 0.1,
    },
    description: 'A BMW E30: rear-wheel drive, open differential, five speeds.',
    drivetrain: {
        efficiency: 1,
        finalDrive: 3.25,
        frontTorqueShare: 0,
        gears: [
            -3.46,
            0,
            3.71,
            2.403,
            1.681,
            1.26,
            1,
        ],
        lsdPreload: 100,
        lsdRamp: 1,
        maxClutchTorque: 300,
        shiftDuration: {
            milliseconds: 200,
        },
        torqueBiasRatio: 2,
    },
    engine: {
        friction: {
            constant: 3,
            linear: 4.5,
            quadratic: 8,
        },
        idleRpm: 850,
        inertia: 0.239,
        maxRpm: 6750,
        maxTorque: 230,
        torqueCurve: e30TorqueCurve,
    },
    hasHeadlights: true,
    label: 'Sedan',
    frontBrakeShare: 0.7,
    mass: 1200,
    maxBrakeTorque: 5400,
    steering: {
        ackermannFactor: 1,
        maxAngle: 37.5,
        ratio: 20.5,
        speedFactor: 0.12,
        turnSpeed: 3.5,
        wheelTravel: 720,
    },
    suspension: {
        damperRatio: 0.4,
        maxCompression: 0.3,
        restLength: 0.5,
        velocityExponent: 1,
    },
    tire: {
        grip: 1.25,
        inertia: 0.486,
        lateralStiffness: 50_000,
        longitudinalStiffness: 65_000,
        radius: 0.303,
        rimRadius: 0.22,
        rollingResistance: 0.0105,
        width: 0.11,
    },
    tractionControl: defaultTractionControl,
};

export const carPresets: Readonly<Record<CarPreset, Readonly<CarPresetTuning>>> = {
    [CarPreset.Sedan]: sedanTuning,
    [CarPreset.Drift]: {
        ...sedanTuning,
        axles: {
            [Axle.Front]: {
                ...sedanTuning.axles[Axle.Front],
                antiRollStiffness: 35_000,
                rideFrequency: 2,
            },
            [Axle.Rear]: {
                ...sedanTuning.axles[Axle.Rear],
                antiRollStiffness: 11_000,
                differential: DifferentialKind.ClutchLsd,
                rideFrequency: 1.8,
                tireScale: 1.07,
            },
        },
        description:
            'The E30 with a clutch-pack limited slip, more power, and no traction control. Throttle steers it.',
        drivetrain: {
            ...sedanTuning.drivetrain,
            lsdPreload: 200,
            lsdRamp: 0.6,
            maxClutchTorque: 450,
        },
        engine: {
            ...sedanTuning.engine,
            maxRpm: 7500,
            maxTorque: 330,
        },
        label: 'Drift Car',
        maxBrakeTorque: 4500,
        steering: {
            ...sedanTuning.steering,
            maxAngle: 50,
            ratio: 14,
        },
        tire: {
            ...sedanTuning.tire,
            grip: 1.05,
            lateralStiffness: 40_000,
        },
        tractionControl: undefined,
    },
    [CarPreset.Muscle]: {
        ...sedanTuning,
        axles: {
            [Axle.Front]: {
                ...sedanTuning.axles[Axle.Front],
                halfTrack: 0.76,
                mountY: -0.15,
                mountZ: 1.4,
                rideFrequency: 1.3,
                weightShare: 0.56,
            },
            [Axle.Rear]: {
                ...sedanTuning.axles[Axle.Rear],
                differential: DifferentialKind.ClutchLsd,
                halfTrack: 0.76,
                mountY: -0.15,
                mountZ: -1.35,
                rideFrequency: 1.4,
                weightShare: 0.44,
            },
        },
        bodyBoxes: [
            {
                center: {
                    x: 0,
                    y: -0.08,
                    z: 0.05,
                },
                halfSize: {
                    x: 0.88,
                    y: 0.27,
                    z: 2.15,
                },
            },
            {
                center: {
                    x: 0,
                    y: 0.4,
                    z: -0.35,
                },
                halfSize: {
                    x: 0.74,
                    y: 0.21,
                    z: 0.85,
                },
            },
        ],
        description:
            'A heavy V8 with a clutch-pack limited slip, four long gears, and traction control to tame it.',
        drivetrain: {
            ...sedanTuning.drivetrain,
            finalDrive: 3.55,
            gears: [
                -2.9,
                0,
                2.64,
                1.75,
                1.34,
                1,
            ],
            maxClutchTorque: 650,
        },
        engine: {
            ...sedanTuning.engine,
            idleRpm: 750,
            inertia: 0.35,
            maxRpm: 6000,
            maxTorque: 520,
        },
        hasHeadlights: false,
        label: 'Muscle Car',
        mass: 1600,
        maxBrakeTorque: 7200,
        tire: {
            ...sedanTuning.tire,
            grip: 1.15,
            inertia: 0.7,
            radius: 0.33,
            rimRadius: 0.23,
            width: 0.115,
        },
        tractionControl: defaultTractionControl,
    },
    [CarPreset.Stunt]: {
        ...sedanTuning,
        axles: {
            [Axle.Front]: {
                ...sedanTuning.axles[Axle.Front],
                antiRollStiffness: 30_000,
                differential: DifferentialKind.Torsen,
                rideFrequency: 2.2,
            },
            [Axle.Rear]: {
                ...sedanTuning.axles[Axle.Rear],
                antiRollStiffness: 20_000,
                differential: DifferentialKind.Torsen,
                rideFrequency: 2.4,
            },
        },
        description:
            'Light, stiff, and all-wheel drive through Torsen differentials. Built to land jumps.',
        drivetrain: {
            ...sedanTuning.drivetrain,
            frontTorqueShare: 0.4,
            maxClutchTorque: 450,
            torqueBiasRatio: 3,
        },
        engine: {
            ...sedanTuning.engine,
            maxRpm: 7500,
            maxTorque: 300,
        },
        hasHeadlights: false,
        label: 'Stunt Car',
        mass: 1000,
        maxBrakeTorque: 4500,
        suspension: {
            ...sedanTuning.suspension,
            damperRatio: 0.55,
        },
    },
    [CarPreset.Rally]: {
        ...sedanTuning,
        axles: {
            [Axle.Front]: {
                ...sedanTuning.axles[Axle.Front],
                differential: DifferentialKind.Torsen,
                mountY: 0,
                rideFrequency: 1.3,
            },
            [Axle.Rear]: {
                ...sedanTuning.axles[Axle.Rear],
                differential: DifferentialKind.Torsen,
                mountY: 0,
                rideFrequency: 1.4,
            },
        },
        description:
            'All-wheel drive with a center split and Torsen axles, on long, soft springs for rough ground.',
        drivetrain: {
            ...sedanTuning.drivetrain,
            frontTorqueShare: 0.45,
            maxClutchTorque: 400,
        },
        engine: {
            ...sedanTuning.engine,
            maxRpm: 7200,
            maxTorque: 290,
        },
        label: 'Rally Car',
        mass: 1250,
        maxBrakeTorque: 4900,
        suspension: {
            ...sedanTuning.suspension,
            damperRatio: 0.45,
            maxCompression: 0.4,
            restLength: 0.75,
        },
        tire: {
            ...sedanTuning.tire,
            grip: 1.1,
        },
    },
    [CarPreset.MonsterTruck]: {
        ...sedanTuning,
        axles: {
            [Axle.Front]: {
                ...sedanTuning.axles[Axle.Front],
                halfTrack: 1.15,
                mountY: 0,
                mountZ: 1.2,
                rideFrequency: 1.1,
                weightShare: 0.5,
            },
            [Axle.Rear]: {
                ...sedanTuning.axles[Axle.Rear],
                halfTrack: 1.15,
                mountY: 0,
                mountZ: -1.1,
                rideFrequency: 1.1,
                weightShare: 0.5,
            },
        },
        bodyBoxes: [
            {
                center: {
                    x: 0,
                    y: 0.25,
                    z: 0.1,
                },
                halfSize: {
                    x: 1,
                    y: 0.35,
                    z: 2.1,
                },
            },
            {
                center: {
                    x: 0,
                    y: 0.85,
                    z: -0.2,
                },
                halfSize: {
                    x: 0.85,
                    y: 0.3,
                    z: 0.8,
                },
            },
        ],
        centerOfMassOffset: {
            x: 0,
            y: -0.3,
            z: 0,
        },
        description:
            'Huge tires and long springs on open differentials. Climbs over anything, leans in every turn.',
        drivetrain: {
            ...sedanTuning.drivetrain,
            finalDrive: 4.1,
            frontTorqueShare: 0.5,
            gears: [
                -3,
                0,
                3,
                1.8,
                1.2,
            ],
            maxClutchTorque: 1000,
        },
        engine: {
            ...sedanTuning.engine,
            idleRpm: 700,
            inertia: 0.6,
            maxRpm: 5000,
            maxTorque: 900,
        },
        label: 'Monster Truck',
        mass: 3000,
        maxBrakeTorque: 20_000,
        steering: {
            ...sedanTuning.steering,
            maxAngle: 32,
        },
        suspension: {
            ...sedanTuning.suspension,
            damperRatio: 0.35,
            maxCompression: 0.6,
            restLength: 1.3,
        },
        tire: {
            ...sedanTuning.tire,
            grip: 1.1,
            inertia: 6,
            lateralStiffness: 120_000,
            longitudinalStiffness: 150_000,
            radius: 0.51,
            rimRadius: 0.19,
            rollingResistance: 0.02,
            width: 0.36,
        },
    },
};
