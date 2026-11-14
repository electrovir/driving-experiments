import {type WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {Container3D, Geometry3D, Material3D, Mesh3D} from '@pixi/3d';
import {ParticleSystem3D} from '@pixi/3d/extras';
import {Texture} from 'pixi.js';
import {mapWheelPositions, wheelPositions} from './car-layout.js';
import {type CarModel} from './car-model.js';
import {getSparkBursts, getTireSmokeRate, takeEmission} from './effect-rates.js';
import {
    addVectors,
    getVectorLength,
    rotateVector,
    scaleVector,
    type Vector3,
} from './physics/vector.js';
import {
    addSkidSegment,
    createSkidMarkBuffers,
    fadeSkidMarks,
    stepSkidTrail,
    type SkidTrail,
} from './skid-marks.js';
import {type VehicleView} from './vehicle-view.js';

const maxSkidSegments = 6000;
const skidHoldSeconds = 45;
const skidFadeSeconds = 30;
/** Meters the skid strip floats above the road. */
const skidLift = 0.03;
/** Particles per second from each boost nozzle, per layer. */
const boostFlamePerSecond = 260;
/** Particles per second from each exhaust pipe at idle, and added at full throttle. */
const exhaustIdlePerSecond = 160;
const exhaustThrottlePerSecond = 160;
/** Meters per second the exhaust leaves the pipe, relative to the still air. */
const exhaustExitSpeed = 0.8;
/** Seconds exhaust lasts while the car is parked. */
const exhaustParkedLifeSeconds = 1;
/**
 * Exhaust left behind by a moving car fades sooner, so its trail never stretches much farther than
 * this many meters behind the pipe at any speed.
 */
const exhaustMaxTrailMeters = 2;

function createSoftTexture() {
    const canvas = globalThis.document.createElement('canvas');

    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext('2d');

    if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);

        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.4)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
    }

    return Texture.from(canvas);
}

/** A glow with a solid hot center, so a flame reads as a jet instead of a haze. */
function createFlameTexture() {
    const canvas = globalThis.document.createElement('canvas');

    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext('2d');

    if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);

        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.9)');
        gradient.addColorStop(0.6, 'rgba(255,255,255,0.25)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
    }

    return Texture.from(canvas);
}

function createSkidMarks() {
    const buffers = createSkidMarkBuffers(maxSkidSegments);
    const geometry = new Geometry3D({
        colors: buffers.colors,
        dynamic: true,
        indices: buffers.indices,
        normals: buffers.normals,
        positions: buffers.positions,
    });
    const material = new Material3D({
        alphaMode: 'blend',
        baseColor: 0xff_ff_ff,
        doubleSided: true,
        roughness: 1,
    });

    material.vertexColors = true;

    return {
        buffers,
        mesh: new Mesh3D({
            geometry,
            material,
        }),
        trails: mapWheelPositions((): SkidTrail | undefined => undefined),
    };
}

export type Effects = {
    root: Container3D;
    skid: ReturnType<typeof createSkidMarks>;
    sparks: ParticleSystem3D;
    tireSmoke: ParticleSystem3D;
    flameCore: ParticleSystem3D;
    flamePlume: ParticleSystem3D;
    exhaustSmoke: ParticleSystem3D;
    /** Fractions of a particle owed to each emitter, so slow rates still emit. */
    carries: {
        tireSmoke: Record<WheelPosition, number>;
        flameCore: number;
        flamePlume: number;
        exhaustSmoke: number;
    };
};

export function createEffects(): Effects {
    const soft = createSoftTexture();
    const skid = createSkidMarks();
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
    const tireSmoke = new ParticleSystem3D({
        alpha: 0.45,
        alphaEnd: 0,
        capacity: 300,
        color: 0xc8_c8_c8,
        drag: 1.2,
        emitRate: 0,
        gravity: -0.4,
        life: [
            0.8,
            1.6,
        ],
        size: [
            0.5,
            0.8,
        ],
        sizeEnd: 2.2,
        texture: soft,
    });
    const flameTexture = createFlameTexture();
    const flameCore = new ParticleSystem3D({
        alpha: 1,
        alphaEnd: 0.2,
        blendMode: 'add',
        capacity: 400,
        color: 0xd0_e8_ff,
        colorEnd: 0x60_80_ff,
        drag: 0,
        emitRate: 0,
        gravity: 0,
        life: [
            0.04,
            0.07,
        ],
        size: [
            0.16,
            0.2,
        ],
        sizeEnd: 0.06,
        texture: flameTexture,
    });
    const flamePlume = new ParticleSystem3D({
        alpha: 0.9,
        alphaEnd: 0,
        blendMode: 'add',
        capacity: 600,
        color: 0xff_c0_50,
        colorEnd: 0xc0_20_00,
        drag: 3,
        emitRate: 0,
        gravity: -1,
        life: [
            0.1,
            0.2,
        ],
        size: [
            0.18,
            0.26,
        ],
        sizeEnd: 0.4,
        texture: flameTexture,
    });
    const exhaustSmoke = new ParticleSystem3D({
        alpha: 0.004,
        alphaEnd: 0,
        capacity: 2400,
        color: 0xe0_e0_e0,
        drag: 1,
        emitRate: 0,
        gravity: -0.2,
        life: [
            0.9,
            1.1,
        ],
        size: [
            0.2,
            0.22,
        ],
        sizeEnd: 1.2,
        texture: soft,
    });
    const root = new Container3D();

    root.addChild(skid.mesh, tireSmoke, exhaustSmoke, flamePlume, flameCore, sparks);

    return {
        carries: {
            exhaustSmoke: 0,
            flameCore: 0,
            flamePlume: 0,
            tireSmoke: mapWheelPositions(() => 0),
        },
        exhaustSmoke,
        flameCore,
        flamePlume,
        root,
        skid,
        sparks,
        tireSmoke,
    };
}

/** Forgets each tire's strip so a car swap or teleport doesn't draw a mark across the map. */
export function resetEffectTrails(effects: Effects) {
    wheelPositions.forEach((position) => {
        effects.skid.trails[position] = undefined;
    });
}

function toWorld(view: Readonly<VehicleView>, carFramePoint: Readonly<Vector3>) {
    return addVectors(view.position, rotateVector(view.rotation, carFramePoint));
}

function jitter(random: () => number, spread: number) {
    return (random() - 0.5) * spread;
}

function emitBoostFlame({
    dtSeconds,
    effects,
    model,
    view,
}: Readonly<{
    effects: Effects;
    model: Readonly<CarModel>;
    view: Readonly<VehicleView>;
    dtSeconds: number;
}>) {
    const backward = rotateVector(view.rotation, {
        x: 0,
        y: 0,
        z: -1,
    });
    const sources = model.padMaterials
        ? wheelPositions.map((position) => view.wheels[position].position)
        : model.exhausts.map((exhaust) => toWorld(view, exhaust));
    const exhaustDirection = model.padMaterials
        ? {
              x: 0,
              y: -1,
              z: 0,
          }
        : backward;
    const layers = [
        {
            carry: 'flameCore',
            /** Meters per second the flame leaves the nozzle, on top of the car's own velocity. */
            exitSpeed: 14,
            spread: 0.4,
        },
        {
            carry: 'flamePlume',
            exitSpeed: 9,
            spread: 1.6,
        },
    ] as const;

    layers.forEach((layer) => {
        const emission = takeEmission({
            carry: effects.carries[layer.carry],
            dtSeconds,
            ratePerSecond: view.boost.isBoosting ? boostFlamePerSecond * sources.length : 0,
        });

        effects.carries[layer.carry] = emission.carry;

        if (!emission.count || !sources.length) {
            return;
        }

        const perSource = Math.max(1, Math.round(emission.count / sources.length));

        sources.forEach((source) => {
            effects[layer.carry].spawn(perSource, {
                position(random) {
                    /**
                     * Places each particle where it would be had it left the nozzle earlier in the
                     * frame, so a frame's particles form a line instead of one clump.
                     */
                    const travel = random() * dtSeconds * layer.exitSpeed;

                    return addVectors(source, scaleVector(exhaustDirection, travel));
                },
                velocity(random) {
                    return {
                        x:
                            view.velocity.x +
                            exhaustDirection.x * layer.exitSpeed +
                            jitter(random, layer.spread),
                        y:
                            view.velocity.y +
                            exhaustDirection.y * layer.exitSpeed +
                            jitter(random, layer.spread),
                        z:
                            view.velocity.z +
                            exhaustDirection.z * layer.exitSpeed +
                            jitter(random, layer.spread),
                    };
                },
            });
        });
    });
}

/** A thin cloud that drifts from each exhaust pipe the whole time the car is out. */
function emitExhaustSmoke({
    dtSeconds,
    effects,
    model,
    view,
}: Readonly<{
    effects: Effects;
    model: Readonly<CarModel>;
    view: Readonly<VehicleView>;
    dtSeconds: number;
}>) {
    const emission = takeEmission({
        carry: effects.carries.exhaustSmoke,
        dtSeconds,
        ratePerSecond: exhaustIdlePerSecond + exhaustThrottlePerSecond * view.engine.throttle,
    });

    effects.carries.exhaustSmoke = emission.carry;

    if (!emission.count || !model.exhausts.length) {
        return;
    }

    const backward = rotateVector(view.rotation, {
        x: 0,
        y: 0,
        z: -1,
    });

    const speed = getVectorLength(view.velocity);

    /** One shared count per frame, so every pipe puffs exactly as much as the others. */
    model.exhausts.forEach((exhaust) => {
        effects.exhaustSmoke.spawn(emission.count, {
            life(random) {
                return (
                    (exhaustParkedLifeSeconds * (0.9 + random() * 0.2)) /
                    (1 + (speed * exhaustParkedLifeSeconds) / exhaustMaxTrailMeters)
                );
            },
            position(random) {
                /**
                 * Places each particle where it would be had it left the pipe earlier in the frame,
                 * so a frame's particles form one unbroken line instead of a clump, whether the car
                 * is moving or not.
                 */
                const secondsAgo = random() * dtSeconds;

                return addVectors(
                    toWorld(view, exhaust),
                    scaleVector(view.velocity, -secondsAgo),
                    scaleVector(backward, exhaustExitSpeed * secondsAgo),
                );
            },
            velocity(random) {
                return {
                    x: backward.x * exhaustExitSpeed + jitter(random, 0.3),
                    y: backward.y * exhaustExitSpeed + jitter(random, 0.3),
                    z: backward.z * exhaustExitSpeed + jitter(random, 0.3),
                };
            },
        });
    });
}

/**
 * Lays skid marks and throws every particle effect for this frame. Allocates only the small objects
 * each spawn needs; the skid pool and particle capacities are fixed.
 */
export function updateEffects({
    dtSeconds,
    effects,
    model,
    timeSeconds,
    view,
}: Readonly<{
    effects: Effects;
    model: Readonly<CarModel>;
    view: Readonly<VehicleView>;
    dtSeconds: number;
    timeSeconds: number;
}>) {
    const hasWheels = !model.padMaterials;
    const segmentsBefore = effects.skid.buffers.nextSegment;

    wheelPositions.forEach((position) => {
        const wheel = view.wheels[position];
        const step = stepSkidTrail({
            lift: skidLift,
            trail: effects.skid.trails[position],
            wheel: hasWheels
                ? wheel
                : {
                      ...wheel,
                      isGrounded: false,
                  },
        });

        effects.skid.trails[position] = step.trail;

        if (step.segment) {
            addSkidSegment({
                buffers: effects.skid.buffers,
                segment: step.segment,
                timeSeconds,
            });
        }

        const emission = takeEmission({
            carry: effects.carries.tireSmoke[position],
            dtSeconds,
            ratePerSecond: hasWheels ? getTireSmokeRate(wheel) : 0,
        });

        effects.carries.tireSmoke[position] = emission.carry;

        if (emission.count) {
            effects.tireSmoke.spawn(emission.count, {
                position: wheel.contactPoint,
                velocity(random) {
                    return {
                        x: view.velocity.x * 0.3 + jitter(random, 1.5),
                        y: 0.4 + random() * 0.8,
                        z: view.velocity.z * 0.3 + jitter(random, 1.5),
                    };
                },
            });
        }
    });

    if (effects.skid.buffers.nextSegment !== segmentsBefore) {
        effects.skid.mesh.geometry.attributes.aPosition?.buffer.update();
    }

    fadeSkidMarks({
        buffers: effects.skid.buffers,
        fadeSeconds: skidFadeSeconds,
        holdSeconds: skidHoldSeconds,
        timeSeconds,
    });
    effects.skid.mesh.geometry.attributes.aColor?.buffer.update();

    emitBoostFlame({
        dtSeconds,
        effects,
        model,
        view,
    });
    emitExhaustSmoke({
        dtSeconds,
        effects,
        model,
        view,
    });

    getSparkBursts(view.impacts).forEach(({count, impact}) => {
        effects.sparks.spawn(count, {
            position: impact.position,
            velocity(random) {
                const outward = scaleVector(impact.normal, 2 + random() * 4);

                return {
                    x: outward.x + jitter(random, 10),
                    y: Math.max(0, outward.y) + 1 + random() * 5,
                    z: outward.z + jitter(random, 10),
                };
            },
        });
    });
}
