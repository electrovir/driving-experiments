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
    /** Whether the car is tumbling out of control after a crash. */
    isCrashing: boolean;
    /** Seconds left that the car blinks after being set back on its wheels. */
    blinkSeconds: number;
    /** Wheels or pads touching the ground. */
    groundedWheelCount: number;
    /** Impacts since the last frame, for sparks and crash sounds. */
    impacts: ReadonlyArray<Readonly<VehicleImpact>>;
};

export type WheelView = {
    /** The wheel's center. */
    position: Vector3;
    /**
     * The wheel's full rotation, including steering and spin. A wheel mesh built with its axle
     * along x and its tread facing ±y and ±z turns correctly with this.
     */
    rotation: Quaternion;
    /** Meters from the axle to the tread. */
    radius: number;
    rimRadius: number;
    width: number;
    isGrounded: boolean;
    /** Where the tire touches the ground, or would with the spring fully extended. */
    contactPoint: Vector3;
    contactNormal: Vector3;
    /**
     * How hard the tire is skidding, 0 when rolling cleanly. Skid marks and tire screech start
     * around 0.5 and are fully on by 1.
     */
    slip: number;
    /** From 0 fully extended to 1 fully compressed. */
    compression: number;
};

export type EngineView = {
    /** From 0 to 1, how loud and high the engine sounds before the sound's own range is applied. */
    pitch: number;
    /** Throttle the engine is being given, from 0 to 1. */
    throttle: number;
    /** Gear name for the HUD: "R", "N", "1"... */
    gearLabel: string;
    isShifting: boolean;
    /** "A" (automatic) or "M" (manual) for a car with a gearbox, empty otherwise. */
    shiftModeLabel: string;
    /** Engine RPM, in thousands. */
    kiloRpm: number;
};

export type BoostView = {
    isBoosting: boolean;
};

export type LightsView = {
    areHeadlightsOn: boolean;
    /** From 0 to 1. */
    brake: number;
    isReversing: boolean;
};

/** One hit of the body on the ground or a wall. */
export type VehicleImpact = {
    position: Vector3;
    /** Out of the surface that was hit. */
    normal: Vector3;
    /** Meters per second the car hit at, along the normal. */
    speed: number;
    /** Whether this hit is hard enough to count as a crash: sparks and a crash sound. */
    isCrash: boolean;
};
