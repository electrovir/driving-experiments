import {createArray, getObjectTypedEntries} from '@augment-vir/common';
import {roadHeight} from '@evir/driving-common/src/road-network.js';
import {createRoadNetworkMesh} from '@evir/driving-common/src/track-mesh.js';
import {
    Container3D,
    CubeGeometry,
    CylinderGeometry,
    Material3D,
    Mesh3D,
    PlaneGeometry,
    PointLight,
} from '@pixi/3d';
import {Texture} from 'pixi.js';
import {
    arenaHalfWidth,
    arenaLayout,
    garageInterior,
    garageSpawn,
    garageStallWidth,
    garageWallHeight,
    garageWalls,
    turntable,
} from './arena-layout.js';
import {parkingSpots} from './garage-parking.js';
import {carPresets} from './physics/vehicle-preset.js';

const groundSize = 2 * arenaHalfWidth + 10;
const outerWallHeight = 3.5;
const outerWallThickness = 1;
const gridSpacing = 10;

function createBox({
    center,
    material,
    size,
}: Readonly<{
    center: Readonly<{x: number; y: number; z: number}>;
    size: Readonly<{x: number; y: number; z: number}>;
    material: Material3D;
}>) {
    const mesh = new Mesh3D({
        geometry: new CubeGeometry({
            depth: size.z,
            height: size.y,
            width: size.x,
        }),
        material,
    });

    mesh.position.set(center.x, center.y, center.z);

    return mesh;
}

/** A plane lying flat and facing up. */
function createFlatPlane({
    material,
    size,
    x,
    y,
    z,
}: Readonly<{
    material: Material3D;
    size: Readonly<{x: number; z: number}>;
    x: number;
    y: number;
    z: number;
}>) {
    const plane = new Mesh3D({
        geometry: new PlaneGeometry({
            height: size.z,
            width: size.x,
        }),
        material,
    });

    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, y, z);

    return plane;
}

function createGround() {
    const ground = new Container3D();
    const lineMaterial = new Material3D({
        baseColor: 0x8a_a6_6f,
        roughness: 1,
    });
    const lineGeometry = new PlaneGeometry({
        height: groundSize,
        width: 0.15,
    });
    const linesPerSide = Math.floor(groundSize / gridSpacing) + 1;
    const firstLine = -((linesPerSide - 1) * gridSpacing) / 2;

    ground.addChild(
        createFlatPlane({
            material: new Material3D({
                baseColor: 0x6a_8c_4a,
                roughness: 1,
            }),
            size: {
                x: groundSize,
                z: groundSize,
            },
            x: 0,
            y: 0,
            z: 0,
        }),
    );

    createArray(linesPerSide, (index) => firstLine + index * gridSpacing).forEach((offset) => {
        const alongZ = new Mesh3D({
            geometry: lineGeometry,
            material: lineMaterial,
        });
        const alongX = new Mesh3D({
            geometry: lineGeometry,
            material: lineMaterial,
        });

        alongZ.position.set(offset, 0.01, 0);
        alongZ.rotation.x = -Math.PI / 2;
        alongX.position.set(0, 0.01, offset);
        alongX.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        ground.addChild(alongZ, alongX);
    });

    const wallMaterial = new Material3D({
        baseColor: 0x9a_96_8e,
        roughness: 0.9,
    });
    const wallLength = 2 * (arenaHalfWidth + outerWallThickness);

    [
        -1,
        1,
    ].forEach((side) => {
        const center = side * (arenaHalfWidth + outerWallThickness / 2);

        ground.addChild(
            createBox({
                center: {
                    x: center,
                    y: outerWallHeight / 2,
                    z: 0,
                },
                material: wallMaterial,
                size: {
                    x: outerWallThickness,
                    y: outerWallHeight,
                    z: wallLength,
                },
            }),
            createBox({
                center: {
                    x: 0,
                    y: outerWallHeight / 2,
                    z: center,
                },
                material: wallMaterial,
                size: {
                    x: wallLength,
                    y: outerWallHeight,
                    z: outerWallThickness,
                },
            }),
        );
    });

    return ground;
}

function createSignTexture(text: string) {
    const canvas = globalThis.document.createElement('canvas');

    canvas.width = 512;
    canvas.height = 96;

    const context = canvas.getContext('2d');

    if (context) {
        context.fillStyle = '#1b2430';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = '#ffc928';
        context.lineWidth = 6;
        context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
        context.fillStyle = '#ffc928';
        context.font = 'bold 64px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2 + 4, canvas.width - 40);
    }

    return Texture.from(canvas);
}

function createSign({
    height,
    text,
    width,
}: Readonly<{text: string; width: number; height: number}>) {
    const texture = createSignTexture(text);

    return new Mesh3D({
        geometry: new PlaneGeometry({
            flipV: true,
            height,
            width,
        }),
        material: new Material3D({
            baseColor: 0xff_ff_ff,
            baseColorTexture: texture,
            emissive: {
                strength: 1.2,
                texture,
            },
        }),
    });
}

function createGarage() {
    const garage = new Container3D();
    const wallMaterial = new Material3D({
        baseColor: 0x2f_6f_b8,
        roughness: 0.5,
    });
    const roofMaterial = new Material3D({
        baseColor: 0x4a_50_58,
        roughness: 0.8,
    });
    const lightStripMaterial = new Material3D({
        baseColor: 0xff_ff_ff,
        emissive: {
            color: 0xff_f4_dc,
            strength: 3,
        },
    });
    const fasciaHeight = 0.9;
    const frontZ = garageInterior.center.z + garageInterior.halfSize.z;
    const backZ = garageInterior.center.z - garageInterior.halfSize.z;
    const outerHalfWidth = Math.max(
        ...garageWalls.map(
            (wall) => Math.abs(wall.center.x - garageInterior.center.x) + wall.halfSize.x,
        ),
    );

    garageWalls.forEach((wall) => {
        garage.addChild(
            createBox({
                center: {
                    x: wall.center.x,
                    y: wall.height / 2,
                    z: wall.center.z,
                },
                material: wallMaterial,
                size: {
                    x: wall.halfSize.x * 2,
                    y: wall.height,
                    z: wall.halfSize.z * 2,
                },
            }),
        );
    });

    /**
     * The roof is one-sided, so it hides the sky from above but leaves the camera a view from
     * below.
     */
    garage.addChild(
        createFlatPlane({
            material: roofMaterial,
            size: {
                x: outerHalfWidth * 2,
                z: garageInterior.halfSize.z * 2,
            },
            x: garageInterior.center.x,
            y: garageWallHeight,
            z: garageInterior.center.z,
        }),
        ...[
            frontZ,
            backZ,
        ].map((z) => {
            return createBox({
                center: {
                    x: garageInterior.center.x,
                    y: garageWallHeight - fasciaHeight / 2,
                    z,
                },
                material: roofMaterial,
                size: {
                    x: outerHalfWidth * 2,
                    y: fasciaHeight,
                    z: 0.3,
                },
            });
        }),
    );

    const garageSign = createSign({
        height: 0.7,
        text: 'GARAGE',
        width: 3.6,
    });

    garageSign.position.set(
        garageInterior.center.x,
        garageWallHeight - fasciaHeight / 2,
        frontZ + 0.17,
    );
    garage.addChild(garageSign);

    getObjectTypedEntries(parkingSpots).forEach(
        ([
            preset,
            spot,
        ]) => {
            const sign = createSign({
                height: 0.6,
                text: carPresets[preset].label.toUpperCase(),
                width: garageStallWidth - 0.6,
            });

            sign.position.set(spot.point.x, garageWallHeight - fasciaHeight / 2, backZ - 0.17);
            /** Faces the apron, where drivers pick a stall. */
            sign.rotation.set(0, Math.PI, 0);
            garage.addChild(
                sign,
                createBox({
                    center: {
                        x: spot.point.x,
                        y: garageWallHeight - fasciaHeight - 0.08,
                        z: garageInterior.center.z,
                    },
                    material: lightStripMaterial,
                    size: {
                        x: 0.3,
                        y: 0.1,
                        z: garageInterior.halfSize.z * 1.6,
                    },
                }),
            );

            const light = new PointLight({
                color: 0xff_f0_d8,
                intensity: 6,
                range: 10,
            });

            light.position.set(spot.point.x, garageWallHeight - 1.4, garageInterior.center.z);
            garage.addChild(light);
        },
    );

    /** Turntable: a pale ring around a dark disc where the car appears. */
    [
        {
            ...turntable.ring,
            color: 0xd8_d8_d0,
        },
        {
            ...turntable.disc,
            color: 0x2a_2c_30,
        },
    ].forEach(({color, height, radius}) => {
        const disc = new Mesh3D({
            geometry: new CylinderGeometry({
                height,
                radialSegments: 48,
                radiusBottom: radius,
                radiusTop: radius,
            }),
            material: new Material3D({
                baseColor: color,
                roughness: 0.6,
            }),
        });

        disc.position.set(garageSpawn.point.x, roadHeight + height / 2, garageSpawn.point.z);
        garage.addChild(disc);
    });

    return garage;
}

/** Everything that stays put: ground, roads, boundary walls, and the garage building. */
export function createGarageWorld() {
    const world = new Container3D();

    world.addChild(createGround(), createRoadNetworkMesh(arenaLayout), createGarage());

    return world;
}
