import {createArray} from '@augment-vir/common';
import {type RoadNetwork} from '@evir/driving-common/src/road-network.js';
import {type GroundPoint} from '@evir/driving-common/src/track-layout.js';

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

/** An oval road, a straight stunt strip of jumps across its middle, and a lane from the garage. */
export const arenaLayout: RoadNetwork = {
    curbHeight: 0.15,
    ramps: [
        {
            x: -50,
            z: stuntStripZ,
        },
        {
            x: 5,
            z: stuntStripZ,
        },
        {
            x: ovalCenter.x + ovalRadius.x,
            z: ovalCenter.z,
        },
    ],
    roads: [
        {
            controlPoints: createArray(ovalPointCount, (index): GroundPoint => {
                const angle = (index / ovalPointCount) * Math.PI * 2;
                return {
                    x: ovalCenter.x + Math.cos(angle) * ovalRadius.x,
                    z: ovalCenter.z + Math.sin(angle) * ovalRadius.z,
                };
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
    ],
    sidewalkWidth: 3,
    speedBumps: [
        {
            x: ovalCenter.x - ovalRadius.x,
            z: ovalCenter.z,
        },
        {
            x: ovalCenter.x,
            z: ovalCenter.z + ovalRadius.z,
        },
    ],
    steepRamps: [
        {
            x: 50,
            z: stuntStripZ,
        },
    ],
};
