import {defineAnthaMod} from '@antha/engine';
import {createArray, ensureErrorAndPrependMessage} from '@augment-vir/common';
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
import {convertDuration} from 'date-vir';
import {Application} from 'pixi.js';
import {createCameraOrbit, updateCameraOrbit} from './camera-orbit.js';
import {type CarState} from './car.js';
import {followCar, type ChaseCamera} from './chase-camera.js';
import {type FlatPlaneState} from './flat-plane-state.js';

const skyColor = 0x9c_c8_ec;
const groundSize = 600;
/** Grid lines across the ground give something to judge speed and turning by. */
const gridSpacing = 10;

function createCar() {
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
        radiusBottom: 0.4,
        radiusTop: 0.4,
    });
    const car = new Container3D();
    const body = new Mesh3D({
        geometry: new CubeGeometry({
            depth: 4,
            height: 0.6,
            width: 1.8,
        }),
        material: paint,
    });
    const cabin = new Mesh3D({
        geometry: new CubeGeometry({
            depth: 2,
            height: 0.55,
            width: 1.5,
        }),
        material: glass,
    });

    body.position.set(0, 0.7, 0);
    cabin.position.set(0, 1.27, -0.3);
    car.addChild(body, cabin);

    const wheels = [
        {
            x: 0.85,
            z: 1.3,
        },
        {
            x: -0.85,
            z: 1.3,
        },
        {
            x: 0.85,
            z: -1.3,
        },
        {
            x: -0.85,
            z: -1.3,
        },
    ].map((spot) => {
        const wheel = new Mesh3D({
            geometry: wheelGeometry,
            material: rubber,
        });

        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(spot.x, 0.4, spot.z);
        car.addChild(wheel);

        return {
            isFront: spot.z > 0,
            wheel,
        };
    });

    return {
        car,
        frontWheels: wheels.filter(({isFront}) => isFront).map(({wheel}) => wheel),
    };
}

function createGround() {
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

    return ground;
}

async function createScene() {
    const canvasLayer = globalThis.document.createElement('div');

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
    const {car, frontWheels} = createCar();

    sun.rotation.set(-Math.PI / 3, Math.PI / 5, 0);
    view.root.addChild(
        sun,
        new AmbientLight({
            intensity: 0.2,
        }),
        createGround(),
        car,
    );
    app.stage.addChild(view);

    return {
        app,
        canvasLayer,
        car,
        frontWheels,
        orbit: createCameraOrbit(canvasLayer),
        resizeObserver,
        view,
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

function placeCarAndCamera({
    car,
    chase,
    scene,
}: Readonly<{
    car: Readonly<CarState>;
    chase: Readonly<ChaseCamera>;
    scene: Readonly<Scene>;
}>) {
    scene.car.position.set(car.x, 0, car.z);
    scene.car.rotation.y = car.heading;
    scene.frontWheels.forEach((wheel) => {
        /** {@link CarState.steerAngle} is positive to the right, which is a negative turn about +y. */
        wheel.rotation.y = -car.steerAngle;
    });

    const cameraYaw = chase.heading + scene.orbit.yaw;
    const cameraElevation = restingElevation + scene.orbit.pitch;
    const radius = Math.hypot(cameraDistance, cameraHeight - pivotHeight);
    const horizontal = radius * Math.cos(cameraElevation);

    scene.view.camera.position.set(
        car.x - Math.sin(cameraYaw) * horizontal,
        pivotHeight + radius * Math.sin(cameraElevation),
        car.z - Math.cos(cameraYaw) * horizontal,
    );
    scene.view.camera.lookAt({
        x: car.x + Math.sin(cameraYaw) * lookAhead,
        y: pivotHeight,
        z: car.z + Math.cos(cameraYaw) * lookAhead,
    });
}

/** Owns the Pixi app and the 3D scene, and draws the car where {@link FlatPlaneState.car} says. */
export function createSceneMod() {
    const runtime: {
        scene: Scene | undefined;
        creating: Promise<void> | undefined;
        chase: ChaseCamera | undefined;
    } = {
        chase: undefined,
        creating: undefined,
        scene: undefined,
    };

    return defineAnthaMod<FlatPlaneState>({
        modName: 'flat-plane-scene',
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
                    const creating: Promise<void> = createScene().then(
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
                orbit: runtime.scene.orbit,
                pitchRange: orbitPitchRange,
            });

            if (state.car) {
                runtime.chase = followCar({
                    car: state.car,
                    chase: runtime.chase ?? {
                        heading: state.car.heading,
                        turnRate: 0,
                    },
                    dtSeconds,
                });
                placeCarAndCamera({
                    car: state.car,
                    chase: runtime.chase,
                    scene: runtime.scene,
                });
            }

            return runtime.scene.canvasLayer;
        },
    });
}
