import {assertWrap} from '@augment-vir/assert';
import {getUnitDirection, type GroundPoint} from '@evir/driving-common/src/track-layout.js';
import {
    findNearestRoutePoint,
    getDistance,
    getRouteDistances,
    getRoutePath,
    type RouteGraph,
} from './route-graph.js';

export enum RouteRunPhase {
    /** No destination: the car is in the garage, or is off the road with no run going. */
    Waiting = 'waiting',
    Driving = 'driving',
    /**
     * The car left the route by turning off it or by driving onto the grass. The run goes on once
     * the car is back where it left.
     */
    OffRoute = 'off-route',
}

/** A point on a route's center line. */
export type RoutePoint = GroundPoint & {
    /** Half the width of the road this point is on. */
    halfWidth: number;
};

/**
 * The route to drive once the current one is done. It begins with the end of the current route, so
 * the car is already on it when it takes over.
 */
export type NextRoute = {
    route: ReadonlyArray<Readonly<RoutePoint>>;
    /** Subtracted from a point index on the current route to get the same point on this one. */
    indexOffset: number;
};

/**
 * A drive along a road route that's fixed when the run starts. The driver has to stay on the
 * route's roads the whole way. Reaching the destination starts the next route straight away.
 */
export type RouteRun =
    | {
          phase: RouteRunPhase.Waiting;
      }
    | {
          phase: RouteRunPhase.Driving | RouteRunPhase.OffRoute;
          /** From where the run started to the destination. */
          route: ReadonlyArray<Readonly<RoutePoint>>;
          /**
           * Planned the frame after this route starts, so finishing this one never waits on route
           * finding. Undefined until then, or when no next route could be found.
           */
          nextRoute: Readonly<NextRoute> | undefined;
          /**
           * The route segment the car has driven up to, from this point to the next. Together with
           * `progressFraction`, never goes back.
           */
          progressIndex: number;
          /** How far along the `progressIndex` segment the car has driven, from 0 to 1. */
          progressFraction: number;
      };

/** Meters from the destination that count as arriving. */
const arrivalRadius = 10;
/** Meters of the current route's end that the next route begins with. */
const nextRouteOverlap = 20;
/**
 * A destination is picked from the points at least this fraction of the farthest reachable point's
 * road distance away.
 */
const farFraction = 0.6;
/**
 * Route segments checked ahead of the car's progress, so a route that later comes back near itself
 * can't be skipped ahead on.
 */
const segmentsAhead = {
    [RouteRunPhase.Driving]: 10,
    /** Rejoining only counts near where the car left, so a detour can't be a shortcut. */
    [RouteRunPhase.OffRoute]: 2,
} satisfies Record<RouteRunPhase.Driving | RouteRunPhase.OffRoute, number>;
/** Segments checked behind the car's progress, for a car that backs up a little. */
const segmentsBehind = 2;
/** Turns sharper than this angle's cosine are hairpins, where a corner's halfway line is useless. */
const hairpinCosine = Math.cos((Math.PI * 2) / 3);

/** A spot on a route: a segment, from this point to the next, and how far along it from 0 to 1. */
export type RouteSpot = {
    segmentIndex: number;
    fraction: number;
};

/**
 * The spot `distance` meters by road past `from`, stopping at the destination.
 *
 * Annotated because it's recursive.
 */
export function advanceAlongRoute({
    distance,
    from,
    route,
}: Readonly<{
    route: ReadonlyArray<Readonly<GroundPoint>>;
    from: Readonly<RouteSpot>;
    distance: number;
}>): RouteSpot {
    const start = route[from.segmentIndex];
    const end = route[from.segmentIndex + 1];

    if (!start || !end) {
        return from;
    }

    const segmentLength = getDistance({
        from: start,
        to: end,
    });
    const segmentLeft = segmentLength * (1 - from.fraction);

    return segmentLeft >= distance || from.segmentIndex + 2 >= route.length
        ? {
              fraction: segmentLength ? Math.min(1, from.fraction + distance / segmentLength) : 1,
              segmentIndex: from.segmentIndex,
          }
        : advanceAlongRoute({
              distance: distance - segmentLeft,
              from: {
                  fraction: 0,
                  segmentIndex: from.segmentIndex + 1,
              },
              route,
          });
}

/**
 * The route from `leadDistance` meters past the spot the car has driven up to, to the destination,
 * and the spot it starts at.
 */
export function getRouteAhead({
    leadDistance,
    run,
}: Readonly<{
    run: Readonly<Extract<RouteRun, {phase: RouteRunPhase.Driving | RouteRunPhase.OffRoute}>>;
    leadDistance: number;
}>) {
    const spot = advanceAlongRoute({
        distance: leadDistance,
        from: {
            fraction: run.progressFraction,
            segmentIndex: run.progressIndex,
        },
        route: run.route,
    });

    return {
        points: getRouteFrom({
            route: run.route,
            spot,
        }),
        spot,
    };
}

/** The route from `spot` to the destination. */
export function getRouteFrom({
    route,
    spot,
}: Readonly<{
    route: ReadonlyArray<Readonly<RoutePoint>>;
    spot: Readonly<RouteSpot>;
}>) {
    const start = route[spot.segmentIndex];
    const end = route[spot.segmentIndex + 1];

    return start && end
        ? [
              {
                  x: start.x + (end.x - start.x) * spot.fraction,
                  z: start.z + (end.z - start.z) * spot.fraction,
              },
              ...route.slice(spot.segmentIndex + 1),
          ]
        : route.slice(spot.segmentIndex);
}

/** Meters by road from `from` to `to`. Only meaningful when `to` is at or past `from`. */
export function getRouteGap({
    from,
    route,
    to,
}: Readonly<{
    route: ReadonlyArray<Readonly<GroundPoint>>;
    from: Readonly<RouteSpot>;
    to: Readonly<RouteSpot>;
}>) {
    const lengths = route.slice(from.segmentIndex, to.segmentIndex + 1).map((start, offset) => {
        const end = route[from.segmentIndex + offset + 1];

        return end
            ? getDistance({
                  from: start,
                  to: end,
              })
            : 0;
    });

    return (
        lengths.reduce((total, length) => total + length, 0) -
        (lengths[0] ?? 0) * from.fraction -
        (lengths.at(-1) ?? 0) * (1 - to.fraction)
    );
}

/** Where the run ends. Undefined while no run is going. */
export function getRouteDestination(run: Readonly<RouteRun>) {
    return run.phase === RouteRunPhase.Waiting ? undefined : run.route.at(-1);
}

/**
 * A route from the graph point at `startIndex` to a random point far away by road. With
 * `startHeading`, the route sets off that way or to the side, never back.
 */
function pickRoute({
    canBeDestination,
    graph,
    random,
    startHeading,
    startIndex,
}: Readonly<{
    graph: Readonly<RouteGraph>;
    canBeDestination: ReadonlyArray<boolean>;
    startIndex: number;
    startHeading?: Readonly<GroundPoint> | undefined;
    random: () => number;
}>) {
    const fromStart = getRouteDistances({
        graph,
        targetHeading: startHeading,
        targetIndex: startIndex,
    });
    const reachable = fromStart.distances.filter(
        (distance, pointIndex) => canBeDestination[pointIndex] && Number.isFinite(distance),
    );
    const farEnough = Math.max(0, ...reachable) * farFraction;
    const candidates = fromStart.distances.flatMap((distance, pointIndex) => {
        return canBeDestination[pointIndex] &&
            Number.isFinite(distance) &&
            distance > 0 &&
            distance >= farEnough
            ? [
                  pointIndex,
              ]
            : [];
    });
    const destinationIndex = candidates[Math.floor(random() * candidates.length)];

    return destinationIndex == undefined
        ? undefined
        : /** The distances lead toward the start, so the path from the destination runs backward. */
          getRoutePath({
              fromIndex: destinationIndex,
              graph,
              routeDistances: fromStart,
          }).toReversed();
}

function startRun({
    canBeDestination,
    graph,
    point,
    random,
}: Readonly<{
    graph: Readonly<RouteGraph>;
    canBeDestination: ReadonlyArray<boolean>;
    point: Readonly<GroundPoint>;
    random: () => number;
}>): RouteRun {
    const startIndex = findNearestRoutePoint({
        graph,
        point,
    });
    const route =
        startIndex == undefined
            ? undefined
            : pickRoute({
                  canBeDestination,
                  graph,
                  random,
                  startIndex,
              });

    return route
        ? {
              nextRoute: undefined,
              phase: RouteRunPhase.Driving,
              progressFraction: 0,
              progressIndex: 0,
              route,
          }
        : {
              phase: RouteRunPhase.Waiting,
          };
}

/**
 * The route onward from `route`'s destination, setting off the way `route` arrives. Turning back is
 * allowed only when the destination is a dead end.
 */
function planNextRoute({
    canBeDestination,
    graph,
    random,
    route,
}: Readonly<{
    route: ReadonlyArray<Readonly<RoutePoint>>;
    graph: Readonly<RouteGraph>;
    canBeDestination: ReadonlyArray<boolean>;
    random: () => number;
}>): NextRoute | undefined {
    const destination = route.at(-1);
    const beforeDestination = route.at(-2);
    const startIndex = destination
        ? findNearestRoutePoint({
              graph,
              point: destination,
          })
        : undefined;

    if (startIndex == undefined || !destination) {
        return undefined;
    }

    const onward =
        pickRoute({
            canBeDestination,
            graph,
            random,
            startHeading: beforeDestination
                ? {
                      x: destination.x - beforeDestination.x,
                      z: destination.z - beforeDestination.z,
                  }
                : undefined,
            startIndex,
        }) ??
        pickRoute({
            canBeDestination,
            graph,
            random,
            startIndex,
        });

    if (!onward) {
        return undefined;
    }

    const overlapCount = route.toReversed().findIndex((point) => {
        return (
            getDistance({
                from: point,
                to: destination,
            }) > nextRouteOverlap
        );
    });
    const indexOffset = Math.max(
        0,
        route.length - 1 - (overlapCount < 0 ? route.length - 1 : overlapCount),
    );

    return {
        indexOffset,
        route: [
            ...route.slice(indexOffset, -1),
            ...onward,
        ],
    };
}

/**
 * The direction the route runs at a segment's end, halfway between the segment's own `direction`
 * and the neighboring segment's, so the line across the road there splits the corner in half.
 */
function getCornerTangent({
    direction,
    neighbor,
}: Readonly<{
    direction: Readonly<GroundPoint>;
    /** Undefined at the route's ends. */
    neighbor: Readonly<GroundPoint> | undefined;
}>) {
    /**
     * At a hairpin the halfway line runs nearly along the road, cutting the segment's approach in
     * half lengthwise, and at a U-turn it doesn't exist.
     */
    return !neighbor || direction.x * neighbor.x + direction.z * neighbor.z < hairpinCosine
        ? direction
        : getUnitDirection({
              from: {
                  x: 0,
                  z: 0,
              },
              to: {
                  x: direction.x + neighbor.x,
                  z: direction.z + neighbor.z,
              },
          });
}

/**
 * How far `point` is from the route's segment starting at `segmentIndex`, and how far along the
 * segment it is from 0 to 1.
 *
 * Along is measured between the lines across the road at each end, which split each corner in half,
 * rather than by the segment's nearest spot. The nearest spot stalls at a corner while the car cuts
 * across its inside and then jumps to the next segment; between the corner lines, the next segment
 * picks up exactly where this one leaves off.
 */
function measureSegment({
    point,
    route,
    segmentIndex,
}: Readonly<{
    route: ReadonlyArray<Readonly<GroundPoint>>;
    segmentIndex: number;
    point: Readonly<GroundPoint>;
}>) {
    const start = assertWrap.isDefined(route[segmentIndex]);
    const end = assertWrap.isDefined(route[segmentIndex + 1]);
    const segment = {
        x: end.x - start.x,
        z: end.z - start.z,
    };
    const lengthSquared = segment.x ** 2 + segment.z ** 2;
    const nearestFraction = lengthSquared
        ? Math.min(
              1,
              Math.max(
                  0,
                  ((point.x - start.x) * segment.x + (point.z - start.z) * segment.z) /
                      lengthSquared,
              ),
          )
        : 0;
    const direction = getUnitDirection({
        from: start,
        to: end,
    });
    const before = route[segmentIndex - 1];
    const after = route[segmentIndex + 2];
    const startTangent = getCornerTangent({
        direction,
        neighbor: before
            ? getUnitDirection({
                  from: before,
                  to: start,
              })
            : undefined,
    });
    const endTangent = getCornerTangent({
        direction,
        neighbor: after
            ? getUnitDirection({
                  from: end,
                  to: after,
              })
            : undefined,
    });
    const pastStart = (point.x - start.x) * startTangent.x + (point.z - start.z) * startTangent.z;
    const pastEnd = (point.x - end.x) * endTangent.x + (point.z - end.z) * endTangent.z;

    return {
        distance: getDistance({
            from: point,
            to: {
                x: start.x + segment.x * nearestFraction,
                z: start.z + segment.z * nearestFraction,
            },
        }),
        fraction:
            pastStart > pastEnd
                ? Math.min(1, Math.max(0, pastStart / (pastStart - pastEnd)))
                : nearestFraction,
        /** Whether `point` is between the corner lines at the segment's two ends. */
        isBetweenEnds: pastStart >= 0 && pastEnd <= 0,
    };
}

/**
 * The route segment near the car's progress whose road the car is on, and how far along it the car
 * is. Undefined when the car isn't on any of them.
 */
function findRouteSegment({
    phase,
    point,
    progressIndex,
    route,
    sidewalkWidth,
}: Readonly<{
    route: ReadonlyArray<Readonly<RoutePoint>>;
    progressIndex: number;
    phase: RouteRunPhase.Driving | RouteRunPhase.OffRoute;
    point: Readonly<GroundPoint>;
    sidewalkWidth: number;
}>) {
    const firstIndex = Math.max(0, progressIndex - segmentsBehind);
    const lastIndex = Math.min(route.length - 2, progressIndex + segmentsAhead[phase]);

    return route
        .slice(firstIndex, lastIndex + 1)
        .reduce<
            (ReturnType<typeof measureSegment> & {segmentIndex: number}) | undefined
        >((best, start, offset) => {
            const end = route[firstIndex + offset + 1];

            if (!end) {
                return best;
            }

            const measured = measureSegment({
                point,
                route,
                segmentIndex: firstIndex + offset,
            });
            const isOnRoad =
                measured.distance <= Math.max(start.halfWidth, end.halfWidth) + sidewalkWidth;
            /** Inside a corner, the car is near both segments, but between the ends of only one. */
            const isBetter =
                !best ||
                (measured.isBetweenEnds === best.isBetweenEnds
                    ? measured.distance < best.distance
                    : measured.isBetweenEnds);

            return isOnRoad && isBetter
                ? {
                      ...measured,
                      segmentIndex: firstIndex + offset,
                  }
                : best;
        }, undefined);
}

/**
 * Advances a {@link RouteRun} by one frame. Starts a run along a fixed route to a random far-off
 * road point when none is going, tracks how far along the route the car has driven, and swaps in
 * the next route when the car reaches the destination by the route.
 */
export function updateRouteRun({
    canBeDestination,
    graph,
    isInGarage,
    isOffRoad,
    point,
    random,
    run,
    sidewalkWidth,
}: Readonly<{
    run: Readonly<RouteRun>;
    graph: Readonly<RouteGraph>;
    /** For each graph point, whether a run may end there. */
    canBeDestination: ReadonlyArray<boolean>;
    point: Readonly<GroundPoint>;
    isInGarage: boolean;
    /** Whether the car is on the grass. */
    isOffRoad: boolean;
    /** Meters past a road's edge that still count as on it. */
    sidewalkWidth: number;
    random: () => number;
}>): RouteRun {
    if (isInGarage) {
        return {
            phase: RouteRunPhase.Waiting,
        };
    } else if (run.phase === RouteRunPhase.Waiting) {
        return isOffRoad
            ? run
            : startRun({
                  canBeDestination,
                  graph,
                  point,
                  random,
              });
    }

    const current = {
        ...run,
        nextRoute:
            run.nextRoute ??
            planNextRoute({
                canBeDestination,
                graph,
                random,
                route: run.route,
            }),
    };
    const segment = isOffRoad
        ? undefined
        : findRouteSegment({
              phase: run.phase,
              point,
              progressIndex: run.progressIndex,
              route: run.route,
              sidewalkWidth,
          });

    if (!segment) {
        return {
            ...current,
            phase: RouteRunPhase.OffRoute,
        };
    }

    const isAhead =
        segment.segmentIndex > run.progressIndex ||
        (segment.segmentIndex === run.progressIndex && segment.fraction > run.progressFraction);
    const progressIndex = isAhead ? segment.segmentIndex : run.progressIndex;
    const destination = run.route.at(-1);

    if (
        destination &&
        progressIndex >= run.route.length - 2 &&
        getDistance({
            from: point,
            to: destination,
        }) < arrivalRadius
    ) {
        return current.nextRoute
            ? {
                  nextRoute: undefined,
                  phase: RouteRunPhase.Driving,
                  progressFraction: isAhead ? segment.fraction : run.progressFraction,
                  progressIndex: Math.max(0, progressIndex - current.nextRoute.indexOffset),
                  route: current.nextRoute.route,
              }
            : {
                  phase: RouteRunPhase.Waiting,
              };
    }

    return {
        ...current,
        phase: RouteRunPhase.Driving,
        progressFraction: isAhead ? segment.fraction : run.progressFraction,
        progressIndex,
    };
}
