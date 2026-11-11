// cspell:words randomation
import {clamp, createArray} from '@augment-vir/common';
import {type Vector3} from './physics/vector.js';
import {type VehicleImpact} from './vehicle-view.js';

/** Longest edge, in meters, of a body box that can dent's grid cells: finer cells dent smoother. */
const dentCellSize = 0.25;
const maxSegmentsPerAxis = 10;
/** Below this the dent is too faint to move a vertex visibly. */
const minFalloff = 0.001;

/** How many grid cells each axis of a box that can dent gets, so vertices exist to push around. */
export function getDentSegments(size: Readonly<Vector3>) {
    function segmentsFor(length: number) {
        return clamp(Math.ceil(length / dentCellSize), {
            max: maxSegmentsPerAxis,
            min: 1,
        });
    }

    return {
        depth: segmentsFor(size.z),
        height: segmentsFor(size.y),
        width: segmentsFor(size.x),
    };
}

/**
 * Pushes every vertex near the impact along the hit, with Randomation Vehicle Physics'
 * `VehicleDamage` falloff, documented on {@link VehicleImpact}. Edits `positions` in place because
 * the mesh redraws from that same buffer. Returns whether any vertex moved.
 */
export function applyDent({
    boxCenter,
    impact,
    positions,
}: Readonly<{
    /** Float triples of vertex positions relative to `boxCenter`. */
    positions: Float32Array;
    /** Where the box sits in the car frame, so its vertices can be compared with the impact. */
    boxCenter: Readonly<Vector3>;
    impact: Readonly<Pick<VehicleImpact, 'dentPoint' | 'dentStrength' | 'dentTranslation'>>;
}>) {
    if (impact.dentStrength <= 0) {
        return false;
    }

    const maxPush = impact.dentStrength * 0.01;
    const falloffNumerator = impact.dentStrength * 0.001;
    const falloffExponent = impact.dentStrength * 0.5;
    const vertexCount = positions.length / 3;

    return createArray(vertexCount, (vertex) => vertex).reduce<boolean>((didMove, vertex) => {
        const base = vertex * 3;
        const x = (positions[base] ?? 0) + boxCenter.x - impact.dentPoint.x;
        const y = (positions[base + 1] ?? 0) + boxCenter.y - impact.dentPoint.y;
        const z = (positions[base + 2] ?? 0) + boxCenter.z - impact.dentPoint.z;
        const squaredDistance = x * x + y * y + z * z;
        const falloff = falloffNumerator / squaredDistance ** falloffExponent;

        if (falloff <= minFalloff) {
            return didMove;
        }

        const push = Math.min(maxPush, falloff);

        positions[base] = (positions[base] ?? 0) + impact.dentTranslation.x * push;
        positions[base + 1] = (positions[base + 1] ?? 0) + impact.dentTranslation.y * push;
        positions[base + 2] = (positions[base + 2] ?? 0) + impact.dentTranslation.z * push;

        return true;
    }, false);
}

/** Whether the health jump between two frames means the car was repaired or recovered. */
export function isRepair({
    health,
    previousHealth,
}: Readonly<{health: number; previousHealth: number}>) {
    return health - previousHealth > 0.05;
}
