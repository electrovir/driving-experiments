import {assert, assertWrap} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {type TrackLayout} from '@evir/driving-common/src/track-layout.js';
import {
    createRouteGraph,
    findNearestRoutePoint,
    getRouteDistances,
    getRoutePath,
} from './route-graph.js';

function createStraightRoad({
    from,
    to,
}: Readonly<{from: {x: number; z: number}; to: {x: number; z: number}}>): TrackLayout {
    return {
        controlPoints: [
            from,
            to,
        ],
        isOpen: true,
        width: 10,
    };
}

const crossRoads = [
    createStraightRoad({
        from: {
            x: -100,
            z: 0,
        },
        to: {
            x: 100,
            z: 0,
        },
    }),
    createStraightRoad({
        from: {
            x: 0,
            z: -100,
        },
        to: {
            x: 0,
            z: 100,
        },
    }),
];

function getRoute({
    roads,
    from,
    to,
}: Readonly<{
    roads: ReadonlyArray<TrackLayout>;
    from: {x: number; z: number};
    to: {x: number; z: number};
}>) {
    const graph = createRouteGraph(roads);
    const targetIndex = assertWrap.isDefined(
        findNearestRoutePoint({
            graph,
            point: to,
        }),
    );
    const fromIndex = assertWrap.isDefined(
        findNearestRoutePoint({
            graph,
            point: from,
        }),
    );
    const routeDistances = getRouteDistances({
        graph,
        targetIndex,
    });

    return {
        distance: routeDistances.distances[fromIndex],
        path: getRoutePath({
            fromIndex,
            graph,
            routeDistances,
        }),
    };
}

describe(createRouteGraph.name, () => {
    it('turns where two roads cross', () => {
        const route = getRoute({
            from: {
                x: -100,
                z: 0,
            },
            roads: crossRoads,
            to: {
                x: 0,
                z: 100,
            },
        });

        assert.isAbove(route.distance ?? Infinity, 199);
        assert.isBelow(route.distance ?? Infinity, 205);
        assert.isTrue(
            route.path.some((point) => Math.hypot(point.x, point.z) < 5),
            'The route should pass through the crossing.',
        );
    });

    it('has no route to a road that touches no other', () => {
        const route = getRoute({
            from: {
                x: 400,
                z: 0,
            },
            roads: [
                ...crossRoads,
                createStraightRoad({
                    from: {
                        x: 300,
                        z: 0,
                    },
                    to: {
                        x: 400,
                        z: 0,
                    },
                }),
            ],
            to: {
                x: 0,
                z: 100,
            },
        });

        assert.strictEquals(route.distance, Infinity);
        assert.isLengthExactly(route.path, 1);
    });
});
