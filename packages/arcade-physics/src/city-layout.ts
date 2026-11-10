import {createArray} from '@augment-vir/common';
import {
    getUnitDirection,
    type GroundPoint,
    type RoadNetwork,
    type TrackLayout,
} from '@evir/driving-common';
import {trackLayout} from './track-layout.js';

const streetWidth = 10;
/** Meters from a rounded street corner's center line to the middle of its curve. */
const cornerRadius = 20;
/**
 * Meters between a corner street's control points. The road's curve overshoots between control
 * points spaced very unevenly, so the straight legs get points as close as the curve's.
 */
const cornerPointSpacing = 10;

function createStreet(...controlPoints: ReadonlyArray<Readonly<GroundPoint>>): TrackLayout {
    return {
        controlPoints,
        isOpen: true,
        width: streetWidth,
    };
}

/** Points from `start` up to, but not including, `end`, no more than the corner spacing apart. */
function getLegPoints({start, end}: Readonly<Record<'start' | 'end', Readonly<GroundPoint>>>) {
    const count = Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / cornerPointSpacing);

    return createArray(count, (index): GroundPoint => {
        return {
            x: start.x + ((end.x - start.x) * index) / count,
            z: start.z + ((end.z - start.z) * index) / count,
        };
    });
}

/**
 * A street that runs straight from `start`, turns a rounded right angle at `corner`, and runs
 * straight on to `end`. Two streets that both end square at one corner leave its outside edge
 * empty.
 */
function createCornerStreet({
    corner,
    end,
    start,
}: Readonly<Record<'start' | 'corner' | 'end', Readonly<GroundPoint>>>): TrackLayout {
    const incoming = getUnitDirection({
        from: start,
        to: corner,
    });
    const outgoing = getUnitDirection({
        from: corner,
        to: end,
    });
    const curveStart = {
        x: corner.x - incoming.x * cornerRadius,
        z: corner.z - incoming.z * cornerRadius,
    };
    const curveEnd = {
        x: corner.x + outgoing.x * cornerRadius,
        z: corner.z + outgoing.z * cornerRadius,
    };
    const curveCenter = {
        x: curveStart.x + outgoing.x * cornerRadius,
        z: curveStart.z + outgoing.z * cornerRadius,
    };
    const curveSteps = Math.ceil((Math.PI * cornerRadius) / 2 / cornerPointSpacing);

    return createStreet(
        ...getLegPoints({
            start,
            end: curveStart,
        }),
        ...createArray(curveSteps, (step): GroundPoint => {
            const angle = (Math.PI / 2) * (step / curveSteps);

            return {
                x:
                    curveCenter.x +
                    cornerRadius * (incoming.x * Math.sin(angle) - outgoing.x * Math.cos(angle)),
                z:
                    curveCenter.z +
                    cornerRadius * (incoming.z * Math.sin(angle) - outgoing.z * Math.cos(angle)),
            };
        }),
        ...getLegPoints({
            start: curveEnd,
            end,
        }),
        end,
    );
}

/** A street grid east of the loop, a few streets to the west, and side roads leaving the loop. */
export const cityLayout: RoadNetwork = {
    curbHeight: 0.15,
    roads: [
        trackLayout,
        /** These leave the loop's straight and head east into the grid. */
        ...[
            -30,
            30,
        ].map((z) => {
            return createStreet(
                {
                    x: 0,
                    z,
                },
                {
                    x: 240,
                    z,
                },
            );
        }),
        ...[
            -150,
            -90,
            90,
            150,
        ].map((z) => {
            return createStreet(
                {
                    x: 60,
                    z,
                },
                {
                    x: 240,
                    z,
                },
            );
        }),
        /**
         * The grid's outer edge, split where side streets meet it so each piece's square end is
         * covered by the next piece's.
         */
        createCornerStreet({
            corner: {
                x: -200,
                z: 200,
            },
            end: {
                x: -55,
                z: 200,
            },
            start: {
                x: -200,
                z: 60,
            },
        }),
        createCornerStreet({
            corner: {
                x: 240,
                z: 200,
            },
            end: {
                x: 240,
                z: 30,
            },
            start: {
                x: -55,
                z: 200,
            },
        }),
        createCornerStreet({
            corner: {
                x: 240,
                z: -200,
            },
            end: {
                x: -70,
                z: -200,
            },
            start: {
                x: 240,
                z: 30,
            },
        }),
        createCornerStreet({
            corner: {
                x: -200,
                z: -200,
            },
            end: {
                x: -200,
                z: 60,
            },
            start: {
                x: -70,
                z: -200,
            },
        }),
        ...[
            60,
            120,
            180,
        ].map((x) => {
            return createStreet(
                {
                    x,
                    z: -200,
                },
                {
                    x,
                    z: 200,
                },
            );
        }),
        /** These start on the loop's control points, where its curve passes exactly. */
        createStreet(
            {
                x: -110,
                z: 60,
            },
            {
                x: -200,
                z: 60,
            },
        ),
        createStreet(
            {
                x: -150,
                z: -90,
            },
            {
                x: -200,
                z: -90,
            },
        ),
        createStreet(
            {
                x: -55,
                z: 115,
            },
            {
                x: -55,
                z: 200,
            },
        ),
        createStreet(
            {
                x: -70,
                z: -125,
            },
            {
                x: -70,
                z: -200,
            },
        ),
    ],
    /** On the long straight of the city's west edge, climbing north. */
    ramps: [
        {
            x: -200,
            z: -15,
        },
    ],
    sidewalkWidth: 3,
    /** Across the grid from the ramp, on the east edge, climbing south. */
    steepRamps: [
        {
            x: 240,
            z: -60,
        },
    ],
    speedBumps: [
        /** A row of three on the street leaving the loop's straight. */
        ...[
            90,
            150,
            210,
        ].map((x) => {
            return {
                x,
                z: 30,
            };
        }),
        /** Two close together, so the second lands while the car still bounces from the first. */
        ...[
            55,
            62,
        ].map((z) => {
            return {
                x: 60,
                z,
            };
        }),
        {
            x: 180,
            z: -120,
        },
        {
            x: -150,
            z: 200,
        },
    ],
};
