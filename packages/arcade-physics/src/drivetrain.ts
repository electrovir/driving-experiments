import {clamp, getEnumValues} from '@augment-vir/common';
import {type CarControls} from '@evir/driving-common';
import {wheelRadius} from '@evir/driving-common/src/car-pose.js';
import {convertDuration, type AnyDuration} from 'date-vir';

/** The values are what the gear indicator shows. */
export enum Gear {
    Reverse = 'R',
    Neutral = 'N',
    First = '1',
    Second = '2',
    Third = '3',
    Fourth = '4',
    Fifth = '5',
    Sixth = '6',
}

/** In shifting order. */
const orderedGears = getEnumValues(Gear);

/** Gearbox ratios. Reverse is negative so it spins the wheels backward. */
const gearRatios: Readonly<Record<Gear, number>> = {
    [Gear.Reverse]: -3.3,
    [Gear.Neutral]: 0,
    [Gear.First]: 2.8,
    [Gear.Second]: 2.2,
    [Gear.Third]: 1.55,
    [Gear.Fourth]: 1.2,
    [Gear.Fifth]: 1,
    [Gear.Sixth]: 0.82,
};

export enum ShiftDirection {
    Up = 'up',
    Down = 'down',
}

const shiftSteps: Readonly<Record<ShiftDirection, number>> = {
    [ShiftDirection.Up]: 1,
    [ShiftDirection.Down]: -1,
};

const finalDrive = 3.9;
const drivetrainEfficiency = 0.85;
const idleRpm = 900;
export const redlineRpm = 7000;
/** The engine cuts fuel at this rpm, so it bounces off it instead of revving higher. */
const limiterRpm = 7200;
/**
 * The automatic clutch grips harder the faster the engine spins, enough at this rpm to hold full
 * throttle. Pulling away at full throttle, the engine holds about here while the clutch slips.
 */
const launchRpm = 2700;
/** Newton meters. The most the clutch can pass while slipping, which limits the jolt as it bites. */
const maxClutchTorque = 320;
/** Rpm. A slipping clutch closer than this to the gearbox's speed locks up. */
const clutchLockRpm = 20;
/** Kilogram square meters, for the engine and flywheel. */
const engineInertia = 0.15;
/**
 * The pedal opens the throttle by its travel to this power, so the first part of the pedal is
 * gentle. A barely open throttle can't feed a fast-spinning engine, so its torque falls as rpm
 * climbs until it only balances the engine's losses, and the rpm settles there.
 */
const throttleProgression = 3;
/** How far below the next gear's rpm the automatic starts easing off its rev-matching blip. */
const revMatchRpm = 300;
const manualShift: AnyDuration = {
    milliseconds: 200,
};
const automaticShift: AnyDuration = {
    milliseconds: 250,
};
/** Below this forward speed the car counts as stopped, for the automatic's reverse. */
const stoppedSpeed = 0.5;
/** Reverse won't engage above this speed in either direction, like a real gearbox's lockout. */
const maxReverseEngageSpeed = 2;
/**
 * Meters per second. Reverse eases off the throttle toward this speed, like the reverse limiter
 * many cars have. Faster, the steered front wheels trail so far behind that the car slides wide
 * instead of turning, and braking out of that slide spins it.
 */
const maxReverseSpeed = 6;
/** Meters per second below {@link maxReverseSpeed} where the limiter starts easing off. */
const reverseLimiterRange = 2;
/**
 * The automatic shifts up and down at these rpm, interpolated by throttle so gentle driving shifts
 * early and flooring it holds gears longer and kicks down sooner.
 */
const automaticShiftRpm = {
    upshift: {
        noThrottle: 2800,
        fullThrottle: 6600,
    },
    downshift: {
        noThrottle: 1400,
        fullThrottle: 3000,
    },
};

/** Newton meters at full throttle, by rpm. Sorted by rpm. */
const torqueCurve: ReadonlyArray<Readonly<{rpm: number; torque: number}>> = [
    {
        rpm: 1000,
        torque: 175,
    },
    {
        rpm: 2500,
        torque: 220,
    },
    {
        rpm: 4500,
        torque: 250,
    },
    {
        rpm: 6000,
        torque: 230,
    },
    {
        rpm: 7000,
        torque: 195,
    },
];

/** The engine's state and the gear it's in. */
export type DrivetrainState = {
    gear: Gear;
    isAutomatic: boolean;
    /** No power reaches the wheels until the shift finishes. */
    shiftSecondsLeft: number;
    rpm: number;
};

export const initialDrivetrain: DrivetrainState = {
    gear: Gear.First,
    isAutomatic: true,
    rpm: idleRpm,
    shiftSecondsLeft: 0,
};

function getFullThrottleTorque(rpm: number) {
    const upper = torqueCurve.find((point) => point.rpm >= rpm);
    const lower = torqueCurve.findLast((point) => point.rpm <= rpm);

    if (!upper || !lower || upper === lower) {
        return (upper ?? lower)?.torque ?? 0;
    }

    return (
        lower.torque + ((upper.torque - lower.torque) * (rpm - lower.rpm)) / (upper.rpm - lower.rpm)
    );
}

/** The engine's friction and pumping losses, which slow the car when the throttle is off. */
function getLossTorque(rpm: number) {
    return 10 + (25 * rpm) / redlineRpm;
}

/** The air the closed throttle still lets in, just enough to hold idle against the engine's losses. */
const idleAirflowRpm =
    (idleRpm * getLossTorque(idleRpm)) / (getFullThrottleTorque(idleRpm) + getLossTorque(idleRpm));

/**
 * Newton meters out of the crankshaft. The throttle passes enough air to fill the cylinders fully
 * up to some rpm, and partly above it.
 */
function getEngineTorque({rpm, throttle}: Readonly<{rpm: number; throttle: number}>) {
    if (rpm >= limiterRpm) {
        return -getLossTorque(rpm);
    }

    const airflowRpm =
        idleAirflowRpm + throttle ** throttleProgression * (limiterRpm - idleAirflowRpm);
    const cylinderFill = Math.min(1, airflowRpm / Math.max(rpm, idleAirflowRpm));

    return cylinderFill * (getFullThrottleTorque(rpm) + getLossTorque(rpm)) - getLossTorque(rpm);
}

/** Newton meters the clutch can pass while slipping. */
function getClutchCapacity(rpm: number) {
    return Math.min(
        maxClutchTorque,
        getFullThrottleTorque(launchRpm) *
            (Math.max(0, rpm - idleRpm) / (launchRpm - idleRpm)) ** 2,
    );
}

function spinEngine({
    dtSeconds,
    load,
    rpm,
    throttle,
}: Readonly<{
    dtSeconds: number;
    /** Newton meters the clutch takes from the engine. */
    load: number;
    rpm: number;
    throttle: number;
}>) {
    const torque =
        getEngineTorque({
            rpm,
            throttle,
        }) - load;

    return rpm + ((torque / engineInertia) * dtSeconds * 60) / (2 * Math.PI);
}

function interpolate({from, to, amount}: Readonly<{from: number; to: number; amount: number}>) {
    return from + (to - from) * amount;
}

/** The rpm the engine would turn at with the clutch fully engaged. */
function getLinkedRpm({gear, wheelSpeed}: Readonly<{gear: Gear; wheelSpeed: number}>) {
    return ((wheelSpeed / wheelRadius) * gearRatios[gear] * finalDrive * 60) / (2 * Math.PI);
}

function startShift({
    drivetrain,
    gear,
    shift,
}: Readonly<{drivetrain: Readonly<DrivetrainState>; gear: Gear; shift: AnyDuration}>) {
    return {
        ...drivetrain,
        gear,
        shiftSecondsLeft: convertDuration(shift, {
            seconds: true,
        }).seconds,
    };
}

/**
 * Shifts one gear through R, N, 1–6, and switches the gearbox to manual. Does nothing past either
 * end or when reverse is requested while moving.
 */
export function shiftGear({
    direction,
    drivetrain,
    forwardSpeed,
}: Readonly<{
    direction: ShiftDirection;
    drivetrain: Readonly<DrivetrainState>;
    /** Meters per second. */
    forwardSpeed: number;
}>) {
    const gear = orderedGears[orderedGears.indexOf(drivetrain.gear) + shiftSteps[direction]];
    const manual = {
        ...drivetrain,
        isAutomatic: false,
    };

    if (!gear || (gear === Gear.Reverse && Math.abs(forwardSpeed) > maxReverseEngageSpeed)) {
        return manual;
    }

    return startShift({
        drivetrain: manual,
        gear,
        shift: manualShift,
    });
}

/** Switches between the automatic and manual gearbox. The automatic leaves neutral for first. */
export function toggleAutomatic(drivetrain: Readonly<DrivetrainState>) {
    return {
        ...drivetrain,
        gear:
            !drivetrain.isAutomatic && drivetrain.gear === Gear.Neutral
                ? Gear.First
                : drivetrain.gear,
        isAutomatic: !drivetrain.isAutomatic,
    };
}

/** The gear the automatic wants, or `undefined` to stay put. */
function findAutomaticGear({
    controls,
    drivetrain,
    forwardSpeed,
}: Readonly<{
    controls: Readonly<Pick<CarControls, 'brake' | 'throttle'>>;
    drivetrain: Readonly<DrivetrainState>;
    forwardSpeed: number;
}>) {
    const isStopped = Math.abs(forwardSpeed) < stoppedSpeed;

    if (drivetrain.gear === Gear.Reverse) {
        return isStopped && controls.throttle > 0 && !controls.brake ? Gear.First : undefined;
    } else if (isStopped && controls.brake > 0 && !controls.throttle) {
        return Gear.Reverse;
    }

    const gearIndex = orderedGears.indexOf(drivetrain.gear);
    const firstIndex = orderedGears.indexOf(Gear.First);
    const linkedRpm = getLinkedRpm({
        gear: drivetrain.gear,
        wheelSpeed: forwardSpeed,
    });
    const upshiftRpm = interpolate({
        amount: controls.throttle,
        from: automaticShiftRpm.upshift.noThrottle,
        to: automaticShiftRpm.upshift.fullThrottle,
    });
    const downshiftRpm = interpolate({
        amount: controls.throttle,
        from: automaticShiftRpm.downshift.noThrottle,
        to: automaticShiftRpm.downshift.fullThrottle,
    });

    if (gearIndex < firstIndex) {
        return undefined;
    } else if (controls.throttle > 0 && linkedRpm > upshiftRpm) {
        return orderedGears[gearIndex + 1];
    } else if (linkedRpm < downshiftRpm && gearIndex > firstIndex) {
        return orderedGears[gearIndex - 1];
    } else {
        return undefined;
    }
}

/**
 * The automatic's gear choice. Holding the brake at a stop selects reverse and holding the throttle
 * selects first, the way most driving games work; {@link getPedals} swaps the pedals in reverse.
 */
export function chooseAutomaticGear({
    controls,
    drivetrain,
    forwardSpeed,
}: Readonly<{
    controls: Readonly<Pick<CarControls, 'brake' | 'throttle'>>;
    drivetrain: Readonly<DrivetrainState>;
    /** Meters per second. */
    forwardSpeed: number;
}>) {
    if (!drivetrain.isAutomatic || drivetrain.shiftSecondsLeft > 0) {
        return drivetrain;
    }

    const gear = findAutomaticGear({
        controls,
        drivetrain,
        forwardSpeed,
    });

    return gear
        ? startShift({
              drivetrain,
              gear,
              shift: automaticShift,
          })
        : drivetrain;
}

/** The pedals as the car sees them. In the automatic's reverse, the brake pedal drives. */
export function getPedals({
    controls,
    drivetrain,
}: Readonly<{
    controls: Readonly<Pick<CarControls, 'brake' | 'throttle'>>;
    drivetrain: Readonly<DrivetrainState>;
}>) {
    return drivetrain.isAutomatic && drivetrain.gear === Gear.Reverse
        ? {
              brake: controls.throttle,
              throttle: controls.brake,
          }
        : {
              brake: controls.brake,
              throttle: controls.throttle,
          };
}

/**
 * Runs the engine for one step and returns the force it pushes the driven wheels with, in Newtons
 * in total, not per wheel. Off throttle, engine braking pulls back. The clutch slips at low rpm, so
 * the engine keeps idling at a stop. In neutral or mid-shift the engine spins freely, except that
 * the automatic blips the throttle to match the next gear's rpm.
 */
export function stepDrivetrain({
    drivetrain,
    dtSeconds,
    throttle,
    wheelSpeed,
}: Readonly<{
    drivetrain: Readonly<DrivetrainState>;
    dtSeconds: number;
    /** From 0 to 1. */
    throttle: number;
    /** Meters per second. The car's forward speed, since wheel slip isn't modeled. */
    wheelSpeed: number;
}>) {
    const shiftSecondsLeft = Math.max(0, drivetrain.shiftSecondsLeft - dtSeconds);
    const ratio = gearRatios[drivetrain.gear];
    const linkedRpm = getLinkedRpm({
        gear: drivetrain.gear,
        wheelSpeed,
    });

    if (!ratio || shiftSecondsLeft > 0) {
        return {
            driveForce: 0,
            drivetrain: {
                ...drivetrain,
                rpm: spinEngine({
                    dtSeconds,
                    load: 0,
                    rpm: drivetrain.rpm,
                    throttle:
                        drivetrain.isAutomatic && ratio
                            ? clamp((linkedRpm - drivetrain.rpm) / revMatchRpm, {
                                  max: 1,
                                  min: 0,
                              })
                            : throttle,
                }),
                shiftSecondsLeft,
            },
        };
    }

    const limitedThrottle =
        drivetrain.gear === Gear.Reverse
            ? throttle *
              clamp((maxReverseSpeed - Math.abs(wheelSpeed)) / reverseLimiterRange, {
                  max: 1,
                  min: 0,
              })
            : throttle;
    const lockedTorque = getEngineTorque({
        rpm: linkedRpm,
        throttle: limitedThrottle,
    });
    const isLocked =
        Math.abs(drivetrain.rpm - linkedRpm) < clutchLockRpm &&
        Math.abs(lockedTorque) <= getClutchCapacity(linkedRpm);
    const slipDirection = Math.sign(drivetrain.rpm - linkedRpm);
    const clutchTorque = isLocked
        ? lockedTorque
        : slipDirection * getClutchCapacity(drivetrain.rpm);
    const slippingRpm = spinEngine({
        dtSeconds,
        load: clutchTorque,
        rpm: drivetrain.rpm,
        throttle: limitedThrottle,
    });

    return {
        driveForce: (clutchTorque * ratio * finalDrive * drivetrainEfficiency) / wheelRadius,
        drivetrain: {
            ...drivetrain,
            rpm:
                isLocked || Math.sign(slippingRpm - linkedRpm) !== slipDirection
                    ? linkedRpm
                    : slippingRpm,
            shiftSecondsLeft,
        },
    };
}
