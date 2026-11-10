import {type TrackLayout} from '@evir/driving-common';

/**
 * A loop with fast sweepers and one hairpin. It starts where the car spawns, heading the way the
 * car faces.
 */
export const trackLayout: TrackLayout = {
    controlPoints: [
        {
            x: 0,
            z: 0,
        },
        {
            x: 0,
            z: 50,
        },
        {
            x: -15,
            z: 95,
        },
        {
            x: -55,
            z: 115,
        },
        {
            x: -100,
            z: 100,
        },
        {
            x: -110,
            z: 60,
        },
        {
            x: -85,
            z: 30,
        },
        {
            x: -75,
            z: 0,
        },
        {
            x: -95,
            z: -30,
        },
        {
            x: -135,
            z: -50,
        },
        {
            x: -150,
            z: -90,
        },
        {
            x: -120,
            z: -125,
        },
        {
            x: -70,
            z: -125,
        },
        {
            x: -30,
            z: -110,
        },
        {
            x: -5,
            z: -85,
        },
        {
            x: 0,
            z: -50,
        },
    ],
    width: 12,
};
