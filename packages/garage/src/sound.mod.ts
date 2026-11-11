import {defineAnthaMod} from '@antha/engine';
import {
    createArray,
    getEnumValues,
    getObjectTypedValues,
    mapObjectValues,
} from '@augment-vir/common';
import {convertDuration, type AnyDuration} from 'date-vir';
import {type GarageState} from './garage-state.js';
import {CarPreset} from './physics/vehicle-preset.js';
import {
    engineVoices,
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
 * don't click. It is also how long swapping the engine voice takes to crossfade.
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
    Rim = 'rim',
}

/** RVP's own skid recordings: rubber, and a bare rim grinding on the road. */
const screechRecordingUrls: Readonly<Record<ScreechKind, URL>> = {
    [ScreechKind.Rim]: new URL('audio/rim-screech.mp3', import.meta.url),
    [ScreechKind.Tire]: new URL('audio/tire-screech.mp3', import.meta.url),
};
/** The recordings fade in and out at their ends, so the loop skips those. */
const recordingFadeIn: AnyDuration = {
    milliseconds: 600,
};
const recordingFadeOut: AnyDuration = {
    milliseconds: 500,
};
/** The loop's end blends into its start over this long, so the seam isn't heard. */
const loopCrossfade: AnyDuration = {
    milliseconds: 300,
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

type EngineVoiceNodes = {
    frequencyNodes: ReadonlyArray<{
        oscillator: OscillatorNode;
        ratio: number;
    }>;
    filter: BiquadFilterNode;
    gain: GainNode;
};

type GarageSound = {
    context: AudioContext;
    noise: AudioBuffer;
    /** Where every sound ends up, so one volume knob exists. */
    master: GainNode;
    /** Sits after every engine voice to duck the engine during a shift. */
    engineDip: GainNode;
    engineVoiceNodes: Partial<Record<CarPreset, EngineVoiceNodes>>;
    screechGains: Readonly<Record<ScreechKind, GainNode>>;
    /** Each screech's looping playback, once its recording has loaded. */
    screechSources: Partial<Record<ScreechKind, AudioBufferSourceNode>>;
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

function createEngineVoice({
    sound,
    preset,
}: Readonly<{
    sound: GarageSound;
    preset: CarPreset;
}>): EngineVoiceNodes {
    const voice = engineVoices[preset];
    const {context} = sound;

    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(sound.engineDip);

    const lope = context.createGain();
    lope.gain.value = 1 - voice.lopeDepth;
    lope.connect(gain);
    if (voice.lopeDepth) {
        const lopeOscillator = context.createOscillator();
        lopeOscillator.frequency.value = voice.lopeHz;
        const lopeDepth = context.createGain();
        lopeDepth.gain.value = voice.lopeDepth;
        lopeOscillator.connect(lopeDepth).connect(lope.gain);
        lopeOscillator.start();
    }

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = voice.filterQ;
    filter.connect(lope);

    const frequencyNodes = voice.oscillators.map((oscillatorVoice) => {
        const oscillator = context.createOscillator();
        oscillator.type = oscillatorVoice.type;
        const oscillatorGain = context.createGain();
        oscillatorGain.gain.value = oscillatorVoice.gain / voice.oscillators.length;
        oscillator.connect(oscillatorGain).connect(filter);
        oscillator.start();

        return {
            oscillator,
            ratio: oscillatorVoice.ratio,
        };
    });

    return {
        filter,
        frequencyNodes,
        gain,
    };
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
}: Readonly<{
    context: AudioContext;
    recording: AudioBuffer;
}>) {
    const samples = recording.getChannelData(0);
    const start = toSampleCount(context, recordingFadeIn);
    const end = recording.length - toSampleCount(context, recordingFadeOut);
    const crossfade = toSampleCount(context, loopCrossfade);
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

/** Fetches each screech recording and starts it looping silently, ready to be faded in. */
async function startScreechLoops(sound: GarageSound) {
    await Promise.all(
        getEnumValues(ScreechKind).map(async (kind) => {
            const response = await fetch(screechRecordingUrls[kind]);
            const recording = await sound.context.decodeAudioData(await response.arrayBuffer());
            const source = sound.context.createBufferSource();
            source.buffer = createSeamlessLoop({
                context: sound.context,
                recording,
            });
            source.loop = true;
            source.connect(sound.screechGains[kind]);
            source.start();
            sound.screechSources[kind] = source;
        }),
    );
}

function createGarageSound(): GarageSound {
    const context = new AudioContext();
    const noise = createNoiseBuffer(context);
    const master = context.createGain();
    master.gain.value = 0.3;
    master.connect(context.destination);

    const engineDip = context.createGain();
    engineDip.connect(master);

    const screechGains = mapObjectValues(screechRecordingUrls, () => {
        const gain = context.createGain();
        gain.gain.value = 0;
        gain.connect(master);

        return gain;
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
        engineVoiceNodes: {},
        master,
        noise,
        screechGains,
        screechSources: {},
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
 * Synthesizes the garage car's sound from `state.vehicleView`: an engine voice per preset (or a
 * turbine whine for the hover car), shift blips, tire screech, boost, crashes, tire pops, wheels
 * coming off, and wind.
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
                /** A recording that fails to load leaves its screech silent; the rest still plays. */
                void startScreechLoops(runtime.sound);
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

            sound.engineVoiceNodes[view.preset] ??= createEngineVoice({
                preset: view.preset,
                sound,
            });
            getObjectTypedValues(CarPreset).forEach((preset) => {
                const nodes = sound.engineVoiceNodes[preset];
                if (!nodes) {
                    return;
                }
                if (preset === view.preset) {
                    nodes.frequencyNodes.forEach(({oscillator, ratio}) => {
                        oscillator.frequency.setTargetAtTime(
                            engine.frequency * ratio,
                            now,
                            smoothingSeconds,
                        );
                    });
                    nodes.filter.frequency.setTargetAtTime(
                        engine.filterFrequency,
                        now,
                        smoothingSeconds,
                    );
                }
                nodes.gain.gain.setTargetAtTime(
                    preset === view.preset && engine.isAudible ? engine.gain : 0,
                    now,
                    smoothingSeconds,
                );
            });

            const screech = getScreechTargets({
                view,
            });
            getEnumValues(ScreechKind).forEach((kind) => {
                const gain = sound.screechGains[kind].gain;
                const target =
                    (kind === ScreechKind.Rim) === screech.isRim ? screech.gain * 0.8 : 0;
                gain.setTargetAtTime(
                    target,
                    now,
                    target > gain.value ? screechRiseSeconds : screechFallSeconds,
                );
                if (screech.gain) {
                    sound.screechSources[kind]?.playbackRate.setTargetAtTime(
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
