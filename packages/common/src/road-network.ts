import {clamp, createArray, getEnumValues, type PartialWithUndefined} from '@augment-vir/common';
import {getUnitDirection, sampleTrack, type GroundPoint, type TrackLayout} from './track-layout.js';

export enum RoadObstacleType {
    SpeedBump = 'speed-bump',
    /** A jump: a short climb, a flat top, and a longer slope down to land on. */
    Ramp = 'ramp',
    /** A peaked ramp whose crest bends too sharply for a car's floor to clear, so it scrapes over. */
    SteepRamp = 'steep-ramp',
}

/**
 * The {@link RoadNetwork} property that lists the points for each obstacle type. Each point puts an
 * obstacle across whichever road it's on, centered on that road. A ramp climbs the way the road's
 * control points run.
 */
export const roadObstacleListKeys = {
    [RoadObstacleType.SpeedBump]: 'speedBumps',
    [RoadObstacleType.Ramp]: 'ramps',
    [RoadObstacleType.SteepRamp]: 'steepRamps',
} as const satisfies Record<RoadObstacleType, string>;

/** Roads lined on both sides by raised sidewalks. Where roads overlap, the road wins. */
export type RoadNetwork = {
    roads: ReadonlyArray<Readonly<TrackLayout>>;
    /** Meters from the curb to the sidewalk's outer edge. */
    sidewalkWidth: number;
    /** Meters the sidewalks sit above the road and the grass. */
    curbHeight: number;
} & PartialWithUndefined<
    Record<(typeof roadObstacleListKeys)[RoadObstacleType], ReadonlyArray<Readonly<GroundPoint>>>
>;

/** Something raised spanning a road from curb to curb. */
export type RoadObstacle = {
    type: RoadObstacleType;
    /** On the road's center line. */
    center: GroundPoint;
    /** Unit vector along the road. */
    along: GroundPoint;
    halfWidth: number;
};

/** An obstacle's height along the road. */
export type RoadObstacleProfile = {
    /** Meters along the road from its middle to each end. */
    halfLength: number;
    /** Meters above the road, `offset` meters along the road from its middle. */
    getHeight: (offset: number) => number;
    /**
     * Offsets that the profile is drawn through. Straight lines between them must follow it
     * closely.
     */
    outlineOffsets: ReadonlyArray<number>;
};

/**
 * Meters from the world's center to the inner face of the wall around it, along x and along z. The
 * wall has no top, so nothing can jump over it.
 */
export const boundaryHalfWidth = 345;

/** Meters a speed bump rises above the road. */
const speedBumpHeight = 0.2;
const speedBumpHalfLength = 0.6;
/** Pieces of a speed bump's outline, so its curve looks smooth. */
const speedBumpSlices = 8;
/** How many spots across a wheel's width are checked for where it touches an obstacle. */
const obstacleContactSamples = 16;

/**
 * A ramp of straight slopes: a climb, a flat top, and a slope down. Each part spans this many
 * meters along the road, and the top is this high.
 */
function createRampProfile({
    climb,
    descent,
    height,
    top,
}: Readonly<Record<'climb' | 'top' | 'descent' | 'height', number>>) {
    const halfLength = (climb + top + descent) / 2;

    return {
        getHeight(offset: number) {
            const distance = offset + halfLength;

            return distance <= 0 || distance >= 2 * halfLength
                ? 0
                : distance < climb
                  ? (height * distance) / climb
                  : distance < climb + top
                    ? height
                    : (height * (2 * halfLength - distance)) / descent;
        },
        halfLength,
        outlineOffsets: [
            -halfLength,
            climb - halfLength,
            ...(top
                ? [
                      climb + top - halfLength,
                  ]
                : []),
            halfLength,
        ],
    };
}

export const roadObstacleProfiles: Readonly<Record<RoadObstacleType, RoadObstacleProfile>> = {
    [RoadObstacleType.SpeedBump]: {
        getHeight(offset) {
            return Math.abs(offset) >= speedBumpHalfLength
                ? 0
                : (speedBumpHeight * (1 + Math.cos((Math.PI * offset) / speedBumpHalfLength))) / 2;
        },
        halfLength: speedBumpHalfLength,
        outlineOffsets: createArray(speedBumpSlices + 1, (index) => {
            return speedBumpHalfLength * ((2 * index) / speedBumpSlices - 1);
        }),
    },
    [RoadObstacleType.Ramp]: createRampProfile({
        climb: 5,
        descent: 8,
        height: 1.2,
        top: 3,
    }),
    [RoadObstacleType.SteepRamp]: createRampProfile({
        climb: 2.1,
        descent: 3.3,
        height: 1.2,
        top: 0,
    }),
};

/**
 * A straight piece of an obstacle's sharp edge, where its sides or its slopes meet. A flat face,
 * such as a car's floor, can come down onto one between any points it checks the ground at.
 */
export type ObstacleEdge = Record<'start' | 'end', GroundPoint & {y: number}>;

/** The edges along both of an obstacle's sides, and across the road where its slope changes. */
function getObstacleEdges({along, center, halfWidth, type}: Readonly<RoadObstacle>) {
    const profile = roadObstacleProfiles[type];

    function getCorner({across, offset}: Readonly<Record<'across' | 'offset', number>>) {
        return {
            x: center.x + along.x * offset - along.z * across,
            y: profile.getHeight(offset),
            z: center.z + along.z * offset + along.x * across,
        };
    }

    return [
        ...[
            -halfWidth,
            halfWidth,
        ].flatMap((across) => {
            return profile.outlineOffsets.slice(1).map((offset, index): ObstacleEdge => {
                return {
                    end: getCorner({
                        across,
                        offset,
                    }),
                    start: getCorner({
                        across,
                        offset: profile.outlineOffsets[index] ?? offset,
                    }),
                };
            });
        }),
        ...profile.outlineOffsets.slice(1, -1).map((offset): ObstacleEdge => {
            return {
                end: getCorner({
                    across: halfWidth,
                    offset,
                }),
                start: getCorner({
                    across: -halfWidth,
                    offset,
                }),
            };
        }),
    ];
}

/** Where a round wheel rests on the ground. */
export type WheelContact = {
    /** Meters above the road that the bottom of the wheel rests at. */
    height: number;
    /**
     * Sideways newtons the ground pushes the wheel with, per newton it holds the wheel up. A wheel
     * leaning on a curb's edge gets pushed away from the curb.
     */
    push: GroundPoint;
} & PartialWithUndefined<{
    /** Set while the wheel presses into a wall it can't roll up onto. */
    wall: {
        /** Unit direction out of the wall. */
        outward: GroundPoint;
        /** Meters the wheel reaches into the wall. */
        depth: number;
    };
}>;

/** Finds where a wheel centered over `point` rests. */
export type GetWheelContact = (
    params: Readonly<{
        point: Readonly<GroundPoint>;
        radius: number;
        /** Meters above the road that the bottom of the wheel is now. */
        wheelBottom: number;
    }>,
) => WheelContact;

/** Flat ground everywhere. */
export const getFlatWheelContact: GetWheelContact = () => {
    return {
        height: 0,
        push: {
            x: 0,
            z: 0,
        },
    };
};

type RoadSegment = {
    start: GroundPoint;
    end: GroundPoint;
    halfWidth: number;
    roadIndex: number;
    /** An open road ends square, so nothing past these lines across its ends counts as road. */
    ends: ReadonlyArray<
        Readonly<{
            point: GroundPoint;
            /** Unit vector pointing back along the road from its end. */
            inward: GroundPoint;
        }>
    >;
};

/** The nearest road's edge. */
export type RoadEdge = {
    /** Meters outside the nearest road's edge. Negative inside a road. */
    distance: number;
    /** Unit vector pointing away from the nearest road's center line. */
    outward: GroundPoint;
};

/** Meters per side of the cells that roads are bucketed into for lookup. */
const cellSize = 16;
/** Meters beyond the sidewalks that a lookup still finds a road from. */
const lookupMargin = 2;

function getCellKey({cellX, cellZ}: Readonly<Record<'cellX' | 'cellZ', number>>) {
    return `${cellX},${cellZ}`;
}

function measureSegment(segment: Readonly<RoadSegment>, point: Readonly<GroundPoint>) {
    const alongX = segment.end.x - segment.start.x;
    const alongZ = segment.end.z - segment.start.z;
    const progress =
        ((point.x - segment.start.x) * alongX + (point.z - segment.start.z) * alongZ) /
        (alongX ** 2 + alongZ ** 2 || 1);

    if (
        segment.ends.some(({inward, point: endPoint}) => {
            return (point.x - endPoint.x) * inward.x + (point.z - endPoint.z) * inward.z < 0;
        })
    ) {
        return undefined;
    }

    const along = clamp(progress, {
        max: 1,
        min: 0,
    });
    const offsetX = point.x - (segment.start.x + alongX * along);
    const offsetZ = point.z - (segment.start.z + alongZ * along);
    const centerDistance = Math.hypot(offsetX, offsetZ);

    return {
        distance: centerDistance - segment.halfWidth,
        outward:
            centerDistance > 0
                ? {
                      x: offsetX / centerDistance,
                      z: offsetZ / centerDistance,
                  }
                : {
                      x: 0,
                      z: 0,
                  },
    };
}

/** Each road's center line as short straight pieces. */
function getRoadSegments(roads: ReadonlyArray<Readonly<TrackLayout>>) {
    return roads.flatMap((road, roadIndex) => {
        const samples = sampleTrack(road);
        const segmentCount = road.isOpen ? samples.length - 1 : samples.length;
        const ends = road.isOpen
            ? [
                  [
                      samples[0],
                      samples[1],
                  ],
                  [
                      samples.at(-1),
                      samples.at(-2),
                  ],
              ].flatMap(
                  ([
                      endPoint,
                      inner,
                  ]) => {
                      if (!endPoint || !inner) {
                          return [];
                      }

                      return [
                          {
                              inward: getUnitDirection({
                                  from: endPoint,
                                  to: inner,
                              }),
                              point: endPoint,
                          },
                      ];
                  },
              )
            : [];

        return samples.slice(0, segmentCount).map((start, index): RoadSegment => {
            return {
                end: samples[(index + 1) % samples.length] ?? start,
                ends,
                halfWidth: road.width / 2,
                roadIndex,
                start,
            };
        });
    });
}

/** The faces of the wall around the world that a wheel reaches into. */
function getBoundaryWalls({
    point,
    radius,
}: Readonly<{point: Readonly<GroundPoint>; radius: number}>) {
    return (
        [
            'x',
            'z',
        ] as const
    ).map((axis): WheelContact['wall'] => {
        const depth = Math.abs(point[axis]) + radius - boundaryHalfWidth;

        return depth > 0
            ? {
                  depth,
                  outward: {
                      x: axis === 'x' ? -Math.sign(point.x) : 0,
                      z: axis === 'z' ? -Math.sign(point.z) : 0,
                  },
              }
            : undefined;
    });
}

/**
 * Answers questions about a {@link RoadNetwork}: how a wheel rests on it, where its nearest road
 * edge is, and where its obstacles and their sharp edges are.
 */
export function createRoadSurface(network: Readonly<RoadNetwork>) {
    const cells = new Map<string, RoadSegment[]>();
    const reach = network.sidewalkWidth + lookupMargin;
    const segments = getRoadSegments(network.roads);
    const obstaclePoints = getEnumValues(RoadObstacleType).flatMap((type) => {
        return (network[roadObstacleListKeys[type]] ?? []).map((point) => {
            return {
                point,
                type,
            };
        });
    });
    const obstacles = obstaclePoints.flatMap(({point, type}): RoadObstacle[] => {
        const nearest = segments.reduce<{distance: number; segment?: RoadSegment | undefined}>(
            (best, segment) => {
                const distance = measureSegment(segment, point)?.distance ?? Infinity;

                return distance < best.distance
                    ? {
                          distance,
                          segment,
                      }
                    : best;
            },
            {
                distance: Infinity,
            },
        ).segment;

        if (!nearest) {
            return [];
        }

        const along = getUnitDirection({
            from: nearest.start,
            to: nearest.end,
        });
        const progress =
            (point.x - nearest.start.x) * along.x + (point.z - nearest.start.z) * along.z;

        return [
            {
                along,
                center: {
                    x: nearest.start.x + along.x * progress,
                    z: nearest.start.z + along.z * progress,
                },
                halfWidth: nearest.halfWidth,
                type,
            },
        ];
    });

    segments.forEach((segment) => {
        const extent = segment.halfWidth + reach;
        const minCellX = Math.floor((Math.min(segment.start.x, segment.end.x) - extent) / cellSize);
        const maxCellX = Math.floor((Math.max(segment.start.x, segment.end.x) + extent) / cellSize);
        const minCellZ = Math.floor((Math.min(segment.start.z, segment.end.z) - extent) / cellSize);
        const maxCellZ = Math.floor((Math.max(segment.start.z, segment.end.z) + extent) / cellSize);

        createArray(maxCellX - minCellX + 1, (index) => minCellX + index).forEach((cellX) => {
            createArray(maxCellZ - minCellZ + 1, (index) => minCellZ + index).forEach((cellZ) => {
                const key = getCellKey({
                    cellX,
                    cellZ,
                });
                cells.set(key, [
                    ...(cells.get(key) ?? []),
                    segment,
                ]);
            });
        });
    });

    /**
     * The nearest road edge, ignoring one road if asked. Past the sidewalks' outer edge plus a
     * margin, the distance may be infinite.
     */
    function getRoadEdge(point: Readonly<GroundPoint>, ignoredRoadIndex?: number): RoadEdge {
        const nearbySegments =
            cells.get(
                getCellKey({
                    cellX: Math.floor(point.x / cellSize),
                    cellZ: Math.floor(point.z / cellSize),
                }),
            ) ?? [];

        return nearbySegments.reduce<RoadEdge>(
            (nearest, segment) => {
                const measured =
                    segment.roadIndex === ignoredRoadIndex
                        ? undefined
                        : measureSegment(segment, point);

                return measured && measured.distance < nearest.distance ? measured : nearest;
            },
            {
                distance: Infinity,
                outward: {
                    x: 0,
                    z: 0,
                },
            },
        );
    }

    /**
     * A wheel rolls onto a curb up its round tread, so near a curb it rests partway up and the
     * curb's edge pushes it back.
     */
    const getCurbContact: GetWheelContact = ({point, radius}) => {
        const edge = getRoadEdge(point);
        const isOnSidewalk = edge.distance > 0 && edge.distance < network.sidewalkWidth;
        /** Meters from the wheel's center out to the nearest sidewalk edge below it. */
        const gap = edge.distance <= 0 ? -edge.distance : edge.distance - network.sidewalkWidth;
        const sink = radius - Math.sqrt(Math.max(0, radius ** 2 - gap ** 2));

        if (isOnSidewalk) {
            return {
                height: network.curbHeight,
                push: {
                    x: 0,
                    z: 0,
                },
            };
        } else if (gap >= radius || sink >= network.curbHeight) {
            return {
                height: 0,
                push: {
                    x: 0,
                    z: 0,
                },
            };
        }

        /** Away from the sidewalk: inward on the road, outward on the grass. */
        const away = edge.distance <= 0 ? -1 : 1;
        const slope = gap / (radius - sink);

        return {
            height: network.curbHeight - sink,
            push: {
                x: edge.outward.x * away * slope,
                z: edge.outward.z * away * slope,
            },
        };
    };

    /**
     * A round wheel rests where its tread first meets an obstacle, which can be ahead of or behind
     * its center, and the obstacle pushes it back away from that spot. A wheel below an obstacle's
     * side by more than it can roll up instead hits the side like a wall, which pushes it back out
     * sideways.
     */
    function getObstacleContact({point, radius, wheelBottom}: Parameters<GetWheelContact>[0]) {
        return obstacles.reduce<Pick<WheelContact, 'wall'> & {surface?: WheelContact | undefined}>(
            (contact, obstacle) => {
                const profile = roadObstacleProfiles[obstacle.type];
                const offsetX = point.x - obstacle.center.x;
                const offsetZ = point.z - obstacle.center.z;
                const along = offsetX * obstacle.along.x + offsetZ * obstacle.along.z;
                const across = offsetZ * obstacle.along.x - offsetX * obstacle.along.z;

                if (
                    Math.abs(across) > obstacle.halfWidth + radius ||
                    Math.abs(along) >= profile.halfLength + radius
                ) {
                    return contact;
                }

                const touch = createArray(obstacleContactSamples - 1, (index) => {
                    const treadOffset = radius * ((2 * (index + 1)) / obstacleContactSamples - 1);
                    const rise = Math.sqrt(radius ** 2 - treadOffset ** 2);

                    return {
                        height: profile.getHeight(along + treadOffset) - (radius - rise),
                        slope: treadOffset / rise,
                    };
                }).reduce((best, sample) => (sample.height > best.height ? sample : best));

                const sideDepth = obstacle.halfWidth + radius - Math.abs(across);

                /**
                 * A point that came down onto the obstacle from above, such as a car landing a jump
                 * onto a slope, sits nearer the top than a side and gets pushed back up instead of
                 * across the whole obstacle.
                 */
                if (touch.height - wheelBottom > radius && sideDepth < touch.height - wheelBottom) {
                    const depth = sideDepth;

                    return depth > (contact.wall?.depth ?? 0)
                        ? {
                              surface: contact.surface,
                              wall: {
                                  depth,
                                  outward: {
                                      x: -obstacle.along.z * Math.sign(across),
                                      z: obstacle.along.x * Math.sign(across),
                                  },
                              },
                          }
                        : contact;
                }

                return Math.abs(across) <= obstacle.halfWidth &&
                    touch.height > (contact.surface?.height ?? 0)
                    ? {
                          surface: {
                              height: touch.height,
                              push: {
                                  x: -obstacle.along.x * touch.slope,
                                  z: -obstacle.along.z * touch.slope,
                              },
                          },
                          wall: contact.wall,
                      }
                    : contact;
            },
            {},
        );
    }

    const getWheelContact: GetWheelContact = (params) => {
        const curbContact = getCurbContact(params);
        const obstacleContact = getObstacleContact(params);
        const wall = [
            obstacleContact.wall,
            ...getBoundaryWalls(params),
        ].reduce<WheelContact['wall']>(
            (deepest, next) => (next && next.depth > (deepest?.depth ?? 0) ? next : deepest),
            undefined,
        );

        return {
            ...(obstacleContact.surface && obstacleContact.surface.height > curbContact.height
                ? obstacleContact.surface
                : curbContact),
            wall,
        };
    };

    return {
        getRoadEdge,
        getWheelContact,
        obstacleEdges: obstacles.flatMap(getObstacleEdges),
        obstacles,
    };
}
