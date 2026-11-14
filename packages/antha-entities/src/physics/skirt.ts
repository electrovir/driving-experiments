import {createArray, mapObjectValues} from '@augment-vir/common';
import {
    addAccelerations,
    getAccelerationAtPoint,
    getPointVelocity,
    getWorldPoint,
    noAcceleration,
    type BodyShape,
    type RigidBody,
} from './rigid-body.js';
import {
    createVector,
    dotVectors,
    getVectorLength,
    projectOnPlane,
    scaleVector,
    subtractVectors,
} from './vector.js';
import {carPresets, type BodyBox, type CarPreset} from './vehicle-preset.js';
import {probeGround, type VehicleWorld} from './vehicle-world.js';

/**
 * Meters of the body's underside that flex like a fender instead of hitting rigidly, so the body
 * rides up over a curb rather than snagging on it.
 */
const skirtHeight = 0.15;
/** Meters between the points along the underside's edges that feel the ground. */
const skirtSpacing = 0.5;
/** Upward push, in meters per second squared, for each meter a point is pressed in. */
const skirtStiffness = 300;
/** Push against each meter per second a point presses further in. */
const skirtDamping = 20;
/** Drag along the ground, as a share of the push. */
const skirtFriction = 0.4;

function isLowest(box: Readonly<BodyBox>, boxes: ReadonlyArray<Readonly<BodyBox>>) {
    const lowest = Math.min(...boxes.map((other) => other.center.y - other.halfSize.y));

    return box.center.y - box.halfSize.y <= lowest + 1e-6;
}

/** The body's boxes with their underside raised by {@link skirtHeight}, for rigid collisions. */
export function getRigidBodyBoxes(boxes: ReadonlyArray<Readonly<BodyBox>>): BodyBox[] {
    return boxes.map((box) => {
        return isLowest(box, boxes)
            ? {
                  center: {
                      ...box.center,
                      y: box.center.y + skirtHeight / 2,
                  },
                  halfSize: {
                      ...box.halfSize,
                      y: box.halfSize.y - skirtHeight / 2,
                  },
              }
            : box;
    });
}

/** Points along the edges of the lowest boxes' undersides, relative to the body's origin. */
function getSkirtPoints(boxes: ReadonlyArray<Readonly<BodyBox>>) {
    return boxes
        .filter((box) => isLowest(box, boxes))
        .flatMap((box) => {
            const y = box.center.y - box.halfSize.y;
            const corners = [
                {
                    x: -1,
                    z: -1,
                },
                {
                    x: 1,
                    z: -1,
                },
                {
                    x: 1,
                    z: 1,
                },
                {
                    x: -1,
                    z: 1,
                },
            ].map((corner) => {
                return createVector({
                    x: box.center.x + corner.x * box.halfSize.x,
                    y,
                    z: box.center.z + corner.z * box.halfSize.z,
                });
            });

            return corners.flatMap((corner, index) => {
                const next = corners[(index + 1) % corners.length] ?? corner;
                const count = Math.max(
                    1,
                    Math.ceil(Math.hypot(next.x - corner.x, next.z - corner.z) / skirtSpacing),
                );

                return createArray(count, (step) => {
                    return createVector({
                        x: corner.x + ((next.x - corner.x) * step) / count,
                        y,
                        z: corner.z + ((next.z - corner.z) * step) / count,
                    });
                });
            });
        });
}

const skirtPoints = mapObjectValues(carPresets, (preset, tuning) => {
    return getSkirtPoints(tuning.bodyBoxes);
});

/**
 * Pushes the underside's edges up and back wherever the ground rises into them, like a bumper or
 * fender flexing as it scrapes over a curb.
 */
export function getSkirtAcceleration({
    body,
    dtSeconds,
    preset,
    shape,
    world,
}: Readonly<{
    body: Readonly<RigidBody>;
    shape: Readonly<BodyShape>;
    preset: CarPreset;
    world: Readonly<VehicleWorld>;
    dtSeconds: number;
}>) {
    const points = skirtPoints[preset];
    const pushes = points.flatMap((localPoint) => {
        const point = getWorldPoint({
            body,
            localPoint,
            shape,
        });
        const ground = probeGround({
            bottom: point.y,
            point,
            radius: skirtHeight / 2,
            world,
        });
        const depth = Math.min(ground.height - point.y, skirtHeight);

        if (depth <= 0) {
            return [];
        }

        const velocity = getPointVelocity(body, point);
        const pressSpeed = -dotVectors({
            left: velocity,
            right: ground.normal,
        });
        const push = Math.max(0, skirtStiffness * depth + skirtDamping * pressSpeed);
        const slide = projectOnPlane({
            normal: ground.normal,
            vector: velocity,
        });
        const slideSpeed = getVectorLength(slide);
        /** Never more than stops the slide this step, split across every pressed point. */
        const drag = Math.min(skirtFriction * push, slideSpeed / dtSeconds / points.length);

        return [
            getAccelerationAtPoint({
                body,
                force: subtractVectors({
                    left: scaleVector(ground.normal, push),
                    right: slideSpeed ? scaleVector(slide, drag / slideSpeed) : slide,
                }),
                point,
                shape,
            }),
        ];
    });

    return pushes.length ? addAccelerations(...pushes) : noAcceleration;
}
