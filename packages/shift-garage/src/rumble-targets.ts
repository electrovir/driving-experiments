import {clamp, getObjectTypedValues, mapObjectValues} from '@augment-vir/common';
import {type WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {type CarPreset} from './physics/vehicle-preset.js';
import {type VehicleView} from './vehicle-view.js';

function clamp01(value: number) {
    return clamp(value, {
        max: 1,
        min: 0,
    });
}

/** The two motors of a dual-rumble gamepad, each from 0 to 1. */
export type Rumble = {
    /** The heavy, low motor. */
    strong: number;
    /** The light, buzzing motor. */
    weak: number;
};

/** What {@link getRumble} carries from one frame to the next. */
export type RumbleSnapshot = {
    preset: CarPreset;
    groundedWheelCount: number;
    isShifting: boolean;
    compressions: Readonly<Record<WheelPosition, number>>;
    /** Jolts from earlier frames, still fading out. */
    pulse: Rumble;
};

/** Each second, a jolt keeps this fraction of its strength. */
const pulseKeptPerSecond = 0.0005;
/** Slip at which a spinning wheel starts to buzz, and the slip at which it buzzes fully. */
const spinStartSlip = 0.5;
const spinFullSlip = 4;
/** Strong-motor strength per unit of suspension compression gained or lost in one frame. */
const bumpGain = 3;

const silent: Rumble = {
    strong: 0,
    weak: 0,
};

function maxRumble(rumbles: ReadonlyArray<Readonly<Rumble>>): Rumble {
    return rumbles.reduce((strongest, rumble) => {
        return {
            strong: Math.max(strongest.strong, rumble.strong),
            weak: Math.max(strongest.weak, rumble.weak),
        };
    }, silent);
}

/**
 * How hard to rumble the gamepad this frame. Spinning wheels buzz for as long as it lasts;
 * landings, curbs and bumps, crashes, and gear shifts each give a jolt that fades out over the next
 * frames. With no previous snapshot, or right after the preset changed, only spinning wheels and
 * crashes count.
 */
export function getRumble({
    msSinceLastFrame,
    previous,
    view,
}: Readonly<{
    msSinceLastFrame: number;
    previous: Readonly<RumbleSnapshot> | undefined;
    view: Readonly<
        Pick<VehicleView, 'preset' | 'engine' | 'wheels' | 'groundedWheelCount' | 'impacts'>
    >;
}>) {
    const isContinuing = previous != undefined && previous.preset === view.preset;
    const wheels = getObjectTypedValues(view.wheels);
    const spinSlip = Math.max(
        0,
        ...wheels.filter((wheel) => wheel.isGrounded).map((wheel) => wheel.slip),
    );
    const spin: Rumble = {
        strong: 0,
        weak: clamp01((spinSlip - spinStartSlip) / (spinFullSlip - spinStartSlip)) * 0.5,
    };
    const crash = maxRumble(
        view.impacts.map((impact) => {
            const amount = clamp01(impact.speed * 0.1);

            return {
                strong: amount,
                weak: amount * (impact.isCrash ? 1 : 0.6),
            };
        }),
    );
    const bump: Rumble = isContinuing
        ? {
              strong: clamp01(
                  bumpGain *
                      Math.max(
                          ...getObjectTypedValues(
                              mapObjectValues(view.wheels, (position, wheel) => {
                                  return wheel.isGrounded
                                      ? Math.abs(
                                            wheel.compression - previous.compressions[position],
                                        )
                                      : 0;
                              }),
                          ),
                      ),
              ),
              weak: 0,
          }
        : silent;
    const landing: Rumble =
        isContinuing && !previous.groundedWheelCount && view.groundedWheelCount
            ? {
                  strong: 0.7,
                  weak: 0.3,
              }
            : silent;
    const shift: Rumble =
        isContinuing && view.engine.isShifting && !previous.isShifting
            ? {
                  strong: 0,
                  weak: 0.35,
              }
            : silent;
    const kept = isContinuing ? pulseKeptPerSecond ** (msSinceLastFrame / 1000) : 0;
    const pulse = maxRumble([
        {
            strong: (previous?.pulse.strong ?? 0) * kept,
            weak: (previous?.pulse.weak ?? 0) * kept,
        },
        crash,
        bump,
        landing,
        shift,
    ]);

    return {
        rumble: maxRumble([
            pulse,
            spin,
        ]),
        snapshot: {
            compressions: mapObjectValues(view.wheels, (position, wheel) => wheel.compression),
            groundedWheelCount: view.groundedWheelCount,
            isShifting: view.engine.isShifting,
            preset: view.preset,
            pulse,
        } satisfies RumbleSnapshot,
    };
}
