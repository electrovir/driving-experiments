import {getObjectTypedValues, typedObjectFromEntries} from '@augment-vir/common';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {type BodyBox} from './physics/vehicle-preset.js';

/** The extent of a car's body in the scene's car frame (+x left, +y up, +z forward). */
export type BodyBounds = Record<'minX' | 'maxX' | 'minY' | 'maxY' | 'minZ' | 'maxZ', number>;

export function getBodyBounds(boxes: ReadonlyArray<Readonly<BodyBox>>): BodyBounds {
    return boxes.reduce<BodyBounds>(
        (bounds, {center, halfSize}) => {
            return {
                maxX: Math.max(bounds.maxX, center.x + halfSize.x),
                maxY: Math.max(bounds.maxY, center.y + halfSize.y),
                maxZ: Math.max(bounds.maxZ, center.z + halfSize.z),
                minX: Math.min(bounds.minX, center.x - halfSize.x),
                minY: Math.min(bounds.minY, center.y - halfSize.y),
                minZ: Math.min(bounds.minZ, center.z - halfSize.z),
            };
        },
        {
            maxX: Number.NEGATIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY,
            maxZ: Number.NEGATIVE_INFINITY,
            minX: Number.POSITIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            minZ: Number.POSITIVE_INFINITY,
        },
    );
}

export const wheelPositions = getObjectTypedValues(WheelPosition);

/** Builds one value for each of the car's four wheels. */
export function mapWheelPositions<Value>(
    create: (position: WheelPosition) => Value,
): Record<WheelPosition, Value> {
    return typedObjectFromEntries(
        wheelPositions.map((position) => {
            return [
                position,
                create(position),
            ];
        }),
    );
}
