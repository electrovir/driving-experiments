// cspell:words catmull
import {createArray, type PartialWithUndefined} from '@augment-vir/common';

/** A point on the ground plane, in meters. */
export type GroundPoint = {
    x: number;
    z: number;
};

/** A closed loop of road, or an open one when {@link TrackLayout.isOpen} is set. */
export type TrackLayout = {
    /**
     * The road's center passes through these in order and loops back to the first, which is where
     * the start line goes. The curve between them overshoots when neighbors are spaced very
     * unevenly.
     */
    controlPoints: ReadonlyArray<Readonly<GroundPoint>>;
    /** Meters from edge to edge. */
    width: number;
} & PartialWithUndefined<{
    /** The road ends square at its first and last control points instead of looping back. */
    isOpen: boolean;
}>;

/** Meters between the points the road's curve is drawn through. */
const sampleSpacing = 1;

/** The unit vector pointing from `from` to `to`, or zero when they are the same point. */
export function getUnitDirection({
    from,
    to,
}: Readonly<Record<'from' | 'to', Readonly<GroundPoint>>>) {
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1;

    return {
        x: (to.x - from.x) / length,
        z: (to.z - from.z) / length,
    };
}

function getCatmullRomPoint({
    after,
    before,
    end,
    progress,
    start,
}: Readonly<{
    before: Readonly<GroundPoint>;
    start: Readonly<GroundPoint>;
    end: Readonly<GroundPoint>;
    after: Readonly<GroundPoint>;
    /** From 0 at `start` to 1 at `end`. */
    progress: number;
}>) {
    const squared = progress ** 2;
    const cubed = progress ** 3;

    function interpolate(key: keyof GroundPoint) {
        return (
            0.5 *
            (2 * start[key] +
                (end[key] - before[key]) * progress +
                (2 * before[key] - 5 * start[key] + 4 * end[key] - after[key]) * squared +
                (3 * start[key] - before[key] - 3 * end[key] + after[key]) * cubed)
        );
    }

    return {
        x: interpolate('x'),
        z: interpolate('z'),
    };
}

/**
 * Points spaced evenly along the road's center, starting at the first control point. An open road's
 * samples end exactly on its last control point.
 */
export function sampleTrack(layout: Readonly<TrackLayout>) {
    const points = layout.controlPoints;
    const segmentStarts = layout.isOpen ? points.slice(0, -1) : points;
    const lastPoint = points.at(-1);

    return [
        ...segmentStarts.flatMap((start, index) => {
            /** An open road's ends have no neighbor beyond them, so the curve aims straight there. */
            const before = layout.isOpen ? (points[index - 1] ?? start) : points.at(index - 1);
            const end = points[(index + 1) % points.length];
            const after = layout.isOpen
                ? (points[index + 2] ?? end)
                : points[(index + 2) % points.length];

            if (!before || !end || !after) {
                return [];
            }

            const stepCount = Math.max(
                2,
                Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / sampleSpacing),
            );

            return createArray(stepCount, (step) => {
                return getCatmullRomPoint({
                    after,
                    before,
                    end,
                    progress: step / stepCount,
                    start,
                });
            });
        }),
        ...(layout.isOpen && lastPoint
            ? [
                  {
                      x: lastPoint.x,
                      z: lastPoint.z,
                  },
              ]
            : []),
    ];
}

/** The unit vector pointing to the road's right at each of {@link sampleTrack}'s samples. */
export function getTrackRights({
    isOpen,
    samples,
}: Readonly<{
    samples: ReadonlyArray<Readonly<GroundPoint>>;
    isOpen?: boolean | undefined;
}>) {
    return samples.map((sample, index) => {
        const previous =
            (isOpen ? samples[Math.max(0, index - 1)] : samples.at(index - 1)) ?? sample;
        const next =
            (isOpen
                ? samples[Math.min(samples.length - 1, index + 1)]
                : samples[(index + 1) % samples.length]) ?? sample;
        const direction = getUnitDirection({
            from: previous,
            to: next,
        });

        return {
            x: direction.z,
            z: -direction.x,
        };
    });
}
