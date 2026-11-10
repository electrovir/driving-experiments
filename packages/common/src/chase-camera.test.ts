import {assert} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {followCar, type ChaseCamera} from './chase-camera.js';

const stillCamera: ChaseCamera = {
    climbRate: 0,
    heading: 0,
    height: 0,
    turnRate: 0,
};

describe(followCar.name, () => {
    it('only covers part of a sudden turn in one frame', () => {
        const chase = followCar({
            bodyHeight: 0,
            car: {
                heading: 1,
            },
            chase: stillCamera,
            dtSeconds: 1 / 60,
        });

        assert.isAbove(chase.heading, 0);
        assert.isBelow(chase.heading, 0.1);
    });
    it('turns the short way across the wrap-around', () => {
        const chase = followCar({
            bodyHeight: 0,
            car: {
                heading: Math.PI - 0.1,
            },
            chase: {
                ...stillCamera,
                heading: -Math.PI + 0.1,
            },
            dtSeconds: 1 / 60,
        });

        const turned = chase.heading - (-Math.PI + 0.1);

        assert.isBelow(Math.atan2(Math.sin(turned), Math.cos(turned)), 0);
    });
    it('settles on the car heading without overshooting', () => {
        const car = {
            heading: 1,
        };
        const headings = createArray(120, () => 0).reduce<ChaseCamera[]>((history) => {
            return [
                ...history,
                followCar({
                    bodyHeight: 0,
                    car,
                    chase: history.at(-1) ?? stillCamera,
                    dtSeconds: 1 / 60,
                }),
            ];
        }, []);

        assert.isTrue(headings.every((chase) => chase.heading <= car.heading));
        assert.isAbove(headings.at(-1)?.heading ?? 0, 0.999);
    });
    it('rises to follow the body into the air', () => {
        const chase = createArray(120, () => 0).reduce<ChaseCamera>((previous) => {
            return followCar({
                bodyHeight: 5,
                car: {
                    heading: 0,
                },
                chase: previous,
                dtSeconds: 1 / 60,
            });
        }, stillCamera);

        assert.isAbove(chase.height, 4.9);
    });
});
