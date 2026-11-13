import {createArray} from '@augment-vir/common';
import {type WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {
    Container3D,
    CubeGeometry,
    CylinderGeometry,
    Material3D,
    Mesh3D,
    SpotLight,
    type Geometry3D,
} from '@pixi/3d';
import {getBodyBounds, mapWheelPositions, wheelPositions} from './car-layout.js';
import {CarMaterial, carStyles, getCarDecorations, getLampPositions} from './car-style.js';
import {type Vector3} from './physics/vector.js';
import {carPresets, type CarPreset} from './physics/vehicle-preset.js';

export type WheelNode = {
    root: Container3D;
};

export type CarModel = {
    /** Holds everything for this preset, so it can be hidden while another car is out. */
    group: Container3D;
    /** Follows the body's pose. */
    body: Container3D;
    wheels: Record<WheelPosition, WheelNode>;
    lamps: Record<'brake' | 'headlight' | 'reverse', Material3D>;
    headlights: SpotLight[];
    exhausts: Vector3[];
};

const tireLugCount = 12;

function createMaterials(preset: CarPreset) {
    const style = carStyles[preset];
    const materials: Record<CarMaterial, Material3D> = {
        [CarMaterial.Accent]: new Material3D({
            baseColor: style[CarMaterial.Accent],
            roughness: 0.4,
        }),
        [CarMaterial.Chrome]: new Material3D({
            baseColor: style[CarMaterial.Chrome],
            metallic: 1,
            roughness: 0.15,
        }),
        [CarMaterial.Dark]: new Material3D({
            baseColor: style[CarMaterial.Dark],
            roughness: 0.8,
        }),
        [CarMaterial.Glass]: new Material3D({
            baseColor: style[CarMaterial.Glass],
            metallic: 0.5,
            roughness: 0.1,
        }),
        [CarMaterial.Glow]: new Material3D({
            baseColor: style[CarMaterial.Glow],
            emissive: {
                color: style[CarMaterial.Glow],
                strength: 2.5,
            },
            roughness: 0.4,
        }),
        [CarMaterial.Paint]: new Material3D({
            baseColor: style[CarMaterial.Paint],
            metallic: 0.3,
            roughness: 0.35,
        }),
    };

    return materials;
}

function createLampMaterial({color, strength}: Readonly<{color: number; strength: number}>) {
    return new Material3D({
        baseColor: color,
        emissive: {
            color,
            strength,
        },
        roughness: 0.3,
    });
}

function createBoxMesh({
    center,
    geometry,
    material,
}: Readonly<{
    geometry: Geometry3D;
    material: Material3D;
    center: Readonly<Vector3>;
}>) {
    const mesh = new Mesh3D({
        geometry,
        material,
    });

    mesh.position.set(center.x, center.y, center.z);

    return mesh;
}

function createWheel(preset: CarPreset): WheelNode {
    const root = new Container3D();
    const wheel = carPresets[preset].tire;
    const style = carStyles[preset];
    const tireMaterial = new Material3D({
        baseColor: style.tire,
        roughness: 0.95,
    });
    const rimMaterial = new Material3D({
        baseColor: style.rim,
        metallic: 0.8,
        roughness: 0.25,
    });
    const tire = new Container3D();
    const tread = new Mesh3D({
        geometry: new CylinderGeometry({
            height: wheel.width,
            radialSegments: 20,
            radiusBottom: wheel.radius,
            radiusTop: wheel.radius,
        }),
        material: tireMaterial,
    });
    const lugGeometry = new CubeGeometry({
        depth: wheel.radius * 0.28,
        height: 0.08,
        width: wheel.width * 1.04,
    });
    const rim = new Mesh3D({
        geometry: new CylinderGeometry({
            height: wheel.width * 1.02,
            radialSegments: 16,
            radiusBottom: wheel.rimRadius,
            radiusTop: wheel.rimRadius,
        }),
        material: rimMaterial,
    });
    const spokeGeometry = new CubeGeometry({
        depth: 0.05,
        height: wheel.rimRadius * 1.9,
        width: wheel.width * 1.08,
    });

    /** The cylinder's axis is y, and the wheel's axle is x. */
    tread.rotation.z = Math.PI / 2;
    rim.rotation.z = Math.PI / 2;
    tire.addChild(
        tread,
        ...createArray(tireLugCount, (index) => {
            const angle = (index / tireLugCount) * Math.PI * 2;
            const lug = createBoxMesh({
                center: {
                    x: 0,
                    y: Math.cos(angle) * wheel.radius,
                    z: Math.sin(angle) * wheel.radius,
                },
                geometry: lugGeometry,
                material: tireMaterial,
            });

            lug.rotation.x = angle;

            return lug;
        }),
    );
    root.addChild(
        tire,
        rim,
        ...createArray(2, (index) => {
            const spoke = new Mesh3D({
                geometry: spokeGeometry,
                material: rimMaterial,
            });

            spoke.rotation.x = (index * Math.PI) / 2;

            return spoke;
        }),
    );

    return {
        root,
    };
}

/** Builds one preset's car: body, decorations, lamps, and wheels. */
export function createCarModel(preset: CarPreset): CarModel {
    const tuning = carPresets[preset];
    const materials = createMaterials(preset);
    const group = new Container3D();
    const body = new Container3D();
    const bounds = getBodyBounds(tuning.bodyBoxes);

    tuning.bodyBoxes.forEach((boxTuning, index) => {
        const center = boxTuning.center;
        const size = {
            x: boxTuning.halfSize.x * 2,
            y: boxTuning.halfSize.y * 2,
            z: boxTuning.halfSize.z * 2,
        };
        const geometry = new CubeGeometry({
            depth: size.z,
            height: size.y,
            width: size.x,
        });

        body.addChild(
            createBoxMesh({
                center,
                geometry,
                material: index ? materials[CarMaterial.Glass] : materials[CarMaterial.Paint],
            }),
        );

        if (index) {
            /** The cabin's glass box gets a painted roof. */
            body.addChild(
                createBoxMesh({
                    center: {
                        ...center,
                        y: center.y + boxTuning.halfSize.y + 0.012,
                    },
                    geometry: new CubeGeometry({
                        depth: size.z * 0.85,
                        height: 0.024,
                        width: size.x * 0.92,
                    }),
                    material: materials[CarMaterial.Paint],
                }),
            );
        }
    });

    getCarDecorations(preset).forEach((decoration) => {
        body.addChild(
            createBoxMesh({
                center: decoration.center,
                geometry: new CubeGeometry({
                    depth: decoration.halfSize.z * 2,
                    height: decoration.halfSize.y * 2,
                    width: decoration.halfSize.x * 2,
                }),
                material: materials[decoration.material],
            }),
        );
    });

    const lamps = {
        brake: createLampMaterial({
            color: 0xff_10_10,
            strength: 0.4,
        }),
        headlight: createLampMaterial({
            color: 0xff_f2_d0,
            strength: 0.15,
        }),
        reverse: createLampMaterial({
            color: 0xff_ff_ff,
            strength: 0,
        }),
    };
    const lampPositions = getLampPositions(preset);
    const lampGeometry = {
        brake: new CubeGeometry({
            depth: 0.04,
            height: 0.12,
            width: 0.3,
        }),
        headlight: new CubeGeometry({
            depth: 0.04,
            height: 0.12,
            width: 0.26,
        }),
        reverse: new CubeGeometry({
            depth: 0.04,
            height: 0.08,
            width: 0.12,
        }),
    };
    const lampKinds: ReadonlyArray<keyof typeof lamps> = tuning.hasHeadlights
        ? [
              'brake',
              'headlight',
              'reverse',
          ]
        : [
              'brake',
              'reverse',
          ];

    lampKinds.forEach((kind) => {
        [
            -1,
            1,
        ].forEach((side) => {
            body.addChild(
                createBoxMesh({
                    center: {
                        ...lampPositions[kind],
                        x: lampPositions[kind].x * side,
                    },
                    geometry: lampGeometry[kind],
                    material: lamps[kind],
                }),
            );
        });
    });

    const headlights = tuning.hasHeadlights
        ? [
              -1,
              1,
          ].map((side) => {
              /** A light shines along its own -z, so the aim container turns it to the car's +z. */
              const aim = new Container3D();
              const light = new SpotLight({
                  color: 0xff_f2_d0,
                  coneAngle: 28,
                  intensity: 30,
                  penumbra: 0.4,
                  range: 45,
              });

              aim.position.set(
                  lampPositions.headlight.x * side,
                  lampPositions.headlight.y,
                  lampPositions.headlight.z + 0.1,
              );
              aim.rotation.y = Math.PI;
              light.rotation.x = -0.08;
              aim.addChild(light);
              body.addChild(aim);

              return light;
          })
        : [];

    const wheels = mapWheelPositions(() => {
        return createWheel(preset);
    });

    group.addChild(body, ...wheelPositions.map((position) => wheels[position].root));

    return {
        body,
        exhausts: [
            -1,
            1,
        ].map((side) => {
            return {
                x: 0.4 * side,
                y: bounds.minY + 0.25,
                z: bounds.minZ - 0.1,
            };
        }),
        group,
        headlights,
        lamps,
        wheels,
    };
}
