import {garageWallHeight} from './arena-layout.js';
import {type Vector3} from './physics/vector.js';

export type CameraBox = Record<'minX' | 'maxX' | 'minZ' | 'maxZ' | 'maxY', number>;

/**
 * Pulls the camera in along its line from `pivot` until it is inside `box`, so it stays within a
 * room instead of looking at the car from behind a wall. A camera already inside stays put.
 */
export function clipCameraToBox({
    box,
    camera,
    pivot,
}: Readonly<{
    pivot: Readonly<Vector3>;
    camera: Readonly<Vector3>;
    box: Readonly<CameraBox>;
}>): Vector3 {
    function limit({from, to, bound}: Readonly<{from: number; to: number; bound: number}>) {
        return to === from || (to - from) * (bound - from) < 0 ? 1 : (bound - from) / (to - from);
    }

    const scale = Math.min(
        1,
        limit({
            from: pivot.x,
            to: camera.x,
            bound: camera.x > pivot.x ? box.maxX : box.minX,
        }),
        limit({
            from: pivot.z,
            to: camera.z,
            bound: camera.z > pivot.z ? box.maxZ : box.minZ,
        }),
        limit({
            from: pivot.y,
            to: camera.y,
            bound: box.maxY,
        }),
    );

    return {
        x: pivot.x + (camera.x - pivot.x) * scale,
        y: pivot.y + (camera.y - pivot.y) * scale,
        z: pivot.z + (camera.z - pivot.z) * scale,
    };
}

const cameraRoofMargin = 0.5;

/**
 * Where the camera may be while it or the car is under the stalls' roof: below the roof. The stalls
 * are open at both ends and the camera trails the car down its own stall, so only the roof is in
 * the way.
 */
export const garageCameraBox: CameraBox = {
    maxX: Number.POSITIVE_INFINITY,
    maxY: garageWallHeight - cameraRoofMargin,
    maxZ: Number.POSITIVE_INFINITY,
    minX: Number.NEGATIVE_INFINITY,
    minZ: Number.NEGATIVE_INFINITY,
};
