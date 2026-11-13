// cspell:words torsen
import {evaluateCurve} from './animation-curve.js';
import {DifferentialKind, type DrivetrainTuning, type EngineTuning} from './vehicle-preset.js';

/** Shift's `SLIP_THRESHOLD`: how much more one wheel must slip before a clutch LSD locks. */
const lsdSlipThreshold = 0.01;

export function rpmToAngularVelocity(rpm: number) {
    return (rpm * 2 * Math.PI) / 60;
}

export function angularVelocityToRpm(angularVelocity: number) {
    return (angularVelocity * 60) / (2 * Math.PI);
}

/** The gear's ratio times the final drive: engine turns per wheel turn. */
export function getTotalRatio({
    gearIndex,
    tuning,
}: Readonly<{
    gearIndex: number;
    tuning: Readonly<Pick<DrivetrainTuning, 'gears' | 'finalDrive'>>;
}>) {
    return (tuning.gears[gearIndex] ?? 0) * tuning.finalDrive;
}

/**
 * Same as Shift's engine step in `Motor.process`: the engine's torque minus its own friction and
 * what the clutch takes, never revving past the limiter or below a stop.
 */
export function stepEngine({
    clutchTorque,
    dtSeconds,
    engineAngularVelocity,
    throttle,
    tuning,
}: Readonly<{
    engineAngularVelocity: number;
    /** From 0 to 1. */
    throttle: number;
    clutchTorque: number;
    dtSeconds: number;
    tuning: Readonly<EngineTuning>;
}>) {
    const rpmFraction = angularVelocityToRpm(engineAngularVelocity) / tuning.maxRpm;
    const torque = evaluateCurve(tuning.torqueCurve, rpmFraction) * tuning.maxTorque * throttle;
    const friction =
        tuning.friction.constant +
        tuning.friction.linear * rpmFraction +
        tuning.friction.quadratic * rpmFraction ** 2;
    const netTorque =
        rpmFraction >= 1 ? -clutchTorque : torque - (1 - throttle) * friction - clutchTorque;

    return Math.max(0, engineAngularVelocity + (netTorque / tuning.inertia) * dtSeconds);
}

/**
 * Same as Shift's `Motor.get_differential_torque` for one axle. `slips` are each wheel's slip
 * ratio; the result is each wheel's torque, in the same order.
 */
export function splitAxleTorque({
    kind,
    slips,
    torque,
    tuning,
}: Readonly<{
    kind: DifferentialKind;
    torque: number;
    slips: Readonly<
        [
            number,
            number,
        ]
    >;
    tuning: Readonly<Pick<DrivetrainTuning, 'torqueBiasRatio' | 'lsdPreload' | 'lsdRamp'>>;
}>): [
    number,
    number,
] {
    const [
        firstSlip,
        secondSlip,
    ] = slips;
    const half = torque / 2;
    const even: [
        number,
        number,
    ] = [
        half,
        half,
    ];
    const splitters: Record<
        DifferentialKind,
        () => [
            number,
            number,
        ]
    > = {
        [DifferentialKind.Open]() {
            return even;
        },
        [DifferentialKind.Torsen]() {
            if (Math.min(firstSlip, secondSlip) <= 0) {
                return even;
            }

            const high = (torque * tuning.torqueBiasRatio) / (tuning.torqueBiasRatio + 1);
            const low = torque / (tuning.torqueBiasRatio + 1);

            return firstSlip > secondSlip
                ? [
                      low,
                      high,
                  ]
                : [
                      high,
                      low,
                  ];
        },
        [DifferentialKind.ClutchLsd]() {
            const lock = Math.min(
                tuning.lsdPreload + Math.abs(torque) * tuning.lsdRamp,
                Math.abs(torque) / 2,
            );
            const high = Math.sign(torque) * (Math.abs(half) + lock);
            const low = Math.sign(torque) * Math.max(Math.abs(half) - lock, 0);

            if (firstSlip - secondSlip > lsdSlipThreshold) {
                return [
                    low,
                    high,
                ];
            } else if (secondSlip - firstSlip > lsdSlipThreshold) {
                return [
                    high,
                    low,
                ];
            } else {
                return even;
            }
        },
    };

    return splitters[kind]();
}
