import {defineAnthaMod} from '@antha/engine';
import {arenaLayout, garageInterior, routeRoads} from './arena-layout.js';
import {arenaRoadSurface} from './garage-parking.js';
import {type GarageState} from './garage-state.js';
import {createRouteGraph, getDistance, type RouteGraph} from './route-graph.js';
import {updateRouteRun} from './route-run.js';

/** Meters a destination keeps from jumps and bumps, so arriving doesn't mean landing a jump. */
const obstacleClearance = 25;
/** Meters a destination keeps from the garage, so a run never ends where it began. */
const garageClearance = 60;

function createRouteMap() {
    const graph = createRouteGraph(routeRoads);

    return {
        canBeDestination: graph.points.map((point) => {
            return (
                getDistance({
                    from: point,
                    to: garageInterior.center,
                }) > garageClearance &&
                arenaRoadSurface.obstacles.every((obstacle) => {
                    return (
                        getDistance({
                            from: point,
                            to: obstacle.center,
                        }) > obstacleClearance
                    );
                })
            );
        }),
        graph,
    };
}

/**
 * Sends the driver along a fixed road route to a random far-off point. Turning off the route or
 * driving onto the grass holds their progress until they come back to where they left it.
 */
export function createRouteMod() {
    const runtime: {
        map: {graph: RouteGraph; canBeDestination: boolean[]} | undefined;
    } = {
        map: undefined,
    };

    return defineAnthaMod<GarageState>({
        modName: 'garage-route',
        execute({state}) {
            if (!state.vehicleView || !state.garage || !state.routeRun) {
                return;
            }

            /** Built on first use so loading the page doesn't wait on it. */
            runtime.map ??= createRouteMap();

            const position = state.vehicleView.position;

            state.routeRun = updateRouteRun({
                canBeDestination: runtime.map.canBeDestination,
                graph: runtime.map.graph,
                isInGarage: state.garage.isInGarage,
                /** Sidewalks count as road; only grass ends a run, and only with a wheel on it. */
                isOffRoad:
                    state.vehicleView.groundedWheelCount > 0 &&
                    arenaRoadSurface.getRoadEdge(position).distance > arenaLayout.sidewalkWidth,
                point: position,
                random: Math.random,
                run: state.routeRun,
                sidewalkWidth: arenaLayout.sidewalkWidth,
            });
        },
    });
}
