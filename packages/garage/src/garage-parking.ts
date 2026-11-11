import {assertWrap} from '@augment-vir/assert';
import {createArray, getEnumValues, mapObjectValues} from '@augment-vir/common';
import {createRoadSurface} from '@evir/driving-common/src/road-network.js';
import {type GroundPoint} from '@evir/driving-common/src/track-layout.js';
import {
    arenaLayout,
    garageInterior,
    garageStallCenters,
    garageStallWidth,
    garageWalls,
} from './arena-layout.js';
import {CarPreset} from './physics/vehicle-preset.js';
import {
    createVehicleSimulation,
    stepVehicleSimulation,
    type VehicleSimulation,
} from './physics/vehicle-sim.js';
import {type VehicleWorld} from './physics/vehicle-world.js';

export const arenaRoadSurface = createRoadSurface(arenaLayout);

export const arenaWorld: VehicleWorld = {
    getWheelContact: arenaRoadSurface.getWheelContact,
    walls: garageWalls,
};

/** Each car's drive-through stall. Its display car parks inside, facing out toward the track. */
export const parkingSpots = mapObjectValues(
    {
        [CarPreset.Drift]: 0,
        [CarPreset.Muscle]: 1,
        /** The stall straight ahead of the spawn, so the starting car leaves through its own stall. */
        [CarPreset.Sedan]: 2,
        [CarPreset.Stunt]: 3,
        [CarPreset.Hover]: 4,
        [CarPreset.MonsterTruck]: 5,
    } satisfies Record<CarPreset, number>,
    (preset, stallIndex) => {
        return {
            heading: 0,
            point: {
                x: assertWrap.isDefined(garageStallCenters[stallIndex]),
                z: garageInterior.center.z,
            },
        };
    },
) satisfies Readonly<Record<CarPreset, Readonly<{point: GroundPoint; heading: number}>>>;

/**
 * How close the driven car's center gets to a parked car's center, along the stall, before
 * swapping. Parked cars don't block, so the driven car passes most of the way into one first.
 */
const bumpReach = 1.5;

/**
 * The parked car the driven car has run into, if it's a different car. The stall's dividers keep
 * the cars lined up, so only the gap along the stall matters.
 */
export function findParkedCarAt({
    currentPreset,
    point,
}: Readonly<{
    point: Readonly<GroundPoint>;
    currentPreset: CarPreset;
}>) {
    return getEnumValues(CarPreset).find((preset) => {
        const spot = parkingSpots[preset].point;

        return (
            preset !== currentPreset &&
            Math.abs(point.x - spot.x) < garageStallWidth / 2 &&
            Math.abs(point.z - spot.z) < bumpReach
        );
    });
}

/** Every car settled on its suspension in its stall, so taking one doesn't drop it onto the floor. */
export function createParkedVehicles() {
    return mapObjectValues(parkingSpots, (preset, spot): VehicleSimulation => {
        return createArray(90, () => undefined).reduce(
            (vehicle) => {
                return stepVehicleSimulation({
                    dtSeconds: 1 / 60,
                    inputs: {
                        brake: 0,
                        handbrake: 0,
                        isBoostHeld: false,
                        roll: 0,
                        steer: 0,
                        throttle: 0,
                    },
                    vehicle,
                    world: arenaWorld,
                });
            },
            createVehicleSimulation({
                heading: spot.heading,
                point: spot.point,
                preset,
            }),
        );
    });
}
