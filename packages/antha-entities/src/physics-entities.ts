import {defineAnthaMod, type ModExecuteParams} from '@antha/engine';
import {
    BodyType,
    createAnthaEntity3dSuite,
    ShapeType,
    type BaseEntity3d,
    type Hit3d,
    type PhysicsShapeDefinition,
    type PhysicsWorld3d,
} from '@antha/entity-3d';
import {assertWrap} from '@augment-vir/assert';
import {createArray} from '@augment-vir/common';
import {
    roadHeight,
    roadObstacleProfiles,
    type WheelContact,
} from '@evir/driving-common/src/road-network.js';
import {getRoadNetworkPolygons, RoadSurfaceLayer} from '@evir/driving-common/src/track-mesh.js';
import {type AnyDuration} from 'date-vir';
import {arenaHalfWidth, arenaLayout, garageSpawn, garageWalls, turntable} from './arena-layout.js';
import {arenaRoadSurface, createParkedVehicles} from './garage-parking.js';
import {type GarageExtraState, type GarageState} from './garage-state.js';
import {getPointVelocity, type RigidBody} from './physics/rigid-body.js';
import {getRigidBodyBoxes} from './physics/skirt.js';
import {
    addVectors,
    createVector,
    crossVectors,
    dotVectors,
    mirrorAngularVelocity,
    mirrorQuaternion,
    mirrorVector,
    rotateVector,
    scaleVector,
    subtractVectors,
    type Vector3,
} from './physics/vector.js';
import {carPresets, type CarPreset} from './physics/vehicle-preset.js';
import {
    accelerateVehicle,
    applyHit,
    getVehicleView,
    minHitSpeed,
    type VehicleSimulation,
} from './physics/vehicle-sim.js';
import {type VehicleWorld} from './physics/vehicle-world.js';

/** The car's own physics was tuned at about this rate, so Box3D steps at it too. */
const physicsStep = {
    seconds: 1 / 120,
} as const satisfies AnyDuration;
/**
 * Box3D only uses the car's mass against other moving bodies, and every force the car's physics
 * makes is already an acceleration, so any reasonable mass works.
 */
const carMass = 1200;
/** Box3D also reports contacts that are about to touch. Closer than this counts as touching. */
const touchingSeparation = 0.02;
/** Sheet metal and glass scraping on any surface the car's body touches. */
const surfaceMaterial = {
    friction: 0.3,
    restitution: 0,
};
const boundaryThickness = 5;
const boundaryHeight = 50;
/** How far below the road each obstacle's solid reaches, so cars can't catch its bottom edge. */
const obstacleFooting = 0.1;
/** Box3D refuses a hull with more than 255 half edges, which caps a round prism at 42 sides. */
const turntableSideCount = 40;
/** Meters below the ground that a wheel's sweep down gives up at. */
const wheelSweepFloor = -1;
/** A surface whose normal points up more than this holds a wheel up rather than walling it in. */
const minGroundNormalY = 0.5;

const {defineEntity, updateEntitiesMod} = createAnthaEntity3dSuite<GarageExtraState>({
    physics: {
        stepDuration: physicsStep,
    },
});

export {updateEntitiesMod};

function createBox({
    center,
    size,
}: Readonly<{center: Vector3; size: Vector3}>): PhysicsShapeDefinition {
    return {
        depth: size.z,
        height: size.y,
        material: surfaceMaterial,
        offset: center,
        type: ShapeType.Box,
        width: size.x,
    };
}

function createBoundaryShapes() {
    const span = 2 * (arenaHalfWidth + boundaryThickness);
    const reach = arenaHalfWidth + boundaryThickness / 2;

    return [
        {
            center: {
                x: 0,
                z: reach,
            },
            size: {
                x: span,
                z: boundaryThickness,
            },
        },
        {
            center: {
                x: 0,
                z: -reach,
            },
            size: {
                x: span,
                z: boundaryThickness,
            },
        },
        {
            center: {
                x: reach,
                z: 0,
            },
            size: {
                x: boundaryThickness,
                z: span,
            },
        },
        {
            center: {
                x: -reach,
                z: 0,
            },
            size: {
                x: boundaryThickness,
                z: span,
            },
        },
    ].map(({center, size}) => {
        return createBox({
            center: {
                ...center,
                y: boundaryHeight / 2,
            },
            size: {
                ...size,
                y: boundaryHeight,
            },
        });
    });
}

/**
 * Each speed bump and ramp as one convex hull through its outline. Separate slices would leave
 * upright faces between them that the car's bumper snags on. The hull slightly fills in a speed
 * bump's concave feet.
 */
function createObstacleShapes() {
    return arenaRoadSurface.obstacles.map(
        ({along, center, halfWidth, type}): PhysicsShapeDefinition => {
            const profile = roadObstacleProfiles[type];

            return {
                material: surfaceMaterial,
                offset: {
                    x: center.x,
                    y: 0,
                    z: center.z,
                },
                points: profile.outlineOffsets.flatMap((offset) => {
                    return [
                        -halfWidth,
                        halfWidth,
                    ].flatMap((across) => {
                        const ground = {
                            x: along.x * offset - along.z * across,
                            z: along.z * offset + along.x * across,
                        };

                        return [
                            {
                                ...ground,
                                y: -obstacleFooting,
                            },
                            {
                                ...ground,
                                y: roadHeight + profile.getHeight(offset),
                            },
                        ];
                    });
                }),
                type: ShapeType.Hull,
            };
        },
    );
}

/** The turntable's ring and disc as round solids standing on the grass under the road. */
function createTurntableShapes() {
    return [
        turntable.ring,
        turntable.disc,
    ].map(({height, radius}): PhysicsShapeDefinition => {
        return {
            material: surfaceMaterial,
            offset: {
                x: garageSpawn.point.x,
                y: 0,
                z: garageSpawn.point.z,
            },
            points: createArray(turntableSideCount, (index) => {
                const angle = (index / turntableSideCount) * Math.PI * 2;

                return [
                    0,
                    roadHeight + height,
                ].map((y) => {
                    return {
                        x: radius * Math.cos(angle),
                        y,
                        z: radius * Math.sin(angle),
                    };
                });
            }).flat(),
            type: ShapeType.Hull,
        };
    });
}

/** The road, curbs, and sidewalks, where they're drawn above the grass, as one triangle mesh. */
function createRaisedGroundMesh(): PhysicsShapeDefinition {
    const polygons = getRoadNetworkPolygons(arenaLayout).filter(({normal, surface}) => {
        return (
            surface === RoadSurfaceLayer.Curb ||
            ((surface === RoadSurfaceLayer.Asphalt || surface === RoadSurfaceLayer.Sidewalk) &&
                normal.y > 0.5)
        );
    });
    /**
     * Appends in place: the road network has enough polygons that copying the list for each one
     * blocked the page for seconds.
     */
    const offsets = polygons.reduce<number[]>(
        (starts, polygon, index) => {
            starts.push(assertWrap.isDefined(starts[index]) + polygon.corners.length);
            return starts;
        },
        [
            0,
        ],
    );

    return {
        material: surfaceMaterial,
        triangles: polygons.flatMap(({corners, normal}, polygonIndex) => {
            const start = assertWrap.isDefined(offsets[polygonIndex]);

            const first = assertWrap.isDefined(corners[0]);

            return corners.slice(2).map((corner, index) => {
                const second = assertWrap.isDefined(corners[index + 1]);
                const facing = dotVectors({
                    left: crossVectors({
                        left: subtractVectors({
                            left: second,
                            right: first,
                        }),
                        right: subtractVectors({
                            left: corner,
                            right: first,
                        }),
                    }),
                    right: normal,
                });

                return facing >= 0
                    ? ([
                          start,
                          start + index + 1,
                          start + index + 2,
                      ] as const)
                    : ([
                          start,
                          start + index + 2,
                          start + index + 1,
                      ] as const);
            });
        }),
        type: ShapeType.Mesh,
        vertices: polygons.flatMap(({corners}) => corners),
    };
}

const groundSize = 2 * (arenaHalfWidth + boundaryThickness) + 20;

/** Everything in the arena the car's body can hit. The wheels read the road surface directly. */
export class ArenaEntity extends defineEntity({
    key: 'arena',
    physics() {
        return {
            shapes: [
                createBox({
                    center: {
                        x: 0,
                        y: -1,
                        z: 0,
                    },
                    size: {
                        x: groundSize,
                        y: 2,
                        z: groundSize,
                    },
                }),
                ...createBoundaryShapes(),
                ...garageWalls.map((wall) => {
                    return createBox({
                        center: {
                            x: wall.center.x,
                            y: wall.height / 2,
                            z: wall.center.z,
                        },
                        size: {
                            x: 2 * wall.halfSize.x,
                            y: wall.height,
                            z: 2 * wall.halfSize.z,
                        },
                    });
                }),
                ...createObstacleShapes(),
                ...createTurntableShapes(),
                createRaisedGroundMesh(),
            ],
            type: BodyType.Static,
        };
    },
}) {}

function getCarShapes(preset: CarPreset) {
    return getRigidBodyBoxes(carPresets[preset].bodyBoxes).map((box) => {
        return createBox({
            center: mirrorVector(box.center),
            size: scaleVector(box.halfSize, 2),
        });
    });
}

/** The scene's pose of the body's origin, from where the car's physics has its center of mass. */
function getSceneOrigin(vehicle: Readonly<VehicleSimulation>) {
    return mirrorVector(
        subtractVectors({
            left: vehicle.body.centerOfMass,
            right: rotateVector(vehicle.body.rotation, vehicle.shape.centerOfMassOffset),
        }),
    );
}

/**
 * The car being driven. Box3D moves its body and pushes it out of everything it hits; the car's own
 * physics adds the wheel, engine, and assist forces before each step.
 */
export class CarEntity extends defineEntity({
    key: 'car',
    physics: {
        enableHitEvents: true,
        gravityScale: 0,
        isBullet: true,
        type: BodyType.Dynamic,
    },
    touches: [
        ArenaEntity,
    ],
}) {
    /** The body the car's physics last saw, so a new one means the game moved the car itself. */
    protected syncedBody: Readonly<RigidBody> | undefined;
    protected syncedPreset: CarPreset | undefined;
    /**
     * Velocity added only to lift the car out of the ground. Box3D keeps it until the next write,
     * so every read until then takes it back out.
     */
    protected correctionVelocity: Vector3 = {
        x: 0,
        y: 0,
        z: 0,
    };
    /** The body before Box3D's latest step, for how fast the car was going into what it hit. */
    protected preStepBody: Readonly<RigidBody> | undefined;
    protected world: VehicleWorld | undefined;

    public override async initInstance() {
        await super.initInstance();
        this.world = createArenaVehicleWorld(this.state.entityStore.physicsWorld);
        this.physics.setSleepEnabled(false);
        this.state.entityStore.physicsWorld.setHitEventThreshold(minHitSpeed);
    }

    /** Brings the car's physics and Box3D's body back in line, and returns the up-to-date car. */
    protected sync({
        state,
        vehicle,
    }: Readonly<{state: Partial<GarageState>; vehicle: Readonly<VehicleSimulation>}>) {
        if (vehicle.preset !== this.syncedPreset) {
            this.physics.setShapes(getCarShapes(vehicle.preset));
            this.physics.setMassData({
                center: mirrorVector(vehicle.shape.centerOfMassOffset),
                mass: carMass,
                rotationalInertia: {
                    x: {
                        x: carMass / vehicle.shape.inverseInertia.x,
                        y: 0,
                        z: 0,
                    },
                    y: {
                        x: 0,
                        y: carMass / vehicle.shape.inverseInertia.y,
                        z: 0,
                    },
                    z: {
                        x: 0,
                        y: 0,
                        z: carMass / vehicle.shape.inverseInertia.z,
                    },
                },
            });
            this.syncedPreset = vehicle.preset;
        }

        if (vehicle.body !== this.syncedBody) {
            this.physics.setRotation(mirrorQuaternion(vehicle.body.rotation));
            this.physics.setPosition(getSceneOrigin(vehicle));
            this.correctionVelocity = {
                x: 0,
                y: 0,
                z: 0,
            };
            this.writeVelocity(vehicle.body);
            this.syncedBody = vehicle.body;

            return vehicle;
        }

        const rotation = mirrorQuaternion(this.physics.getRotation());
        const body: RigidBody = {
            angularVelocity: mirrorAngularVelocity(this.physics.getAngularVelocity()),
            centerOfMass: addVectors(
                mirrorVector(this.physics.getPosition()),
                rotateVector(rotation, vehicle.shape.centerOfMassOffset),
            ),
            rotation,
            velocity: subtractVectors({
                left: mirrorVector(this.physics.getVelocity()),
                right: this.correctionVelocity,
            }),
        };
        const synced = {
            ...vehicle,
            body,
        };

        state.vehicle = synced;
        this.syncedBody = body;

        return synced;
    }

    protected writeVelocity(body: Readonly<RigidBody>) {
        this.physics.setVelocity(mirrorVector(addVectors(body.velocity, this.correctionVelocity)));
        this.physics.setAngularVelocity(mirrorAngularVelocity(body.angularVelocity));
    }

    public override update({state}: Readonly<ModExecuteParams<GarageState>>) {
        if (!state.vehicle || !state.vehicleInputs) {
            return;
        }

        const vehicle = this.sync({
            state,
            vehicle: state.vehicle,
        });
        const isBodyTouching = this.physics
            .getContacts()
            .some((contact) => contact.separation < touchingSeparation);
        const accelerated = accelerateVehicle({
            dtSeconds: physicsStep.seconds,
            inputs: state.vehicleInputs,
            isBodyTouching,
            vehicle,
            world: assertWrap.isDefined(this.world),
        });

        /** Box3D moves the body, so all the car's physics can do is ask for the push out. */
        this.correctionVelocity = scaleVector(
            subtractVectors({
                left: accelerated.body.centerOfMass,
                right: vehicle.body.centerOfMass,
            }),
            1 / physicsStep.seconds,
        );
        this.preStepBody = accelerated.body;
        this.writeVelocity(accelerated.body);
        state.vehicle = accelerated;
        this.syncedBody = accelerated.body;
        /** A shift press is one gear, not one per step. */
        state.vehicleInputs = {
            ...state.vehicleInputs,
            gearChange: 0,
        };
    }

    public override contactHit(otherEntity: BaseEntity3d, hit: Hit3d) {
        const vehicle = this.sync({
            state: this.state,
            vehicle: this.state.vehicle,
        });
        const point = mirrorVector(hit.point);

        this.state.vehicle = applyHit({
            contact: {
                normal: mirrorVector(hit.normal),
                point,
            },
            hitVelocity: scaleVector(getPointVelocity(this.preStepBody ?? vehicle.body, point), -1),
            vehicle,
        });
    }

    public override render({state}: Readonly<ModExecuteParams<GarageState>>) {
        if (!state.vehicle) {
            return;
        }

        const vehicle = this.sync({
            state,
            vehicle: state.vehicle,
        });
        /** Where the view sits between Box3D's last two steps, so the car moves smoothly. */
        const rotation = mirrorQuaternion(this.view.quaternion);

        state.vehicleView = getVehicleView({
            ...vehicle,
            body: {
                ...vehicle.body,
                centerOfMass: addVectors(
                    mirrorVector(this.view.position),
                    rotateVector(rotation, vehicle.shape.centerOfMassOffset),
                ),
                rotation,
            },
        });
    }
}

/**
 * The car's wheels resting on the same arena shapes that its body hits. Each wheel is swept down as
 * a ball from as high as it can roll up a step, so a taller step walls it in instead.
 */
export function createArenaVehicleWorld(physicsWorld: Readonly<PhysicsWorld3d>): VehicleWorld {
    const filter = {
        category: CarEntity.collision.category,
        mask: ArenaEntity.collision.category,
    };

    function sweepDown({
        point,
        radius,
        startY,
    }: Readonly<{point: Readonly<{x: number; z: number}>; radius: number; startY: number}>) {
        const hit = physicsWorld.castShape({
            filter,
            position: {
                x: point.x,
                y: startY,
                z: point.z,
            },
            shape: {
                radius,
                type: ShapeType.Sphere,
            },
            translation: {
                x: 0,
                y: wheelSweepFloor - startY,
                z: 0,
            },
        });

        /** A sweep that starts inside a shape stops at once with no normal. */
        return hit && hit.normal.y > 0 ? hit : undefined;
    }

    function findWall({
        center,
        radius,
    }: Readonly<{center: Readonly<{x: number; y: number; z: number}>; radius: number}>) {
        return physicsWorld
            .collideMover({
                capsule: {
                    center1: {
                        x: 0,
                        y: 0,
                        z: 0,
                    },
                    center2: {
                        x: 0,
                        y: 0,
                        z: 0,
                    },
                    radius,
                },
                filter,
                position: center,
            })
            .reduce<WheelContact['wall']>((deepest, plane) => {
                const across = Math.hypot(plane.normal.x, plane.normal.z);

                return plane.normal.y < minGroundNormalY &&
                    across > 0 &&
                    plane.offset > (deepest?.depth ?? 0)
                    ? {
                          depth: plane.offset,
                          outward: {
                              x: plane.normal.x / across,
                              z: plane.normal.z / across,
                          },
                      }
                    : deepest;
            }, undefined);
    }

    return {
        castBall({from, radius, translation}) {
            const hit = physicsWorld.castShape({
                filter,
                position: from,
                shape: {
                    radius,
                    type: ShapeType.Sphere,
                },
                translation,
            });

            /** A sweep that starts inside a shape stops at once with no normal. */
            return hit && (hit.normal.x || hit.normal.y || hit.normal.z)
                ? {
                      normal: createVector(hit.normal),
                      point: createVector(hit.point),
                  }
                : undefined;
        },
        getWheelContact({point, radius, wheelBottom}) {
            const climbHit = sweepDown({
                point,
                radius,
                startY: wheelBottom + 2 * radius,
            });
            /** Something too tall to roll up onto stands over the wheel. */
            const blockedHit = climbHit
                ? undefined
                : sweepDown({
                      point,
                      radius,
                      startY: wheelBottom + radius,
                  });
            const hit = climbHit ?? blockedHit;

            return {
                height: hit ? hit.point.y + hit.normal.y * radius - radius : wheelSweepFloor,
                push: hit
                    ? {
                          x: hit.normal.x / hit.normal.y,
                          z: hit.normal.z / hit.normal.y,
                      }
                    : {
                          x: 0,
                          z: 0,
                      },
                wall: climbHit
                    ? undefined
                    : findWall({
                          center: {
                              x: point.x,
                              y: wheelBottom + radius,
                              z: point.z,
                          },
                          radius,
                      }),
            };
        },
        /** The garage's walls are arena shapes, so the sweep already walls the wheels in. */
        walls: [],
    };
}

/** Adds the arena and the car to each new entity store. */
export function createSpawnMod() {
    const spawnedStores = new WeakSet<object>();

    return defineAnthaMod<GarageState>({
        modName: 'garage-spawn',
        async execute({state}) {
            if (!state.entityStore || spawnedStores.has(state.entityStore)) {
                return;
            }
            spawnedStores.add(state.entityStore);
            await state.entityStore.addEntity(ArenaEntity);
            state.garage = {
                isInGarage: true,
                parkedVehicles: createParkedVehicles(
                    createArenaVehicleWorld(state.entityStore.physicsWorld),
                ),
            };
            await state.entityStore.addEntity(CarEntity);
        },
    });
}
