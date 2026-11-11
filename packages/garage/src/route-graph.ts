import {createArray} from '@augment-vir/common';
import {
    sampleTrack,
    type GroundPoint,
    type TrackLayout,
} from '@evir/driving-common/src/track-layout.js';

/** Every road's center line as points joined where they follow each other or where roads meet. */
export type RouteGraph = {
    points: ReadonlyArray<Readonly<GroundPoint>>;
    /** For each point, half the width of the road it's on. */
    halfWidths: ReadonlyArray<number>;
    /** For each point, the points it joins and the meters to each. */
    links: ReadonlyArray<ReadonlyArray<Readonly<RouteLink>>>;
};

export type RouteLink = {
    pointIndex: number;
    distance: number;
};

/** Every point's road distance to one point, and its next step toward that point. */
export type RouteDistances = {
    distances: ReadonlyArray<number>;
    /** -1 at the point itself and at points that can't reach it. */
    nextPointIndexes: ReadonlyArray<number>;
};

/** Road samples kept per graph point. Sampled roads are 1 m apart. */
const samplesPerPoint = 4;
/** Meters per side of the cells that points are bucketed into for lookup. */
const cellSize = 16;

function getCellKey(point: Readonly<GroundPoint>) {
    return `${Math.floor(point.x / cellSize)},${Math.floor(point.z / cellSize)}`;
}

/** Meters between two points on the ground. */
export function getDistance({
    from,
    to,
}: Readonly<{from: Readonly<GroundPoint>; to: Readonly<GroundPoint>}>) {
    return Math.hypot(to.x - from.x, to.z - from.z);
}

function bucketPoints(points: ReadonlyArray<Readonly<GroundPoint>>) {
    return points.reduce((cells, point, pointIndex) => {
        const key = getCellKey(point);

        return cells.set(key, [
            ...(cells.get(key) ?? []),
            pointIndex,
        ]);
    }, new Map<string, number[]>());
}

/** Indexes of the points within one cell of `point`, in any direction. */
function getNearbyPointIndexes({
    cells,
    point,
}: Readonly<{cells: ReadonlyMap<string, ReadonlyArray<number>>; point: Readonly<GroundPoint>}>) {
    return [
        -1,
        0,
        1,
    ].flatMap((offsetX) => {
        return [
            -1,
            0,
            1,
        ].flatMap((offsetZ) => {
            return (
                cells.get(
                    getCellKey({
                        x: point.x + offsetX * cellSize,
                        z: point.z + offsetZ * cellSize,
                    }),
                ) ?? []
            );
        });
    });
}

/**
 * Joins each road's center-line points in order, and joins a point to the nearest point of every
 * other road whose pavement it lies on, so routes can turn wherever roads cross or meet.
 */
export function createRouteGraph(roads: ReadonlyArray<Readonly<TrackLayout>>): RouteGraph {
    const roadPoints = roads.map((road) => {
        const samples = sampleTrack(road);
        const kept = samples.filter((sample, index) => index % samplesPerPoint === 0);
        const last = samples.at(-1);

        return road.isOpen && last && kept.at(-1) !== last
            ? [
                  ...kept,
                  last,
              ]
            : kept;
    });
    const firstIndexes = roadPoints.reduce<number[]>(
        (starts, points, roadIndex) => {
            return [
                ...starts,
                (starts[roadIndex] ?? 0) + points.length,
            ];
        },
        [
            0,
        ],
    );
    const points = roadPoints.flat();
    const roadIndexes = roadPoints.flatMap((roadSamples, roadIndex) => {
        return createArray(roadSamples.length, () => roadIndex);
    });
    const cells = bucketPoints(points);
    const alongRoadLinks = roadPoints.flatMap((roadSamples, roadIndex) => {
        const first = firstIndexes[roadIndex] ?? 0;
        const linkCount = roads[roadIndex]?.isOpen ? roadSamples.length - 1 : roadSamples.length;

        return createArray(Math.max(0, linkCount), (index) => {
            return [
                first + index,
                first + ((index + 1) % roadSamples.length),
            ] as const;
        });
    });
    const crossingLinks = points.flatMap((point, pointIndex) => {
        const nearestByRoad = getNearbyPointIndexes({
            cells,
            point,
        }).reduce((nearest, otherIndex) => {
            const otherRoad = roadIndexes[otherIndex] ?? -1;
            const other = points[otherIndex];

            if (otherRoad === roadIndexes[pointIndex] || !other) {
                return nearest;
            }

            const distance = getDistance({
                from: point,
                to: other,
            });
            const best = nearest.get(otherRoad);
            const isOnOtherRoad = distance < (roads[otherRoad]?.width ?? 0) / 2;

            return isOnOtherRoad && (!best || distance < best.distance)
                ? new Map(nearest).set(otherRoad, {
                      distance,
                      otherIndex,
                  })
                : nearest;
        }, new Map<number, {distance: number; otherIndex: number}>());

        return [...nearestByRoad.values()].map(({otherIndex}) => {
            return [
                pointIndex,
                otherIndex,
            ] as const;
        });
    });

    const linksByPoint = Map.groupBy(
        [
            ...alongRoadLinks,
            ...crossingLinks,
        ].flatMap(
            ([
                from,
                to,
            ]) => {
                const fromPoint = points[from];
                const toPoint = points[to];

                if (!fromPoint || !toPoint || from === to) {
                    return [];
                }

                const distance = getDistance({
                    from: fromPoint,
                    to: toPoint,
                });

                return [
                    {
                        distance,
                        from,
                        pointIndex: to,
                    },
                    {
                        distance,
                        from: to,
                        pointIndex: from,
                    },
                ];
            },
        ),
        (link) => link.from,
    );

    return {
        halfWidths: roadIndexes.map((roadIndex) => (roads[roadIndex]?.width ?? 0) / 2),
        links: points.map((point, pointIndex) => {
            return (linksByPoint.get(pointIndex) ?? []).map(({distance, pointIndex}) => {
                return {
                    distance,
                    pointIndex,
                };
            });
        }),
        points,
    };
}

/** The graph point closest to `point`. Only an empty graph has none. */
export function findNearestRoutePoint({
    graph,
    point,
}: Readonly<{graph: Readonly<RouteGraph>; point: Readonly<GroundPoint>}>) {
    return graph.points.reduce<{distance: number; pointIndex: number} | undefined>(
        (nearest, candidate, pointIndex) => {
            const distance = getDistance({
                from: point,
                to: candidate,
            });

            return !nearest || distance < nearest.distance
                ? {
                      distance,
                      pointIndex,
                  }
                : nearest;
        },
        undefined,
    )?.pointIndex;
}

/**
 * Dijkstra's shortest paths from every point to `targetIndex` over the road graph. With
 * `targetHeading`, paths may only leave the target going that way or to the side, never back.
 */
export function getRouteDistances({
    graph,
    targetHeading,
    targetIndex,
}: Readonly<{
    graph: Readonly<RouteGraph>;
    targetIndex: number;
    targetHeading?: Readonly<GroundPoint> | undefined;
}>): RouteDistances {
    const target = graph.points[targetIndex];

    const distances = createArray(graph.points.length, () => Infinity);
    const nextPointIndexes = createArray(graph.points.length, () => -1);
    const isDone = createArray(graph.points.length, () => false);
    /** A binary min-heap of [distance, point index]. Stale entries are skipped when popped. */
    const heap: Array<
        [
            number,
            number,
        ]
    > = [
        [
            0,
            targetIndex,
        ],
    ];

    distances[targetIndex] = 0;

    function push(
        entry: [
            number,
            number,
        ],
    ) {
        heap.push(entry);
        let index = heap.length - 1;
        while (index > 0) {
            const parent = (index - 1) >> 1;
            const parentEntry = heap[parent];
            if (!parentEntry || parentEntry[0] <= entry[0]) {
                break;
            }
            heap[index] = parentEntry;
            heap[parent] = entry;
            index = parent;
        }
    }

    /** Moves the entry at `index` down until both its children are larger. */
    function sink(index: number): void {
        const entry = heap[index];
        const smallest = [
            index * 2 + 1,
            index * 2 + 2,
        ].reduce((best, child) => {
            return (heap[child]?.[0] ?? Infinity) < (heap[best]?.[0] ?? Infinity) ? child : best;
        }, index);
        const smallestEntry = heap[smallest];

        if (smallest !== index && entry && smallestEntry) {
            heap[smallest] = entry;
            heap[index] = smallestEntry;
            sink(smallest);
        }
    }

    function pop() {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length && last) {
            heap[0] = last;
            sink(0);
        }
        return top;
    }

    while (heap.length) {
        const entry = pop();
        if (!entry) {
            break;
        }
        const [
            distance,
            pointIndex,
        ] = entry;
        if (isDone[pointIndex]) {
            continue;
        }
        isDone[pointIndex] = true;
        graph.links[pointIndex]?.forEach((link) => {
            const linked = graph.points[link.pointIndex];

            if (
                pointIndex === targetIndex &&
                targetHeading &&
                target &&
                linked &&
                (linked.x - target.x) * targetHeading.x + (linked.z - target.z) * targetHeading.z <
                    0
            ) {
                return;
            }

            const reached = distance + link.distance;
            if (reached < (distances[link.pointIndex] ?? Infinity)) {
                distances[link.pointIndex] = reached;
                nextPointIndexes[link.pointIndex] = pointIndex;
                push([
                    reached,
                    link.pointIndex,
                ]);
            }
        });
    }

    return {
        distances,
        nextPointIndexes,
    };
}

/**
 * The points from `fromIndex` along the shortest road route to the target the distances lead to,
 * each with half its road's width.
 */
export function getRoutePath({
    fromIndex,
    graph,
    routeDistances,
}: Readonly<{
    graph: Readonly<RouteGraph>;
    routeDistances: Readonly<RouteDistances>;
    fromIndex: number;
}>) {
    const pointIndexes = [
        fromIndex,
    ];
    /** The step count cap only guards against a cycle in malformed distances. */
    while (pointIndexes.length <= graph.points.length) {
        const next = routeDistances.nextPointIndexes[pointIndexes.at(-1) ?? -1] ?? -1;
        if (next < 0) {
            break;
        }
        pointIndexes.push(next);
    }

    return pointIndexes.flatMap((pointIndex) => {
        const point = graph.points[pointIndex];

        return point
            ? [
                  {
                      ...point,
                      halfWidth: graph.halfWidths[pointIndex] ?? 0,
                  },
              ]
            : [];
    });
}
