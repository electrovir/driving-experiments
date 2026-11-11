import {type WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {Container3D, Geometry3D, Material3D, Mesh3D} from '@pixi/3d';
import {ParticleSystem3D} from '@pixi/3d/extras';
import {Texture} from 'pixi.js';
import {mapWheelPositions, wheelPositions} from './car-layout.js';
import {type CarModel} from './car-model.js';
import {
    getDamageSmokeRate,
    getSparkBursts,
    getTireSmokeRate,
    takeEmission,
} from './effect-rates.js';
import {addVectors, rotateVector, scaleVector, type Vector3} from './physics/vector.js';
import {
    addSkidSegment,
    createSkidMarkBuffers,
    fadeSkidMarks,
    stepSkidTrail,
    type SkidTrail,
} from './skid-marks.js';
import {type VehicleView} from './vehicle-view.js';

const maxSkidSegments = 1500;
const skidHoldSeconds = 25;
const skidFadeSeconds = 20;
/** Meters the skid strip floats above the road. */
const skidLift = 0.03;
const boostFlamePerSecond = 90;

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
    damageSmoke: ParticleSystem3D;
    flame: ParticleSystem3D;
    /** Fractions of a particle owed to each emitter, so slow rates still emit. */
    carries: {
        tireSmoke: Record<WheelPosition, number>;
        damageSmoke: number;
        flame: number;
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
    const damageSmoke = new ParticleSystem3D({
        alpha: 0.6,
        alphaEnd: 0,
        capacity: 200,
        color: 0x30_30_30,
        drag: 0.8,
        emitRate: 0,
        gravity: -1.5,
        life: [
            1,
            2,
        ],
        size: [
            0.4,
            0.6,
        ],
        sizeEnd: 1.8,
        texture: soft,
    });
    const flame = new ParticleSystem3D({
        alpha: 1,
        alphaEnd: 0,
        blendMode: 'add',
        capacity: 300,
        color: 0xff_e0_90,
        colorEnd: 0xff_40_10,
        drag: 2,
        emitRate: 0,
        gravity: 0,
        life: [
            0.12,
            0.3,
        ],
        size: [
            0.4,
            0.6,
        ],
        sizeEnd: 0.05,
        texture: soft,
    });
    const root = new Container3D();

    root.addChild(skid.mesh, tireSmoke, damageSmoke, flame, sparks);

    return {
        carries: {
            damageSmoke: 0,
            flame: 0,
            tireSmoke: mapWheelPositions(() => 0),
        },
        damageSmoke,
        flame,
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
    const emission = takeEmission({
        carry: effects.carries.flame,
        dtSeconds,
        ratePerSecond: view.boost.isBoosting ? boostFlamePerSecond : 0,
    });

    effects.carries.flame = emission.carry;

    if (!emission.count || !sources.length) {
        return;
    }

    const perSource = Math.max(1, Math.round(emission.count / sources.length));

    sources.forEach((source) => {
        effects.flame.spawn(perSource, {
            position: source,
            velocity(random) {
                return {
                    x: view.velocity.x * 0.6 + exhaustDirection.x * 7 + jitter(random, 1.2),
                    y: view.velocity.y * 0.6 + exhaustDirection.y * 7 + jitter(random, 1.2),
                    z: view.velocity.z * 0.6 + exhaustDirection.z * 7 + jitter(random, 1.2),
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

    const damageEmission = takeEmission({
        carry: effects.carries.damageSmoke,
        dtSeconds,
        ratePerSecond: getDamageSmokeRate(view.health),
    });

    effects.carries.damageSmoke = damageEmission.carry;

    if (damageEmission.count) {
        effects.damageSmoke.spawn(damageEmission.count, {
            position: toWorld(view, model.engineBay),
            velocity(random) {
                return {
                    x: view.velocity.x * 0.4 + jitter(random, 1),
                    y: 1 + random(),
                    z: view.velocity.z * 0.4 + jitter(random, 1),
                };
            },
        });
    }

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
