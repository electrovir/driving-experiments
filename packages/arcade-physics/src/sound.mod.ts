import {defineAnthaMod} from '@antha/engine';
import {clamp, createArray} from '@augment-vir/common';
import {convertDuration, type AnyDuration} from 'date-vir';
import {type ArcadePhysicsState} from './arcade-physics-state.js';

/**
 * Gains and the engine oscillators' frequencies ramp toward each new target with this time
 * constant, so per-frame jumps don't click.
 */
const smoothing: AnyDuration = {
    milliseconds: 40,
};
const smoothingSeconds = convertDuration(smoothing, {
    seconds: true,
}).seconds;
/** A four-stroke four-cylinder fires twice per crank revolution. */
const firingsPerRevolution = 2;
/** Meters per second of sideways sliding before the tires start to squeal. */
const squealStartSpeed = 1.5;
/** Sideways speed at which the squeal is at full volume. */
const squealFullSpeed = 6;

type CarSound = {
    context: AudioContext;
    engineOscillator: OscillatorNode;
    engineRumble: OscillatorNode;
    engineFilter: BiquadFilterNode;
    engineGain: GainNode;
    squealGain: GainNode;
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

function createCarSound(): CarSound {
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.3;
    master.connect(context.destination);

    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.connect(engineGain).connect(master);

    const engineOscillator = context.createOscillator();
    engineOscillator.type = 'sawtooth';
    engineOscillator.connect(engineFilter);
    /** A square wave an octave down gives the thin sawtooth some body. */
    const engineRumble = context.createOscillator();
    engineRumble.type = 'square';
    const rumbleGain = context.createGain();
    rumbleGain.gain.value = 0.5;
    engineRumble.connect(rumbleGain).connect(engineFilter);

    const squealGain = context.createGain();
    squealGain.gain.value = 0;
    const squealFilter = context.createBiquadFilter();
    squealFilter.type = 'bandpass';
    squealFilter.frequency.value = 1100;
    squealFilter.Q.value = 12;
    squealFilter.connect(squealGain).connect(master);
    const noise = context.createBufferSource();
    noise.buffer = createNoiseBuffer(context);
    noise.loop = true;
    noise.connect(squealFilter);

    engineOscillator.start();
    engineRumble.start();
    noise.start();

    return {
        context,
        engineFilter,
        engineGain,
        engineOscillator,
        engineRumble,
        squealGain,
    };
}

/** Plays an engine tone that follows rpm and throttle, and a tire squeal while the car slides. */
export function createSoundMod() {
    const runtime: {
        sound: CarSound | undefined;
    } = {
        sound: undefined,
    };

    return defineAnthaMod<ArcadePhysicsState>({
        modName: 'arcade-physics-sound',
        async cleanup() {
            await runtime.sound?.context.close();
            runtime.sound = undefined;
        },
        execute({state}) {
            if (!state.car) {
                return;
            }

            /** Browsers refuse to start audio until the page has had a key press or click. */
            if (!runtime.sound) {
                if (!navigator.userActivation.hasBeenActive) {
                    return;
                }
                runtime.sound = createCarSound();
            }

            const sound = runtime.sound;
            if (sound.context.state === 'suspended') {
                void sound.context.resume();
            }

            const now = sound.context.currentTime;
            const throttle = state.carControls?.throttle ?? 0;
            const firingHz = (state.car.drivetrain.rpm / 60) * firingsPerRevolution;
            const squeal = clamp(
                (Math.abs(state.car.lateralSpeed) - squealStartSpeed) /
                    (squealFullSpeed - squealStartSpeed),
                {
                    max: 1,
                    min: 0,
                },
            );

            sound.engineOscillator.frequency.setTargetAtTime(firingHz, now, smoothingSeconds);
            sound.engineRumble.frequency.setTargetAtTime(firingHz / 2, now, smoothingSeconds);
            /** An open throttle sounds brighter and louder than a coasting engine. */
            sound.engineFilter.frequency.setTargetAtTime(
                firingHz * (3 + throttle * 6),
                now,
                smoothingSeconds,
            );
            sound.engineGain.gain.setTargetAtTime(0.35 + throttle * 0.4, now, smoothingSeconds);
            sound.squealGain.gain.setTargetAtTime(squeal * 0.8, now, smoothingSeconds);
        },
    });
}
