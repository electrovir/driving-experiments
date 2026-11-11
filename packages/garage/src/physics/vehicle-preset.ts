import {type PartialWithUndefined} from '@augment-vir/common';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {type AnyDuration} from 'date-vir';
import {curveKey, type AnimationCurve} from './animation-curve.js';
import {type Vector3} from './vector.js';

/**
 * Every car in the garage. Each is tuned from a Randomation Vehicle Physics prefab: `Sedan` is "Car
 * RWD", `Stunt` is "Special Car" with flip control turned on.
 */
export enum CarPreset {
    Sedan = 'sedan',
    Drift = 'drift',
    Muscle = 'muscle',
    Stunt = 'stunt',
    Hover = 'hover',
    MonsterTruck = 'monster-truck',
}

export enum VehicleKind {
    /** Wheels on springs, driven by an engine through a transmission. */
    Wheeled = 'wheeled',
    /** Pads that float on a cushion of force and push the car along. */
    Hover = 'hover',
}

export enum TransmissionKind {
    Gearbox = 'gearbox',
    /** A continuously variable transmission that can also reverse. */
    Continuous = 'continuous',
}

/**
 * A box the car's body is built from, in the physics' car frame: +x right, +y up, +z forward, in
 * meters from the body's origin.
 */
export type BodyBox = {
    center: Vector3;
    halfSize: Vector3;
};

export type GearTuning = {
    ratio: number;
};

export type TransmissionTuning =
    | {
          kind: TransmissionKind.Gearbox;
          /** In order: reverse, neutral, then each forward gear. */
          gears: ReadonlyArray<Readonly<GearTuning>>;
          /** How long the wheels go without drive while the gearbox changes gear. */
          shiftDuration: AnyDuration;
          startGear: number;
          driveDividePower: number;
      }
    | {
          kind: TransmissionKind.Continuous;
          minRatio: number;
          maxRatio: number;
          driveDividePower: number;
      };

export type GasMotorTuning = {
    power: number;
    /** Torque over thousands of RPM. Its last key's time is the redline. */
    torqueCurve: AnimationCurve;
    inertia: number;
    driveDividePower: number;
};

/** One wheel on its spring. */
export type WheelTuning = {
    /** Where the spring hangs from, in the car frame. */
    pivot: Vector3;
    brakeForce: number;
    ebrakeForce: number;
    /** Degrees each way. */
    steerRange: number;
    /** Negative steers against the front wheels. */
    steerFactor: number;
    ackermannFactor: number;
    suspensionDistance: number;
    springForce: number;
    springExponent: number;
    springDamping: number;
    extendSpeed: number;
    hardContactForce: number;
    forwardFriction: number;
    /**
     * How hard the engine has to drive the wheel before its tire breaks loose and spins, as the
     * slip the engine alone would give it. Infinite never spins under power.
     */
    breakLooseSlip: number;
    sidewaysFriction: number;
    sidewaysFrictionCurve: AnimationCurve;
    tireRadius: number;
    rimRadius: number;
    tireWidth: number;
    feedbackRpmBias: number;
    isDriven: boolean;
    /** Damage needed to knock the wheel off. Infinite never detaches. */
    detachForce: number;
};

export type HoverPadTuning = {
    pivot: Vector3;
    steerFactor: number;
};

export type WheeledTuning = {
    kind: VehicleKind.Wheeled;
    motor: GasMotorTuning;
    transmission: TransmissionTuning;
    wheels: Readonly<Record<WheelPosition, Readonly<WheelTuning>>>;
    steerRate: number;
    steerCurve: AnimationCurve;
    burnoutThreshold: number;
    burnoutSpin: number;
};

export type HoverTuning = {
    kind: VehicleKind.Hover;
    pads: Readonly<Record<WheelPosition, Readonly<HoverPadTuning>>>;
    hoverDistance: number;
    bufferDistance: number;
    floatForce: number;
    bufferFloatForce: number;
    floatExponent: number;
    floatDamping: number;
    brakeForce: number;
    ebrakeForce: number;
    sideFriction: number;
    power: number;
    /** Push over speed in meters per second. Its last key's time is the top speed. */
    forceCurve: AnimationCurve;
    steerRate: number;
    steerCurve: AnimationCurve;
};

export type AssistTuning = {
    driftSpinAssist: number;
    driftSpinSpeed: number;
    driftSpinExponent: number;
    driftPush: number;
    straightenAssist: number;
    downforce: number;
};

export type FlipTuning = {
    /** Torque from the air controls about the car's own x (pitch), y (yaw), and z (roll). */
    flipPower: Vector3;
    isDisabledWhileCrashing: boolean;
};

export type CarPresetTuning = {
    label: string;
    description: string;
    mass: number;
    linearDrag: number;
    centerOfMassOffset: Vector3;
    bodyBoxes: ReadonlyArray<Readonly<BodyBox>>;
    vehicle: Readonly<WheeledTuning> | Readonly<HoverTuning>;
    assist: AssistTuning;
    flip: FlipTuning;
    boostPowerCurve: AnimationCurve;
    /**
     * Straight forward push while boosting, on top of the extra engine power. Randomation's boost
     * only adds engine power, which a car with a gearbox barely feels.
     */
    boostThrust: number;
} & PartialWithUndefined<{
    /** Whether the body dents, the engine wears, and the wheels can come off in crashes. */
    hasDamage: boolean;
    hasHeadlights: boolean;
}>;

const carWheelX = 0.7;
const carFrontZ = 1.023;
const carRearZ = -1.043;
const carPivotY = -0.201;

const frontFrictionCurve: AnimationCurve = [
    curveKey({
        time: 0,
        value: 0.304,
        inTangent: 8.827,
    }),
    curveKey({
        time: 0.193,
        value: 1.209,
    }),
    curveKey({
        time: 1,
        value: 1.052,
    }),
];

const rearFrictionCurve: AnimationCurve = [
    curveKey({
        time: 0,
        value: 0.304,
        inTangent: 8.827,
    }),
    curveKey({
        time: 0.193,
        value: 1.999,
    }),
    curveKey({
        time: 1,
        value: 1.052,
    }),
];

/** Randomation Vehicle Physics gives every wheel this forward friction curve. */
export const forwardFrictionCurve: AnimationCurve = [
    curveKey({
        time: 0,
        value: 0.307,
        inTangent: 8.81,
    }),
    curveKey({
        time: 0.201,
        value: 0.998,
    }),
    curveKey({
        time: 0.396,
        value: 0.859,
        inTangent: -0.265,
    }),
    curveKey({
        time: 1,
        value: 0.802,
    }),
];

const defaultSteerCurve: AnimationCurve = [
    curveKey({
        time: 0,
        value: 1,
        inTangent: -0.079,
    }),
    curveKey({
        time: 30,
        value: 0.198,
        inTangent: -0.002,
    }),
];

const defaultBoostCurve: AnimationCurve = [
    curveKey({
        time: 0,
        value: 0.1,
    }),
    curveKey({
        time: 50,
        value: 0.2,
    }),
];

const defaultTorqueCurve: AnimationCurve = [
    curveKey({
        time: 0,
        value: 0.87,
        inTangent: 0.062,
    }),
    curveKey({
        time: 4.181,
        value: 0.999,
    }),
    curveKey({
        time: 8.043,
        value: 0.004,
        inTangent: -0.329,
    }),
];

const defaultAssist: AssistTuning = {
    downforce: 2,
    driftPush: 2,
    driftSpinAssist: 2,
    driftSpinExponent: 2,
    driftSpinSpeed: 3,
    straightenAssist: 1,
};

const defaultFlip: FlipTuning = {
    flipPower: {
        x: 0,
        y: 0,
        z: 0,
    },
    isDisabledWhileCrashing: false,
};

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

function createWheels({
    front,
    rear,
    shared,
}: Readonly<{
    shared: Readonly<Omit<WheelTuning, 'pivot'>>;
    front: Readonly<Partial<WheelTuning> & Pick<WheelTuning, 'pivot'>>;
    rear: Readonly<Partial<WheelTuning> & Pick<WheelTuning, 'pivot'>>;
}>): Record<WheelPosition, WheelTuning> {
    function mirrorToLeft(pivot: Readonly<Vector3>): Vector3 {
        return {
            ...pivot,
            x: -pivot.x,
        };
    }

    return {
        [WheelPosition.FrontLeft]: {
            ...shared,
            ...front,
            pivot: mirrorToLeft(front.pivot),
        },
        [WheelPosition.FrontRight]: {
            ...shared,
            ...front,
        },
        [WheelPosition.RearLeft]: {
            ...shared,
            ...rear,
            pivot: mirrorToLeft(rear.pivot),
        },
        [WheelPosition.RearRight]: {
            ...shared,
            ...rear,
        },
    };
}

const carWheelShared: Omit<WheelTuning, 'pivot'> = {
    ackermannFactor: 0.1,
    brakeForce: 0.5,
    breakLooseSlip: Infinity,
    detachForce: Infinity,
    ebrakeForce: 0,
    extendSpeed: 20,
    feedbackRpmBias: 0,
    forwardFriction: 5,
    hardContactForce: 50,
    isDriven: false,
    rimRadius: 0.22,
    sidewaysFriction: 5,
    sidewaysFrictionCurve: frontFrictionCurve,
    springDamping: 0.5,
    springExponent: 10,
    springForce: 5,
    steerFactor: 1,
    steerRange: 40,
    suspensionDistance: 0.2,
    tireRadius: 0.296,
    tireWidth: 0.11,
};

const carRearWheel: Partial<WheelTuning> = {
    ackermannFactor: 0.2,
    ebrakeForce: 1,
    isDriven: true,
    sidewaysFriction: 4,
    sidewaysFrictionCurve: rearFrictionCurve,
    steerFactor: 0,
    steerRange: 50,
};

const carFrontPivot: Vector3 = {
    x: carWheelX,
    y: carPivotY,
    z: carFrontZ,
};

const carRearPivot: Vector3 = {
    x: carWheelX,
    y: carPivotY,
    z: carRearZ,
};

/** Reverse, neutral, then the forward gears with these ratios. */
function createGears(forwardRatios: ReadonlyArray<number>): GearTuning[] {
    return [
        -3.5,
        0,
        ...forwardRatios,
    ].map((ratio) => {
        return {
            ratio,
        };
    });
}

const sedanVehicle: WheeledTuning = {
    burnoutSpin: 5,
    burnoutThreshold: 0.9,
    kind: VehicleKind.Wheeled,
    motor: {
        driveDividePower: 3,
        inertia: 0.8,
        power: 1,
        torqueCurve: defaultTorqueCurve,
    },
    steerCurve: defaultSteerCurve,
    steerRate: 0.1,
    transmission: {
        driveDividePower: 3,
        gears: createGears([
            3,
            2,
            1.6,
            1.2,
            0.9,
            0.7,
        ]),
        kind: TransmissionKind.Gearbox,
        shiftDuration: {
            milliseconds: 170,
        },
        startGear: 2,
    },
    wheels: createWheels({
        front: {
            pivot: carFrontPivot,
        },
        rear: {
            ...carRearWheel,
            pivot: carRearPivot,
        },
        shared: carWheelShared,
    }),
};

const sedanTuning: CarPresetTuning = {
    assist: defaultAssist,
    bodyBoxes: carBodyBoxes,
    boostThrust: 10,
    boostPowerCurve: defaultBoostCurve,
    centerOfMassOffset: {
        x: 0,
        y: -0.1,
        z: 0,
    },
    description: 'Rear-wheel drive with a six-speed automatic. Holds the road and forgives.',
    flip: defaultFlip,
    hasHeadlights: true,
    label: 'Sedan',
    linearDrag: 0,
    mass: 1,
    vehicle: sedanVehicle,
};

const muscleFrontPivot: Vector3 = {
    x: 0.634,
    y: -0.269,
    z: 1.186,
};

const muscleRearPivot: Vector3 = {
    x: 0.634,
    y: -0.269,
    z: -1.113,
};

export const carPresets: Readonly<Record<CarPreset, Readonly<CarPresetTuning>>> = {
    [CarPreset.Sedan]: sedanTuning,
    [CarPreset.Drift]: {
        ...sedanTuning,
        assist: {
            ...defaultAssist,
            driftPush: 3,
        },
        description:
            'Wide steering lock and slippery rear tires. Kick the tail out with the handbrake.',
        label: 'Drift Car',
        vehicle: {
            ...sedanVehicle,
            motor: {
                driveDividePower: 3,
                inertia: 0.8,
                power: 1,
                torqueCurve: [
                    curveKey({
                        time: 0,
                        value: 0.796,
                        inTangent: 0.099,
                    }),
                    curveKey({
                        time: 4.181,
                        value: 0.999,
                    }),
                    curveKey({
                        time: 8.043,
                        value: 0.004,
                        inTangent: -0.329,
                    }),
                ],
            },
            transmission: {
                driveDividePower: 3,
                gears: createGears([
                    4,
                    3,
                    2,
                    1.5,
                    1,
                    0.7,
                ]),
                kind: TransmissionKind.Gearbox,
                shiftDuration: {
                    milliseconds: 170,
                },
                startGear: 2,
            },
            wheels: createWheels({
                front: {
                    ackermannFactor: 0.2,
                    pivot: carFrontPivot,
                    sidewaysFriction: 4,
                    steerRange: 50,
                },
                rear: {
                    ...carRearWheel,
                    forwardFriction: 6,
                    pivot: carRearPivot,
                    sidewaysFriction: 3,
                },
                shared: {
                    ...carWheelShared,
                    feedbackRpmBias: 0.5,
                },
            }),
        },
    },
    [CarPreset.Muscle]: {
        ...sedanTuning,
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
            'A big V8 with dents, a wearing engine, and wheels that come off when you hit hard.',
        flip: {
            ...defaultFlip,
            isDisabledWhileCrashing: true,
        },
        hasDamage: true,
        label: 'Muscle Car',
        linearDrag: 0.01,
        vehicle: {
            ...sedanVehicle,
            motor: {
                driveDividePower: 3,
                inertia: 0.8,
                power: 1,
                torqueCurve: [
                    curveKey({
                        time: 0,
                        value: 0.87,
                        inTangent: 0.062,
                    }),
                    curveKey({
                        time: 4.181,
                        value: 0.999,
                    }),
                    curveKey({
                        time: 8.983,
                        value: 0.004,
                        inTangent: -0.329,
                    }),
                ],
            },
            transmission: {
                driveDividePower: 3,
                gears: createGears([
                    3,
                    2,
                    1.5,
                    1.1,
                    0.9,
                    0.7,
                ]),
                kind: TransmissionKind.Gearbox,
                shiftDuration: {
                    milliseconds: 170,
                },
                startGear: 2,
            },
            wheels: createWheels({
                front: {
                    pivot: muscleFrontPivot,
                },
                rear: {
                    ...carRearWheel,
                    breakLooseSlip: 2,
                    pivot: muscleRearPivot,
                    sidewaysFriction: 4.5,
                },
                shared: {
                    ...carWheelShared,
                    detachForce: 10,
                    hardContactForce: 20,
                    rimRadius: 0.23,
                    suspensionDistance: 0.15,
                    tireWidth: 0.115,
                },
            }),
        },
    },
    [CarPreset.Stunt]: {
        ...sedanTuning,
        description:
            'All-wheel drive and four-wheel steering. In the air, steer, throttle, and Q / E spin and flip it.',
        flip: {
            ...defaultFlip,
            flipPower: {
                x: 5,
                y: 5,
                z: 5,
            },
        },
        hasHeadlights: false,
        label: 'Stunt Car',
        vehicle: {
            ...sedanVehicle,
            burnoutSpin: 0,
            burnoutThreshold: -1,
            transmission: {
                driveDividePower: 3,
                kind: TransmissionKind.Continuous,
                maxRatio: 0.8,
                minRatio: 2,
            },
            wheels: createWheels({
                front: {
                    isDriven: true,
                    pivot: carFrontPivot,
                },
                rear: {
                    ...carRearWheel,
                    pivot: carRearPivot,
                    /**
                     * The prefab steers the rear wheels with the front ones, which crabs sideways.
                     * Steering them against the front tightens the turns a stunt car needs.
                     */
                    steerFactor: -0.5,
                },
                shared: {
                    ...carWheelShared,
                    ackermannFactor: 0.2,
                    steerRange: 50,
                },
            }),
        },
    },
    [CarPreset.Hover]: {
        ...sedanTuning,
        assist: {
            ...defaultAssist,
            driftPush: 0,
            driftSpinAssist: 0,
            straightenAssist: 0,
        },
        boostPowerCurve: [
            curveKey({
                time: 0,
                value: 0.1,
            }),
            curveKey({
                time: 49.996,
                value: 0.2,
            }),
        ],
        centerOfMassOffset: {
            x: 0,
            y: -0.3,
            z: 0,
        },
        description: 'Floats on four thrust pads. No grip to speak of, so brake early.',
        hasHeadlights: true,
        label: 'Hover Car',
        vehicle: {
            bufferDistance: 0.5,
            bufferFloatForce: 10,
            brakeForce: 0.2,
            ebrakeForce: 0.5,
            floatDamping: 0.3,
            floatExponent: 5,
            floatForce: 5,
            forceCurve: [
                curveKey({
                    time: 0,
                    value: 1,
                }),
                curveKey({
                    time: 69.996,
                    value: 0,
                }),
            ],
            hoverDistance: 2,
            kind: VehicleKind.Hover,
            pads: {
                [WheelPosition.FrontLeft]: {
                    pivot: {
                        x: -0.733,
                        y: -0.23,
                        z: 1.02,
                    },
                    steerFactor: 2,
                },
                [WheelPosition.FrontRight]: {
                    pivot: {
                        x: 0.733,
                        y: -0.23,
                        z: 1.02,
                    },
                    steerFactor: 2,
                },
                [WheelPosition.RearLeft]: {
                    pivot: {
                        x: -0.733,
                        y: -0.23,
                        z: -1.028,
                    },
                    steerFactor: -2,
                },
                [WheelPosition.RearRight]: {
                    pivot: {
                        x: 0.733,
                        y: -0.23,
                        z: -1.028,
                    },
                    steerFactor: -2,
                },
            },
            power: 5,
            sideFriction: 1,
            steerCurve: [
                curveKey({
                    time: 0,
                    value: 1,
                    inTangent: -0.002,
                }),
                curveKey({
                    time: 30,
                    value: 0.499,
                    inTangent: -0.001,
                }),
            ],
            steerRate: 1.5,
        },
    },
    [CarPreset.MonsterTruck]: {
        ...sedanTuning,
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
        description: 'Huge tires and long springs. Climbs over anything, leans in every turn.',
        hasHeadlights: true,
        label: 'Monster Truck',
        mass: 2,
        vehicle: {
            burnoutSpin: 0,
            burnoutThreshold: -1,
            kind: VehicleKind.Wheeled,
            motor: {
                driveDividePower: 3,
                inertia: 0.87,
                power: 0.9,
                torqueCurve: [
                    curveKey({
                        time: 0,
                        value: 0.87,
                        inTangent: 0.062,
                    }),
                    curveKey({
                        time: 1.635,
                        value: 0.977,
                        inTangent: -0.014,
                    }),
                    curveKey({
                        time: 7.011,
                        value: 0.004,
                        inTangent: -0.53,
                    }),
                ],
            },
            steerCurve: defaultSteerCurve,
            steerRate: 0.05,
            transmission: {
                driveDividePower: 2,
                gears: createGears([
                    3,
                    2.2,
                    1.8,
                    1.5,
                    1.2,
                ]),
                kind: TransmissionKind.Gearbox,
                shiftDuration: {
                    milliseconds: 250,
                },
                startGear: 2,
            },
            wheels: createWheels({
                front: {
                    pivot: {
                        x: 1.1,
                        y: -0.465,
                        z: 1.189,
                    },
                },
                rear: {
                    ...carRearWheel,
                    pivot: {
                        x: 1.1,
                        y: -0.465,
                        z: -1.009,
                    },
                    sidewaysFriction: 6,
                    steerFactor: 0,
                },
                shared: {
                    ...carWheelShared,
                    ackermannFactor: 0.2,
                    extendSpeed: 10,
                    forwardFriction: 6,
                    rimRadius: 0.19,
                    sidewaysFriction: 6,
                    springDamping: 0.2,
                    springExponent: 1.5,
                    springForce: 7,
                    steerRange: 50,
                    suspensionDistance: 0.7,
                    tireRadius: 0.51,
                    tireWidth: 0.36,
                },
            }),
        },
    },
};
