import {defineAnthaMod} from '@antha/engine';
import {createArray, getEnumValues, mapObjectValues} from '@augment-vir/common';
import {convertDuration, type AnyDuration} from 'date-vir';
import {type GarageState} from './garage-state.js';
import {
    EngineRecording,
    getEngineTargets,
    getScreechTargets,
    getSoundEvents,
    getWindTargets,
    oneShotRecipes,
    OneShotSound,
    type OneShotEvent,
    type SoundSnapshot,
} from './sound-targets.js';

/**
 * Gains and frequencies ramp toward each new target with this time constant, so per-frame jumps
 * don't click. It is also how long swapping the engine recording takes to crossfade.
 */
const smoothing: AnyDuration = {
    milliseconds: 40,
};
const smoothingSeconds = convertDuration(smoothing, {
    seconds: true,
}).seconds;
/**
 * Engine loudness dips to this fraction at the start of a gear shift and recovers over
 * `shiftDipDuration`.
 */
const shiftDipFloor = 0.45;
const shiftDipDuration: AnyDuration = {
    milliseconds: 150,
};
/** One-shot envelopes rise over this long so they don't click on. */
const oneShotAttack: AnyDuration = {
    milliseconds: 5,
};
enum ScreechKind {
    Tire = 'tire',
}

/** RVP's own skid recording. */
const screechRecordingUrls: Readonly<Record<ScreechKind, URL>> = {
    [ScreechKind.Tire]: new URL('audio/tire-screech.mp3', import.meta.url),
};
/** RVP's engine recordings, each a steady run at one speed that playback rate bends. */
const engineRecordingUrls: Readonly<Record<EngineRecording, URL>> = {
    [EngineRecording.Gas]: new URL('audio/engine.mp3', import.meta.url),
};

type LoopTrims = {
    /** Skipped at the recording's start. */
    start: AnyDuration;
    /** Skipped at the recording's end. */
    end: AnyDuration;
    /** The loop's end blends into its start over this long, so the seam isn't heard. */
    crossfade: AnyDuration;
};

/** The screech recordings fade in and out at their ends, so the loop skips those. */
const screechTrims: Readonly<LoopTrims> = {
    crossfade: {
        milliseconds: 300,
    },
    end: {
        milliseconds: 500,
    },
    start: {
        milliseconds: 600,
    },
};
/** The engine recordings are steady throughout; the trims only skip the mp3 encoder's padding. */
const engineTrims: Readonly<LoopTrims> = {
    crossfade: {
        milliseconds: 150,
    },
    end: {
        milliseconds: 50,
    },
    start: {
        milliseconds: 50,
    },
};
/**
 * How fast the screech swells in, fades out, and follows slip in pitch. RVP eases both much slower
 * than the engine, which keeps a twitchy slip value from making the screech stutter.
 */
const screechRiseSeconds = 0.25;
const screechFallSeconds = 0.1;
const screechPitchSeconds = 0.5;
/** The floor an exponential ramp decays to, since it can't reach 0. */
const silentGain = 0.0001;

type RecordingLoop = {
    gain: GainNode;
    /** Set once the recording has loaded. */
    source: AudioBufferSourceNode | undefined;
};

type GarageSound = {
    context: AudioContext;
    noise: AudioBuffer;
    /** Where every sound ends up, so one volume knob exists. */
    master: GainNode;
    /** Sits after every engine voice to duck the engine during a shift. */
    engineDip: GainNode;
    /** Sits before the shift dip to dull the engine off throttle. */
    engineFilter: BiquadFilterNode;
    engineLoops: Readonly<Record<EngineRecording, RecordingLoop>>;
    screechLoops: Readonly<Record<ScreechKind, RecordingLoop>>;
    windGain: GainNode;
    windFilter: BiquadFilterNode;
    boostGain: GainNode;
};

function createNoiseBuffer(context: Readonly<AudioContext>) {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    buffer.copyToChannel(
        // eslint-disable-next-line sonarjs/pseudo-random
        Float32Array.from(createArray(buffer.length, () => Math.random() * 2 - 1)),
        0,
    );

    return buffer;
}

function startLoopingNoise({
    context,
    noise,
    destination,
}: Readonly<{
    context: AudioContext;
    noise: AudioBuffer;
    destination: AudioNode;
}>) {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    source.connect(destination);
    source.start();
}

function toSampleCount(context: Readonly<AudioContext>, duration: Readonly<AnyDuration>) {
    return Math.round(
        convertDuration(duration, {
            seconds: true,
        }).seconds * context.sampleRate,
    );
}

/**
 * The recording's steady middle, with its last moments blended into its first, so it loops forever
 * without a dip or a click.
 */
function createSeamlessLoop({
    context,
    recording,
    trims,
}: Readonly<{
    context: AudioContext;
    recording: AudioBuffer;
    trims: Readonly<LoopTrims>;
}>) {
    const samples = recording.getChannelData(0);
    const start = toSampleCount(context, trims.start);
    const end = recording.length - toSampleCount(context, trims.end);
    const crossfade = toSampleCount(context, trims.crossfade);
    const loop = context.createBuffer(1, end - start - crossfade, context.sampleRate);
    loop.copyToChannel(
        Float32Array.from(
            createArray(loop.length, (index) => {
                const sample = samples[start + index] ?? 0;
                if (index >= crossfade) {
                    return sample;
                }
                const blend = index / crossfade;
                /** Equal-power, since the two ends aren't the same waveform. */
                return (
                    sample * Math.sqrt(blend) +
                    (samples[end - crossfade + index] ?? 0) * Math.sqrt(1 - blend)
                );
            }),
        ),
        0,
    );

    return loop;
}

function createRecordingLoop({
    context,
    destination,
}: Readonly<{
    context: AudioContext;
    destination: AudioNode;
}>): RecordingLoop {
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(destination);

    return {
        gain,
        source: undefined,
    };
}

/** Fetches a recording and starts it looping, silent until its gain is raised. */
async function startRecordingLoop({
    context,
    loop,
    trims,
    url,
}: Readonly<{
    context: AudioContext;
    loop: RecordingLoop;
    trims: Readonly<LoopTrims>;
    url: URL;
}>) {
    const response = await fetch(url);
    const recording = await context.decodeAudioData(await response.arrayBuffer());
    const source = context.createBufferSource();
    source.buffer = createSeamlessLoop({
        context,
        recording,
        trims,
    });
    source.loop = true;
    source.connect(loop.gain);
    source.start();
    loop.source = source;
}

/** A recording that fails to load leaves its loop silent; the rest still plays. */
async function startRecordingLoops(sound: Readonly<GarageSound>) {
    await Promise.all([
        ...getEnumValues(ScreechKind).map(async (kind) => {
            await startRecordingLoop({
                context: sound.context,
                loop: sound.screechLoops[kind],
                trims: screechTrims,
                url: screechRecordingUrls[kind],
            });
        }),
        ...getEnumValues(EngineRecording).map(async (recording) => {
            await startRecordingLoop({
                context: sound.context,
                loop: sound.engineLoops[recording],
                trims: engineTrims,
                url: engineRecordingUrls[recording],
            });
        }),
    ]);
}

function createGarageSound(): GarageSound {
    const context = new AudioContext();
    const noise = createNoiseBuffer(context);
    const master = context.createGain();
    master.gain.value = 0.3;
    master.connect(context.destination);

    const engineDip = context.createGain();
    engineDip.connect(master);
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.connect(engineDip);

    const screechLoops = mapObjectValues(screechRecordingUrls, () => {
        return createRecordingLoop({
            context,
            destination: master,
        });
    });
    const engineLoops = mapObjectValues(engineRecordingUrls, () => {
        return createRecordingLoop({
            context,
            destination: engineFilter,
        });
    });

    const windGain = context.createGain();
    windGain.gain.value = 0;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.connect(windGain).connect(master);
    startLoopingNoise({
        context,
        destination: windFilter,
        noise,
    });

    const boostGain = context.createGain();
    boostGain.gain.value = 0;
    const boostFilter = context.createBiquadFilter();
    boostFilter.type = 'lowpass';
    boostFilter.frequency.value = 900;
    boostFilter.connect(boostGain).connect(master);
    startLoopingNoise({
        context,
        destination: boostFilter,
        noise,
    });

    return {
        boostGain,
        context,
        engineDip,
        engineFilter,
        engineLoops,
        master,
        noise,
        screechLoops,
        windFilter,
        windGain,
    };
}

function playOneShot({
    sound,
    event,
}: Readonly<{
    sound: GarageSound;
    event: Readonly<OneShotEvent>;
}>) {
    if (!event.volume) {
        return;
    }
    const {context} = sound;
    const now = context.currentTime;
    const recipe = oneShotRecipes[event.sound];
    const attackSeconds = convertDuration(oneShotAttack, {
        seconds: true,
    }).seconds;

    function shapeEnvelope(peakGain: number, duration: AnyDuration) {
        const gain = context.createGain();
        const durationSeconds = convertDuration(duration, {
            seconds: true,
        }).seconds;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(peakGain * event.volume, now + attackSeconds);
        gain.gain.exponentialRampToValueAtTime(silentGain, now + durationSeconds);
        gain.connect(sound.master);

        return {
            durationSeconds,
            gain,
        };
    }

    if (recipe.noise) {
        const envelope = shapeEnvelope(recipe.noise.peakGain, recipe.noise.duration);
        const filter = context.createBiquadFilter();
        filter.type = recipe.noise.filterType;
        filter.Q.value = recipe.noise.q;
        filter.frequency.setValueAtTime(recipe.noise.startHz, now);
        filter.frequency.exponentialRampToValueAtTime(
            recipe.noise.endHz,
            now + envelope.durationSeconds,
        );
        const source = context.createBufferSource();
        source.buffer = sound.noise;
        source.connect(filter).connect(envelope.gain);
        source.start(now);
        source.stop(now + envelope.durationSeconds);
    }
    if (recipe.tone) {
        const envelope = shapeEnvelope(recipe.tone.peakGain, recipe.tone.duration);
        const oscillator = context.createOscillator();
        oscillator.type = recipe.tone.type;
        oscillator.frequency.setValueAtTime(recipe.tone.startHz, now);
        oscillator.frequency.exponentialRampToValueAtTime(
            recipe.tone.endHz,
            now + envelope.durationSeconds,
        );
        oscillator.connect(envelope.gain);
        oscillator.start(now);
        oscillator.stop(now + envelope.durationSeconds);
    }
}

/**
 * Plays the garage car's sound from `state.vehicleView`: RVP's engine recording bent in pitch,
 * shift blips, tire screech, boost, crashes, tire pops, wheels coming off, and wind.
 */
export function createGarageSoundMod() {
    const runtime: {
        sound: GarageSound | undefined;
        previous: SoundSnapshot | undefined;
    } = {
        previous: undefined,
        sound: undefined,
    };

    return defineAnthaMod<GarageState>({
        modName: 'garage-sound',
        async cleanup() {
            await runtime.sound?.context.close();
            runtime.sound = undefined;
            runtime.previous = undefined;
        },
        execute({state}) {
            const {vehicleView: view} = state;
            /** The view doesn't exist until the drive mod's first run. */
            if (!view) {
                return;
            }

            /** Browsers refuse to start audio until the page has had a key press or click. */
            if (!runtime.sound) {
                if (!navigator.userActivation.hasBeenActive) {
                    return;
                }
                runtime.sound = createGarageSound();
                void startRecordingLoops(runtime.sound);
            }

            const sound = runtime.sound;
            if (sound.context.state === 'suspended') {
                void sound.context.resume();
            }

            const now = sound.context.currentTime;
            const engine = getEngineTargets({
                timeSeconds: now,
                view,
            });

            sound.engineFilter.frequency.setTargetAtTime(
                engine.filterFrequency,
                now,
                smoothingSeconds,
            );
            getEnumValues(EngineRecording).forEach((recording) => {
                const loop = sound.engineLoops[recording];
                loop.source?.playbackRate.setTargetAtTime(
                    engine.playbackRate,
                    now,
                    smoothingSeconds,
                );
                loop.gain.gain.setTargetAtTime(engine.gain, now, smoothingSeconds);
            });

            const screech = getScreechTargets({
                view,
            });
            getEnumValues(ScreechKind).forEach((kind) => {
                const gain = sound.screechLoops[kind].gain.gain;
                const target = screech.gain * 0.8;
                gain.setTargetAtTime(
                    target,
                    now,
                    target > gain.value ? screechRiseSeconds : screechFallSeconds,
                );
                if (screech.gain) {
                    sound.screechLoops[kind].source?.playbackRate.setTargetAtTime(
                        screech.playbackRate,
                        now,
                        screechPitchSeconds,
                    );
                }
            });

            const wind = getWindTargets({
                view,
            });
            sound.windFilter.frequency.setTargetAtTime(wind.filterFrequency, now, smoothingSeconds);
            sound.windGain.gain.setTargetAtTime(wind.gain, now, smoothingSeconds);

            sound.boostGain.gain.setTargetAtTime(
                view.boost.isBoosting ? 0.35 : 0,
                now,
                smoothingSeconds,
            );

            const events = getSoundEvents({
                previous: runtime.previous,
                view,
            });
            runtime.previous = events.snapshot;
            events.oneShots.forEach((event) => {
                playOneShot({
                    event,
                    sound,
                });
            });
            if (events.oneShots.some((event) => event.sound === OneShotSound.ShiftBlip)) {
                sound.engineDip.gain.cancelScheduledValues(now);
                sound.engineDip.gain.setValueAtTime(shiftDipFloor, now);
                sound.engineDip.gain.linearRampToValueAtTime(
                    1,
                    now +
                        convertDuration(shiftDipDuration, {
                            seconds: true,
                        }).seconds,
                );
            }
        },
    });
}
