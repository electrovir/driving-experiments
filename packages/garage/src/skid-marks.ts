import {createArray} from '@augment-vir/common';
import {
    addVectors,
    clamp01,
    getVectorLength,
    normalizeVector,
    projectOnPlane,
    rotateVector,
    scaleVector,
    subtractVectors,
    type Quaternion,
    type Vector3,
} from './physics/vector.js';
import {type WheelView} from './vehicle-view.js';

/** The two sides of the strip a tire lays down at one spot. */
export type SkidEdges = {
    left: Vector3;
    right: Vector3;
};

/** A tire's strip so far: where it last reached and how dark it was there. */
export type SkidTrail = {
    edges: SkidEdges;
    contactPoint: Vector3;
    alpha: number;
};

export type SkidSegment = {
    from: SkidEdges;
    to: SkidEdges;
    startAlpha: number;
    endAlpha: number;
};

/** Slip below this leaves no mark. {@link WheelView.slip} is fully on by 1. */
export const skidSlipStart = 0.5;
const minimumSkidAlpha = 0.3;
/** Meters between strip edges: shorter segments only waste the pool. */
const minSegmentLength = 0.25;
/** A jump longer than this is a teleport (recovery), not a skid, so the strip starts over. */
const maxSegmentLength = 4;
/** A bare rim leaves a narrower mark than a tire. */
const rimWidthFactor = 0.6;
const skidColor = 0.03;
const verticesPerSegment = 4;
const indicesPerSegment = 6;

export function getSkidAlpha(slip: number) {
    return (
        minimumSkidAlpha +
        (1 - minimumSkidAlpha) * clamp01((slip - skidSlipStart) / (1 - skidSlipStart))
    );
}

/**
 * The strip's edges across the tire's tread, lying in the ground plane and lifted off it so they
 * don't z-fight with the road.
 */
export function getSkidEdges({
    contactNormal,
    contactPoint,
    lift,
    rotation,
    width,
}: Readonly<{
    contactPoint: Readonly<Vector3>;
    contactNormal: Readonly<Vector3>;
    /** The wheel's rotation, whose x axis is the axle. */
    rotation: Readonly<Quaternion>;
    width: number;
    lift: number;
}>): SkidEdges {
    const axle = rotateVector(rotation, {
        x: 1,
        y: 0,
        z: 0,
    });
    const sideways = scaleVector(
        normalizeVector(
            projectOnPlane({
                vector: axle,
                normal: contactNormal,
            }),
        ),
        width / 2,
    );
    const center = addVectors(contactPoint, scaleVector(contactNormal, lift));

    return {
        left: addVectors(center, sideways),
        right: subtractVectors({
            left: center,
            right: sideways,
        }),
    };
}

/**
 * Moves a wheel's strip one frame. A new segment comes back only once the tire has rolled far
 * enough from where the strip last reached.
 */
export function stepSkidTrail({
    lift,
    trail,
    wheel,
}: Readonly<{
    trail: Readonly<SkidTrail> | undefined;
    wheel: Readonly<
        Pick<
            WheelView,
            | 'contactNormal'
            | 'contactPoint'
            | 'isDetached'
            | 'isGrounded'
            | 'isTirePopped'
            | 'rotation'
            | 'slip'
            | 'width'
        >
    >;
    lift: number;
}>): {
    trail: SkidTrail | undefined;
    segment: SkidSegment | undefined;
} {
    if (!wheel.isGrounded || wheel.isDetached || wheel.slip < skidSlipStart) {
        return {
            segment: undefined,
            trail: undefined,
        };
    }

    const edges = getSkidEdges({
        contactNormal: wheel.contactNormal,
        contactPoint: wheel.contactPoint,
        lift,
        rotation: wheel.rotation,
        width: wheel.isTirePopped ? wheel.width * rimWidthFactor : wheel.width,
    });
    const alpha = getSkidAlpha(wheel.slip);
    const startedTrail: SkidTrail = {
        alpha: 0,
        contactPoint: wheel.contactPoint,
        edges,
    };

    if (!trail) {
        return {
            segment: undefined,
            trail: startedTrail,
        };
    }

    const distance = getVectorLength(
        subtractVectors({
            left: wheel.contactPoint,
            right: trail.contactPoint,
        }),
    );

    if (distance > maxSegmentLength) {
        return {
            segment: undefined,
            trail: startedTrail,
        };
    } else if (distance < minSegmentLength) {
        return {
            segment: undefined,
            trail,
        };
    } else {
        return {
            segment: {
                endAlpha: alpha,
                from: trail.edges,
                startAlpha: trail.alpha,
                to: edges,
            },
            trail: {
                alpha,
                contactPoint: wheel.contactPoint,
                edges,
            },
        };
    }
}

/**
 * Fixed-size storage for every skid segment in the scene. Each segment is a quad of four vertices,
 * and new segments overwrite the oldest. The arrays are written in place every frame, which is the
 * point: no allocation while driving.
 */
export type SkidMarkBuffers = {
    maxSegments: number;
    /** Three floats per vertex. */
    positions: Float32Array;
    /** Four floats per vertex, with alpha last. */
    colors: Float32Array;
    /** Three floats per vertex, all pointing up. */
    normals: Float32Array;
    indices: Uint16Array;
    /** Seconds each segment was laid, or negative infinity for an unused slot. */
    birthSeconds: Float32Array;
    /** Per segment: the alpha at its start edge, then at its end edge. */
    edgeAlphas: Float32Array;
    nextSegment: number;
};

export function createSkidMarkBuffers(maxSegments: number): SkidMarkBuffers {
    const indices = new Uint16Array(maxSegments * indicesPerSegment);

    createArray(maxSegments, (segment) => segment).forEach((segment) => {
        const vertex = segment * verticesPerSegment;

        indices.set(
            [
                vertex,
                vertex + 1,
                vertex + 2,
                vertex + 1,
                vertex + 3,
                vertex + 2,
            ],
            segment * indicesPerSegment,
        );
    });

    return {
        birthSeconds: new Float32Array(maxSegments).fill(Number.NEGATIVE_INFINITY),
        colors: new Float32Array(maxSegments * verticesPerSegment * 4),
        edgeAlphas: new Float32Array(maxSegments * 2),
        indices,
        maxSegments,
        nextSegment: 0,
        normals: new Float32Array(maxSegments * verticesPerSegment * 3).map((_value, index) => {
            return index % 3 === 1 ? 1 : 0;
        }),
        positions: new Float32Array(maxSegments * verticesPerSegment * 3),
    };
}

/** Lays a segment in the next slot, replacing the oldest segment once the pool is full. */
export function addSkidSegment({
    buffers,
    segment,
    timeSeconds,
}: Readonly<{
    buffers: SkidMarkBuffers;
    segment: Readonly<SkidSegment>;
    timeSeconds: number;
}>) {
    const slot = buffers.nextSegment;
    const corners = [
        segment.from.left,
        segment.from.right,
        segment.to.left,
        segment.to.right,
    ];

    corners.forEach((corner, cornerIndex) => {
        buffers.positions.set(
            [
                corner.x,
                corner.y,
                corner.z,
            ],
            (slot * verticesPerSegment + cornerIndex) * 3,
        );
    });
    buffers.edgeAlphas.set(
        [
            segment.startAlpha,
            segment.endAlpha,
        ],
        slot * 2,
    );
    buffers.birthSeconds[slot] = timeSeconds;
    buffers.nextSegment = (slot + 1) % buffers.maxSegments;
}

/** Which of a segment's two edge alphas each of its four vertices takes. */
const vertexEdgeIndexes = [
    0,
    0,
    1,
    1,
] as const;

/**
 * Writes each segment's color from its age: held dark for a while, then fading out. Runs over the
 * whole pool every frame, so it writes scalars instead of building arrays.
 */
export function fadeSkidMarks({
    buffers,
    fadeSeconds,
    holdSeconds,
    timeSeconds,
}: Readonly<{
    buffers: SkidMarkBuffers;
    timeSeconds: number;
    holdSeconds: number;
    fadeSeconds: number;
}>) {
    buffers.birthSeconds.forEach((birthSeconds, slot) => {
        if (!Number.isFinite(birthSeconds)) {
            return;
        }

        const visibility = 1 - clamp01((timeSeconds - birthSeconds - holdSeconds) / fadeSeconds);

        vertexEdgeIndexes.forEach((edgeIndex, cornerIndex) => {
            const colorStart = (slot * verticesPerSegment + cornerIndex) * 4;

            buffers.colors[colorStart] = skidColor;
            buffers.colors[colorStart + 1] = skidColor;
            buffers.colors[colorStart + 2] = skidColor;
            buffers.colors[colorStart + 3] =
                (buffers.edgeAlphas[slot * 2 + edgeIndex] ?? 0) * visibility;
        });
    });
}
