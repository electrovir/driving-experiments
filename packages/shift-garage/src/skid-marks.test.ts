import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {
    addSkidSegment,
    createSkidMarkBuffers,
    fadeSkidMarks,
    getSkidAlpha,
    getSkidEdges,
    stepSkidTrail,
    type SkidTrail,
} from './skid-marks.js';

const up = {
    x: 0,
    y: 1,
    z: 0,
};
const identity = {
    w: 1,
    x: 0,
    y: 0,
    z: 0,
};

function createWheel(overrides: Partial<Parameters<typeof stepSkidTrail>[0]['wheel']> = {}) {
    return {
        contactNormal: up,
        contactPoint: {
            x: 0,
            y: 0,
            z: 0,
        },
        isGrounded: true,
        rotation: identity,
        slip: 1,
        width: 0.2,
        ...overrides,
    };
}

function stepAlong(trail: SkidTrail | undefined, z: number, slip = 1) {
    return stepSkidTrail({
        lift: 0.02,
        trail,
        wheel: createWheel({
            contactPoint: {
                x: 0,
                y: 0,
                z,
            },
            slip,
        }),
    });
}

describe(getSkidAlpha.name, () => {
    it('darkens with slip', () => {
        assert.isAbove(getSkidAlpha(1), getSkidAlpha(0.5));
        assert.strictEquals(getSkidAlpha(1), 1);
    });
});

describe(getSkidEdges.name, () => {
    it('spans the tire width along the axle, lifted off the ground', () => {
        const edges = getSkidEdges({
            contactNormal: up,
            contactPoint: {
                x: 0,
                y: 0,
                z: 0,
            },
            lift: 0.02,
            rotation: identity,
            width: 0.4,
        });

        assert.deepEquals(edges, {
            left: {
                x: 0.2,
                y: 0.02,
                z: 0,
            },
            right: {
                x: -0.2,
                y: 0.02,
                z: 0,
            },
        });
    });
});

describe(stepSkidTrail.name, () => {
    it('lays no mark below the slip threshold, and ends a running trail', () => {
        const started = stepAlong(undefined, 0);

        assert.isDefined(started.trail);
        assert.deepEquals(stepAlong(started.trail, 1, 0.2), {
            segment: undefined,
            trail: undefined,
        });
    });

    it('starts transparent, then emits a segment after enough travel', () => {
        const started = stepAlong(undefined, 0);
        const barely = stepAlong(started.trail, 0.1);
        const moved = stepAlong(barely.trail, 1);

        assert.isUndefined(started.segment);
        assert.isUndefined(barely.segment);
        assert.strictEquals(moved.segment?.startAlpha, 0);
        assert.strictEquals(moved.segment.endAlpha, 1);
    });

    it('starts over rather than draw across a teleport', () => {
        const started = stepAlong(undefined, 0);
        const jumped = stepAlong(started.trail, 100);

        assert.isUndefined(jumped.segment);
        assert.strictEquals(jumped.trail?.contactPoint.z, 100);
    });

    it('leaves nothing for an airborne wheel', () => {
        const started = stepAlong(undefined, 0);

        assert.isUndefined(
            stepSkidTrail({
                lift: 0.02,
                trail: started.trail,
                wheel: createWheel({
                    isGrounded: false,
                }),
            }).trail,
        );
    });
});

describe(addSkidSegment.name, () => {
    const segment = {
        endAlpha: 1,
        from: {
            left: up,
            right: up,
        },
        startAlpha: 0,
        to: {
            left: up,
            right: up,
        },
    };

    it('recycles the oldest slot once the pool is full', () => {
        const buffers = createSkidMarkBuffers(2);

        [
            1,
            2,
            3,
        ].forEach((timeSeconds) => {
            addSkidSegment({
                buffers,
                segment,
                timeSeconds,
            });
        });

        assert.deepEquals(
            Array.from(buffers.birthSeconds),
            [
                3,
                2,
            ],
        );
        assert.strictEquals(buffers.nextSegment, 1);
    });
});

describe(fadeSkidMarks.name, () => {
    const segment = {
        endAlpha: 1,
        from: {
            left: up,
            right: up,
        },
        startAlpha: 0.5,
        to: {
            left: up,
            right: up,
        },
    };

    function alphaAt(timeSeconds: number) {
        const buffers = createSkidMarkBuffers(2);

        addSkidSegment({
            buffers,
            segment,
            timeSeconds: 0,
        });
        fadeSkidMarks({
            buffers,
            fadeSeconds: 10,
            holdSeconds: 10,
            timeSeconds,
        });

        return [
            buffers.colors[3],
            buffers.colors[11],
            buffers.colors[19],
        ];
    }

    it('holds, then fades to nothing, using each edge alpha', () => {
        assert.deepEquals(
            alphaAt(5),
            [
                0.5,
                1,
                0,
            ],
        );
        assert.deepEquals(
            alphaAt(15),
            [
                0.25,
                0.5,
                0,
            ],
        );
        assert.deepEquals(
            alphaAt(30),
            [
                0,
                0,
                0,
            ],
        );
    });
});
