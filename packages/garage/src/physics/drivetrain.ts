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
    /** From 0 to 1. */
    pitch: number;
    airPitch: number;
};

export type TransmissionState = {
    gearIndex: number;
    /** Physics steps left in the current shift. */
    shiftTime: number;
    /** The ratio driving the wheels right now: the gear's ratio, or the CVT's. */
    ratio: number;
};

export function createMotorState(): MotorState {
    return {
        airPitch: 1,
        pitch: 0,
        rpm: 0,
        throttle: 0,
        torque: 0,
    };
}

export function createTransmissionState(tuning: Readonly<TransmissionTuning>): TransmissionState {
    return tuning.kind === TransmissionKind.Gearbox
        ? {
              gearIndex: tuning.startGear,
              ratio: tuning.gears[tuning.startGear]?.ratio ?? 1,
              shiftTime: 0,
          }
        : {
              gearIndex: 0,
              ratio: tuning.minRatio,
              shiftTime: 0,
          };
}

/** Same as Randomation Vehicle Physics' `GasMotor.FixedUpdate`. */
export function stepGasMotor({
    feedbackRpm,
    motor,
    situation,
    transmission,
    transmissionTuning,
    tuning,
}: Readonly<{
    motor: Readonly<MotorState>;
    tuning: Readonly<GasMotorTuning>;
    situation: Readonly<DriveSituation>;
    /** Engine-side RPM coming back from the wheels. */
    feedbackRpm: number;
    transmission: Readonly<TransmissionState>;
    transmissionTuning: Readonly<TransmissionTuning>;
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
    const isShifting = transmission.shiftTime > 0;
    const shiftDelay =
        transmissionTuning.kind === TransmissionKind.Gearbox ? transmissionTuning.shiftDelay : 1;
    const airPitch =
        situation.groundedWheelCount > 0 || throttle !== 0
            ? 1
            : lerpNumber({
                  from: motor.airPitch,
                  to: 0,
                  amount: 0.5 * 0.01,
              });
    const pitchFactor =
        (throttle !== 0 || situation.groundedWheelCount === 0 ? 1 : 0.5) *
        (isShifting ? Math.min(shiftDelay, transmission.shiftTime ** 2) / shiftDelay : 1) *
        airPitch;

    return {
        airPitch,
        pitch: lerpNumber({
            from: motor.pitch,
            to: Math.abs((feedbackRpm * 0.001) / maxKiloRpm) * pitchFactor,
            amount: 0.1,
        }),
        rpm,
        throttle,
        torque,
    };
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

/** Same as Randomation Vehicle Physics' automatic `GearboxTransmission.FixedUpdate`. */
function stepGearbox({
    situation,
    transmission,
    tuning,
    wheelFeedbackRpm,
}: Readonly<{
    transmission: Readonly<TransmissionState>;
    tuning: Readonly<Extract<TransmissionTuning, {kind: TransmissionKind.Gearbox}>>;
    situation: Readonly<DriveSituation>;
    wheelFeedbackRpm: number;
}>): TransmissionState {
    const gears = tuning.gears;
    const shiftTime = Math.max(0, transmission.shiftTime - 1);
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
    const upshiftDifference = currentGear.maxRpm - upperGear.minRpm;
    const downshiftDifference = lowerGear.maxRpm - currentGear.minRpm;
    const firstGearIndex = Math.max(
        0,
        gears.findIndex((gear) => gear.ratio > 0),
    );

    function shiftTo(index: number): TransmissionState {
        return {
            gearIndex: index,
            ratio: getGear(gears, index).ratio,
            shiftTime: tuning.shiftDelay,
        };
    }

    const unchanged: TransmissionState = {
        gearIndex,
        ratio,
        shiftTime,
    };

    if (shiftTime > 0 || situation.groundedWheelCount === 0) {
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
        (upperGear.minRpm +
            upshiftDifference *
                (ratio < 0 ? Math.min(1, tuning.shiftThreshold) : tuning.shiftThreshold) -
            wheelFeedbackRpm <=
            0 ||
            (ratio <= 0 &&
                upperGear.ratio > 0 &&
                (!situation.isReversing ||
                    (situation.accel > 0 && situation.forwardSpeed > ratio * 10)))) &&
        !(situation.brake > 0 && upperGear.ratio >= 0) &&
        !(situation.forwardSpeed < 0 && situation.accel === 0);
    const shouldDownshift =
        gearIndex > 0 &&
        (wheelFeedbackRpm - (lowerGear.maxRpm - downshiftDifference * tuning.shiftThreshold) <= 0 ||
            (ratio >= 0 &&
                lowerGear.ratio < 0 &&
                (situation.isReversing ||
                    ((situation.accel < 0 || situation.brake > 0) &&
                        situation.forwardSpeed < ratio * 10)))) &&
        !(situation.accel > 0 && lowerGear.ratio <= 0) &&
        (lowerGear.ratio > 0 || situation.forwardSpeed < 1);

    return shouldUpshift ? shiftTo(upperIndex) : shouldDownshift ? shiftTo(lowerIndex) : unchanged;
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
}>): TransmissionState {
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
 * Randomation Vehicle Physics' transmissions and their `SetOutputDrives`.
 */
export function stepTransmission({
    drivenWheelCount,
    engineFeedbackRpm,
    maxKiloRpm,
    motor,
    situation,
    transmission,
    tuning,
}: Readonly<{
    transmission: Readonly<TransmissionState>;
    tuning: Readonly<TransmissionTuning>;
    motor: Readonly<DriveForce>;
    situation: Readonly<DriveSituation>;
    engineFeedbackRpm: number;
    maxKiloRpm: number;
    drivenWheelCount: number;
}>): {transmission: TransmissionState; wheelDrive: DriveForce} {
    const isNeutralOrShifting = transmission.ratio === 0 || transmission.shiftTime > 0;
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
                  (1 / Math.max(1, drivenWheelCount)) ** tuning.driveDividePower,
          };
    const next =
        tuning.kind === TransmissionKind.Gearbox
            ? stepGearbox({
                  situation,
                  transmission,
                  tuning,
                  wheelFeedbackRpm:
                      transmission.ratio === 0
                          ? 0
                          : engineFeedbackRpm / Math.abs(transmission.ratio),
              })
            : stepContinuous({
                  engineFeedbackRpm,
                  maxKiloRpm,
                  situation,
                  transmission,
                  tuning,
              });

    return {
        transmission: next,
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
