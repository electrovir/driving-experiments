import {getTrackRights, type GroundPoint} from '@evir/driving-common/src/track-layout.js';
import {createStrip} from '@evir/driving-common/src/track-mesh.js';
import {Container3D, CylinderGeometry, Material3D, Mesh3D} from '@pixi/3d';
import {
    getRouteAhead,
    getRouteDestination,
    RouteRunPhase,
    type RoutePoint,
    type RouteRun,
    type RouteSpot,
} from './route-run.js';

const beaconHeight = 80;
/** Cyan, so the route never reads as an ordinary road marking. */
const routeColor = 0x00_8c_ff;
/** Meters across the route line. */
const lineWidth = 1.2;
/** Just above the road markings, so the line doesn't flicker against them. */
const lineHeight = 0.05;

/** Meters past the car's center that the line starts, so it ends just ahead of the car's nose. */
const lineLead = 6;

function createLineGeometry({
    points,
    rights,
}: Readonly<{
    points: ReadonlyArray<Readonly<GroundPoint>>;
    rights: ReadonlyArray<Readonly<GroundPoint>>;
}>) {
    return createStrip({
        height: lineHeight,
        isOpen: true,
        leftOffset: -lineWidth / 2,
        rightOffset: lineWidth / 2,
        rights,
        samples: points,
    });
}

/**
 * Sideways directions for the line's points. They come from the whole route rather than from the
 * line alone: the line's moving first point would otherwise swing the next point's direction every
 * frame and make the line wobble.
 */
function getLineRights({
    routeRights,
    spot,
}: Readonly<{
    routeRights: ReadonlyArray<Readonly<GroundPoint>>;
    spot: Readonly<RouteSpot>;
}>) {
    const start = routeRights[spot.segmentIndex];
    const end = routeRights[spot.segmentIndex + 1];

    if (!start || !end) {
        return routeRights.slice(spot.segmentIndex);
    }

    const blended = {
        x: start.x + (end.x - start.x) * spot.fraction,
        z: start.z + (end.z - start.z) * spot.fraction,
    };
    const length = Math.hypot(blended.x, blended.z) || 1;

    return [
        {
            x: blended.x / length,
            z: blended.z / length,
        },
        ...routeRights.slice(spot.segmentIndex + 1),
    ];
}

/** A glowing column over the route's destination and a line along the road leading to it. */
export function createRouteMarkers() {
    const root = new Container3D();
    const beacon = new Mesh3D({
        geometry: new CylinderGeometry({
            height: beaconHeight,
            radialSegments: 24,
            radiusBottom: 2.5,
            radiusTop: 2.5,
        }),
        material: new Material3D({
            alpha: 0.55,
            alphaMode: 'blend',
            baseColor: routeColor,
            emissive: {
                color: routeColor,
                strength: 1,
            },
        }),
    });
    const line = new Mesh3D({
        /** A stand-in until the first run, kept hidden. */
        geometry: createLineGeometry({
            points: [
                {
                    x: 0,
                    z: 0,
                },
                {
                    x: 0,
                    z: 1,
                },
            ],
            rights: [
                {
                    x: 1,
                    z: 0,
                },
                {
                    x: 1,
                    z: 0,
                },
            ],
        }),
        material: new Material3D({
            baseColor: routeColor,
            emissive: {
                color: routeColor,
                strength: 1,
            },
        }),
    });

    line.visible = false;
    root.addChild(beacon, line);

    const markers: {
        beacon: Mesh3D;
        line: Mesh3D;
        /** What the line was last built from, so it's rebuilt only when the car makes progress. */
        lineSource:
            | {
                  route: ReadonlyArray<Readonly<RoutePoint>>;
                  routeRights: ReadonlyArray<Readonly<GroundPoint>>;
                  spot: RouteSpot;
              }
            | undefined;
        root: Container3D;
    } = {
        beacon,
        line,
        lineSource: undefined,
        root,
    };

    return markers;
}

export type RouteMarkers = ReturnType<typeof createRouteMarkers>;

/** Shows the route still ahead while a run is going, and hides the markers otherwise. */
export function updateRouteMarkers({
    markers,
    run,
}: Readonly<{markers: RouteMarkers; run: Readonly<RouteRun>}>) {
    const isGoing = run.phase === RouteRunPhase.Driving || run.phase === RouteRunPhase.OffRoute;
    const destination = isGoing ? getRouteDestination(run) : undefined;

    markers.beacon.visible = !!destination;
    markers.line.visible = false;
    if (destination) {
        markers.beacon.position.set(destination.x, beaconHeight / 2, destination.z);
    }

    if (!isGoing) {
        return;
    }

    const ahead = getRouteAhead({
        leadDistance: lineLead,
        run,
    });
    const source = markers.lineSource;
    const isSameRoute = source?.route === run.route;

    markers.line.visible = ahead.points.length > 1;

    if (
        !markers.line.visible ||
        (isSameRoute &&
            source.spot.segmentIndex === ahead.spot.segmentIndex &&
            source.spot.fraction === ahead.spot.fraction)
    ) {
        return;
    }

    const routeRights = isSameRoute
        ? source.routeRights
        : getTrackRights({
              isOpen: true,
              samples: run.route,
          });
    const previous = markers.line.geometry;

    markers.line.geometry = createLineGeometry({
        points: ahead.points,
        rights: getLineRights({
            routeRights,
            spot: ahead.spot,
        }),
    });
    previous.destroy();
    markers.lineSource = {
        route: run.route,
        routeRights,
        spot: ahead.spot,
    };
}
