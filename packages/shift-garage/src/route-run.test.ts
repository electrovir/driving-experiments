import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {type GroundPoint} from '@evir/driving-common/src/track-layout.js';
import {createRouteGraph} from './route-graph.js';
import {
    getRouteAhead,
    getRouteDestination,
    RouteRunPhase,
    updateRouteRun,
    type RouteRun,
} from './route-run.js';

/** A main road with a side road branching off it halfway along. */
const graph = createRouteGraph([
    {
        controlPoints: [
            {
                x: 0,
                z: 0,
            },
            {
                x: 400,
                z: 0,
            },
        ],
        isOpen: true,
        width: 10,
    },
    {
        controlPoints: [
            {
                x: 200,
                z: 0,
            },
            {
                x: 200,
                z: 100,
            },
        ],
        isOpen: true,
        width: 10,
    },
]);

const baseInputs = {
    canBeDestination: graph.points.map(() => true),
    graph,
    isInGarage: false,
    isOffRoad: false,
    point: {
        x: 0,
        z: 0,
    },
    random() {
        return 0;
    },
    sidewalkWidth: 3,
};

function drive({
    points,
    run,
}: Readonly<{
    run: Readonly<RouteRun>;
    points: ReadonlyArray<Readonly<GroundPoint>>;
}>) {
    return points.reduce<RouteRun>((current, point) => {
        return updateRouteRun({
            ...baseInputs,
            point,
            run: current,
        });
    }, run);
}

/** Points every 20 meters along the main road, from `fromX` to `toX`. */
function alongMainRoad({fromX, toX}: Readonly<{fromX: number; toX: number}>) {
    return createArray(Math.floor((toX - fromX) / 20) + 1, (index) => {
        return {
            x: fromX + index * 20,
            z: 0,
        };
    });
}

function startRun() {
    return updateRouteRun({
        ...baseInputs,
        run: {
            phase: RouteRunPhase.Waiting,
        },
    });
}

describe(updateRouteRun.name, () => {
    it('starts the next route onward from the destination once the car reaches it', () => {
        const run = startRun();
        const destination = getRouteDestination(run);

        assert.isDefined(destination);
        assert.isAbove(destination.x, 400 * 0.6 - 1);

        const partway = drive({
            points: alongMainRoad({
                fromX: 0,
                toX: 100,
            }),
            run,
        });

        assert.strictEquals(partway.phase, RouteRunPhase.Driving);
        assert.isBelow(
            Math.abs(
                (getRouteAhead({
                    leadDistance: 5,
                    run: partway,
                }).points[0]?.x ?? 0) - 105,
            ),
            1,
        );
        const arrived = drive({
            points: [
                ...alongMainRoad({
                    fromX: 120,
                    toX: destination.x,
                }),
                destination,
            ],
            run: partway,
        });

        assert.strictEquals(arrived.phase, RouteRunPhase.Driving);
        assert.isTrue(
            arrived.route.every((point, index) => point.x >= (arrived.route[index - 1]?.x ?? 0)),
            'The next route should carry on the way the last one arrived, never turning back.',
        );
        assert.isAbove(getRouteDestination(arrived)?.x ?? 0, destination.x);
    });

    it('holds progress through a wrong turn until the car returns to where it left', () => {
        const atJunction = drive({
            points: alongMainRoad({
                fromX: 0,
                toX: 200,
            }),
            run: startRun(),
        });
        const wrongTurn = drive({
            points: [
                {
                    x: 200,
                    z: 30,
                },
                {
                    x: 200,
                    z: 60,
                },
            ],
            run: atJunction,
        });
        /** Rejoining far past where the car left would skip part of the route. */
        const skippedAhead = drive({
            points: [
                {
                    x: 240,
                    z: 0,
                },
            ],
            run: wrongTurn,
        });

        assert.deepEquals(
            [
                wrongTurn.phase,
                skippedAhead.phase,
                drive({
                    points: [
                        {
                            x: 200,
                            z: 0,
                        },
                    ],
                    run: skippedAhead,
                }).phase,
            ],
            [
                RouteRunPhase.OffRoute,
                RouteRunPhase.OffRoute,
                RouteRunPhase.Driving,
            ],
        );
    });
});
