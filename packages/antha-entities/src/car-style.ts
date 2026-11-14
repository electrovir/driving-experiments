import {getBodyBounds, getSceneBoxCenter} from './car-layout.js';
import {type Vector3} from './physics/vector.js';
import {CarPreset, carPresets} from './physics/vehicle-preset.js';

export enum CarMaterial {
    Paint = 'paint',
    Accent = 'accent',
    Glass = 'glass',
    Chrome = 'chrome',
    Dark = 'dark',
    /** Lit from within, such as a hover car's under-glow. */
    Glow = 'glow',
}

/** A box added to a body, in the scene's car frame (+x left). */
export type CarDecoration = {
    material: CarMaterial;
    center: Vector3;
    halfSize: Vector3;
};

/** Each preset's own colors for its {@link CarMaterial}s, plus its tires and rims. */
export type CarStyle = Record<CarMaterial, number> & {
    rim: number;
    tire: number;
};

export const carStyles: Readonly<Record<CarPreset, Readonly<CarStyle>>> = {
    [CarPreset.Sedan]: {
        [CarMaterial.Accent]: 0xe8_e8_e8,
        [CarMaterial.Chrome]: 0xd8_dc_e0,
        [CarMaterial.Dark]: 0x1c_1c_20,
        [CarMaterial.Glass]: 0x20_2c_38,
        [CarMaterial.Glow]: 0xff_ff_ff,
        [CarMaterial.Paint]: 0x2e_5f_b8,
        rim: 0xc8_cc_d0,
        tire: 0x18_18_18,
    },
    [CarPreset.Drift]: {
        [CarMaterial.Accent]: 0xff_f0_20,
        [CarMaterial.Chrome]: 0xd8_dc_e0,
        [CarMaterial.Dark]: 0x16_16_1a,
        [CarMaterial.Glass]: 0x18_20_28,
        [CarMaterial.Glow]: 0xff_ff_ff,
        [CarMaterial.Paint]: 0xf4_f4_f4,
        rim: 0xff_c0_20,
        tire: 0x14_14_14,
    },
    [CarPreset.Muscle]: {
        [CarMaterial.Accent]: 0xf0_f0_f0,
        [CarMaterial.Chrome]: 0xe4_e8_ec,
        [CarMaterial.Dark]: 0x14_14_14,
        [CarMaterial.Glass]: 0x1c_24_2c,
        [CarMaterial.Glow]: 0xff_ff_ff,
        [CarMaterial.Paint]: 0xc4_1e_1e,
        rim: 0xe0_e4_e8,
        tire: 0x12_12_12,
    },
    [CarPreset.Stunt]: {
        [CarMaterial.Accent]: 0xff_6a_00,
        [CarMaterial.Chrome]: 0xd0_d4_d8,
        [CarMaterial.Dark]: 0x18_18_20,
        [CarMaterial.Glass]: 0x20_28_34,
        [CarMaterial.Glow]: 0xff_ff_ff,
        [CarMaterial.Paint]: 0x6a_2c_c8,
        rim: 0xff_6a_00,
        tire: 0x18_18_18,
    },
    [CarPreset.Hover]: {
        [CarMaterial.Accent]: 0x20_f0_ff,
        [CarMaterial.Chrome]: 0xc0_c8_d0,
        [CarMaterial.Dark]: 0x10_14_1c,
        [CarMaterial.Glass]: 0x10_30_48,
        [CarMaterial.Glow]: 0x30_d8_ff,
        [CarMaterial.Paint]: 0xb8_c4_d4,
        rim: 0x30_d8_ff,
        tire: 0x10_14_1c,
    },
    [CarPreset.MonsterTruck]: {
        [CarMaterial.Accent]: 0xff_d0_00,
        [CarMaterial.Chrome]: 0xd8_dc_e0,
        [CarMaterial.Dark]: 0x1a_1a_1a,
        [CarMaterial.Glass]: 0x24_30_38,
        [CarMaterial.Glow]: 0xff_ff_ff,
        [CarMaterial.Paint]: 0x2c_9a_3c,
        rim: 0xd8_dc_e0,
        tire: 0x16_16_16,
    },
};

type BodyFacts = ReturnType<typeof getBodyFacts>;

/** The measurements every decoration is placed from, so they follow the preset's own boxes. */
function getBodyFacts(preset: CarPreset) {
    const boxes = carPresets[preset].bodyBoxes;
    const bounds = getBodyBounds(boxes);
    const lower = boxes[0];
    const cabin = boxes[1] ?? boxes[0];

    if (!lower || !cabin) {
        throw new Error(`The ${preset} preset has no body boxes.`);
    }

    return {
        bounds,
        cabinCenter: getSceneBoxCenter(cabin),
        cabinHalfSize: cabin.halfSize,
        lowerBottom: lower.center.y - lower.halfSize.y,
        lowerCenter: getSceneBoxCenter(lower),
        lowerHalfSize: lower.halfSize,
        lowerTop: lower.center.y + lower.halfSize.y,
    };
}

function box({
    material,
    center,
    halfSize,
}: Readonly<{
    material: CarMaterial;
    center: Readonly<Vector3>;
    halfSize: Readonly<Vector3>;
}>): CarDecoration {
    return {
        center,
        halfSize,
        material,
    };
}

function mirrorX(decoration: Readonly<CarDecoration>) {
    return [
        decoration,
        {
            ...decoration,
            center: {
                ...decoration.center,
                x: -decoration.center.x,
            },
        },
    ];
}

/** A strip along the hood and roof, a hair above the paint so it doesn't z-fight. */
function racingStripe(facts: Readonly<BodyFacts>, material: CarMaterial) {
    const hoodStart = facts.cabinCenter.z + facts.cabinHalfSize.z;
    const hoodEnd = facts.bounds.maxZ;
    const lift = 0.006;

    return [
        box({
            material,
            center: {
                x: 0,
                y: facts.lowerTop + lift,
                z: (hoodStart + hoodEnd) / 2,
            },
            halfSize: {
                x: 0.14,
                y: lift,
                z: (hoodEnd - hoodStart) / 2,
            },
        }),
        box({
            material,
            center: {
                x: 0,
                y: facts.bounds.maxY + lift,
                z: facts.cabinCenter.z,
            },
            halfSize: {
                x: 0.14,
                y: lift,
                z: facts.cabinHalfSize.z,
            },
        }),
    ];
}

function bumpers(facts: Readonly<BodyFacts>, material: CarMaterial) {
    const height = (facts.lowerTop - facts.lowerBottom) * 0.22;

    return [
        facts.bounds.maxZ,
        facts.bounds.minZ,
    ].map((z) => {
        return box({
            material,
            center: {
                x: 0,
                y: facts.lowerBottom + height + 0.02,
                z: z + Math.sign(z) * 0.04,
            },
            halfSize: {
                x: facts.lowerHalfSize.x + 0.02,
                y: height,
                z: 0.06,
            },
        });
    });
}

function wing(
    facts: Readonly<BodyFacts>,
    {height, width}: Readonly<{height: number; width: number}>,
) {
    const z = facts.bounds.minZ + 0.3;
    const postHeight = height / 2;

    return [
        box({
            material: CarMaterial.Accent,
            center: {
                x: 0,
                y: facts.lowerTop + height,
                z,
            },
            halfSize: {
                x: width,
                y: 0.03,
                z: 0.24,
            },
        }),
        ...mirrorX(
            box({
                material: CarMaterial.Dark,
                center: {
                    x: width * 0.6,
                    y: facts.lowerTop + postHeight,
                    z: z + 0.04,
                },
                halfSize: {
                    x: 0.03,
                    y: postHeight,
                    z: 0.05,
                },
            }),
        ),
    ];
}

function sideMirrors(facts: Readonly<BodyFacts>) {
    return mirrorX(
        box({
            material: CarMaterial.Dark,
            center: {
                x: facts.cabinHalfSize.x + 0.12,
                y: facts.lowerTop + 0.12,
                z: facts.cabinCenter.z + facts.cabinHalfSize.z - 0.15,
            },
            halfSize: {
                x: 0.1,
                y: 0.06,
                z: 0.07,
            },
        }),
    );
}

const decorators: Readonly<Record<CarPreset, (facts: Readonly<BodyFacts>) => CarDecoration[]>> = {
    [CarPreset.Sedan](facts) {
        return [
            ...bumpers(facts, CarMaterial.Dark),
            ...sideMirrors(facts),
        ];
    },
    [CarPreset.Drift](facts) {
        return [
            ...bumpers(facts, CarMaterial.Dark),
            ...sideMirrors(facts),
            ...racingStripe(facts, CarMaterial.Accent),
            ...wing(facts, {
                height: 0.55,
                width: facts.lowerHalfSize.x * 0.95,
            }),
        ];
    },
    [CarPreset.Muscle](facts) {
        const hoodStart = facts.cabinCenter.z + facts.cabinHalfSize.z;

        return [
            ...bumpers(facts, CarMaterial.Chrome),
            ...sideMirrors(facts),
            ...racingStripe(facts, CarMaterial.Accent),
            box({
                material: CarMaterial.Dark,
                center: {
                    x: 0,
                    y: facts.lowerTop + 0.08,
                    z: hoodStart + (facts.bounds.maxZ - hoodStart) * 0.4,
                },
                halfSize: {
                    x: 0.26,
                    y: 0.08,
                    z: 0.4,
                },
            }),
        ];
    },
    [CarPreset.Stunt](facts) {
        const postX = facts.cabinHalfSize.x * 0.85;
        const postZ = facts.cabinHalfSize.z * 0.8;
        const postHeight = 0.16;

        return [
            ...bumpers(facts, CarMaterial.Dark),
            ...wing(facts, {
                height: 0.75,
                width: facts.lowerHalfSize.x,
            }),
            ...mirrorX(
                box({
                    material: CarMaterial.Accent,
                    center: {
                        x: facts.lowerHalfSize.x + 0.006,
                        y: facts.lowerBottom + (facts.lowerTop - facts.lowerBottom) * 0.55,
                        z: facts.lowerCenter.z,
                    },
                    halfSize: {
                        x: 0.006,
                        y: 0.1,
                        z: facts.lowerHalfSize.z * 0.7,
                    },
                }),
            ),
            box({
                material: CarMaterial.Dark,
                center: {
                    x: 0,
                    y: facts.bounds.maxY + postHeight * 2,
                    z: facts.cabinCenter.z,
                },
                halfSize: {
                    x: postX,
                    y: 0.025,
                    z: postZ,
                },
            }),
            ...[
                -1,
                1,
            ].flatMap((side) => {
                return mirrorX(
                    box({
                        material: CarMaterial.Dark,
                        center: {
                            x: postX,
                            y: facts.bounds.maxY + postHeight,
                            z: facts.cabinCenter.z + side * postZ,
                        },
                        halfSize: {
                            x: 0.025,
                            y: postHeight,
                            z: 0.025,
                        },
                    }),
                );
            }),
        ];
    },
    [CarPreset.Hover](facts) {
        return [
            ...mirrorX(
                box({
                    material: CarMaterial.Glow,
                    center: {
                        x: facts.lowerHalfSize.x + 0.01,
                        y: facts.lowerBottom + 0.1,
                        z: facts.lowerCenter.z,
                    },
                    halfSize: {
                        x: 0.015,
                        y: 0.03,
                        z: facts.lowerHalfSize.z * 0.75,
                    },
                }),
            ),
            ...mirrorX(
                box({
                    material: CarMaterial.Dark,
                    center: {
                        x: 0.5,
                        y: facts.lowerTop + 0.3,
                        z: facts.bounds.minZ + 0.2,
                    },
                    halfSize: {
                        x: 0.03,
                        y: 0.3,
                        z: 0.25,
                    },
                }),
            ),
            box({
                material: CarMaterial.Dark,
                center: {
                    x: 0,
                    y: facts.lowerBottom + 0.02,
                    z: facts.lowerCenter.z,
                },
                halfSize: {
                    x: facts.lowerHalfSize.x * 0.9,
                    y: 0.03,
                    z: facts.lowerHalfSize.z * 0.95,
                },
            }),
        ];
    },
    [CarPreset.MonsterTruck](facts) {
        return [
            ...bumpers(facts, CarMaterial.Chrome),
            ...sideMirrors(facts),
            ...mirrorX(
                box({
                    material: CarMaterial.Chrome,
                    center: {
                        x: 0.45,
                        y: facts.bounds.maxY + 0.2,
                        z: facts.cabinCenter.z - facts.cabinHalfSize.z - 0.1,
                    },
                    halfSize: {
                        x: 0.05,
                        y: 0.35,
                        z: 0.05,
                    },
                }),
            ),
            box({
                material: CarMaterial.Dark,
                center: {
                    x: 0,
                    y: facts.bounds.maxY + 0.07,
                    z: facts.cabinCenter.z + facts.cabinHalfSize.z * 0.6,
                },
                halfSize: {
                    x: facts.cabinHalfSize.x * 0.9,
                    y: 0.07,
                    z: 0.08,
                },
            }),
        ];
    },
};

/** Everything added on top of a preset's body boxes. */
export function getCarDecorations(preset: CarPreset): CarDecoration[] {
    return decorators[preset](getBodyFacts(preset));
}

/** Where the lamps sit, from the body's own extent. Positions are for the left lamp. */
export function getLampPositions(preset: CarPreset) {
    const {bounds, lowerBottom, lowerTop} = getBodyFacts(preset);
    const lampHeight = lowerBottom + (lowerTop - lowerBottom) * 0.62;
    const lampX = bounds.maxX * 0.68;

    return {
        brake: {
            x: lampX,
            y: lampHeight,
            z: bounds.minZ,
        },
        headlight: {
            x: lampX,
            y: lampHeight,
            z: bounds.maxZ,
        },
        reverse: {
            x: lampX * 0.45,
            y: lampHeight,
            z: bounds.minZ,
        },
    };
}
