import {type PartialWithUndefined} from '@augment-vir/common';
import {type GetWheelContact} from '@evir/driving-common/src/road-network.js';
import {type WallBlock} from '../arena-layout.js';
import {createVector, mirrorVector, normalizeVector, type Vector3} from './vector.js';

/** What the car drives on and bumps into, in the scene's world coordinates. */
export type VehicleWorld = {
    getWheelContact: GetWheelContact;
    walls: ReadonlyArray<Readonly<WallBlock>>;
} & PartialWithUndefined<{
    /**
     * The first surface a ball of `radius` hits moving from `from` along `translation`. Worlds with
     * nothing for a tire to hit from the side leave it out.
     */
    castBall: (
        params: Readonly<{
            from: Readonly<Vector3>;
            translation: Readonly<Vector3>;
            radius: number;
        }>,
    ) => {point: Vector3; normal: Vector3} | undefined;
}>;

/** The ground under a point, in the physics' mirrored frame. */
export type GroundProbe = {
    height: number;
    /** Out of the ground. */
    normal: Vector3;
} & Partial<
    Record<
        'wall',
        {
            outward: Vector3;
            depth: number;
        }
    >
>;

/**
 * {@link VehicleWorld.castBall} in the physics' frame, which mirrors the scene's x. Never hits
 * anything in a world without it.
 */
export function castBall({
    from,
    radius,
    translation,
    world,
}: Readonly<{
    world: Readonly<VehicleWorld>;
    from: Readonly<Vector3>;
    translation: Readonly<Vector3>;
    radius: number;
}>) {
    const hit = world.castBall?.({
        from: mirrorVector(from),
        radius,
        translation: mirrorVector(translation),
    });

    return hit
        ? {
              normal: mirrorVector(hit.normal),
              point: mirrorVector(hit.point),
          }
        : undefined;
}

/**
 * Finds the ground under a ball of `radius` whose bottom is at `bottom`, centered over `point`.
 * `point` and the result are in the physics' frame, which mirrors the scene's x.
 */
export function probeGround({
    bottom,
    point,
    radius,
    world,
}: Readonly<{
    world: Readonly<VehicleWorld>;
    point: Readonly<Vector3>;
    radius: number;
    bottom: number;
}>): GroundProbe {
    const contact = world.getWheelContact({
        point: {
            x: -point.x,
            z: point.z,
        },
        radius,
        wheelBottom: bottom,
    });

    return {
        height: contact.height,
        /** The push is sideways force per unit of upward force, which a slope's normal also has. */
        normal: normalizeVector(
            createVector({
                x: -contact.push.x,
                y: 1,
                z: contact.push.z,
            }),
        ),
        ...(contact.wall
            ? {
                  wall: {
                      depth: contact.wall.depth,
                      outward: createVector({
                          x: -contact.wall.outward.x,
                          y: 0,
                          z: contact.wall.outward.z,
                      }),
                  },
              }
            : {}),
    };
}

/**
 * How far `point` (physics frame) sits inside the nearest wall block, and which way out, or
 * `undefined` when it's in none. `margin` grows every block, for points that stand for a ball.
 */
export function findWallPenetration({
    margin,
    point,
    world,
}: Readonly<{
    world: Readonly<VehicleWorld>;
    point: Readonly<Vector3>;
    margin: number;
}>) {
    return world.walls.reduce<{normal: Vector3; depth: number} | undefined>((deepest, wall) => {
        const offsetX = -point.x - wall.center.x;
        const offsetZ = point.z - wall.center.z;
        const outX = wall.halfSize.x + margin - Math.abs(offsetX);
        const outZ = wall.halfSize.z + margin - Math.abs(offsetZ);
        const outTop = wall.height + margin - point.y;

        if (outX <= 0 || outZ <= 0 || outTop <= 0 || point.y < -margin) {
            return deepest;
        }

        const exits = [
            {
                depth: outX,
                normal: createVector({
                    x: -Math.sign(offsetX) || 1,
                    y: 0,
                    z: 0,
                }),
            },
            {
                depth: outZ,
                normal: createVector({
                    x: 0,
                    y: 0,
                    z: Math.sign(offsetZ) || 1,
                }),
            },
            {
                depth: outTop,
                normal: createVector({
                    x: 0,
                    y: 1,
                    z: 0,
                }),
            },
        ];
        const shortest = exits.reduce((best, exit) => (exit.depth < best.depth ? exit : best));

        return !deepest || shortest.depth > deepest.depth ? shortest : deepest;
    }, undefined);
}
