import {createArray} from '@augment-vir/common';
import {type RoadNetwork} from '@evir/driving-common/src/road-network.js';
import {type GroundPoint, type TrackLayout} from '@evir/driving-common/src/track-layout.js';

/** A wall block standing on the ground, in the scene's world coordinates. */
export type WallBlock = {
    center: GroundPoint;
    halfSize: GroundPoint;
    height: number;
};

/** How many drive-through stalls the garage has, one per car. */
export const garageStallCount = 6;
/** Meters across each stall, between its dividers. */
export const garageStallWidth = 4.5;

/**
 * The garage's stalls, in the scene's world coordinates. Like a self-serve car wash, every stall is
 * open at both ends and runs along z.
 */
export const garageInterior = {
    center: {
        x: 0,
        z: -60,
    },
    halfSize: {
        x: (garageStallCount * garageStallWidth) / 2,
        z: 4,
    },
} as const satisfies Pick<WallBlock, 'center' | 'halfSize'>;

const garageWallThickness = 0.5;
const stallDividerThickness = 0.3;
export const garageWallHeight = 6;
/** Meters from the back of the stalls to where a new car appears. */
const apronLength = 12;

/** The scene x of each stall's middle, from -x to +x. */
export const garageStallCenters = createArray(garageStallCount, (index) => {
    return garageInterior.center.x - garageInterior.halfSize.x + (index + 0.5) * garageStallWidth;
});

/** The garage's side walls and the dividers between its stalls. */
export const garageWalls: ReadonlyArray<Readonly<WallBlock>> = createArray(
    garageStallCount + 1,
    (index): WallBlock => {
        const isOutside = index === 0 || index === garageStallCount;
        const thickness = isOutside ? garageWallThickness : stallDividerThickness;
        const side = index === 0 ? -1 : index === garageStallCount ? 1 : 0;

        return {
            center: {
                x:
                    garageInterior.center.x -
                    garageInterior.halfSize.x +
                    index * garageStallWidth +
                    (side * thickness) / 2,
                z: garageInterior.center.z,
            },
            halfSize: {
                x: thickness / 2,
                z: garageInterior.halfSize.z,
            },
            height: garageWallHeight,
        };
    },
);

/** The stalls and the apron behind them, where the HUD shows the garage panel. */
const garageLot = {
    center: {
        x: garageInterior.center.x,
        z: garageInterior.center.z - apronLength / 2,
    },
    halfSize: {
        x: garageInterior.halfSize.x,
        z: garageInterior.halfSize.z + apronLength / 2,
    },
} as const satisfies Pick<WallBlock, 'center' | 'halfSize'>;

export const garageLotBounds = {
    maxX: garageLot.center.x + garageLot.halfSize.x,
    maxZ: garageLot.center.z + garageLot.halfSize.z,
    minX: garageLot.center.x - garageLot.halfSize.x,
    minZ: garageLot.center.z - garageLot.halfSize.z,
};

/** Whether a car centered at `point` is in the stalls or on the apron behind them. */
export function isInGarage(point: Readonly<GroundPoint>) {
    return (
        point.x > garageLotBounds.minX &&
        point.x < garageLotBounds.maxX &&
        point.z > garageLotBounds.minZ &&
        point.z < garageLotBounds.maxZ
    );
}

/** Whether a car centered at `point` is under the stalls' roof. */
export function isUnderGarageRoof(point: Readonly<GroundPoint>) {
    return (
        Math.abs(point.x - garageInterior.center.x) < garageInterior.halfSize.x &&
        Math.abs(point.z - garageInterior.center.z) < garageInterior.halfSize.z
    );
}

/** Where a new car appears: on the apron behind the stalls, nose toward them. */
export const garageSpawn = {
    heading: 0,
    point: {
        x: garageInterior.center.x - garageStallWidth / 2,
        z: garageInterior.center.z - garageInterior.halfSize.z - apronLength * 0.6,
    },
} as const;

/**
 * The raised turntable the car appears on: a ring with a taller disc inside it, both standing on
 * the road. Heights are meters above the road.
 */
export const turntable = {
    disc: {
        height: 0.06,
        radius: 2.7,
    },
    ring: {
        height: 0.04,
        radius: 3,
    },
} as const;

/** Meters from the world's center to the wall around it, along x and along z. */
export const arenaHalfWidth = 700;

/**
 * Meters the paved forecourt reaches past each side of the lot, and three times that past its
 * front.
 */
const forecourtOverhang = 3;
const forecourtCenterZ = (garageLotBounds.minZ + garageLotBounds.maxZ + forecourtOverhang * 3) / 2;

const ovalCenter: GroundPoint = {
    x: 0,
    z: 40,
};
const ovalRadius: GroundPoint = {
    x: 120,
    z: 70,
};
const ovalPointCount = 24;
const stuntStripZ = ovalCenter.z;
const outerLoopRadius = 550;
/** Meters the outer loop swells out past, and pulls in from, its radius. */
const outerLoopSwell = 60;
const outerLoopPointCount = 40;

function getOvalPoint(angle: number) {
    return {
        x: ovalCenter.x + Math.cos(angle) * ovalRadius.x,
        z: ovalCenter.z + Math.sin(angle) * ovalRadius.z,
    };
}

function getOuterLoopPoint(angle: number) {
    const radius = outerLoopRadius + outerLoopSwell * Math.sin(3 * angle);

    return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
    };
}

type RoadEnds = Readonly<{
    from: Readonly<GroundPoint>;
    to: Readonly<GroundPoint>;
}>;

function getPointBetween({from, fraction, to}: RoadEnds & Readonly<{fraction: number}>) {
    return {
        x: from.x + (to.x - from.x) * fraction,
        z: from.z + (to.z - from.z) * fraction,
    };
}

/** Evenly spaced control points for a straight road. */
function getStraightPoints({count, from, to}: RoadEnds & Readonly<{count: number}>) {
    return createArray(count, (index) => {
        return getPointBetween({
            from,
            fraction: index / (count - 1),
            to,
        });
    });
}

/** Control points that zigzag `sway` meters to either side of the straight line between the ends. */
function getWindingPoints({
    bends,
    from,
    sway,
    to,
}: RoadEnds & Readonly<{bends: number; sway: number}>) {
    const length = Math.hypot(to.x - from.x, to.z - from.z);

    return getStraightPoints({
        count: bends + 2,
        from,
        to,
    }).map((point, index) => {
        const offset = index === 0 || index === bends + 1 ? 0 : index % 2 ? sway : -sway;

        return {
            x: point.x - ((to.z - from.z) / length) * offset,
            z: point.z + ((to.x - from.x) / length) * offset,
        };
    });
}

/** Straight from the oval out to the outer loop, with jumps along it. */
const dragStrip: RoadEnds = {
    from: getOvalPoint(0.75 * Math.PI),
    to: getOuterLoopPoint(0.75 * Math.PI),
};
const northEastRoad: RoadEnds = {
    from: getOvalPoint(0.25 * Math.PI),
    to: getOuterLoopPoint(0.25 * Math.PI),
};
const southWestRoad: RoadEnds = {
    from: getOvalPoint(1.25 * Math.PI),
    to: getOuterLoopPoint(1.25 * Math.PI),
};
const windingRoad: RoadEnds = {
    from: getOvalPoint(1.75 * Math.PI),
    to: getOuterLoopPoint(1.75 * Math.PI),
};

/** A round road between the oval and the outer loop, crossing every road out from the oval. */
const middleRingRadius = 320;
const middleRingPointCount = 36;

function getMiddleRingPoint(angle: number) {
    return {
        x: Math.cos(angle) * middleRingRadius,
        z: Math.sin(angle) * middleRingRadius,
    };
}

/**
 * How far along a straight line at `offset` meters from the world's center a road ends so it pokes
 * a little into the middle ring.
 */
function getMiddleRingReach(offset: number) {
    return Math.sqrt((middleRingRadius + 2) ** 2 - offset ** 2);
}

/**
 * A grid of streets north of the oval, boxed in by the roads out to the outer loop at each side and
 * the middle ring beyond. Cross streets run along x and end on whichever of those they reach first.
 * The diagonal roads run about along `z = |x| + diagonalOffset` there.
 */
const diagonalOffset = getOvalPoint(0.25 * Math.PI).z - getOvalPoint(0.25 * Math.PI).x;
const gridCrossStreets = [
    150,
    215,
    280,
].map((z): RoadEnds => {
    const halfLength = Math.min(z - diagonalOffset, getMiddleRingReach(z));

    return {
        from: {
            x: -halfLength,
            z,
        },
        to: {
            x: halfLength,
            z,
        },
    };
});
/** The inner pair starts at the oval. The outer pair starts at the first cross street. */
const gridSideStreets = [
    {
        startZ: getOvalPoint(Math.acos(50 / ovalRadius.x)).z - 2,
        x: 50,
    },
    {
        startZ: 150,
        x: 100,
    },
].flatMap(({startZ, x}) => {
    return [
        -x,
        x,
    ].map((sideX): RoadEnds => {
        return {
            from: {
                x: sideX,
                z: startZ,
            },
            to: {
                x: sideX,
                z: getMiddleRingReach(sideX),
            },
        };
    });
});
/** Runs south from behind the garage's apron out to the middle ring. */
const southRoad: RoadEnds = {
    from: {
        x: garageInterior.center.x,
        z: garageLotBounds.minZ,
    },
    to: {
        x: garageInterior.center.x,
        z: -getMiddleRingReach(0),
    },
};
/** Roads from the middle ring out to the outer loop, at angles that miss the outer loop's jumps. */
const outerSpokes = [
    {
        isWinding: true,
        turns: 0.5,
    },
    {
        isWinding: false,
        turns: 0.9,
    },
    {
        isWinding: false,
        turns: 1.9,
    },
].map(({isWinding, turns}) => {
    return {
        from: getMiddleRingPoint(turns * Math.PI),
        isWinding,
        to: getOuterLoopPoint(turns * Math.PI),
    };
});

/**
 * Paves the lot and the space in front of the stalls, so the lane's sidewalks stop short of the
 * stall exits and this road's own sidewalks stay outside the lot.
 */
const forecourtRoad: TrackLayout = {
    controlPoints: [
        {
            x: garageLotBounds.minX - forecourtOverhang,
            z: forecourtCenterZ,
        },
        {
            x: garageLotBounds.maxX + forecourtOverhang,
            z: forecourtCenterZ,
        },
    ],
    isOpen: true,
    width: garageLotBounds.maxZ + forecourtOverhang * 3 - garageLotBounds.minZ,
};

/**
 * An oval road with a straight stunt strip of jumps across its middle and a lane from the garage.
 * Four roads lead from the oval out to a big wavy loop around everything, crossing a round middle
 * ring on the way. A grid of streets fills the space north of the oval, a road runs south from the
 * garage, and more roads join the middle ring to the outer loop.
 */
export const arenaLayout: RoadNetwork = {
    boundaryHalfWidth: arenaHalfWidth,
    /** Puts the curb's face 15 cm above the road, which sits at `roadHeight`. */
    curbHeight: 0.17,
    ramps: [
        {
            x: -50,
            z: stuntStripZ,
        },
        {
            x: 5,
            z: stuntStripZ,
        },
        getOvalPoint(0),
        getOuterLoopPoint(0),
        getOuterLoopPoint(Math.PI),
        ...[
            0.25,
            0.5,
            0.75,
        ].map((fraction) => {
            return getPointBetween({
                ...dragStrip,
                fraction,
            });
        }),
    ],
    roads: [
        {
            controlPoints: createArray(ovalPointCount, (index) => {
                return getOvalPoint((index / ovalPointCount) * Math.PI * 2);
            }),
            width: 16,
        },
        {
            controlPoints: [
                {
                    x: -90,
                    z: stuntStripZ,
                },
                {
                    x: -30,
                    z: stuntStripZ,
                },
                {
                    x: 30,
                    z: stuntStripZ,
                },
                {
                    x: 90,
                    z: stuntStripZ,
                },
            ],
            isOpen: true,
            width: 14,
        },
        {
            controlPoints: [
                {
                    x: garageInterior.center.x,
                    z: garageInterior.center.z + garageInterior.halfSize.z,
                },
                {
                    x: garageInterior.center.x,
                    z: ovalCenter.z - ovalRadius.z - 10,
                },
                {
                    x: garageInterior.center.x,
                    z: ovalCenter.z - ovalRadius.z + 2,
                },
            ],
            isOpen: true,
            width: 12,
        },
        forecourtRoad,
        {
            controlPoints: createArray(outerLoopPointCount, (index) => {
                return getOuterLoopPoint((index / outerLoopPointCount) * Math.PI * 2);
            }),
            width: 16,
        },
        {
            controlPoints: getStraightPoints({
                ...dragStrip,
                count: 6,
            }),
            isOpen: true,
            width: 14,
        },
        ...[
            northEastRoad,
            southWestRoad,
        ].map((ends) => {
            return {
                controlPoints: getStraightPoints({
                    ...ends,
                    count: 6,
                }),
                isOpen: true,
                width: 12,
            };
        }),
        {
            controlPoints: getWindingPoints({
                ...windingRoad,
                bends: 7,
                sway: 40,
            }),
            isOpen: true,
            width: 10,
        },
        {
            controlPoints: createArray(middleRingPointCount, (index) => {
                return getMiddleRingPoint((index / middleRingPointCount) * Math.PI * 2);
            }),
            width: 14,
        },
        ...[
            ...gridCrossStreets,
            ...gridSideStreets,
            southRoad,
        ].map((ends) => {
            return {
                controlPoints: getStraightPoints({
                    ...ends,
                    count: 2,
                }),
                isOpen: true,
                width: 10,
            };
        }),
        ...outerSpokes.map((spoke) => {
            return {
                controlPoints: spoke.isWinding
                    ? getWindingPoints({
                          ...spoke,
                          bends: 3,
                          sway: 25,
                      })
                    : getStraightPoints({
                          ...spoke,
                          count: 2,
                      }),
                isOpen: true,
                width: 12,
            };
        }),
    ],
    sidewalkWidth: 3,
    lowSpeedBumps: [
        getOvalPoint(Math.PI),
        getOvalPoint(0.5 * Math.PI),
        ...[
            0.3,
            0.4,
            0.5,
        ].map((fraction) => {
            return getPointBetween({
                ...southWestRoad,
                fraction,
            });
        }),
    ],
    steepRamps: [
        {
            x: 50,
            z: stuntStripZ,
        },
        getPointBetween({
            ...northEastRoad,
            fraction: 0.5,
        }),
    ],
};

/**
 * The roads a route can follow. The forecourt is left out because a straight line across it runs
 * through the stall dividers.
 */
export const routeRoads = arenaLayout.roads.filter((road) => road !== forecourtRoad);
