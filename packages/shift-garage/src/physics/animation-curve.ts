import {type PartialWithUndefined} from '@augment-vir/common';

/**
 * One key of a Unity `AnimationCurve`. The tangents are slopes: value change per unit of time.
 * Unity's "weighted" tangents are not supported, which Randomation Vehicle Physics never uses.
 */
export type CurveKey = {
    time: number;
    value: number;
    inTangent: number;
    outTangent: number;
};

/** Keys sorted by time. */
export type AnimationCurve = ReadonlyArray<Readonly<CurveKey>>;

/** Builds a curve key, with one slope for both sides unless `outTangent` is given. */
export function curveKey({
    time,
    value,
    inTangent = 0,
    outTangent = inTangent,
}: Readonly<
    Pick<CurveKey, 'time' | 'value'> &
        PartialWithUndefined<Pick<CurveKey, 'inTangent' | 'outTangent'>>
>): CurveKey {
    return {
        inTangent,
        outTangent,
        time,
        value,
    };
}

/**
 * Same as Unity's `AnimationCurve.Evaluate` with the default clamped wrap modes: before the first
 * key and after the last, the curve holds that key's value. Between keys it's a cubic Hermite
 * spline.
 */
export function evaluateCurve(curve: AnimationCurve, time: number) {
    const first = curve[0];
    const last = curve[curve.length - 1];

    if (!first || !last) {
        return 0;
    } else if (time <= first.time) {
        return first.value;
    } else if (time >= last.time) {
        return last.value;
    }

    const endIndex = curve.findIndex((key) => key.time > time);
    const start = curve[endIndex - 1];
    const end = curve[endIndex];

    if (!start || !end) {
        return last.value;
    }

    const span = end.time - start.time;
    const progress = (time - start.time) / span;
    const progressSquared = progress * progress;
    const progressCubed = progressSquared * progress;

    return (
        (2 * progressCubed - 3 * progressSquared + 1) * start.value +
        (progressCubed - 2 * progressSquared + progress) * span * start.outTangent +
        (-2 * progressCubed + 3 * progressSquared) * end.value +
        (progressCubed - progressSquared) * span * end.inTangent
    );
}

/** The time of a curve's last key, which Randomation Vehicle Physics uses as its range. */
export function getCurveEndTime(curve: AnimationCurve) {
    return curve[curve.length - 1]?.time ?? 0;
}
