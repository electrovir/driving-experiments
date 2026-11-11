import {convertDuration} from 'date-vir';
import {evaluateCurve, getCurveEndTime} from './animation-curve.js';
import {clamp01, lerpNumber} from './vector.js';
import {
    TransmissionKind,
    type GasMotorTuning,
    type GearTuning,
    type TransmissionTuning,
} from './vehicle-preset.js';

/** What the driver and the car's motion tell the drivetrain on one physics step. */
export type DriveSituation = {
    accel: number;
    brake: number;
    isReversing: boolean;
    /** From 0 to 1. See Randomation Vehicle Physics' `VehicleParent.burnout`. */
    burnout: number;
    isBoosting: boolean;
    /** Extra power while boosting, from the preset's boost curve. */
    boostBoost: number;
    health: number;
    /** Meters per second along the car's nose. */
    forwardSpeed: number;
    groundedWheelCount: number;
};

/** What a motor or transmission hands down the line. Same as Randomation's `DriveForce`. */
export type DriveForce = {
    rpm: number;
    torque: number;
};

export type MotorState = DriveForce & {
    /** The throttle the engine is actually given, which a burnout or reversing changes. */
    throttle: number;
};

export type TransmissionState = {
    gearIndex: number;
    /** Seconds left in the current shift. */
    shiftSeconds: number;
    /** The ratio driving the wheels right now: the gear's ratio, or the CVT's. */
    ratio: number;
    /**
     * From 0 with the clutch pedal down to 1 fully engaged. It opens for each shift and closes
     * again after, so the engine's speed and drive blend into the new gear instead of jumping.
     */
    clutch: number;
};

/** How the gearbox picks its gear. A CVT always shifts itself. */
export type ShiftRequest = {
    isManual: boolean;
    /** 1 to shift up a gear this step, -1 to shift down, 0 to hold. Only read while manual. */
    gearChange: number;
    /** From 0 released to 1 fully pressed. Only read while manual. */
    clutchPedal: number;
};

/** Engine speed at rest, as a fraction of the redline. */
const idleFraction = 0.1;
/**
 * How high a slipping clutch lets the engine rev at full throttle while the wheels are too slow to
 * hold it, as a fraction of the redline.
 */
const launchFraction = 0.4;
/** Time constant of a free-revving engine chasing its throttle. */
const freeRevSeconds = 0.15;
/** How long the clutch takes to close after a shift or after the pedal comes up. */
const clutchEngageSeconds = 0.25;
/**
 * The automatic's upshift point, as a fraction of the redline, with the throttle released and
 * floored. It shifts down once the lower gear would land the engine below the upshift point.
 */
const upshiftFractions = {
    released: 0.35,
    floored: 0.8,
};
/** How far below the upshift point the lower gear must land the engine before a downshift. */
const downshiftMargin = 0.8;
/**
 * Extra drive, per redline of engine speed above the wheels' speed, while the clutch closes. A
 * spinning engine dumps its speed into the wheels, which is what makes a clutch kick break the rear
 * tires loose.
 */
const clutchKickGain = 2;

export function createMotorState(): MotorState {
    return {
        rpm: 0,
        throttle: 0,
        torque: 0,
    };
}

export function createTransmissionState(tuning: Readonly<TransmissionTuning>): TransmissionState {
    return tuning.kind === TransmissionKind.Gearbox
        ? {
              gearIndex: tuning.startGear,
              clutch: 1,
              ratio: tuning.gears[tuning.startGear]?.ratio ?? 1,
              shiftSeconds: 0,
          }
        : {
              clutch: 1,
              gearIndex: 0,
              ratio: tuning.minRatio,
              shiftSeconds: 0,
          };
}

/**
 * Same as Randomation Vehicle Physics' `GasMotor.FixedUpdate`, without its sound pitch: the
 * engine's own speed comes from {@link stepEngineRpm}.
 */
export function stepGasMotor({
    feedbackRpm,
    motor,
    situation,
    tuning,
}: Readonly<{
    motor: Readonly<MotorState>;
    tuning: Readonly<GasMotorTuning>;
    situation: Readonly<DriveSituation>;
    /** Engine-side RPM coming back from the wheels. */
    feedbackRpm: number;
}>): MotorState {
    const throttle = lerpNumber({
        from: situation.isReversing && situation.accel <= 0 ? situation.brake : situation.accel,
        to: Math.max(situation.accel, situation.burnout),
        amount: situation.burnout,
    });
    const input = clamp01(throttle);
    const maxKiloRpm = getCurveEndTime(tuning.torqueCurve);
    const boostMultiplier = situation.isBoosting ? 1 + situation.boostBoost : 1;
    const rpm = lerpNumber({
        from: motor.rpm,
        to: input * maxKiloRpm * 1000 * boostMultiplier,
        amount: 1 - tuning.inertia,
    });
    const torque =
        feedbackRpm > rpm
            ? 0
            : evaluateCurve(
                  tuning.torqueCurve,
                  feedbackRpm * 0.001 - (situation.isBoosting ? situation.boostBoost : 0),
              ) *
              lerpNumber({
                  from: motor.torque,
                  to: tuning.power * Math.abs(Math.sign(input)),
                  amount: 1 - tuning.inertia,
              }) *
              boostMultiplier *
              situation.health;

    return {
        rpm,
        throttle,
        torque,
    };
}

/**
 * The engine's own speed. Randomation has none: its tachometer reads the wheels' speed through the
 * gear, which jumps on every shift and reads 0 at a stop. Here a clutch sits between the two. Fully
 * engaged, the engine turns with the wheels, though a slipping clutch keeps it at idle or above
 * while launching. In neutral, the engine revs freely toward its throttle.
 */
export function stepEngineRpm({
    clutchPedal,
    dtSeconds,
    engineRpm,
    maxKiloRpm,
    throttle,
    transmission,
    wheelRpm,
}: Readonly<{
    engineRpm: number;
    /** Engine-side RPM coming back from the wheels. */
    wheelRpm: number;
    throttle: number;
    transmission: Readonly<TransmissionState>;
    clutchPedal: number;
    maxKiloRpm: number;
    dtSeconds: number;
}>) {
    const redline = maxKiloRpm * 1000;
    const idle = redline * idleFraction;
    const input = clamp01(throttle);
    const launchRpm = lerpNumber({
        from: idle,
        to: redline * launchFraction,
        amount: input,
    });
    const wheelSpeed = Math.abs(wheelRpm);
    /**
     * Below the launch speed the clutch slips, holding the engine up. The slip fades as the wheels
     * catch up instead of cutting off, so the engine dips a little as the clutch bites, but a car
     * lugging along in a tall gear isn't held at launch speed.
     */
    const coupledTarget =
        wheelSpeed < launchRpm
            ? wheelSpeed + (launchRpm - wheelSpeed) ** 2 / launchRpm
            : wheelSpeed;
    const isNeutral = transmission.ratio === 0;
    const freeTarget = lerpNumber({
        from: idle,
        to: redline,
        amount: input,
    });

    return lerpNumber({
        from: engineRpm,
        to: Math.min(
            redline,
            isNeutral
                ? freeTarget
                : lerpNumber({
                      from: coupledTarget,
                      to: freeTarget,
                      amount: clutchPedal,
                  }),
        ),
        /**
         * An open clutch lets the engine glide to the new gear's speed instead of snapping to it,
         * the way a rev-matching automatic clutch does.
         */
        amount: lerpNumber({
            from: clamp01(dtSeconds / freeRevSeconds),
            to: 1,
            amount: isNeutral ? 0 : transmission.clutch,
        }),
    });
}

function getGear(gears: ReadonlyArray<Readonly<GearTuning>>, index: number): Readonly<GearTuning> {
    const gear = gears[Math.min(gears.length - 1, Math.max(0, index))];

    if (!gear) {
        throw new Error('A gearbox needs at least one gear.');
    }

    return gear;
}

/** Steps past neutral, the way an automatic gearbox does. */
function findNextGear({
    direction,
    fromIndex,
    gears,
}: Readonly<{
    gears: ReadonlyArray<Readonly<GearTuning>>;
    fromIndex: number;
    direction: 1 | -1;
}>): number {
    const next = fromIndex + direction;
    return getGear(gears, next).ratio === 0 && next > 0 && next < gears.length - 1
        ? findNextGear({
              direction,
              fromIndex: next,
              gears,
          })
        : Math.min(gears.length - 1, Math.max(0, next));
}

function getShiftSeconds(
    tuning: Readonly<Extract<TransmissionTuning, {kind: TransmissionKind.Gearbox}>>,
) {
    return convertDuration(tuning.shiftDuration, {
        seconds: true,
    }).seconds;
}

/**
 * Same as Randomation Vehicle Physics' automatic `GearboxTransmission.FixedUpdate`, except for when
 * it shifts between forward gears. Randomation compares the wheels' speed to a speed range per
 * gear, which upshifts early and at the same engine speed however hard the throttle is pressed.
 * This shifts at an engine speed that rises with the throttle instead.
 */
function stepGearbox({
    dtSeconds,
    engineFeedbackRpm,
    maxKiloRpm,
    situation,
    transmission,
    tuning,
}: Readonly<{
    transmission: Readonly<TransmissionState>;
    tuning: Readonly<Extract<TransmissionTuning, {kind: TransmissionKind.Gearbox}>>;
    situation: Readonly<DriveSituation>;
    engineFeedbackRpm: number;
    maxKiloRpm: number;
    dtSeconds: number;
}>): Omit<TransmissionState, 'clutch'> {
    const gears = tuning.gears;
    const shiftSeconds = Math.max(0, transmission.shiftSeconds - dtSeconds);
    const gearIndex = transmission.gearIndex;
    const currentGear = getGear(gears, gearIndex);
    const ratio = currentGear.ratio;
    const upperIndex = findNextGear({
        direction: 1,
        fromIndex: gearIndex,
        gears,
    });
    const lowerIndex = findNextGear({
        direction: -1,
        fromIndex: gearIndex,
        gears,
    });
    const upperGear = getGear(gears, upperIndex);
    const lowerGear = getGear(gears, lowerIndex);
    const upshiftRpm =
        maxKiloRpm *
        1000 *
        lerpNumber({
            from: upshiftFractions.released,
            to: upshiftFractions.floored,
            amount: clamp01(situation.accel),
        });
    /**
     * Randomation's speed ranges make reverse and neutral always ready to shift up, and make first
     * gear ready to shift down into reverse once the wheels stop or roll backward. The checks after
     * these decide whether they actually do.
     */
    const isPastUpshiftPoint =
        ratio > 0
            ? Math.abs(engineFeedbackRpm) >= upshiftRpm
            : ratio === 0 || engineFeedbackRpm >= 0;
    const isPastDownshiftPoint =
        lowerGear.ratio > 0 && ratio > 0
            ? (Math.abs(engineFeedbackRpm) * lowerGear.ratio) / ratio < upshiftRpm * downshiftMargin
            : engineFeedbackRpm <= 0;
    const firstGearIndex = Math.max(
        0,
        gears.findIndex((gear) => gear.ratio > 0),
    );

    function shiftTo(index: number): Omit<TransmissionState, 'clutch'> {
        return {
            gearIndex: index,
            ratio: getGear(gears, index).ratio,
            shiftSeconds: getShiftSeconds(tuning),
        };
    }

    const unchanged: Omit<TransmissionState, 'clutch'> = {
        gearIndex,
        ratio,
        shiftSeconds,
    };

    if (shiftSeconds > 0 || situation.groundedWheelCount === 0) {
        return unchanged;
    } else if (situation.burnout > 0) {
        return gearIndex === firstGearIndex ? unchanged : shiftTo(firstGearIndex);
    } else if (
        !(Math.abs(situation.forwardSpeed) > 1 || situation.accel > 0 || situation.brake > 0)
    ) {
        return unchanged;
    }

    const shouldUpshift =
        gearIndex < gears.length - 1 &&
        (isPastUpshiftPoint ||
            (ratio <= 0 &&
                upperGear.ratio > 0 &&
                (!situation.isReversing ||
                    (situation.accel > 0 && situation.forwardSpeed > ratio * 10)))) &&
        !(situation.brake > 0 && upperGear.ratio >= 0) &&
        !(situation.forwardSpeed < 0 && situation.accel === 0);
    const shouldDownshift =
        gearIndex > 0 &&
        (isPastDownshiftPoint ||
            (ratio >= 0 &&
                lowerGear.ratio < 0 &&
                (situation.isReversing ||
                    ((situation.accel < 0 || situation.brake > 0) &&
                        situation.forwardSpeed < ratio * 10)))) &&
        !(situation.accel > 0 && lowerGear.ratio <= 0) &&
        (lowerGear.ratio > 0 || situation.forwardSpeed < 1);

    return shouldUpshift ? shiftTo(upperIndex) : shouldDownshift ? shiftTo(lowerIndex) : unchanged;
}

/**
 * Steps one gear at a time, neutral included, when the driver asks. It refuses reverse while
 * rolling forward.
 */
function stepManualGearbox({
    dtSeconds,
    gearChange,
    situation,
    transmission,
    tuning,
}: Readonly<{
    transmission: Readonly<TransmissionState>;
    tuning: Readonly<Extract<TransmissionTuning, {kind: TransmissionKind.Gearbox}>>;
    situation: Readonly<DriveSituation>;
    gearChange: number;
    dtSeconds: number;
}>): Omit<TransmissionState, 'clutch'> {
    const targetIndex = Math.min(
        tuning.gears.length - 1,
        Math.max(0, transmission.gearIndex + Math.sign(gearChange)),
    );
    const targetRatio = getGear(tuning.gears, targetIndex).ratio;

    return targetIndex === transmission.gearIndex || (targetRatio < 0 && situation.forwardSpeed > 1)
        ? {
              ...transmission,
              shiftSeconds: Math.max(0, transmission.shiftSeconds - dtSeconds),
          }
        : {
              gearIndex: targetIndex,
              ratio: targetRatio,
              shiftSeconds: getShiftSeconds(tuning),
          };
}

/** Same as Randomation Vehicle Physics' `ContinuousTransmission.FixedUpdate`. */
function stepContinuous({
    engineFeedbackRpm,
    maxKiloRpm,
    situation,
    transmission,
    tuning,
}: Readonly<{
    transmission: Readonly<TransmissionState>;
    tuning: Readonly<Extract<TransmissionTuning, {kind: TransmissionKind.Continuous}>>;
    situation: Readonly<DriveSituation>;
    engineFeedbackRpm: number;
    maxKiloRpm: number;
}>): Omit<TransmissionState, 'clutch'> {
    const targetRatio =
        situation.groundedWheelCount > 0
            ? (1 - situation.burnout) *
              clamp01(
                  Math.abs(engineFeedbackRpm) /
                      Math.max(0.01, maxKiloRpm * 1000 * Math.abs(transmission.ratio)),
              )
            : clamp01(
                  (Math.abs(transmission.ratio) - tuning.minRatio) /
                      (tuning.maxRatio - tuning.minRatio),
              );

    return {
        ...transmission,
        ratio:
            lerpNumber({
                from: tuning.minRatio,
                to: tuning.maxRatio,
                amount: targetRatio,
            }) * (situation.isReversing ? -1 : 1),
    };
}

/**
 * Shifts or adjusts the ratio, then splits the engine's drive across the driven wheels. Same as
 * Randomation Vehicle Physics' transmissions and their `SetOutputDrives`, plus a clutch that eases
 * the drive back in after each shift or when its pedal comes up.
 */
export function stepTransmission({
    drivenWheelCount,
    dtSeconds,
    engineFeedbackRpm,
    engineRpm,
    maxKiloRpm,
    motor,
    shiftRequest,
    situation,
    transmission,
    tuning,
}: Readonly<{
    transmission: Readonly<TransmissionState>;
    tuning: Readonly<TransmissionTuning>;
    motor: Readonly<DriveForce>;
    situation: Readonly<DriveSituation>;
    shiftRequest: Readonly<ShiftRequest>;
    engineFeedbackRpm: number;
    /** The engine's own speed. See {@link stepEngineRpm}. */
    engineRpm: number;
    maxKiloRpm: number;
    drivenWheelCount: number;
    dtSeconds: number;
}>): {transmission: TransmissionState; wheelDrive: DriveForce} {
    const isNeutralOrShifting = transmission.ratio === 0 || transmission.shiftSeconds > 0;
    const clutchKick =
        1 +
        (clutchKickGain * Math.max(0, engineRpm - Math.abs(engineFeedbackRpm))) /
            (maxKiloRpm * 1000);
    const wheelDrive: DriveForce = isNeutralOrShifting
        ? {
              rpm: 0,
              torque: 0,
          }
        : {
              rpm: motor.rpm / transmission.ratio,
              torque:
                  Math.abs(transmission.ratio) *
                  motor.torque *
                  transmission.clutch *
                  clutchKick *
                  (1 / Math.max(1, drivenWheelCount)) ** tuning.driveDividePower,
          };
    const next =
        tuning.kind === TransmissionKind.Gearbox
            ? shiftRequest.isManual
                ? stepManualGearbox({
                      dtSeconds,
                      gearChange: shiftRequest.gearChange,
                      situation,
                      transmission,
                      tuning,
                  })
                : stepGearbox({
                      dtSeconds,
                      engineFeedbackRpm,
                      maxKiloRpm,
                      situation,
                      transmission,
                      tuning,
                  })
            : stepContinuous({
                  engineFeedbackRpm,
                  maxKiloRpm,
                  situation,
                  transmission,
                  tuning,
              });

    return {
        transmission: {
            ...next,
            clutch:
                next.shiftSeconds > 0
                    ? 0
                    : Math.min(
                          1 - shiftRequest.clutchPedal,
                          transmission.clutch + dtSeconds / clutchEngageSeconds,
                      ),
        },
        wheelDrive,
    };
}

/** The gear's name for the HUD. */
export function getGearLabel({
    transmission,
    tuning,
}: Readonly<{
    transmission: Readonly<TransmissionState>;
    tuning: Readonly<TransmissionTuning>;
}>) {
    if (transmission.ratio < 0) {
        return 'R';
    } else if (tuning.kind === TransmissionKind.Continuous) {
        return 'CVT';
    }

    const firstGearIndex = tuning.gears.findIndex((gear) => gear.ratio > 0);

    return transmission.ratio === 0 ? 'N' : `${transmission.gearIndex - firstGearIndex + 1}`;
}
