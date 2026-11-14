import {createArray} from '@augment-vir/common';
import {type WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {
    Container3D,
    CubeGeometry,
    CylinderGeometry,
    Material3D,
    Mesh3D,
    SpotLight,
    TorusGeometry,
    type Geometry3D,
} from '@pixi/3d';
import {getBodyBounds, getSceneBoxCenter, mapWheelPositions, wheelPositions} from './car-layout.js';
import {CarMaterial, carStyles, getCarDecorations, getLampPositions} from './car-style.js';
import {type Vector3} from './physics/vector.js';
import {VehicleKind, carPresets, type CarPreset} from './physics/vehicle-preset.js';

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
    /** Hover pads only: each pad's glowing disc material. */
    padMaterials: Record<WheelPosition, Material3D> | undefined;
    /** In the car frame. */
    engineBay: Vector3;
    exhausts: Vector3[];
};

const tireLugCount = 12;
const tireLugHeight = 0.08;
const hoverPadRadius = 0.4;
const exhaustPipeRadius = 0.05;
/** Meters from the pipe's open end forward into the body. */
const exhaustPipeLength = 0.3;
/** Meters the pipe's dark inside sits back from its open end. */
const exhaustPipeDepth = 0.05;
const exhaustPipeWall = 0.014;

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

function createWheel({
    preset,
    position,
}: Readonly<{
    preset: CarPreset;
    position: WheelPosition;
}>): WheelNode {
    const {vehicle} = carPresets[preset];
    const root = new Container3D();

    if (vehicle.kind !== VehicleKind.Wheeled) {
        return {
            root,
        };
    }

    const wheel = vehicle.wheels[position];
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
            height: wheel.tireWidth,
            radialSegments: 20,
            radiusBottom: wheel.tireRadius,
            radiusTop: wheel.tireRadius,
        }),
        material: tireMaterial,
    });
    const lugGeometry = new CubeGeometry({
        depth: wheel.tireRadius * 0.28,
        height: tireLugHeight,
        width: wheel.tireWidth * 1.04,
    });
    const rim = new Mesh3D({
        geometry: new CylinderGeometry({
            height: wheel.tireWidth * 1.02,
            radialSegments: 16,
            radiusBottom: wheel.rimRadius,
            radiusTop: wheel.rimRadius,
        }),
        material: rimMaterial,
    });
    const spokeGeometry = new CubeGeometry({
        depth: 0.05,
        height: wheel.rimRadius * 1.9,
        width: wheel.tireWidth * 1.08,
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
                    y: Math.cos(angle) * (wheel.tireRadius - tireLugHeight / 2),
                    z: Math.sin(angle) * (wheel.tireRadius - tireLugHeight / 2),
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

/** Builds one preset's car: body, decorations, lamps, wheels or hover pads. */
export function createCarModel(preset: CarPreset): CarModel {
    const tuning = carPresets[preset];
    const materials = createMaterials(preset);
    const group = new Container3D();
    const body = new Container3D();
    const bounds = getBodyBounds(tuning.bodyBoxes);

    tuning.bodyBoxes.forEach((boxTuning, index) => {
        const center = getSceneBoxCenter(boxTuning);
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

    const padMaterials =
        tuning.vehicle.kind === VehicleKind.Hover
            ? mapWheelPositions(() => {
                  return createLampMaterial({
                      color: carStyles[preset][CarMaterial.Glow],
                      strength: 1,
                  });
              })
            : undefined;
    const wheels = mapWheelPositions((position) => {
        const node = createWheel({
            position,
            preset,
        });

        if (padMaterials) {
            node.root.addChild(
                new Mesh3D({
                    geometry: new CylinderGeometry({
                        height: 0.1,
                        radialSegments: 20,
                        radiusBottom: hoverPadRadius,
                        radiusTop: hoverPadRadius,
                    }),
                    material: padMaterials[position],
                }),
            );
        }

        return node;
    });

    const exhausts =
        tuning.vehicle.kind === VehicleKind.Hover
            ? []
            : [
                  -1,
                  1,
              ].map((side) => {
                  /** Half hidden behind the rear bumper's bottom edge, like a real tailpipe. */
                  return {
                      x: 0.45 * side,
                      y: bounds.minY + 0.02,
                      z: bounds.minZ - 0.15,
                  };
              });
    const innerRadius = exhaustPipeRadius - exhaustPipeWall;
    const pipeGeometry = new CylinderGeometry({
        height: exhaustPipeLength,
        openEnded: true,
        radialSegments: 16,
        radiusBottom: exhaustPipeRadius,
        radiusTop: exhaustPipeRadius,
    });
    const pipeLinerGeometry = new CylinderGeometry({
        height: exhaustPipeDepth,
        openEnded: true,
        radialSegments: 16,
        radiusBottom: innerRadius,
        radiusTop: innerRadius,
    });
    /** Seen from inside the pipe, through its open end. */
    const pipeLinerMaterial = new Material3D({
        baseColor: carStyles[preset][CarMaterial.Chrome],
        doubleSided: true,
        metallic: 1,
        roughness: 0.15,
    });
    /** Rounds over the pipe's end between its outside and its liner. */
    const pipeLipGeometry = new TorusGeometry({
        radialSegments: 8,
        radius: exhaustPipeRadius - exhaustPipeWall / 2,
        tube: exhaustPipeWall / 2,
        tubularSegments: 16,
    });
    const pipeInsideGeometry = new CylinderGeometry({
        height: 0.01,
        radialSegments: 16,
        radiusBottom: innerRadius,
        radiusTop: innerRadius,
    });

    exhausts.forEach((exhaust) => {
        const parts = [
            {
                geometry: pipeGeometry,
                material: materials[CarMaterial.Chrome],
                z: exhaust.z + exhaustPipeLength / 2,
            },
            {
                geometry: pipeLinerGeometry,
                material: pipeLinerMaterial,
                z: exhaust.z + exhaustPipeDepth / 2,
            },
            {
                geometry: pipeLipGeometry,
                material: materials[CarMaterial.Chrome],
                z: exhaust.z,
            },
            {
                geometry: pipeInsideGeometry,
                material: materials[CarMaterial.Dark],
                z: exhaust.z + exhaustPipeDepth,
            },
        ].map(({geometry, material, z}) => {
            const part = createBoxMesh({
                center: {
                    ...exhaust,
                    z,
                },
                geometry,
                material,
            });

            /** The cylinder's and torus's axis is y, and a pipe points along the car's z. */
            part.rotation.x = Math.PI / 2;

            return part;
        });

        body.addChild(...parts);
    });

    group.addChild(body, ...wheelPositions.map((position) => wheels[position].root));

    return {
        body,
        engineBay: {
            x: 0,
            y: bounds.maxY * 0.4,
            z: bounds.maxZ - 0.6,
        },
        exhausts,
        group,
        headlights,
        lamps,
        padMaterials,
        wheels,
    };
}
