import {assert} from '@augment-vir/assert';
import {createArray, getObjectTypedValues, selectFrom} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {type CarControls} from '@evir/driving-common';
import {WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {boundaryHalfWidth, createRoadSurface} from '@evir/driving-common/src/road-network.js';
import {Gear} from './drivetrain.js';
import {
    createVehicleState,
    getBodyAxes,
    getBodyLean,
    getTireLoads,
    initialVehicleState,
    recoverVehicle,
    stepVehicle,
    wheelOffsets,
    type VehicleState,
} from './vehicle.js';

const noControls: CarControls = {
    brake: 0,
    handbrake: 0,
    steer: 0,
    throttle: 0,
};

/**
 * A road along x with its curb at z = 5, a sidewalk out to z = 8, a speed bump at x = -50, and a
 * ramp climbing toward +x at x = -200.
 */
const curbedRoad = createRoadSurface({
    curbHeight: 0.15,
    roads: [
        {
            controlPoints: [
                {
                    x: -500,
                    z: 0,
                },
                {
                    x: 500,
                    z: 0,
                },
            ],
            isOpen: true,
            width: 10,
        },
    ],
    ramps: [
        {
            x: -200,
            z: 0,
        },
    ],
    sidewalkWidth: 3,
    speedBumps: [
        {
            x: -50,
            z: 0,
        },
    ],
});

/** The curbed road with a steep ramp, whose crest scrapes the car's floor, at x = -200. */
const steepRoad = createRoadSurface({
    curbHeight: 0.15,
    roads: [
        {
            controlPoints: [
                {
                    x: -500,
                    z: 0,
                },
                {
                    x: 500,
                    z: 0,
                },
            ],
            isOpen: true,
            width: 10,
        },
    ],
    sidewalkWidth: 3,
    steepRamps: [
        {
            x: -200,
            z: 0,
        },
    ],
});

function driveFor({
    controls,
    seconds,
    steer,
    vehicle = initialVehicleState,
    isOnCurbedRoad,
    steepSurface,
}: Readonly<{
    vehicle?: Readonly<VehicleState> | undefined;
    controls: Readonly<Partial<CarControls>>;
    seconds: number;
    /** Overrides `controls.steer` with steering that changes over time. */
    steer?: ((seconds: number) => number) | undefined;
    isOnCurbedRoad?: boolean | undefined;
    /** Drives on the steep ramp's road instead. */
    steepSurface?: boolean | undefined;
}>) {
    const dtSeconds = 1 / 60;

    return createArray(Math.round(seconds / dtSeconds), (index) => index).reduce<VehicleState>(
        (current, index) => {
            return stepVehicle({
                controls: {
                    ...noControls,
                    ...controls,
                    ...(steer
                        ? {
                              steer: steer(index * dtSeconds),
                          }
                        : {}),
                },
                dtSeconds,
                surface: steepSurface ? steepRoad : isOnCurbedRoad ? curbedRoad : undefined,
                vehicle: current,
            });
        },
        vehicle,
    );
}

/** The state at the start and after each tenth of a second of driving on the curbed road. */
function recordEveryTenthSecond({
    count,
    vehicle,
}: Readonly<{count: number; vehicle: Readonly<VehicleState>}>) {
    return createArray(count, (index) => index).reduce<VehicleState[]>(
        (previous) => {
            return [
                ...previous,
                driveFor({
                    controls: {},
                    isOnCurbedRoad: true,
                    seconds: 0.1,
                    vehicle: previous.at(-1),
                }),
            ];
        },
        [
            vehicle,
        ],
    );
}

function getSlideAngle(vehicle: Readonly<VehicleState>) {
    return Math.abs(Math.atan2(vehicle.lateralSpeed, Math.abs(vehicle.speed)));
}

/** A tight turn swings the body sideways even on grip, but the rear tires only slip in a slide. */
function getRearSlipAngle(vehicle: Readonly<VehicleState>) {
    return Math.abs(
        Math.atan2(
            vehicle.lateralSpeed + wheelOffsets[WheelPosition.RearLeft].forward * vehicle.yawRate,
            Math.abs(vehicle.speed),
        ),
    );
}

/** About 110 km/h in a straight line. */
const cruising = driveFor({
    controls: {
        throttle: 1,
    },
    seconds: 8,
});

describe(stepVehicle.name, () => {
    it('stays put with no input', () => {
        const vehicle = driveFor({
            controls: {},
            seconds: 3,
        });

        assert.isBelow(Math.hypot(vehicle.x, vehicle.z, vehicle.heading), 1e-6);
    });

    it('does not creep while steering at a standstill', () => {
        const vehicle = driveFor({
            controls: {
                steer: 1,
            },
            seconds: 3,
        });

        assert.isBelow(Math.hypot(vehicle.x, vehicle.z, vehicle.heading), 1e-6);
    });

    it('drives straight and shifts up on its own', () => {
        assert.isAbove(cruising.speed, 15);
        assert.isBelow(Math.abs(cruising.x), 1e-6);
        assert.notStrictEquals(cruising.drivetrain.gear, Gear.First);
    });

    it('turns no harder than the tires allow and does not spin at full steer', () => {
        const vehicle = driveFor({
            controls: {
                steer: 1,
                throttle: 0.3,
            },
            seconds: 3,
            vehicle: cruising,
        });
        assert.isAbove(Math.abs(vehicle.heading - cruising.heading), 0.8);
        assert.isBelow(Math.abs(vehicle.loadAcceleration.right), 13);
        assert.isBelow(getSlideAngle(vehicle), 0.3);
        assert.isAbove(vehicle.speed, 15);
    });

    it('widens the turn without straightening when easing off the stick', () => {
        const turning = driveFor({
            controls: {
                steer: 1,
                throttle: 0.4,
            },
            seconds: 1.5,
            vehicle: cruising,
        });
        const eased = driveFor({
            controls: {
                steer: 0.5,
                throttle: 0.4,
            },
            seconds: 0.3,
            vehicle: turning,
        });

        assert.isAbove(eased.yawRate, turning.yawRate * 0.4);
        assert.isBelow(eased.yawRate, turning.yawRate);
    });

    it('leans the body out of a turn', () => {
        const vehicle = driveFor({
            controls: {
                steer: 1,
            },
            seconds: 1,
            vehicle: cruising,
        });

        /** Leaning toward the car's left lifts its right side. */
        assert.isAbove(getBodyAxes(vehicle.body.orientation).right.y, 0);
    });

    it('shifts weight onto the front tires under braking', () => {
        const loads = getTireLoads(
            driveFor({
                controls: {
                    brake: 1,
                },
                seconds: 0.5,
                vehicle: cruising,
            }),
        );
        const restingLoads = getTireLoads(initialVehicleState);

        assert.isAbove(loads[WheelPosition.FrontLeft], restingLoads[WheelPosition.FrontLeft] * 1.1);
        assert.isBelow(loads[WheelPosition.RearLeft], restingLoads[WheelPosition.RearLeft] * 0.9);
    });

    it('cannot flick the car around by braking and steering', () => {
        const vehicle = driveFor({
            controls: {
                brake: 1,
            },
            seconds: 3,
            steer(seconds) {
                return Math.sin(seconds * 6) > 0 ? 1 : -1;
            },
            vehicle: cruising,
        });

        assert.isBelow(Math.abs(vehicle.heading - cruising.heading), 0.3);
        assert.isBelow(Math.abs(vehicle.speed), 2);
    });

    it('drifts on throttle in a low-gear turn and straightens on lifting off', () => {
        const rolling = driveFor({
            controls: {
                throttle: 0.5,
            },
            seconds: 3,
        });
        const drifting = driveFor({
            controls: {
                steer: 1,
                throttle: 1,
            },
            seconds: 4,
            vehicle: rolling,
        });

        assert.isAbove(getRearSlipAngle(drifting), 0.5);
        assert.isAbove(drifting.speed, 0);
        assert.isBelow(
            getRearSlipAngle(
                driveFor({
                    controls: {
                        steer: 1,
                    },
                    seconds: 4,
                    vehicle: rolling,
                }),
            ),
            0.2,
        );
        assert.isBelow(
            getRearSlipAngle(
                driveFor({
                    controls: {},
                    seconds: 1,
                    vehicle: drifting,
                }),
            ),
            0.05,
        );
    });

    it('keeps the vehicle state finite through a zero-length frame', () => {
        const vehicle = stepVehicle({
            controls: noControls,
            dtSeconds: 0,
            vehicle: cruising,
        });

        assert.isTrue(
            [
                vehicle.speed,
                vehicle.body.position.x,
                vehicle.body.position.y,
                vehicle.body.position.z,
                getBodyLean(vehicle).height,
            ].every((value) => Number.isFinite(value)),
        );
    });

    it('slides the rear out with the handbrake', () => {
        function getSlide(handbrake: number) {
            return driveFor({
                controls: {
                    handbrake,
                    steer: 0.5,
                },
                seconds: 0.8,
                vehicle: cruising,
            }).lateralSpeed;
        }

        assert.isAbove(Math.abs(getSlide(1)), Math.abs(getSlide(0)) * 3);
    });

    it('scrubs off a handbrake spin instead of spinning on', () => {
        const vehicle = driveFor({
            controls: {
                handbrake: 1,
                steer: 1,
            },
            seconds: 4.5,
            vehicle: cruising,
        });

        assert.isBelow(Math.abs(vehicle.yawRate), 0.5);
        assert.isBelow(Math.hypot(vehicle.speed, vehicle.lateralSpeed), 2);
    });

    it('reverses when holding the brake from a stop', () => {
        const vehicle = driveFor({
            controls: {
                brake: 1,
            },
            seconds: 2,
        });

        assert.strictEquals(vehicle.drivetrain.gear, Gear.Reverse);
        assert.isBelow(vehicle.speed, -2);
    });

    it('bounces off a curb at a crawl but climbs onto the sidewalk with some speed', () => {
        function approachCurb(speed: number) {
            return driveFor({
                controls: {},
                isOnCurbedRoad: true,
                seconds: 3,
                vehicle: createVehicleState({
                    speed,
                }),
            });
        }

        assert.isBelow(approachCurb(2).z, 5);
        assert.isAbove(approachCurb(4).z, 5);
    });

    it('settles level on top of the sidewalk', () => {
        const vehicle = driveFor({
            controls: {},
            isOnCurbedRoad: true,
            seconds: 3,
            vehicle: createVehicleState({
                /** Along the road, so all four wheels sit on the sidewalk. */
                heading: Math.PI / 2,
                /** Slightly above the sidewalk, so it has something to settle from. */
                height: 0.2,
                z: 6.5,
            }),
        });

        assert.isBelow(Math.abs((getBodyLean(vehicle).height ?? 0) - 0.15), 0.01);
        assert.isBelow(Math.abs(getBodyAxes(vehicle.body.orientation).forward.y), 0.01);
    });

    it('glances off a curb it meets at a shallow angle', () => {
        /** Heading a quarter turn faces +x, along the road; this angles a little toward the curb. */
        const heading = Math.PI / 2 - 0.06;
        const vehicle = driveFor({
            controls: {
                throttle: 0.25,
            },
            isOnCurbedRoad: true,
            seconds: 5,
            vehicle: createVehicleState({
                heading,
                speed: 15,
            }),
        });

        assert.isBelow(vehicle.z, 5);
        assert.isAbove(vehicle.heading, heading);
    });

    it('bounces the body over a speed bump without knocking the car off course', () => {
        const states = recordEveryTenthSecond({
            count: 30,
            vehicle: createVehicleState({
                heading: Math.PI / 2,
                speed: 6,
                x: -60,
            }),
        });

        assert.isAbove(Math.max(...states.map((state) => getBodyLean(state).height ?? 0)), 0.03);
        assert.isAbove(states.at(-1)?.x ?? 0, -48);
        assert.isBelow(Math.abs((states.at(-1)?.heading ?? 0) - Math.PI / 2), 0.01);
    });

    it('flies off a ramp with all four wheels in the air and lands without turning', () => {
        const states = recordEveryTenthSecond({
            count: 50,
            vehicle: createVehicleState({
                heading: Math.PI / 2,
                speed: 20,
                x: -230,
            }),
        });

        assert.isTrue(
            states.some((state) => {
                return getObjectTypedValues(state.wheels).every((wheel) => wheel.airSeconds > 0);
            }),
        );
        assert.isBelow(Math.abs((states.at(-1)?.heading ?? 0) - Math.PI / 2), 0.05);
        assert.isBelow(
            Math.abs(getBodyLean(states.at(-1) ?? initialVehicleState).height ?? Infinity),
            0.1,
        );
    });

    it('stops against the side of a ramp instead of being thrown onto it', () => {
        const states = recordEveryTenthSecond({
            count: 20,
            vehicle: createVehicleState({
                /** Straight at the ramp's top from across the sidewalk. */
                heading: Math.PI,
                speed: 20,
                x: -201.5,
                z: 15,
            }),
        });

        assert.isBelow(Math.max(...states.map((state) => getBodyLean(state).height ?? 0)), 0.5);
        assert.isAbove(states.at(-1)?.z ?? 0, 5);
    });

    it('tips over when only one side of the car hits the ramp', () => {
        const states = recordEveryTenthSecond({
            count: 30,
            vehicle: createVehicleState({
                heading: Math.PI / 2,
                speed: 20,
                x: -240,
                /** The left wheels ride the ramp and the right wheels the sidewalk past it. */
                z: 5.5,
            }),
        });

        assert.isBelow(
            Math.min(
                ...states.map((state) => {
                    return getBodyAxes(state.body.orientation).up.y;
                }),
            ),
            0.5,
        );
    });

    it('leaves the ramp off center without being thrown sideways', () => {
        const start = createVehicleState({
            heading: Math.PI / 2,
            speed: 30,
            x: -240,
            z: 2,
        });
        const states = recordEveryTenthSecond({
            count: 60,
            vehicle: start,
        });

        assert.isBelow(Math.max(...states.map((state) => Math.abs(state.z - start.z))), 0.1);
        assert.isAbove(
            Math.min(
                ...states.map((state) => {
                    return getBodyAxes(state.body.orientation).up.y;
                }),
            ),
            0.9,
        );
    });

    it('sets a car stuck on its side back on its wheels', () => {
        const parked = createVehicleState({
            heading: 1,
            height: 1,
        });
        const onSide = driveFor({
            controls: {},
            seconds: 1,
            vehicle: {
                ...parked,
                body: {
                    ...parked.body,
                    /** Rolled a quarter turn about the car's forward axis. */
                    orientation: {
                        w: Math.cos(Math.PI / 4) * Math.cos(0.5),
                        x: Math.sin(Math.PI / 4) * Math.sin(0.5),
                        y: Math.cos(Math.PI / 4) * Math.sin(0.5),
                        z: Math.sin(Math.PI / 4) * Math.cos(0.5),
                    },
                },
            },
        });
        const recovered = driveFor({
            controls: {},
            seconds: 3,
            vehicle: onSide,
        });

        assert.isBelow(getBodyAxes(onSide.body.orientation).up.y, 0.3);
        assert.isAbove(getBodyAxes(recovered.body.orientation).up.y, 0.99);
        assert.isBelow(Math.abs(recovered.heading - 1), 0.1);
    });

    it('puts a car back on its wheels on top of the ramp on demand', () => {
        const moving = createVehicleState({
            heading: Math.PI / 2,
            height: 1.5,
            speed: 15,
            /** All four wheels over the ramp's flat top. */
            x: -201.5,
        });
        const recovered = recoverVehicle({
            getWheelContact: curbedRoad.getWheelContact,
            vehicle: {
                ...moving,
                drivetrain: {
                    ...moving.drivetrain,
                    isAutomatic: false,
                },
            },
        });
        const settled = driveFor({
            controls: {},
            isOnCurbedRoad: true,
            seconds: 1,
            vehicle: recovered,
        });

        assert.deepEquals(
            selectFrom(recovered, {
                drivetrain: {
                    isAutomatic: true,
                },
                speed: true,
            }),
            {
                drivetrain: {
                    isAutomatic: false,
                },
                speed: 0,
            },
        );
        assert.isBelow(Math.abs(recovered.heading - Math.PI / 2), 1e-9);
        assert.isAbove(getBodyAxes(settled.body.orientation).up.y, 0.99);
        assert.isAbove(getBodyLean(settled).height ?? 0, 1.15);
        assert.isAbove(settled.ghostSeconds ?? 0, 0);
        assert.strictEquals(
            driveFor({
                controls: {},
                isOnCurbedRoad: true,
                seconds: 3,
                vehicle: settled,
            }).ghostSeconds,
            0,
        );
    });

    it('soaks up a hard landing instead of bouncing back into the air', () => {
        function isAirborne(state: Readonly<VehicleState>) {
            return getObjectTypedValues(state.wheels).every((wheel) => wheel.airSeconds > 0);
        }

        const states = recordEveryTenthSecond({
            count: 80,
            vehicle: createVehicleState({
                heading: Math.PI / 2,
                speed: 40,
                x: -260,
            }),
        });
        const takeoff = states.findIndex(isAirborne);
        const landing = states.findIndex((state, index) => index > takeoff && !isAirborne(state));

        assert.isAbove(takeoff, 0);
        assert.isAbove(landing, takeoff);
        assert.isBelow(
            Math.max(...states.slice(landing + 1).map((state) => getBodyLean(state).height ?? 0)),
            1,
        );
    });

    it('reports sparks while the body slides on the ground faster than the spark speed', () => {
        const parked = createVehicleState({
            heading: 1,
            height: 1,
        });
        const onSide: VehicleState = {
            ...parked,
            body: {
                ...parked.body,
                orientation: {
                    w: Math.cos(Math.PI / 4) * Math.cos(0.5),
                    x: Math.sin(Math.PI / 4) * Math.sin(0.5),
                    y: Math.cos(Math.PI / 4) * Math.sin(0.5),
                    z: Math.sin(Math.PI / 4) * Math.cos(0.5),
                },
                velocity: {
                    x: 8,
                    y: 0,
                    z: 0,
                },
            },
        };
        const sparkCounts = createArray(60, (index) => index).reduce<{
            sparkCounts: number[];
            vehicle: VehicleState;
        }>(
            ({sparkCounts, vehicle}) => {
                const next = stepVehicle({
                    controls: noControls,
                    dtSeconds: 1 / 60,
                    vehicle,
                });

                return {
                    sparkCounts: [
                        ...sparkCounts,
                        next.sparks?.length ?? 0,
                    ],
                    vehicle: next,
                };
            },
            {
                sparkCounts: [],
                vehicle: onSide,
            },
        ).sparkCounts;

        assert.isAbove(Math.max(...sparkCounts), 0);
    });

    it('scrapes over a steep ramp without launching or stalling the car', () => {
        const states = createArray(40, (index) => index).reduce<VehicleState[]>(
            (previous) => {
                return [
                    ...previous,
                    driveFor({
                        controls: {},
                        seconds: 0.1,
                        steepSurface: true,
                        vehicle: previous.at(-1),
                    }),
                ];
            },
            [
                createVehicleState({
                    heading: Math.PI / 2,
                    speed: 8,
                    x: -215,
                }),
            ],
        );

        assert.isBelow(Math.max(...states.map((state) => getBodyLean(state).height ?? 0)), 1.3);
        assert.isAbove(states.at(-1)?.x ?? 0, -195);
        assert.isAbove(states.at(-1)?.speed ?? 0, 2);
        assert.isAbove(
            Math.min(...states.map((state) => getBodyAxes(state.body.orientation).up.y)),
            0.5,
        );
    });

    it('stops the car against the boundary wall', () => {
        const states = recordEveryTenthSecond({
            count: 40,
            vehicle: createVehicleState({
                heading: Math.PI / 2,
                speed: 30,
                x: boundaryHalfWidth - 30,
            }),
        });

        assert.isBelow(Math.max(...states.map((state) => state.x)), boundaryHalfWidth);
        assert.isBelow(states.at(-1)?.speed ?? Infinity, 0.5);
    });
});
