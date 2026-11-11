import {type WheelPosition} from '@evir/driving-common/src/car-pose.js';
import {type Quaternion, type Vector3} from './physics/vector.js';
import {type CarPreset} from './physics/vehicle-preset.js';

/**
 * Everything the scene, sound, and HUD read about the car each frame. Positions and rotations are
 * in the scene's world coordinates: +y up, and a car with heading 0 faces +z with its left side
 * toward +x. "Car frame" means the car's own axes in those same conventions: +x left, +y up, +z
 * forward.
 */
export type VehicleView = {
    preset: CarPreset;
    /** The body's origin, which the preset's body boxes are placed around. */
    position: Vector3;
    rotation: Quaternion;
    velocity: Vector3;
    /** Meters per second along the car's nose. Negative while reversing. */
    forwardSpeed: number;
    wheels: Readonly<Record<WheelPosition, Readonly<WheelView>>>;
    engine: EngineView;
    boost: BoostView;
    lights: LightsView;
    /** From 1 when new down to 0 when the engine is wrecked. */
    health: number;
    /** Whether the car is tumbling out of control after a crash. */
    isCrashing: boolean;
    /** Seconds left that the car blinks after being set back on its wheels. */
    blinkSeconds: number;
    /** Wheels or pads touching the ground. */
    groundedWheelCount: number;
    /** Impacts since the last frame, for sparks, crash sounds, and dents. */
    impacts: ReadonlyArray<Readonly<VehicleImpact>>;
    stunt: StuntView;
};

export type WheelView = {
    /** The wheel's center, or the hover pad's center. */
    position: Vector3;
    /**
     * The wheel's full rotation, including steering and spin. A wheel mesh built with its axle
     * along x and its tread facing ±y and ±z turns correctly with this.
     */
    rotation: Quaternion;
    /** Meters from the axle to the tread, or to the rim once the tire has popped. */
    radius: number;
    rimRadius: number;
    width: number;
    isGrounded: boolean;
    /** Where the tire touches the ground, or the spot under a hover pad. */
    contactPoint: Vector3;
    contactNormal: Vector3;
    /**
     * How hard the tire is skidding, 0 when rolling cleanly. Skid marks and tire screech start
     * around 0.5 and are fully on by 1.
     */
    slip: number;
    isTirePopped: boolean;
    /** The wheel has broken off and bounces on its own. */
    isDetached: boolean;
    /** For hover pads, from 0 fully extended to 1 pressed against the ground. */
    compression: number;
};

export type EngineView = {
    /** From 0 to 1, how loud and high the engine sounds before the sound's own range is applied. */
    pitch: number;
    /** Throttle the engine is being given, from 0 to 1. */
    throttle: number;
    /** Gear name for the HUD: "R", "N", "1"... or "CVT" / "Hover". */
    gearLabel: string;
    isShifting: boolean;
    /** Engine RPM, in thousands. */
    kiloRpm: number;
};

export type BoostView = {
    isBoosting: boolean;
    /** Fuel left, from 0 to 1. */
    amount: number;
};

export type LightsView = {
    areHeadlightsOn: boolean;
    /** From 0 to 1. */
    brake: number;
    isReversing: boolean;
};

/**
 * One hit. `dentPoint` and `dentTranslation` are in the car frame, ready to push the body's mesh
 * vertices in the same way as Randomation Vehicle Physics' `VehicleDamage`: each vertex at squared
 * distance `d²` from `dentPoint` moves by `dentTranslation × min(dentStrength × 0.01, falloff)`,
 * with `falloff = dentStrength × 0.001 / (d²)^(dentStrength × 0.5)`, skipped when `falloff` is
 * 0.001 or less.
 */
export type VehicleImpact = {
    position: Vector3;
    /** Out of the surface that was hit. */
    normal: Vector3;
    /** Meters per second the car hit at, along the normal. */
    speed: number;
    /** Whether this hit is hard enough to count as a crash: sparks and a crash sound. */
    isCrash: boolean;
    dentPoint: Vector3;
    dentTranslation: Vector3;
    dentStrength: number;
};

export type StuntView = {
    /** What the car is doing right now, such as "Drift: 12 m + Back Flip x2". Empty when nothing. */
    current: string;
    /** The last finished stunt combo, and the score it earned. */
    lastCompleted: string;
    totalScore: number;
};
