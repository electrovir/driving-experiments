import {clamp, getObjectTypedKeys, getObjectTypedValues} from '@augment-vir/common';
import {type AnyDuration} from 'date-vir';
import {CarPreset} from './physics/vehicle-preset.js';
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

/** RVP's engine recordings. */
export enum EngineRecording {
    Gas = 'gas',
}

export type EngineVoice = {
    recording: EngineRecording;
    /** Playback rate of the recording at `engine.pitch` 0 and 1, RVP's `minPitch` and `maxPitch`. */
    minRate: number;
    maxRate: number;
};

/**
 * RVP plays every wheeled car at 0.5 to 1.5. Bigger engines here play lower and smaller ones
 * higher, so the cars don't all sound alike.
 */
export const engineVoices: Readonly<Record<CarPreset, Readonly<EngineVoice>>> = {
    [CarPreset.Sedan]: {
        maxRate: 1.5,
        minRate: 0.5,
        recording: EngineRecording.Gas,
    },
    [CarPreset.Muscle]: {
        maxRate: 1.25,
        minRate: 0.4,
        recording: EngineRecording.Gas,
    },
    [CarPreset.Drift]: {
        maxRate: 1.7,
        minRate: 0.55,
        recording: EngineRecording.Gas,
    },
    [CarPreset.Stunt]: {
        maxRate: 1.8,
        minRate: 0.6,
        recording: EngineRecording.Gas,
    },
    [CarPreset.MonsterTruck]: {
        maxRate: 1.05,
        minRate: 0.35,
        recording: EngineRecording.Gas,
    },
    [CarPreset.Rally]: {
        maxRate: 1.6,
        minRate: 0.55,
        recording: EngineRecording.Gas,
    },
};

export type EngineTargets = {
    playbackRate: number;
    gain: number;
    /** Cutoff of the lowpass the engine plays through. */
    filterFrequency: number;
};

/** Engine pitch past which a gas engine is on its rev limiter. */
const limiterPitch = 0.99;
/** How many times a second the rev limiter cuts the engine. */
const limiterHz = 11;
/** Lowpass cutoff with the throttle closed and fully open. */
const engineFilterHz = {
    closed: 1400,
    open: 16_000,
};

/**
 * Same as RVP's engine sound: playback rate from min to max by `engine.pitch`, volume `0.3 + 0.7 ×
 * pitch`. Unlike RVP, lifting off the throttle makes the engine quieter and duller, and a gas
 * engine held at its redline stutters on the rev limiter.
 */
export function getEngineTargets({
    view,
    timeSeconds,
}: Readonly<{
    view: Readonly<Pick<VehicleView, 'preset' | 'engine'>>;
    timeSeconds: number;
}>): EngineTargets {
    const voice = engineVoices[view.preset];
    const pitch = clamp01(view.engine.pitch);
    const throttle = clamp01(view.engine.throttle);
    const isCutByLimiter =
        pitch >= limiterPitch && Math.sin(timeSeconds * 2 * Math.PI * limiterHz) < 0;

    return {
        filterFrequency:
            engineFilterHz.closed * (engineFilterHz.open / engineFilterHz.closed) ** throttle,
        gain:
            (0.3 + 0.7 * pitch) *
            lerp({
                amount: throttle,
                from: 0.6,
                to: 1,
            }) *
            (isCutByLimiter ? 0.4 : 1),
        playbackRate:
            lerp({
                amount: pitch,
                from: voice.minRate,
                to: voice.maxRate,
            }) * (isCutByLimiter ? 0.96 : 1),
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
};

/**
 * Same as RVP's `TireScreech`: the strongest slip among attached wheels sets volume and pitch, and
 * volume fades when fewer wheels touch the ground.
 */
export function getScreechTargets({
    view,
}: Readonly<{
    view: Readonly<Pick<VehicleView, 'preset' | 'wheels' | 'groundedWheelCount'>>;
}>): ScreechTargets {
    const silent: ScreechTargets = {
        gain: 0,
        playbackRate: 1,
    };
    const wheels = getObjectTypedValues(view.wheels).filter((wheel) => wheel.isGrounded);
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
};

export function createSoundSnapshot(
    view: Readonly<Pick<VehicleView, 'preset' | 'engine' | 'boost'>>,
): SoundSnapshot {
    return {
        isBoosting: view.boost.isBoosting,
        isShifting: view.engine.isShifting,
        preset: view.preset,
    };
}

/**
 * Finds every one-shot sound that should start this frame: rising edges of shifting and boosting,
 * plus one sound per impact. With no previous snapshot, or right after the preset changed (the new
 * car starts fresh), no edges fire.
 */
export function getSoundEvents({
    previous,
    view,
}: Readonly<{
    previous: Readonly<SoundSnapshot> | undefined;
    view: Readonly<Pick<VehicleView, 'preset' | 'engine' | 'boost' | 'impacts'>>;
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
