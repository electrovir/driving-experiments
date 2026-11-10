import {defineAnthaMod} from '@antha/engine';
import {getDirectionalInputVector, type PlayersActiveBindings} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {
    createArray,
    ensureErrorAndPrependMessage,
    getObjectTypedEntries,
    mapObjectValues,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {
    AmbientLight,
    Camera3D,
    Container3D,
    CubeGeometry,
    CylinderGeometry,
    DirectionalLight,
    Material3D,
    Mesh3D,
    PlaneGeometry,
    View3D,
} from '@pixi/3d';
import {ParticleSystem3D} from '@pixi/3d/extras';
import {convertDuration} from 'date-vir';
import {Application} from 'pixi.js';
import {createCameraOrbit, updateCameraOrbit} from './camera-orbit.js';
import {carBoxes, WheelPosition, wheelRadius, type CarBodyLean, type CarPose} from './car-pose.js';
import {followCar, type ChaseCamera} from './chase-camera.js';
import {DriveBinding} from './drive-binding.js';
import {boundaryHalfWidth, type RoadNetwork} from './road-network.js';
import {type TrackLayout} from './track-layout.js';
import {createRoadNetworkMesh, createTrackMesh} from './track-mesh.js';

const skyColor = 0x9c_c8_ec;
/** Meters across the ground when there are no boundary walls to size it by. */
const openGroundSize = 600;
/** Meters. Well over the car's height, so it reads as a wall the car can't get over. */
const wallHeight = 3.5;
const wallThickness = 1;
/** Grid lines across the ground give something to judge speed and turning by. */
const gridSpacing = 10;
/**
 * Most sparks thrown in one frame. The physics reports every spot that scrapes in each of its many
 * steps, which would recycle the oldest sparks before they burn out.
 */
const maxSparksPerFrame = 24;

/** Meters from the car's center, with right positive. */
export type WheelPositions = Record<WheelPosition, Readonly<{forward: number; right: number}>>;

const defaultWheelPositions: WheelPositions = {
    [WheelPosition.FrontLeft]: {
        forward: 1.3,
        right: -0.85,
    },
    [WheelPosition.FrontRight]: {
        forward: 1.3,
        right: 0.85,
    },
    [WheelPosition.RearLeft]: {
        forward: -1.3,
        right: -0.85,
    },
    [WheelPosition.RearRight]: {
        forward: -1.3,
        right: 0.85,
    },
};

function createCar(wheelPositions: Readonly<WheelPositions>) {
    const paint = new Material3D({
        baseColor: 0xd0_30_20,
        roughness: 0.4,
    });
    const glass = new Material3D({
        baseColor: 0x20_28_30,
        roughness: 0.1,
    });
    const rubber = new Material3D({
        baseColor: 0x18_18_18,
        roughness: 0.9,
    });
    const wheelGeometry = new CylinderGeometry({
        height: 0.3,
        radialSegments: 16,
        radiusBottom: wheelRadius,
        radiusTop: wheelRadius,
    });
    const car = new Container3D();
    /** Holds the body, and the wheels too when the pose gives a full tilt instead of pitch and roll. */
    const chassis = new Container3D();
    const boxes = carBoxes.map((box, index) => {
        const mesh = new Mesh3D({
            geometry: new CubeGeometry({
                depth: box.length,
                height: box.height,
                width: box.width,
            }),
            material: index ? glass : paint,
        });

        /** The car's left side faces +x. */
        mesh.position.set(-box.center.right, box.center.up, box.center.forward);

        return mesh;
    });

    chassis.addChild(...boxes);
    car.addChild(chassis);

    const wheels = mapObjectValues(wheelPositions, (position, spot) => {
        const wheel = new Mesh3D({
            geometry: wheelGeometry,
            material: rubber,
        });

        wheel.rotation.z = Math.PI / 2;
        /** The car's left side faces +x. */
        wheel.position.set(-spot.right, wheelRadius, spot.forward);
        car.addChild(wheel);

        return wheel;
    });

    return {
        car,
        chassis,
        wheels,
    };
}

function createGround({groundSize, hasWalls}: Readonly<{groundSize: number; hasWalls: boolean}>) {
    const ground = new Container3D();
    const plane = new Mesh3D({
        geometry: new PlaneGeometry({
            height: groundSize,
            width: groundSize,
        }),
        material: new Material3D({
            baseColor: 0x6a_8c_4a,
            roughness: 1,
        }),
    });
    const lineMaterial = new Material3D({
        baseColor: 0xe8_ee_dc,
        roughness: 1,
    });
    const lineGeometry = new PlaneGeometry({
        height: groundSize,
        width: 0.15,
    });
    const linesPerSide = Math.floor(groundSize / gridSpacing) + 1;
    const firstLine = -((linesPerSide - 1) * gridSpacing) / 2;

    /** The plane faces +z; this lays it flat facing up. */
    plane.rotation.x = -Math.PI / 2;
    ground.addChild(plane);

    createArray(linesPerSide, (index) => firstLine + index * gridSpacing).forEach((offset) => {
        const alongZ = new Mesh3D({
            geometry: lineGeometry,
            material: lineMaterial,
        });
        const alongX = new Mesh3D({
            geometry: lineGeometry,
            material: lineMaterial,
        });

        /** Lifted a hair off the ground so the lines don't flicker against it. */
        alongZ.position.set(offset, 0.01, 0);
        alongZ.rotation.x = -Math.PI / 2;
        alongX.position.set(0, 0.01, offset);
        alongX.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        ground.addChild(alongZ, alongX);
    });

    if (!hasWalls) {
        return ground;
    }

    const wallMaterial = new Material3D({
        baseColor: 0x9a_96_8e,
        roughness: 0.9,
    });
    const wallLength = 2 * (boundaryHalfWidth + wallThickness);

    [
        -1,
        1,
    ].forEach((side) => {
        const alongZ = new Mesh3D({
            geometry: new CubeGeometry({
                depth: wallLength,
                height: wallHeight,
                width: wallThickness,
            }),
            material: wallMaterial,
        });
        const alongX = new Mesh3D({
            geometry: new CubeGeometry({
                depth: wallThickness,
                height: wallHeight,
                width: wallLength,
            }),
            material: wallMaterial,
        });
        const center = side * (boundaryHalfWidth + wallThickness / 2);

        alongZ.position.set(center, wallHeight / 2, 0);
        alongX.position.set(0, wallHeight / 2, center);
        ground.addChild(alongZ, alongX);
    });

    return ground;
}

async function createScene({
    roads,
    track,
    wheelPositions = defaultWheelPositions,
}: Readonly<SceneOptions>) {
    const canvasLayer = globalThis.document.createElement('div');

    /** Only a road network collides with the boundary walls, so only it gets them. */
    const groundSize = roads ? 2 * boundaryHalfWidth + 10 : openGroundSize;

    canvasLayer.style.cssText = 'position: absolute; inset: 0;';

    const app = new Application();

    await app.init({
        antialias: true,
        autoDensity: true,
        background: skyColor,
        preference: 'webgpu',
        resizeTo: canvasLayer,
        resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
    });
    canvasLayer.append(app.canvas);

    /**
     * Pixi's `resizeTo` only re-measures on window resize, and the layer has no size until the
     * engine's UI inserts it.
     */
    const resizeObserver = new ResizeObserver(() => {
        app.resize();
    });
    resizeObserver.observe(canvasLayer);

    const view = new View3D({
        autoResize: true,
        camera: new Camera3D({
            far: 800,
            fov: 60,
            near: 0.3,
        }),
        environment: {
            groundColor: 0x80_74_60,
            intensity: 0.6,
            skyColor,
        },
        fog: {
            color: skyColor,
            far: groundSize / 2,
            near: groundSize / 6,
            type: 'linear',
        },
    });
    const sun = new DirectionalLight({
        intensity: 2.5,
    });
    const {car, chassis, wheels} = createCar(wheelPositions);
    const sparks = new ParticleSystem3D({
        alphaEnd: 0.3,
        blendMode: 'add',
        capacity: 800,
        color: 0xff_ff_ff,
        colorEnd: 0xff_d0_60,
        drag: 0.5,
        emitRate: 0,
        gravity: 9.81,
        life: [
            0.3,
            0.8,
        ],
        size: [
            0.08,
            0.14,
        ],
        sizeEnd: 0.02,
    });

    sun.rotation.set(-Math.PI / 3, Math.PI / 5, 0);
    view.root.addChild(
        sun,
        new AmbientLight({
            intensity: 0.2,
        }),
        createGround({
            groundSize,
            hasWalls: !!roads,
        }),
        ...(track ? [createTrackMesh(track)] : []),
        ...(roads ? [createRoadNetworkMesh(roads)] : []),
        car,
        sparks,
    );
    app.stage.addChild(view);

    return {
        app,
        canvasLayer,
        car,
        chassis,
        orbit: createCameraOrbit(canvasLayer),
        resizeObserver,
        sparks,
        view,
        wheels,
    };
}

type Scene = Awaited<ReturnType<typeof createScene>>;

function destroyScene(scene: Readonly<Scene>) {
    scene.resizeObserver.disconnect();
    scene.orbit.destroy();
    scene.app.destroy(true, {
        children: true,
    });
}

const cameraDistance = 9;
const cameraHeight = 3.5;
/** The camera aims at this height, a little ahead of the car. */
const pivotHeight = 1;
const lookAhead = 4;
const restingElevation = Math.atan2(cameraHeight - pivotHeight, cameraDistance);
/** How far dragging can tilt the camera from its resting angle, in radians. */
const orbitPitchRange = {
    max: 1.3 - restingElevation,
    min: 0.05 - restingElevation,
};

/** Times a second that a ghost car blinks. */
const ghostBlinkRate = 6;

function placeCarAndCamera({
    bodyLean,
    car,
    chase,
    scene,
}: Readonly<{
    car: Readonly<CarPose>;
    bodyLean: Readonly<CarBodyLean> | undefined;
    chase: Readonly<ChaseCamera>;
    scene: Readonly<Scene>;
}>) {
    const bodyHeight = bodyLean?.height ?? 0;

    scene.car.position.set(car.x, 0, car.z);
    scene.car.visible =
        !car.ghostSeconds || Math.floor(car.ghostSeconds * ghostBlinkRate * 2) % 2 === 0;
    scene.car.rotation.y = car.heading;
    scene.chassis.position.y = bodyHeight;

    const sparkStride = Math.ceil((car.sparks?.length ?? 0) / maxSparksPerFrame);

    car.sparks
        ?.filter((_spark, index) => index % sparkStride === 0)
        .forEach((spark) => {
            /** Torn-off bits drag on the ground, so they fall behind the body and spray up and out. */
            scene.sparks.spawn(4, {
                position: spark.position,
                velocity(random) {
                    const kept = 0.1 + 0.4 * random();

                    return {
                        x: spark.velocity.x * kept + 12 * (random() - 0.5),
                        y: Math.max(0, spark.velocity.y) * kept + 2 + 6 * random(),
                        z: spark.velocity.z * kept + 12 * (random() - 0.5),
                    };
                },
            });
        });

    if (bodyLean?.tilt) {
        scene.chassis.quaternion.set(
            bodyLean.tilt.x,
            bodyLean.tilt.y,
            bodyLean.tilt.z,
            bodyLean.tilt.w,
        );
    } else {
        /** The chassis faces +z, so pitching the nose down is a positive turn about +x. */
        scene.chassis.rotation.set(bodyLean?.pitch ?? 0, 0, bodyLean?.roll ?? 0);
    }

    /** A tumbling body's wheels hang off it, while leaning bodies leave theirs planted. */
    const wheelParent = bodyLean?.tilt ? scene.chassis : scene.car;

    getObjectTypedEntries(scene.wheels).forEach(
        ([
            position,
            wheel,
        ]) => {
            if (wheel.parent !== wheelParent) {
                wheelParent.addChild(wheel);
            }

            wheel.position.y = wheelRadius + (bodyLean?.wheelHeights?.[position] ?? 0);

            if (position === WheelPosition.FrontLeft || position === WheelPosition.FrontRight) {
                /**
                 * {@link CarPose.steerAngle} is positive to the right, which is a negative turn
                 * about +y.
                 */
                wheel.rotation.y = -car.steerAngle;
            }
        },
    );

    const cameraYaw = chase.heading + scene.orbit.yaw;
    const cameraElevation = restingElevation + scene.orbit.pitch;
    const radius = Math.hypot(cameraDistance, cameraHeight - pivotHeight);
    const horizontal = radius * Math.cos(cameraElevation);

    scene.view.camera.position.set(
        car.x - Math.sin(cameraYaw) * horizontal,
        chase.height + pivotHeight + radius * Math.sin(cameraElevation),
        car.z - Math.cos(cameraYaw) * horizontal,
    );
    scene.view.camera.lookAt({
        x: car.x + Math.sin(cameraYaw) * lookAhead,
        y: chase.height + pivotHeight,
        z: car.z + Math.cos(cameraYaw) * lookAhead,
    });
}

/** What {@link createSceneMod} reads. Leave `carBodyLean` unset for a car without suspension. */
export type SceneState = {
    car: CarPose;
    carBodyLean?: CarBodyLean | undefined;
    activeBindings: PlayersActiveBindings<DriveBinding>;
};

/** What the scene draws besides the car and the ground. */
export type SceneOptions = PartialWithUndefined<{
    track: TrackLayout;
    roads: RoadNetwork;
    /**
     * Where each wheel is drawn. Match the physics' wheel points so the wheels sit under the body
     * they act on.
     */
    wheelPositions: WheelPositions;
}>;

/** Owns the Pixi app and the 3D scene, and draws the car where {@link SceneState.car} says. */
export function createSceneMod(options: Readonly<SceneOptions> = {}) {
    const runtime: {
        scene: Scene | undefined;
        creating: Promise<void> | undefined;
        chase: ChaseCamera | undefined;
    } = {
        chase: undefined,
        creating: undefined,
        scene: undefined,
    };

    return defineAnthaMod<SceneState>({
        modName: 'driving-scene',
        cleanup() {
            if (runtime.scene) {
                destroyScene(runtime.scene);
            }
            runtime.scene = undefined;
            runtime.creating = undefined;
            runtime.chase = undefined;
        },
        execute({engine, msSinceLastExecute, state}) {
            if (!runtime.scene) {
                if (!runtime.creating) {
                    const creating: Promise<void> = createScene(options).then(
                        (scene) => {
                            /** The launcher can switch away before Pixi finishes starting. */
                            if (runtime.creating === creating) {
                                runtime.scene = scene;
                            } else {
                                destroyScene(scene);
                            }
                        },
                        (error: unknown) => {
                            engine.log.error(
                                ensureErrorAndPrependMessage(
                                    error,
                                    'Failed to start the 3D renderer.',
                                ),
                            );
                        },
                    );
                    runtime.creating = creating;
                }

                return;
            }

            /**
             * Unlike the physics step, the camera takes long frames as they come: the spring and
             * the orbit easing are both solved exactly, so a long frame just settles them further.
             */
            const dtSeconds = convertDuration(
                {
                    milliseconds: msSinceLastExecute,
                },
                {
                    seconds: true,
                },
            ).seconds;

            updateCameraOrbit({
                dtSeconds,
                lookStick: getDirectionalInputVector({
                    activeBindings: state.activeBindings?.[LocalPlayerPosition.One],
                    bindingNames: {
                        down: DriveBinding.LookDown,
                        left: DriveBinding.LookLeft,
                        right: DriveBinding.LookRight,
                        up: DriveBinding.LookUp,
                    },
                }),
                orbit: runtime.scene.orbit,
                pitchRange: orbitPitchRange,
            });

            if (state.car) {
                runtime.chase = followCar({
                    bodyHeight: state.carBodyLean?.height ?? 0,
                    car: state.car,
                    chase: runtime.chase ?? {
                        climbRate: 0,
                        heading: state.car.heading,
                        height: 0,
                        turnRate: 0,
                    },
                    dtSeconds,
                });
                placeCarAndCamera({
                    bodyLean: state.carBodyLean,
                    car: state.car,
                    chase: runtime.chase,
                    scene: runtime.scene,
                });
            }

            return runtime.scene.canvasLayer;
        },
    });
}
