import {createArray, getEnumValues} from '@augment-vir/common';
import {Container3D, Geometry3D, Material3D, Mesh3D, PlaneGeometry} from '@pixi/3d';
import {
    createRoadSurface,
    roadHeight,
    roadObstacleProfiles,
    RoadObstacleType,
    type RoadNetwork,
    type RoadObstacle,
} from './road-network.js';
import {getTrackRights, sampleTrack, type GroundPoint, type TrackLayout} from './track-layout.js';

const edgeLineWidth = 0.3;
const startLineDepth = 1;
/**
 * Meters above the ground. Each layer sits a little higher than the one under it so they don't
 * flicker against each other.
 */
const layerHeight = {
    road: roadHeight,
    marking: 0.03,
};
const asphaltMaterialOptions = {
    baseColor: 0x3a_3c_40,
    roughness: 0.9,
};
const paintMaterialOptions = {
    baseColor: 0xf0_f0_f0,
    roughness: 0.8,
};

/**
 * A strip running alongside the road's center, between two distances to its right. It loops back to
 * the first sample unless `isOpen`.
 */
export function createStrip({
    height,
    isOpen,
    leftOffset,
    rightOffset,
    rights,
    samples,
}: Readonly<{
    samples: ReadonlyArray<Readonly<GroundPoint>>;
    rights: ReadonlyArray<Readonly<GroundPoint>>;
    /** Meters right of the center line; negative is to the left. */
    leftOffset: number;
    rightOffset: number;
    height: number;
    isOpen?: boolean | undefined;
}>) {
    const positions = samples.flatMap((sample, index) => {
        const right = rights[index] ?? {
            x: 0,
            z: 0,
        };

        return [
            sample.x + right.x * leftOffset,
            height,
            sample.z + right.z * leftOffset,
            sample.x + right.x * rightOffset,
            height,
            sample.z + right.z * rightOffset,
        ];
    });
    const indices = samples.slice(0, isOpen ? -1 : undefined).flatMap((sample, index) => {
        const left = index * 2;
        const nextLeft = ((index + 1) % samples.length) * 2;

        return [
            left,
            nextLeft,
            left + 1,
            nextLeft,
            nextLeft + 1,
            left + 1,
        ];
    });

    return new Geometry3D({
        indices: new Uint32Array(indices),
        normals: new Float32Array(
            samples.flatMap(() => {
                return [
                    0,
                    1,
                    0,
                    0,
                    1,
                    0,
                ];
            }),
        ),
        positions: new Float32Array(positions),
    });
}

/** A line across a looping road at its first control point. */
function createStartLine({
    material,
    road,
}: Readonly<{
    material: Material3D;
    road: Readonly<TrackLayout>;
}>) {
    const samples = sampleTrack(road);
    const rights = getTrackRights({
        isOpen: road.isOpen,
        samples,
    });
    const startLine = new Mesh3D({
        geometry: new PlaneGeometry({
            height: startLineDepth,
            width: road.width,
        }),
        material,
    });
    const start = samples[0];
    const startRight = rights[0];

    if (start && startRight) {
        startLine.position.set(start.x, layerHeight.marking, start.z);
        /** The plane faces +z; this lays it flat, then turns its width across the road. */
        startLine.rotation.set(-Math.PI / 2, 0, -Math.atan2(startRight.z, startRight.x));
    }

    return startLine;
}

/** The road surface with white edge lines and a start line across the first control point. */
export function createTrackMesh(layout: Readonly<TrackLayout>) {
    const samples = sampleTrack(layout);
    const rights = getTrackRights({
        isOpen: layout.isOpen,
        samples,
    });
    const halfWidth = layout.width / 2;
    const asphalt = new Material3D(asphaltMaterialOptions);
    const paint = new Material3D(paintMaterialOptions);
    const track = new Container3D();
    const edgeLines = [
        -halfWidth,
        halfWidth - edgeLineWidth,
    ].map((leftOffset) => {
        return new Mesh3D({
            geometry: createStrip({
                height: layerHeight.marking,
                isOpen: layout.isOpen,
                leftOffset,
                rightOffset: leftOffset + edgeLineWidth,
                rights,
                samples,
            }),
            material: paint,
        });
    });
    track.addChild(
        createStartLine({
            material: paint,
            road: layout,
        }),
        new Mesh3D({
            geometry: createStrip({
                height: layerHeight.road,
                isOpen: layout.isOpen,
                leftOffset: -halfWidth,
                rightOffset: halfWidth,
                rights,
                samples,
            }),
            material: asphalt,
        }),
        ...edgeLines,
    );

    return track;
}

type Vertex = {
    x: number;
    y: number;
    z: number;
};

/** A flat piece with its corners in order around the edge, and the direction its lit side faces. */
type Polygon = {
    corners: Vertex[];
    normal: Vertex;
    /** One lit direction per corner, in place of `normal`, so a curved surface shades smoothly. */
    cornerNormals?: Vertex[] | undefined;
};

/**
 * The polygon with its corners running counterclockwise when seen from the side `normal` points to.
 * Pixi treats a polygon wound the other way as its back face, and a double sided material then
 * lights it and looks up its shadow with `normal` flipped.
 */
function windTowardNormal(polygon: Readonly<Polygon>): Readonly<Polygon> {
    /** Newell's method, which still works once clipping leaves a sliver or repeated corner. */
    const windingNormal = polygon.corners.reduce(
        (sum, corner, index) => {
            const next = polygon.corners[(index + 1) % polygon.corners.length] ?? corner;

            return {
                x: sum.x + (corner.y - next.y) * (corner.z + next.z),
                y: sum.y + (corner.z - next.z) * (corner.x + next.x),
                z: sum.z + (corner.x - next.x) * (corner.y + next.y),
            };
        },
        {
            x: 0,
            y: 0,
            z: 0,
        },
    );
    const alignment =
        windingNormal.x * polygon.normal.x +
        windingNormal.y * polygon.normal.y +
        windingNormal.z * polygon.normal.z;

    return alignment < 0
        ? {
              ...polygon,
              cornerNormals: polygon.cornerNormals?.toReversed(),
              corners: polygon.corners.toReversed(),
          }
        : polygon;
}

function createPolygonGeometry(polygons: ReadonlyArray<Readonly<Polygon>>) {
    const triangles = polygons.map(windTowardNormal).flatMap(({cornerNormals, corners, normal}) => {
        const [
            first,
            ...rest
        ] = corners;

        return first
            ? rest.slice(0, -1).flatMap((corner, index) => {
                  const next = rest[index + 1];

                  return next
                      ? [
                            {
                                corners: [
                                    first,
                                    corner,
                                    next,
                                ],
                                normals: [
                                    cornerNormals?.[0] ?? normal,
                                    cornerNormals?.[index + 1] ?? normal,
                                    cornerNormals?.[index + 2] ?? normal,
                                ],
                            },
                        ]
                      : [];
              })
            : [];
    });

    return new Geometry3D({
        indices: new Uint32Array(createArray(triangles.length * 3, (index) => index)),
        normals: new Float32Array(
            triangles.flatMap(({normals}) => {
                return normals.flatMap((normal) => {
                    return [
                        normal.x,
                        normal.y,
                        normal.z,
                    ];
                });
            }),
        ),
        positions: new Float32Array(
            triangles.flatMap(({corners}) => {
                return corners.flatMap((corner) => {
                    return [
                        corner.x,
                        corner.y,
                        corner.z,
                    ];
                });
            }),
        ),
    });
}

/**
 * Cuts away the part of a polygon where `getSide` is negative, assuming it changes evenly between
 * corners.
 */
function clipPolygon<T extends Readonly<Polygon>>(
    polygon: T,
    getSide: (corner: Readonly<Vertex>, index: number) => number,
): T {
    const sides = polygon.corners.map(getSide);

    return {
        ...polygon,
        corners: polygon.corners.flatMap((corner, index) => {
            const nextIndex = (index + 1) % polygon.corners.length;
            const next = polygon.corners[nextIndex];
            const side = sides[index];
            const nextSide = sides[nextIndex];

            if (!next || side == undefined || nextSide == undefined) {
                return [];
            }

            /**
             * Far from other roads their distance is infinite, which would make the crossing NaN.
             * The crossing is then at the finite corner.
             */
            const progress = Number.isFinite(side)
                ? Number.isFinite(nextSide)
                    ? side / (side - nextSide)
                    : 0
                : 1;

            return [
                ...(side >= 0
                    ? [
                          corner,
                      ]
                    : []),
                ...(side * nextSide < 0
                    ? [
                          {
                              x: corner.x + (next.x - corner.x) * progress,
                              y: corner.y + (next.y - corner.y) * progress,
                              z: corner.z + (next.z - corner.z) * progress,
                          },
                      ]
                    : []),
            ];
        }),
    };
}

export enum RoadSurfaceLayer {
    Asphalt = 'asphalt',
    Paint = 'paint',
    Curb = 'curb',
    Sidewalk = 'sidewalk',
    SpeedBump = 'speed-bump',
    Ramp = 'ramp',
}

const obstacleSurfaces: Readonly<Record<RoadObstacleType, RoadSurfaceLayer>> = {
    [RoadObstacleType.SpeedBump]: RoadSurfaceLayer.SpeedBump,
    [RoadObstacleType.LowSpeedBump]: RoadSurfaceLayer.SpeedBump,
    [RoadObstacleType.Ramp]: RoadSurfaceLayer.Ramp,
    [RoadObstacleType.SteepRamp]: RoadSurfaceLayer.Ramp,
};

/** An obstacle's top as strips running across the road, plus its sides down to the road. */
function getObstaclePolygons({along, center, halfWidth, type}: Readonly<RoadObstacle>) {
    const profile = roadObstacleProfiles[type];
    const surface = obstacleSurfaces[type];
    /** Matches {@link getTrackRights}, so the strips wind the same way as the road under them. */
    const right = {
        x: along.z,
        z: -along.x,
    };

    function getCorner({
        height,
        offset,
        rightOffset,
    }: Readonly<{offset: number; rightOffset: number; height: number}>): Vertex {
        return {
            x: center.x + along.x * offset + right.x * rightOffset,
            y: layerHeight.marking + height,
            z: center.z + along.z * offset + right.z * rightOffset,
        };
    }

    function getSurfaceNormal(slope: number): Vertex {
        const normalLength = Math.hypot(slope, 1);

        return {
            x: (-along.x * slope) / normalLength,
            y: 1 / normalLength,
            z: (-along.z * slope) / normalLength,
        };
    }

    return profile.outlineOffsets.slice(1).flatMap((end, index) => {
        const start = profile.outlineOffsets[index] ?? end;
        const startHeight = profile.getHeight(start);
        const endHeight = profile.getHeight(end);
        /**
         * Each edge takes the profile's slope just inside this strip, so a curved bump shades
         * smoothly across strips while a ramp's straight slopes keep their sharp creases.
         */
        const nudge = (end - start) / 1000;
        const startNormal = getSurfaceNormal(
            (profile.getHeight(start + nudge) - startHeight) / nudge,
        );
        const endNormal = getSurfaceNormal((endHeight - profile.getHeight(end - nudge)) / nudge);
        const top = {
            corners: [
                getCorner({
                    height: startHeight,
                    offset: start,
                    rightOffset: -halfWidth,
                }),
                getCorner({
                    height: endHeight,
                    offset: end,
                    rightOffset: -halfWidth,
                }),
                getCorner({
                    height: endHeight,
                    offset: end,
                    rightOffset: halfWidth,
                }),
                getCorner({
                    height: startHeight,
                    offset: start,
                    rightOffset: halfWidth,
                }),
            ],
            cornerNormals: [
                startNormal,
                endNormal,
                endNormal,
                startNormal,
            ],
            normal: getSurfaceNormal((endHeight - startHeight) / (end - start)),
            surface,
        } satisfies Polygon & {surface: RoadSurfaceLayer};
        const sides = [
            -1,
            1,
        ].map((side) => {
            return {
                corners: [
                    getCorner({
                        height: 0,
                        offset: start,
                        rightOffset: side * halfWidth,
                    }),
                    getCorner({
                        height: 0,
                        offset: end,
                        rightOffset: side * halfWidth,
                    }),
                    getCorner({
                        height: endHeight,
                        offset: end,
                        rightOffset: side * halfWidth,
                    }),
                    getCorner({
                        height: startHeight,
                        offset: start,
                        rightOffset: side * halfWidth,
                    }),
                ],
                normal: {
                    x: right.x * side,
                    y: 0,
                    z: right.z * side,
                },
                surface,
            } satisfies Polygon & {surface: RoadSurfaceLayer};
        });

        return [
            top,
            ...sides,
        ];
    });
}

/**
 * Meters across each piece of sidewalk. Where several roads meet, the cuts only follow their edges
 * closely on small pieces.
 */
const sidewalkPieceWidth = 1;
/** Meters of rounding on a curb's top edge, which sticks out past the sidewalk's edge. */
const curbRadius = 0.05;
/** Pieces of a curb's rounded edge, so its curve looks smooth. */
const curbSlices = 4;
/** Meters past a curb face to look for what lies beyond it. */
const edgeProbe = 0.1;

/** Pieces of one road's surface, curbs, and sidewalks, cut away where other roads cover them. */
function getRoadPolygons({
    curbHeight,
    getRoadEdge,
    road,
    roadIndex,
    sidewalkWidth,
}: Readonly<
    Pick<RoadNetwork, 'curbHeight' | 'sidewalkWidth'> &
        Pick<ReturnType<typeof createRoadSurface>, 'getRoadEdge'> & {
            road: Readonly<TrackLayout>;
            roadIndex: number;
        }
>) {
    const samples = sampleTrack(road);
    const rights = getTrackRights({
        isOpen: road.isOpen,
        samples,
    });
    const halfWidth = road.width / 2;
    const segmentCount = road.isOpen ? samples.length - 1 : samples.length;
    const sidewalkPieceCount = Math.max(1, Math.round(sidewalkWidth / sidewalkPieceWidth));

    /**
     * Meters from a corner, nudged `probe` meters along `direction`, to the nearest other road.
     * This road is left out so that only the other roads decide where to cut.
     */
    function getOtherRoadDistance(
        corner: Readonly<Vertex>,
        {direction, probe}: Readonly<{direction: Vertex; probe: number}> = {
            direction: {
                x: 0,
                y: 0,
                z: 0,
            },
            probe: 0,
        },
    ) {
        return getRoadEdge(
            {
                x: corner.x + direction.x * probe,
                z: corner.z + direction.z * probe,
            },
            roadIndex,
        ).distance;
    }

    return createArray(segmentCount, (index) => index).flatMap((index) => {
        const nextIndex = (index + 1) % samples.length;
        const start = samples[index];
        const end = samples[nextIndex];
        const startRight = rights[index];
        const endRight = rights[nextIndex];

        if (!start || !end || !startRight || !endRight) {
            return [];
        }

        /** Narrowed copies, since narrowing doesn't reach into the helpers below. */
        const ends = {
            end: {
                right: endRight,
                sample: end,
            },
            start: {
                right: startRight,
                sample: start,
            },
        };

        function getPoint({
            isEnd,
            offset,
            height,
        }: Readonly<{isEnd: boolean; offset: number; height: number}>): Vertex {
            const {right, sample} = isEnd ? ends.end : ends.start;

            return {
                x: sample.x + right.x * offset,
                y: height,
                z: sample.z + right.z * offset,
            };
        }

        /** A flat piece between two offsets right of the center line. */
        function getFlatPolygon({
            height,
            offsetA,
            offsetB,
            surface,
        }: Readonly<{
            height: number;
            offsetA: number;
            offsetB: number;
            surface: RoadSurfaceLayer;
        }>) {
            /** Pixi culls or, when double sided, darkens faces wound the other way. */
            const near = Math.min(offsetA, offsetB);
            const far = Math.max(offsetA, offsetB);

            return {
                corners: [
                    getPoint({
                        height,
                        isEnd: false,
                        offset: near,
                    }),
                    getPoint({
                        height,
                        isEnd: true,
                        offset: near,
                    }),
                    getPoint({
                        height,
                        isEnd: true,
                        offset: far,
                    }),
                    getPoint({
                        height,
                        isEnd: false,
                        offset: far,
                    }),
                ],
                normal: {
                    x: 0,
                    y: 1,
                    z: 0,
                },
                surface,
            } satisfies Polygon & {surface: RoadSurfaceLayer};
        }

        /**
         * Points up a curb's face from its foot, with its top edge rounded over onto the sidewalk
         * edge at `edgeOffset`. `angle` tilts each point's normal from `facing` (1 is right) up
         * toward the sky.
         */
        function getCurbProfile({
            baseHeight,
            edgeOffset,
            facing,
        }: Readonly<{baseHeight: number; edgeOffset: number; facing: number}>) {
            return [
                {
                    angle: 0,
                    height: baseHeight,
                    offset: edgeOffset + facing * curbRadius,
                },
                ...createArray(curbSlices + 1, (index) => {
                    const angle = (Math.PI / 2) * (index / curbSlices);

                    return {
                        angle,
                        height: curbHeight - curbRadius * (1 - Math.sin(angle)),
                        offset: edgeOffset + facing * curbRadius * Math.cos(angle),
                    };
                }),
            ];
        }

        /**
         * Strips of a curb's face and rounded top edge, clipped by `getSide`. `overhang` is how far
         * a corner sticks out past the curb's edge, so that two curbs meeting at a corner can be
         * mitered.
         */
        function getCurbPolygons({
            getSide,
            ...curb
        }: Readonly<
            Parameters<typeof getCurbProfile>[0] & {
                getSide: (corner: Readonly<Vertex>, overhang: number) => number;
            }
        >) {
            const points = getCurbProfile(curb);

            function getNormal(angle: number): Vertex {
                return {
                    x: ends.start.right.x * curb.facing * Math.cos(angle),
                    y: Math.sin(angle),
                    z: ends.start.right.z * curb.facing * Math.cos(angle),
                };
            }

            return points.slice(1).map((top, index) => {
                const foot = points[index] ?? top;
                const overhangs = [
                    foot,
                    foot,
                    top,
                    top,
                ].map((point) => curb.facing * (point.offset - curb.edgeOffset));

                const strip = {
                    cornerNormals: [
                        getNormal(foot.angle),
                        getNormal(foot.angle),
                        getNormal(top.angle),
                        getNormal(top.angle),
                    ],
                    corners: [
                        getPoint({
                            height: foot.height,
                            isEnd: false,
                            offset: foot.offset,
                        }),
                        getPoint({
                            height: foot.height,
                            isEnd: true,
                            offset: foot.offset,
                        }),
                        getPoint({
                            height: top.height,
                            isEnd: true,
                            offset: top.offset,
                        }),
                        getPoint({
                            height: top.height,
                            isEnd: false,
                            offset: top.offset,
                        }),
                    ],
                    normal: getNormal((foot.angle + top.angle) / 2),
                    surface: RoadSurfaceLayer.Curb,
                } satisfies Polygon & {surface: RoadSurfaceLayer};

                return clipPolygon(strip, (corner, cornerIndex) => {
                    return getSide(corner, overhangs[cornerIndex] ?? 0);
                });
            });
        }

        const sides = [
            -1,
            1,
        ].flatMap((side) => {
            const edgeLineCenter = side * (halfWidth - edgeLineWidth / 2);
            const toRoad = {
                x: -side * ends.start.right.x,
                y: 0,
                z: -side * ends.start.right.z,
            };

            return [
                clipPolygon(
                    getFlatPolygon({
                        offsetA: edgeLineCenter + (side * edgeLineWidth) / 2,
                        height: layerHeight.marking,
                        offsetB: edgeLineCenter - (side * edgeLineWidth) / 2,
                        surface: RoadSurfaceLayer.Paint,
                    }),
                    /**
                     * Runs a line's width into a crossing road to fill the corner where both lines
                     * meet.
                     */
                    (corner) => getOtherRoadDistance(corner) + edgeLineWidth,
                ),
                ...getCurbPolygons({
                    baseHeight: layerHeight.road,
                    edgeOffset: side * halfWidth,
                    facing: -side,
                    /**
                     * Runs on into the crossing road as far as the lip sticks out, so the lips of
                     * both roads meet on their corner's diagonal.
                     */
                    getSide(corner, overhang) {
                        return (
                            getOtherRoadDistance(corner, {
                                direction: toRoad,
                                probe: -edgeProbe,
                            }) + overhang
                        );
                    },
                }),
                ...createArray(sidewalkPieceCount, (piece) => {
                    return clipPolygon(
                        getFlatPolygon({
                            offsetA:
                                side *
                                (halfWidth + (sidewalkWidth * (piece + 1)) / sidewalkPieceCount),
                            height: curbHeight,
                            offsetB:
                                side * (halfWidth + (sidewalkWidth * piece) / sidewalkPieceCount),
                            surface: RoadSurfaceLayer.Sidewalk,
                        }),
                        (corner) => getOtherRoadDistance(corner),
                    );
                }),
                /** Only stands where grass lies beyond, not another road or its sidewalk. */
                ...getCurbPolygons({
                    baseHeight: 0,
                    edgeOffset: side * (halfWidth + sidewalkWidth),
                    facing: side,
                    getSide(corner) {
                        return (
                            getOtherRoadDistance(corner, {
                                direction: toRoad,
                                probe: -edgeProbe,
                            }) - sidewalkWidth
                        );
                    },
                }),
            ];
        });

        /**
         * Upright faces closing the curbs and sidewalks where an open road stops, shaped like their
         * cross section.
         */
        const caps = [
            ...(road.isOpen && index === 0
                ? [
                      false,
                  ]
                : []),
            ...(road.isOpen && index === segmentCount - 1
                ? [
                      true,
                  ]
                : []),
        ].flatMap((isEnd) => {
            const {right} = isEnd ? ends.end : ends.start;
            const outward = {
                x: isEnd ? -right.z : right.z,
                y: 0,
                z: isEnd ? right.x : -right.x,
            };

            return [
                -1,
                1,
            ].flatMap((side) => {
                const crossSection = [
                    ...getCurbProfile({
                        baseHeight: layerHeight.road,
                        edgeOffset: side * halfWidth,
                        facing: -side,
                    }),
                    ...getCurbProfile({
                        baseHeight: 0,
                        edgeOffset: side * (halfWidth + sidewalkWidth),
                        facing: side,
                    }).toReversed(),
                ];

                return crossSection.slice(1).map((next, pointIndex) => {
                    const previous = crossSection[pointIndex] ?? next;

                    return clipPolygon(
                        {
                            corners: [
                                getPoint({
                                    height: 0,
                                    isEnd,
                                    offset: previous.offset,
                                }),
                                getPoint({
                                    height: 0,
                                    isEnd,
                                    offset: next.offset,
                                }),
                                getPoint({
                                    height: next.height,
                                    isEnd,
                                    offset: next.offset,
                                }),
                                getPoint({
                                    height: previous.height,
                                    isEnd,
                                    offset: previous.offset,
                                }),
                            ],
                            normal: outward,
                            surface: RoadSurfaceLayer.Curb,
                        } satisfies Polygon & {surface: RoadSurfaceLayer},
                        (corner) => {
                            return (
                                getOtherRoadDistance(corner, {
                                    direction: outward,
                                    probe: edgeProbe,
                                }) - sidewalkWidth
                            );
                        },
                    );
                });
            });
        });

        return [
            getFlatPolygon({
                height: layerHeight.road,
                offsetA: halfWidth,
                offsetB: -halfWidth,
                surface: RoadSurfaceLayer.Asphalt,
            }),
            ...sides,
            ...caps,
        ].filter(({corners}) => corners.length >= 3);
    });
}

/** Each network's polygons, which take long enough to build that the physics and scene share them. */
const roadNetworkPolygonCache = new WeakMap<
    Readonly<RoadNetwork>,
    ReturnType<typeof getObstaclePolygons>
>();

/**
 * The flat pieces {@link createRoadNetworkMesh} draws, minus its start lines, in the scene's world
 * coordinates. Each piece's corners run in order around its edge.
 */
export function getRoadNetworkPolygons(network: Readonly<RoadNetwork>) {
    const cached = roadNetworkPolygonCache.get(network);

    if (cached) {
        return cached;
    }

    const {getRoadEdge, obstacles} = createRoadSurface(network);
    const polygons = [
        ...network.roads.flatMap((road, roadIndex) => {
            return getRoadPolygons({
                curbHeight: network.curbHeight,
                getRoadEdge,
                road,
                roadIndex,
                sidewalkWidth: network.sidewalkWidth,
            });
        }),
        ...obstacles.flatMap(getObstaclePolygons),
    ];

    roadNetworkPolygonCache.set(network, polygons);

    return polygons;
}

/**
 * Every road in the network with its edge lines, curbs, and sidewalks, plus a start line on each
 * looping road. Where roads meet, their surfaces merge without curbs or lines between them.
 */
export function createRoadNetworkMesh(network: Readonly<RoadNetwork>) {
    const polygons = getRoadNetworkPolygons(network);
    const materials: Readonly<Record<RoadSurfaceLayer, Material3D>> = {
        [RoadSurfaceLayer.Asphalt]: new Material3D(asphaltMaterialOptions),
        [RoadSurfaceLayer.Paint]: new Material3D(paintMaterialOptions),
        /** Curb faces stand upright, so they must show from whichever side the camera is on. */
        [RoadSurfaceLayer.Curb]: new Material3D({
            baseColor: 0x9a_98_92,
            doubleSided: true,
            roughness: 0.9,
        }),
        [RoadSurfaceLayer.Sidewalk]: new Material3D({
            baseColor: 0xb8_b4_aa,
            roughness: 0.95,
        }),
        /** Obstacle sides stand upright like curb faces. */
        [RoadSurfaceLayer.SpeedBump]: new Material3D({
            baseColor: 0xe8_c0_30,
            doubleSided: true,
            roughness: 0.8,
        }),
        [RoadSurfaceLayer.Ramp]: new Material3D({
            baseColor: 0x8a_8c_90,
            doubleSided: true,
            roughness: 0.85,
        }),
    };
    const roadsMesh = new Container3D();

    roadsMesh.addChild(
        ...getEnumValues(RoadSurfaceLayer).map((layer) => {
            return new Mesh3D({
                geometry: createPolygonGeometry(
                    polygons.filter((polygon) => polygon.surface === layer),
                ),
                material: materials[layer],
            });
        }),
        ...network.roads
            .filter((road) => !road.isOpen)
            .map((road) => {
                return createStartLine({
                    material: materials[RoadSurfaceLayer.Paint],
                    road,
                });
            }),
    );

    return roadsMesh;
}
