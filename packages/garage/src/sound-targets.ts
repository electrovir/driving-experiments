import {clamp, getObjectTypedKeys, getObjectTypedValues} from '@augment-vir/common';
import {type WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {type AnyDuration} from 'date-vir';
import {CarPreset, VehicleKind, carPresets} from './physics/vehicle-preset.js';
import {type VehicleView} from './vehicle-view.js';

function clamp01(value: number) {
    return clamp(value, {
        max: 1,
        min: 0,
    });
}

function lerp({from, to, amount}: Readonly<{from: number; to: number; amount: number}>) {
    return from + (to - from) * amount;
}

export type EngineOscillatorVoice = {
    type: OscillatorType;
    /** Multiple of the engine's fundamental frequency. */
    ratio: number;
    gain: number;
};

export type EngineVoice = {
    oscillators: ReadonlyArray<Readonly<EngineOscillatorVoice>>;
    /**
     * Fundamental frequency in Hz at `engine.pitch` 0 and 1, the counterpart of RVP's min and max
     * pitch.
     */
    minHz: number;
    maxHz: number;
    /** The lowpass cutoff as a multiple of the fundamental, coasting and at full throttle. */
    filterRatioIdle: number;
    filterRatioFull: number;
    filterQ: number;
    /** How deeply the engine's loudness pulses, from 0 (steady) to 0.5. */
    lopeDepth: number;
    lopeHz: number;
    gainScale: number;
};

export const engineVoices: Readonly<Record<CarPreset, Readonly<EngineVoice>>> = {
    [CarPreset.Sedan]: {
        filterQ: 0.7,
        filterRatioFull: 8,
        filterRatioIdle: 3,
        gainScale: 1,
        lopeDepth: 0,
        lopeHz: 0,
        maxHz: 150,
        minHz: 38,
        oscillators: [
            {
                gain: 1,
                ratio: 1,
                type: 'sawtooth',
            },
            {
                gain: 0.5,
                ratio: 0.5,
                type: 'square',
            },
        ],
    },
    [CarPreset.Muscle]: {
        filterQ: 1.2,
        filterRatioFull: 6,
        filterRatioIdle: 2.5,
        gainScale: 1.15,
        lopeDepth: 0.3,
        lopeHz: 7,
        maxHz: 100,
        minHz: 26,
        oscillators: [
            {
                gain: 1,
                ratio: 1,
                type: 'sawtooth',
            },
            {
                gain: 0.8,
                ratio: 0.5,
                type: 'square',
            },
            {
                gain: 0.4,
                ratio: 1.02,
                type: 'square',
            },
        ],
    },
    [CarPreset.Drift]: {
        filterQ: 4,
        filterRatioFull: 14,
        filterRatioIdle: 5,
        gainScale: 0.95,
        lopeDepth: 0.08,
        lopeHz: 19,
        maxHz: 230,
        minHz: 48,
        oscillators: [
            {
                gain: 1,
                ratio: 1,
                type: 'sawtooth',
            },
            {
                gain: 0.6,
                ratio: 1.01,
                type: 'sawtooth',
            },
            {
                gain: 0.3,
                ratio: 2,
                type: 'square',
            },
        ],
    },
    [CarPreset.Stunt]: {
        filterQ: 2,
        filterRatioFull: 12,
        filterRatioIdle: 4,
        gainScale: 0.9,
        lopeDepth: 0,
        lopeHz: 0,
        maxHz: 300,
        minHz: 62,
        oscillators: [
            {
                gain: 1,
                ratio: 1,
                type: 'sawtooth',
            },
            {
                gain: 0.4,
                ratio: 2,
                type: 'triangle',
            },
        ],
    },
    [CarPreset.MonsterTruck]: {
        filterQ: 1.5,
        filterRatioFull: 5,
        filterRatioIdle: 2,
        gainScale: 1.25,
        lopeDepth: 0.18,
        lopeHz: 4,
        maxHz: 72,
        minHz: 20,
        oscillators: [
            {
                gain: 1,
                ratio: 1,
                type: 'sawtooth',
            },
            {
                gain: 1,
                ratio: 0.5,
                type: 'square',
            },
            {
                gain: 0.5,
                ratio: 0.25,
                type: 'sine',
            },
        ],
    },
    [CarPreset.Hover]: {
        filterQ: 1,
        filterRatioFull: 6,
        filterRatioIdle: 3,
        gainScale: 0.8,
        lopeDepth: 0,
        lopeHz: 0,
        maxHz: 560,
        minHz: 140,
        oscillators: [
            {
                gain: 1,
                ratio: 1,
                type: 'sine',
            },
            {
                gain: 0.45,
                ratio: 2.01,
                type: 'sine',
            },
            {
                gain: 0.25,
                ratio: 3.02,
                type: 'triangle',
            },
        ],
    },
};

export type EngineTargets = {
    /** An engine with no health left is silent. */
    isAudible: boolean;
    /** Fundamental frequency in Hz. */
    frequency: number;
    filterFrequency: number;
    gain: number;
};

/**
 * RVP's engine sound: pitch from min to max by `engine.pitch`, volume `0.3 + 0.7 × pitch`. Damaged
 * cars that can be damaged also wobble in pitch, faster and wider as health drops.
 */
export function getEngineTargets({
    view,
    timeSeconds,
}: Readonly<{
    view: Readonly<Pick<VehicleView, 'preset' | 'engine' | 'health'>>;
    timeSeconds: number;
}>): EngineTargets {
    const voice = engineVoices[view.preset];
    const damage = 1 - view.health;
    const wobble = carPresets[view.preset].hasDamage
        ? 1 + Math.sin(timeSeconds * 200 * damage) * damage * 0.1
        : 1;
    const frequency =
        lerp({
            amount: clamp01(view.engine.pitch),
            from: voice.minHz,
            to: voice.maxHz,
        }) * wobble;

    return {
        filterFrequency:
            frequency *
            lerp({
                amount: clamp01(view.engine.throttle),
                from: voice.filterRatioIdle,
                to: voice.filterRatioFull,
            }),
        frequency,
        gain: (0.3 + 0.7 * clamp01(view.engine.pitch)) * voice.gainScale,
        isAudible: view.health > 0,
    };
}

/**
 * Slip at which tires start to screech, and the slip at which the screech is fully on. Ordinary
 * cornering and launches slip a little past the start and a handbrake slide reaches full, so the
 * screech grows with how hard the car slides instead of always being at full.
 */
const screechStartSlip = 0.5;
const screechFullSlip = 6;

export type ScreechTargets = {
    /** From 0 (silent) to 1. */
    gain: number;
    /** How fast the screech recording plays, where 1 is its recorded pitch. */
    playbackRate: number;
    /** Whether the loudest wheel is skidding on its rim. */
    isRim: boolean;
};

/**
 * Same as RVP's `TireScreech`: the strongest slip among attached wheels sets volume and pitch, and
 * volume fades when fewer wheels touch the ground. Hover cars have no tires, so they never
 * screech.
 */
export function getScreechTargets({
    view,
}: Readonly<{
    view: Readonly<Pick<VehicleView, 'preset' | 'wheels' | 'groundedWheelCount'>>;
}>): ScreechTargets {
    const silent: ScreechTargets = {
        gain: 0,
        isRim: false,
        playbackRate: 1,
    };
    if (carPresets[view.preset].vehicle.kind === VehicleKind.Hover) {
        return silent;
    }

    const wheels = getObjectTypedValues(view.wheels).filter(
        (wheel) => wheel.isGrounded && !wheel.isDetached,
    );
    const loudest = wheels.reduce<Readonly<(typeof wheels)[number]> | undefined>(
        (best, wheel) => (best == undefined || wheel.slip > best.slip ? wheel : best),
        undefined,
    );
    if (!loudest) {
        return silent;
    }

    const amount = clamp01(
        (loudest.slip - screechStartSlip) / (screechFullSlip - screechStartSlip),
    );
    if (!amount) {
        return silent;
    }

    const groundedFraction = view.groundedWheelCount / getObjectTypedKeys(view.wheels).length;

    return {
        gain: amount * clamp01(groundedFraction),
        isRim: loudest.isTirePopped,
        playbackRate: 0.75 + amount * 0.4,
    };
}

/** Speed in meters per second at which the wind is at full volume. */
const windFullSpeed = 45;

export type WindTargets = {
    gain: number;
    filterFrequency: number;
};

export function getWindTargets({
    view,
}: Readonly<{
    view: Readonly<Pick<VehicleView, 'velocity'>>;
}>): WindTargets {
    const amount = clamp01(
        Math.hypot(view.velocity.x, view.velocity.y, view.velocity.z) / windFullSpeed,
    );

    return {
        filterFrequency: 300 + amount * 900,
        gain: amount ** 3 * 0.04,
    };
}

/** The sounds that play once, each from its own recipe in {@link oneShotRecipes}. */
export enum OneShotSound {
    Crash = 'crash',
    Scrape = 'scrape',
    ShiftBlip = 'shift-blip',
    BoostStart = 'boost-start',
    BoostEnd = 'boost-end',
    TirePop = 'tire-pop',
    WheelDetach = 'wheel-detach',
}

export type OneShotRecipe = {
    /** A burst of filtered noise whose filter sweeps from `startHz` to `endHz`. */
    noise?: {
        filterType: BiquadFilterType;
        startHz: number;
        endHz: number;
        q: number;
        peakGain: number;
        duration: AnyDuration;
    };
    /** A tone whose pitch glides from `startHz` to `endHz`. */
    tone?: {
        type: OscillatorType;
        startHz: number;
        endHz: number;
        peakGain: number;
        duration: AnyDuration;
    };
};

export const oneShotRecipes: Readonly<Record<OneShotSound, Readonly<OneShotRecipe>>> = {
    [OneShotSound.Crash]: {
        noise: {
            duration: {
                milliseconds: 650,
            },
            endHz: 180,
            filterType: 'lowpass',
            peakGain: 1,
            q: 0.8,
            startHz: 2600,
        },
        tone: {
            duration: {
                milliseconds: 350,
            },
            endHz: 38,
            peakGain: 1,
            startHz: 110,
            type: 'sine',
        },
    },
    [OneShotSound.Scrape]: {
        noise: {
            duration: {
                milliseconds: 220,
            },
            endHz: 1800,
            filterType: 'bandpass',
            peakGain: 0.5,
            q: 2.5,
            startHz: 2800,
        },
    },
    [OneShotSound.ShiftBlip]: {
        noise: {
            duration: {
                milliseconds: 110,
            },
            endHz: 600,
            filterType: 'bandpass',
            peakGain: 0.12,
            q: 1.5,
            startHz: 1800,
        },
    },
    [OneShotSound.BoostStart]: {
        noise: {
            duration: {
                milliseconds: 600,
            },
            endHz: 2600,
            filterType: 'bandpass',
            peakGain: 0.7,
            q: 1.2,
            startHz: 300,
        },
    },
    [OneShotSound.BoostEnd]: {
        noise: {
            duration: {
                milliseconds: 380,
            },
            endHz: 300,
            filterType: 'bandpass',
            peakGain: 0.45,
            q: 1.2,
            startHz: 1800,
        },
    },
    [OneShotSound.TirePop]: {
        noise: {
            duration: {
                milliseconds: 160,
            },
            endHz: 900,
            filterType: 'highpass',
            peakGain: 1,
            q: 0.7,
            startHz: 5000,
        },
        tone: {
            duration: {
                milliseconds: 140,
            },
            endHz: 45,
            peakGain: 0.9,
            startHz: 180,
            type: 'sine',
        },
    },
    [OneShotSound.WheelDetach]: {
        noise: {
            duration: {
                milliseconds: 260,
            },
            endHz: 250,
            filterType: 'lowpass',
            peakGain: 0.7,
            q: 1,
            startHz: 1600,
        },
        tone: {
            duration: {
                milliseconds: 420,
            },
            endHz: 70,
            peakGain: 0.8,
            startHz: 260,
            type: 'triangle',
        },
    },
};

export type OneShotEvent = {
    sound: OneShotSound;
    /** From 0 to 1; scales the recipe's peak gains. */
    volume: number;
};

/** What {@link getSoundEvents} remembers from the previous frame to find edges. */
export type SoundSnapshot = {
    preset: CarPreset;
    isShifting: boolean;
    isBoosting: boolean;
    poppedWheels: ReadonlyArray<WheelPosition>;
    detachedWheels: ReadonlyArray<WheelPosition>;
};

function getFlaggedWheels(
    wheels: VehicleView['wheels'],
    isFlagged: (wheel: Readonly<VehicleView['wheels'][WheelPosition]>) => boolean,
) {
    return getObjectTypedKeys(wheels).filter((position) => isFlagged(wheels[position]));
}

export function createSoundSnapshot(
    view: Readonly<Pick<VehicleView, 'preset' | 'engine' | 'boost' | 'wheels'>>,
): SoundSnapshot {
    return {
        detachedWheels: getFlaggedWheels(view.wheels, (wheel) => wheel.isDetached),
        isBoosting: view.boost.isBoosting,
        isShifting: view.engine.isShifting,
        poppedWheels: getFlaggedWheels(view.wheels, (wheel) => wheel.isTirePopped),
        preset: view.preset,
    };
}

/**
 * Finds every one-shot sound that should start this frame: rising edges of shifting, boosting,
 * popped tires, and detached wheels, plus one sound per impact. With no previous snapshot, or right
 * after the preset changed (the new car starts fresh), no edges fire.
 */
export function getSoundEvents({
    previous,
    view,
}: Readonly<{
    previous: Readonly<SoundSnapshot> | undefined;
    view: Readonly<Pick<VehicleView, 'preset' | 'engine' | 'boost' | 'wheels' | 'impacts'>>;
}>) {
    const snapshot = createSoundSnapshot(view);
    const impactEvents = view.impacts.map((impact): OneShotEvent => {
        return {
            sound: impact.isCrash ? OneShotSound.Crash : OneShotSound.Scrape,
            volume: clamp01(impact.speed * 0.1),
        };
    });

    if (!previous || previous.preset !== view.preset) {
        return {
            oneShots: impactEvents,
            snapshot,
        };
    }

    const edgeSounds: OneShotSound[] = [
        ...(snapshot.isShifting && !previous.isShifting ? [OneShotSound.ShiftBlip] : []),
        ...(snapshot.isBoosting && !previous.isBoosting ? [OneShotSound.BoostStart] : []),
        ...(!snapshot.isBoosting && previous.isBoosting ? [OneShotSound.BoostEnd] : []),
        ...snapshot.poppedWheels
            .filter((position) => !previous.poppedWheels.includes(position))
            .map(() => OneShotSound.TirePop),
        ...snapshot.detachedWheels
            .filter((position) => !previous.detachedWheels.includes(position))
            .map(() => OneShotSound.WheelDetach),
    ];

    return {
        oneShots: [
            ...edgeSounds.map((sound): OneShotEvent => {
                return {
                    sound,
                    volume: 1,
                };
            }),
            ...impactEvents,
        ],
        snapshot,
    };
}
