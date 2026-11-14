import {assert} from '@augment-vir/assert';
import {removeDuplicates} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {
    boundaryHalfWidth,
    createRoadSurface,
    roadHeight,
    roadObstacleProfiles,
    RoadObstacleType,
} from './road-network.js';

/**
 * A 10 m road along x, so its curbs are at z = ±5 and the grass starts at z = ±8, with a speed bump
 * across it at x = 70.
 */
const surface = createRoadSurface({
    curbHeight: 0.15,
    roads: [
        {
            controlPoints: [
                {
                    x: 0,
                    z: 0,
                },
                {
                    x: 100,
                    z: 0,
                },
            ],
            isOpen: true,
            width: 10,
        },
    ],
    sidewalkWidth: 3,
    /** Off the center line, to check that it snaps onto the road. */
    speedBumps: [
        {
            x: 70,
            z: 2,
        },
    ],
});

function getContact({x, z}: Readonly<Record<'x' | 'z', number>>) {
    return surface.getWheelContact({
        point: {
            x,
            z,
        },
        radius: 0.4,
        wheelBottom: 0,
    });
}

describe(createRoadSurface.name, () => {
    it('raises a wheel onto a speed bump from curb to curb and pushes it back off', () => {
        const approaching = getContact({
            x: 69.8,
            z: -4,
        });

        assert.isAbove(approaching.height, roadHeight);
        assert.isAbove(
            getContact({
                x: 70,
                z: 4,
            }).height,
            approaching.height,
        );
        assert.isBelow(approaching.push.x, 0);
        assert.deepEquals(
            [
                getContact({
                    x: 71,
                    z: 0,
                }).height,
                getContact({
                    x: 70,
                    z: 6.5,
                }).height,
            ],
            [
                roadHeight,
                0.15,
            ],
        );
    });

    it('raises the sidewalk above the road and the grass', () => {
        assert.deepEquals(
            [
                0,
                6.5,
                20,
            ].map((z) => {
                return getContact({
                    x: 50,
                    z,
                }).height;
            }),
            [
                roadHeight,
                0.15,
                0,
            ],
        );
    });

    it('lifts a wheel partway up a curb it leans on and pushes it back', () => {
        const onRoad = getContact({
            x: 50,
            z: 4.8,
        });
        const onGrass = getContact({
            x: 50,
            z: 8.2,
        });

        assert.isAbove(onRoad.height, 0);
        assert.isBelow(onRoad.height, 0.15);
        assert.isBelow(onRoad.push.z, 0);
        assert.isAbove(onGrass.push.z, 0);
    });

    it('ends an open road square, with nothing beyond its last point', () => {
        assert.deepEquals(
            [
                getContact({
                    x: -1,
                    z: 6.5,
                }).height,
                getContact({
                    x: 101,
                    z: 6.5,
                }).height,
            ],
            [
                0,
                0,
            ],
        );
    });

    it('walls in the world at any height', () => {
        assert.deepEquals(
            surface.getWheelContact({
                point: {
                    x: 0,
                    z: -boundaryHalfWidth,
                },
                radius: 0.5,
                wheelBottom: 1000,
            }).wall,
            {
                depth: 0.5,
                outward: {
                    x: 0,
                    z: 1,
                },
            },
        );
        assert.isUndefined(
            getContact({
                x: 0,
                z: boundaryHalfWidth - 1,
            }).wall,
        );
    });
});

const rampSurface = createRoadSurface({
    curbHeight: 0.15,
    ramps: [
        {
            x: 50,
            z: 0,
        },
    ],
    roads: [
        {
            controlPoints: [
                {
                    x: 0,
                    z: 0,
                },
                {
                    x: 100,
                    z: 0,
                },
            ],
            isOpen: true,
            width: 10,
        },
    ],
    sidewalkWidth: 3,
    steepRamps: [
        {
            x: 80,
            z: 0,
        },
    ],
});

describe('ramps', () => {
    it('climbs, stays flat on top, then slopes down to the road', () => {
        const {getHeight, halfLength} = roadObstacleProfiles[RoadObstacleType.Ramp];

        assert.deepEquals(
            [
                -halfLength,
                -halfLength + 2.5,
                -halfLength + 6,
                halfLength - 4,
                halfLength,
            ].map(getHeight),
            [
                0,
                0.6,
                1.2,
                0.6,
                0,
            ],
        );
    });

    it('lifts a wheel to the crest of a steep ramp and no higher', () => {
        const {getHeight, halfLength} = roadObstacleProfiles[RoadObstacleType.SteepRamp];
        const crest = getHeight(2.1 - halfLength);

        assert.deepEquals(
            [
                crest,
                getHeight(2.1 - halfLength - 0.5) < crest,
                getHeight(2.1 - halfLength + 0.5) < crest,
            ],
            [
                1.2,
                true,
                true,
            ],
        );
    });

    it('reports the sharp edges along a ramp and across where its slope changes', () => {
        const edges = rampSurface.obstacleEdges.filter(({start}) => start.x < 65);

        assert.isLengthExactly(edges, 8);
        assert.deepEquals(
            removeDuplicates(
                edges.flatMap(({end, start}) => {
                    return [
                        Math.abs(start.z),
                        Math.abs(end.z),
                    ];
                }),
            ),
            [5],
        );
        assert.strictEquals(Math.max(...edges.map(({start}) => start.y)), roadHeight + 1.2);
    });
});

describe('road edges', () => {
    const loopSurface = createRoadSurface({
        curbHeight: 0.15,
        roads: [
            {
                controlPoints: [
                    {
                        x: 0,
                        z: 0,
                    },
                    {
                        x: 100,
                        z: 0,
                    },
                    {
                        x: 100,
                        z: 100,
                    },
                    {
                        x: 0,
                        z: 100,
                    },
                ],
                width: 10,
            },
        ],
        sidewalkWidth: 3,
    });

    it('does not cap a closed road at its first control point', () => {
        assert.isBelow(
            loopSurface.getRoadEdge({
                x: -2,
                z: 0,
            }).distance,
            0,
        );
        assert.strictEquals(
            surface.getRoadEdge({
                x: -2,
                z: 0,
            }).distance,
            Infinity,
        );
    });

    it('skips the ignored road', () => {
        const point = {
            x: 50,
            z: 0,
        };

        assert.deepEquals(
            [
                surface.getRoadEdge(point).distance,
                surface.getRoadEdge(point, 0).distance,
            ],
            [
                -5,
                Infinity,
            ],
        );
    });
});
