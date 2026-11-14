import {defineAnthaMod} from '@antha/engine';
import {type ApplicationOptions} from '@antha/graphics-2d';
import {
    AmbientLight,
    Camera3D,
    DirectionalLight,
    type Material3D,
    type View3D,
    type View3DOptions,
} from '@antha/graphics-3d';
import {actOnBinding, getDirectionalInputVector} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {getEnumValues, getObjectTypedEntries} from '@augment-vir/common';
import {createCameraOrbit, updateCameraOrbit} from '@evir/driving-common/src/camera-orbit.js';
import {followCar, type ChaseCamera} from '@evir/driving-common/src/chase-camera.js';
import {DriveBinding} from '@evir/driving-common/src/drive-binding.js';
import {getPhysicsStepSeconds} from '@evir/driving-common/src/physics-step.js';
import {convertDuration, type AnyDuration} from 'date-vir';
import {arenaHalfWidth, isUnderGarageRoof} from './arena-layout.js';
import {wheelPositions} from './car-layout.js';
import {createCarModel, type CarModel} from './car-model.js';
import {getHeading, getLampStrengths, getPadGlow} from './effect-rates.js';
import {createEffects, resetEffectTrails, updateEffects} from './effects.js';
import {GarageBinding} from './garage-binding.js';
import {clipCameraToBox, garageCameraBox} from './garage-camera.js';
import {type GarageMenu, type GarageState} from './garage-state.js';
import {createGarageWorld} from './garage-world.js';
import {
    addVectors,
    getVectorLength,
    rotateVector,
    subtractVectors,
    type Vector3,
} from './physics/vector.js';
import {carPresets, type CarPreset} from './physics/vehicle-preset.js';
import {getVehicleView} from './physics/vehicle-sim.js';
import {createRouteMarkers, updateRouteMarkers} from './route-markers.js';
import {type VehicleView} from './vehicle-view.js';

const skyColor = 0x9c_c8_ec;
const groundSize = 2 * arenaHalfWidth + 10;

const cameraDistance = 9;
const cameraHeight = 3.5;
/** The camera aims at this height above the car's origin, a little ahead of the car. */
const pivotHeight = 1;
const lookAhead = 4;
const restingElevation = Math.atan2(cameraHeight - pivotHeight, cameraDistance);
const orbitPitchRange = {
    max: 1.3 - restingElevation,
    min: 0.05 - restingElevation,
};
/** Smooths the car's climb rate before the camera follows it. */
const climbRateSmoothTime: AnyDuration = {
    milliseconds: 100,
};
const heightGapSmoothTime: AnyDuration = {
    milliseconds: 300,
};
/** A jump this long between frames is a respawn, so the chase camera snaps instead of swinging. */
const teleportDistance = 15;

/** The `viewOptions` for `createAnthaGraphics3dMod`, so the scene starts with this sky and camera. */
export function createGarageViewOptions() {
    return {
        camera: new Camera3D({
            far: 800,
            fov: baseFieldOfView,
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
        shadowQuality: 'high',
    } satisfies View3DOptions;
}

/** The `pixiOptions` for `createAnthaGraphics2dMod`. */
export const garagePixiOptions = {
    antialias: true,
    autoDensity: true,
    background: skyColor,
    preference: 'webgpu',
    resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
} satisfies Partial<ApplicationOptions>;

function createScene({canvas, view}: Readonly<{view: View3D; canvas: HTMLCanvasElement}>) {
    const sun = new DirectionalLight({
        castShadow: true,
        intensity: 2.5,
        shadow: {
            cascades: 3,
            maxDistance: 80,
        },
    });
    const effects = createEffects();
    const routeMarkers = createRouteMarkers();

    sun.rotation.set(-Math.PI / 3, Math.PI / 5, 0);
    view.root.addChild(
        sun,
        new AmbientLight({
            intensity: 0.2,
        }),
        createGarageWorld(),
        effects.root,
        routeMarkers.root,
    );

    return {
        carState: {
            chase: undefined as ChaseCamera | undefined,
            current: undefined as {model: CarModel; preset: CarPreset} | undefined,
            /** The car's heading when a wheel last touched the ground. */
            groundHeading: undefined as number | undefined,
            lastPosition: undefined as VehicleView['position'] | undefined,
            models: new Map<CarPreset, CarModel>(),
            parkedModels: new Map<CarPreset, CarModel>(),
            timeSeconds: 0,
        },
        cameraView: CameraView.Chase,
        effects,
        orbit: createCameraOrbit(canvas),
        routeMarkers,
        view,
    };
}

type Scene = ReturnType<typeof createScene>;

function setEmissive(material: Material3D, strength: number) {
    const {emissive} = material;

    if (emissive && emissive.strength !== strength) {
        emissive.strength = strength;
    }
}

/** Swaps which car's model is shown, building it the first time that preset appears. */
function showPreset({preset, scene}: Readonly<{preset: CarPreset; scene: Scene}>) {
    const {carState} = scene;

    if (carState.current) {
        carState.current.model.group.visible = false;
        carState.current.model.headlights.forEach((light) => {
            light.visible = false;
        });
    }

    const model = carState.models.get(preset) ?? createCarModel(preset);

    if (!carState.models.has(preset)) {
        carState.models.set(preset, model);
        scene.view.root.addChild(model.group);
    }

    model.group.visible = true;
    carState.current = {
        model,
        preset,
    };
    resetEffectTrails(scene.effects);

    return model;
}

/**
 * Draws the car parked in each stall, except the car being driven. Parked cars never move, so each
 * is posed once when it's built.
 */
function showParkedCars({
    drivenPreset,
    parkedVehicles,
    scene,
}: Readonly<{
    scene: Scene;
    parkedVehicles: GarageMenu['parkedVehicles'];
    drivenPreset: CarPreset;
}>) {
    getObjectTypedEntries(parkedVehicles).forEach(
        ([
            preset,
            parked,
        ]) => {
            const existing = scene.carState.parkedModels.get(preset);
            const model = existing ?? createCarModel(preset);

            if (!existing) {
                const parkedView = getVehicleView(parked);

                poseCar({
                    model,
                    vehicleView: parkedView,
                });
                updateLights({
                    model,
                    vehicleView: parkedView,
                });
                scene.carState.parkedModels.set(preset, model);
                scene.view.root.addChild(model.group);
            }

            model.group.visible = preset !== drivenPreset;
        },
    );
}

/** Times a second that a car blinks after being set back on its wheels. */
const recoveryBlinkRate = 6;

function poseCar({model, vehicleView}: Readonly<{model: CarModel; vehicleView: VehicleView}>) {
    model.group.visible =
        !vehicleView.blinkSeconds ||
        Math.floor(vehicleView.blinkSeconds * recoveryBlinkRate * 2) % 2 === 0;
    model.body.position.set(vehicleView.position.x, vehicleView.position.y, vehicleView.position.z);
    model.body.quaternion.set(
        vehicleView.rotation.x,
        vehicleView.rotation.y,
        vehicleView.rotation.z,
        vehicleView.rotation.w,
    );

    wheelPositions.forEach((position) => {
        const wheel = vehicleView.wheels[position];
        const node = model.wheels[position];

        node.root.position.set(wheel.position.x, wheel.position.y, wheel.position.z);
        node.root.quaternion.set(
            wheel.rotation.x,
            wheel.rotation.y,
            wheel.rotation.z,
            wheel.rotation.w,
        );

        if (model.padMaterials) {
            setEmissive(
                model.padMaterials[position],
                getPadGlow({
                    compression: wheel.compression,
                    throttle: vehicleView.engine.throttle,
                }),
            );
        }
    });
}

function updateLights({model, vehicleView}: Readonly<{model: CarModel; vehicleView: VehicleView}>) {
    const strengths = getLampStrengths(vehicleView.lights);

    setEmissive(model.lamps.brake, strengths.brake);
    setEmissive(model.lamps.headlight, strengths.headlight);
    setEmissive(model.lamps.reverse, strengths.reverse);
    model.headlights.forEach((light) => {
        light.visible = vehicleView.lights.areHeadlightsOn;
    });
}

/** The views the camera cycles through. */
enum CameraView {
    Chase = 'chase',
    FarChase = 'far-chase',
    Roof = 'roof',
    Bumper = 'bumper',
}

const cameraViews = getEnumValues(CameraView);

type CameraPlacement = {
    position: Vector3;
    target: Vector3;
};

type CameraInputs = Readonly<{
    chase: Readonly<ChaseCamera>;
    orbit: Readonly<Scene['orbit']>;
    vehicleView: Readonly<VehicleView>;
}>;

function placeChaseCamera({
    chase,
    distance,
    height,
    orbit,
    vehicleView,
}: CameraInputs &
    Readonly<{
        distance: number;
        height: number;
    }>): CameraPlacement {
    const cameraYaw = chase.heading + orbit.yaw;
    const cameraElevation = Math.atan2(height - pivotHeight, distance) + orbit.pitch;
    const radius = Math.hypot(distance, height - pivotHeight);
    const horizontal = radius * Math.cos(cameraElevation);
    const pivot = {
        x: vehicleView.position.x,
        y: chase.height + pivotHeight,
        z: vehicleView.position.z,
    };
    const rawCamera = {
        x: pivot.x - Math.sin(cameraYaw) * horizontal,
        y: pivot.y + radius * Math.sin(cameraElevation),
        z: pivot.z - Math.cos(cameraYaw) * horizontal,
    };

    return {
        position:
            isUnderGarageRoof(vehicleView.position) || isUnderGarageRoof(rawCamera)
                ? clipCameraToBox({
                      box: garageCameraBox,
                      camera: rawCamera,
                      pivot,
                  })
                : rawCamera,
        target: {
            x: pivot.x + Math.sin(cameraYaw) * lookAhead,
            y: pivot.y,
            z: pivot.z + Math.cos(cameraYaw) * lookAhead,
        },
    };
}

/** A camera fixed to the car at `mount`, in the car's frame, looking where the car points. */
function placeMountedCamera({
    mount,
    orbit,
    vehicleView,
}: CameraInputs &
    Readonly<{
        mount: Readonly<Vector3>;
    }>): CameraPlacement {
    const position = addVectors(vehicleView.position, rotateVector(vehicleView.rotation, mount));

    return {
        position,
        target: addVectors(
            position,
            rotateVector(vehicleView.rotation, {
                x: Math.sin(orbit.yaw) * Math.cos(orbit.pitch),
                y: -Math.sin(orbit.pitch),
                z: Math.cos(orbit.yaw) * Math.cos(orbit.pitch),
            }),
        ),
    };
}

/** The outer edges of a car's body boxes, in its own frame. */
function getBodyExtent(preset: CarPreset) {
    const boxes = carPresets[preset].bodyBoxes;

    return {
        bottom: Math.min(...boxes.map((box) => box.center.y - box.halfSize.y)),
        front: Math.max(...boxes.map((box) => box.center.z + box.halfSize.z)),
        top: Math.max(...boxes.map((box) => box.center.y + box.halfSize.y)),
    };
}

const cameraPlacers: Record<CameraView, (inputs: CameraInputs) => CameraPlacement> = {
    [CameraView.FarChase](inputs) {
        return placeChaseCamera({
            ...inputs,
            distance: cameraDistance,
            height: cameraHeight,
        });
    },
    [CameraView.Chase](inputs) {
        return placeChaseCamera({
            ...inputs,
            distance: 5.5,
            height: 2.2,
        });
    },
    [CameraView.Roof](inputs) {
        return placeMountedCamera({
            ...inputs,
            mount: {
                x: 0,
                y: getBodyExtent(inputs.vehicleView.preset).top + 0.4,
                z: 0,
            },
        });
    },
    [CameraView.Bumper](inputs) {
        const extent = getBodyExtent(inputs.vehicleView.preset);

        return placeMountedCamera({
            ...inputs,
            mount: {
                x: 0,
                y: extent.bottom + 0.4,
                z: extent.front + 0.1,
            },
        });
    },
};

/** Vertical field of view in degrees while parked. It widens with speed. */
const baseFieldOfView = 60;
const speedFieldOfView = {
    /** Meters per second where the view starts to widen, and where it stops. */
    startSpeed: 10,
    fullSpeed: 50,
    /** Degrees added at `fullSpeed`. */
    extraDegrees: 12,
};
const speedShake = {
    /** Meters per second where the camera starts to shake, and where it shakes fully. */
    startSpeed: 45,
    fullSpeed: 80,
    /** Meters the camera wanders at most, at `fullSpeed`. */
    maxOffset: 0.012,
};

function getSpeedAmount(
    speed: number,
    {startSpeed, fullSpeed}: Readonly<{startSpeed: number; fullSpeed: number}>,
) {
    return Math.min(1, Math.max(0, (speed - startSpeed) / (fullSpeed - startSpeed)));
}

function updateCamera({
    scene,
    timeSeconds,
    ...inputs
}: CameraInputs &
    Readonly<{
        scene: Scene;
        timeSeconds: number;
    }>) {
    const {position, target} = cameraPlacers[scene.cameraView](inputs);
    /**
     * Not the speed along the car's nose, which swings to zero and back with every turn of a car
     * flipping through the air, and the view would zoom in and out along with it.
     */
    const speed = Math.hypot(inputs.vehicleView.velocity.x, inputs.vehicleView.velocity.z);
    const shake = getSpeedAmount(speed, speedShake) * speedShake.maxOffset;

    scene.view.camera.fov =
        baseFieldOfView + getSpeedAmount(speed, speedFieldOfView) * speedFieldOfView.extraDegrees;
    /** Sines at unrelated rates, so the shake doesn't settle into a visible rhythm. */
    scene.view.camera.position.set(
        position.x + shake * Math.sin(timeSeconds * 37) * Math.sin(timeSeconds * 11.3),
        position.y + shake * Math.sin(timeSeconds * 43.7) * Math.sin(timeSeconds * 7.9),
        position.z + shake * Math.sin(timeSeconds * 31.1) * Math.sin(timeSeconds * 13.7),
    );
    scene.view.camera.lookAt(target);
}

function drawFrame({
    dtSeconds,
    parkedVehicles,
    scene,
    vehicleView,
}: Readonly<{
    scene: Scene;
    vehicleView: VehicleView;
    parkedVehicles: GarageMenu['parkedVehicles'];
    dtSeconds: number;
}>) {
    const {carState} = scene;

    showParkedCars({
        drivenPreset: vehicleView.preset,
        parkedVehicles,
        scene,
    });
    const model =
        carState.current?.preset === vehicleView.preset
            ? carState.current.model
            : showPreset({
                  preset: vehicleView.preset,
                  scene,
              });

    carState.timeSeconds += dtSeconds;

    poseCar({
        model,
        vehicleView,
    });
    updateLights({
        model,
        vehicleView,
    });

    const didTeleport =
        !!carState.lastPosition &&
        getVectorLength(
            subtractVectors({
                left: vehicleView.position,
                right: carState.lastPosition,
            }),
        ) > teleportDistance;

    if (didTeleport) {
        resetEffectTrails(scene.effects);
    }

    carState.lastPosition = vehicleView.position;
    updateEffects({
        /**
         * The car only advances a capped step per run, so the first run after loading, or after a
         * stall, would otherwise dump all the smoke for that whole gap at one spot.
         */
        dtSeconds: getPhysicsStepSeconds(
            convertDuration(
                {
                    seconds: dtSeconds,
                },
                {
                    milliseconds: true,
                },
            ).milliseconds,
        ),
        effects: scene.effects,
        model,
        timeSeconds: carState.timeSeconds,
        view: vehicleView,
    });

    /**
     * A car tumbling through the air points its nose up or down, where its heading swings wildly,
     * so the camera keeps the heading it had on the ground until a wheel touches down again.
     */
    const heading =
        vehicleView.groundedWheelCount || carState.groundHeading == undefined || didTeleport
            ? getHeading(vehicleView.rotation)
            : carState.groundHeading;

    carState.groundHeading = heading;

    const previous: ChaseCamera =
        !carState.chase || didTeleport
            ? {
                  climbRate: 0,
                  heading,
                  height: vehicleView.position.y,
                  turnRate: 0,
              }
            : carState.chase;
    /**
     * The shared chase camera's height spring trails a ramp launch or a jump's arc by meters, and
     * then surges to catch up. Here the camera instead climbs at the car's own lightly smoothed
     * climb rate and only eases out the gap left over, so it keeps up with a jump without a jolt.
     */
    const climbRate =
        previous.climbRate +
        (vehicleView.velocity.y - previous.climbRate) *
            (1 -
                Math.exp(
                    -dtSeconds /
                        convertDuration(climbRateSmoothTime, {
                            seconds: true,
                        }).seconds,
                ));
    const movedHeight = previous.height + climbRate * dtSeconds;

    carState.chase = {
        ...followCar({
            bodyHeight: vehicleView.position.y,
            car: {
                heading,
            },
            chase: previous,
            dtSeconds,
        }),
        climbRate,
        height:
            vehicleView.position.y +
            (movedHeight - vehicleView.position.y) *
                Math.exp(
                    -dtSeconds /
                        convertDuration(heightGapSmoothTime, {
                            seconds: true,
                        }).seconds,
                ),
    };
    updateCamera({
        chase: carState.chase,
        orbit: scene.orbit,
        scene,
        timeSeconds: performance.now() / 1000,
        vehicleView,
    });
}

/** Fills the 3D view with the garage world, and draws the garage, the roads, and the current car. */
export function createGarageSceneMod() {
    const runtime: {
        scene: Scene | undefined;
    } = {
        scene: undefined,
    };

    return defineAnthaMod<GarageState>({
        modName: 'garage-scene',
        cleanup() {
            /** The 3D view, and everything this mod added to it, is destroyed by its own mod. */
            runtime.scene?.orbit.destroy();
            runtime.scene = undefined;
        },
        execute({msSinceLastExecute, state}) {
            const view = state.graphics3d?.view;
            const canvas = state.pixi?.canvas;

            if (!runtime.scene) {
                if (!view || !canvas) {
                    return;
                }
                runtime.scene = createScene({
                    canvas,
                    view,
                });
            }

            const dtSeconds = convertDuration(
                {
                    milliseconds: msSinceLastExecute,
                },
                {
                    seconds: true,
                },
            ).seconds;

            if (
                actOnBinding({
                    activeBinding:
                        state.activeBindings?.[LocalPlayerPosition.One]?.[
                            GarageBinding.CycleCamera
                        ],
                })
            ) {
                runtime.scene.cameraView =
                    cameraViews[
                        (cameraViews.indexOf(runtime.scene.cameraView) + 1) % cameraViews.length
                    ] ?? CameraView.Chase;
            }

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

            /** The drive mod fills this in on its first run, which can come after this mod's. */
            if (state.vehicleView && state.garage) {
                drawFrame({
                    dtSeconds,
                    parkedVehicles: state.garage.parkedVehicles,
                    scene: runtime.scene,
                    vehicleView: state.vehicleView,
                });
            }

            if (state.routeRun) {
                updateRouteMarkers({
                    carSpeed: Math.abs(state.vehicleView?.forwardSpeed ?? 0),
                    dtSeconds,
                    markers: runtime.scene.routeMarkers,
                    run: state.routeRun,
                });
            }
        },
    });
}
