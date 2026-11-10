import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {getTrackRights, sampleTrack} from './track-layout.js';

describe(sampleTrack.name, () => {
    it('passes through every control point in order, starting at the first', () => {
        const controlPoints = [
            {
                x: 0,
                z: 0,
            },
            {
                x: 0,
                z: 20,
            },
            {
                x: -20,
                z: 20,
            },
            {
                x: -20,
                z: 0,
            },
        ];
        const samples = sampleTrack({
            controlPoints,
            width: 10,
        });

        assert.deepEquals(
            controlPoints.map((point) => {
                return samples.findIndex(
                    (sample) => Math.hypot(sample.x - point.x, sample.z - point.z) < 1e-9,
                );
            }),
            [
                0,
                20,
                40,
                60,
            ],
        );
    });
});

describe(`${sampleTrack.name} with an open layout`, () => {
    it('starts at the first control point and ends exactly on the last', () => {
        const samples = sampleTrack({
            controlPoints: [
                {
                    x: 0,
                    z: 0,
                },
                {
                    x: 20,
                    z: 0,
                },
                {
                    x: 20,
                    z: 20,
                },
            ],
            isOpen: true,
            width: 10,
        });

        assert.deepEquals(
            [
                samples[0],
                samples.at(-1),
            ],
            [
                {
                    x: 0,
                    z: 0,
                },
                {
                    x: 20,
                    z: 20,
                },
            ],
        );
    });
});

describe(getTrackRights.name, () => {
    const samples = [
        {
            x: 0,
            z: 0,
        },
        {
            x: 10,
            z: 0,
        },
        {
            x: 10,
            z: 10,
        },
    ];

    /** Adding zero turns negative zeros into zeros. */
    function normalize(rights: ReadonlyArray<Readonly<{x: number; z: number}>>) {
        return rights.map(({x, z}) => {
            return {
                x: x + 0,
                z: z + 0,
            };
        });
    }

    it('points perpendicular to the road, to its right, with unit length', () => {
        const rights = getTrackRights({
            samples: samples.slice(0, 2),
            isOpen: true,
        });

        assert.deepEquals(normalize(rights), [
            {
                x: 0,
                z: -1,
            },
            {
                x: 0,
                z: -1,
            },
        ]);
    });

    it('clamps at the ends of an open road instead of wrapping around', () => {
        assert.deepEquals(
            [
                normalize(
                    getTrackRights({
                        isOpen: true,
                        samples,
                    }),
                ),
                normalize(
                    getTrackRights({
                        samples,
                    }),
                ),
            ].map((rights) => {
                return [
                    rights[0],
                    rights[2],
                ];
            }),
            [
                [
                    {
                        x: 0,
                        z: -1,
                    },
                    {
                        x: 1,
                        z: 0,
                    },
                ],
                [
                    {
                        x: -1,
                        z: 0,
                    },
                    {
                        x: 0,
                        z: 1,
                    },
                ],
            ],
        );
    });
});
