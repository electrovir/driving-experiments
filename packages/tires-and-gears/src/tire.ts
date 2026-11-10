// cspell:words pacejka
import {createArray} from '@augment-vir/common';

/** Peak grip as a fraction of the load, for a tire carrying {@link referenceLoad}. */
const peakFriction = 1;
/** Newtons. About a quarter of the car's weight. */
const referenceLoad = 3000;
/**
 * How much the friction drops per {@link referenceLoad} of extra load. Real tires grip less per
 * Newton as they're pressed harder, so shifting weight onto one tire of an axle costs the axle
 * grip.
 */
const loadSensitivity = 0.2;
/** A sliding tire grips worse than one that's still rolling, as a fraction of its peak grip. */
const slidingFriction = 0.8;
/**
 * A spinning or locked-up tire grips worse the harder it's overloaded, down to this fraction of its
 * peak. Dropping gradually lets a tire that's only just overloaded recover once weight shifts onto
 * it.
 */
const saturatedFriction = 0.9;
/**
 * How far past the tire's grip the demand must go, as a fraction of it, to reach
 * {@link saturatedFriction}.
 */
const saturationRange = 0.5;
/**
 * Pacejka's "magic formula" shape: stiffness, shape, and curvature. These make grip peak at a
 * modest slip angle and fall away gently past it, so slides are catchable.
 */
const magicFormula = {
    stiffness: 10,
    shape: 1.9,
    curvature: 0.97,
};
/**
 * Slip angle divides by the tire's rolling speed, which blows up near a stop. Flooring that speed
 * turns the low-speed tire into a stiff damper instead.
 */
const minSlipSpeed = 4;
/**
 * Brakes and locked tires push against the direction of travel, which flips sign every step at a
 * standstill. Ramping them in over this speed lets them hold the car still instead.
 */
const holdingSpeed = 0.4;

/** The most force a tire can put down, in Newtons, which grows more slowly than the load on it. */
export function getTireGrip(load: number) {
    return (peakFriction - (loadSensitivity * (load - referenceLoad)) / referenceLoad) * load;
}

function getLateralGripFraction(slipAngle: number) {
    const scaled = magicFormula.stiffness * slipAngle;

    return Math.sin(
        magicFormula.shape *
            Math.atan(scaled - magicFormula.curvature * (scaled - Math.atan(scaled))),
    );
}

/** Radians of slip angle where the tire's sideways grip peaks. */
export const peakSlipAngle = createArray(500, (index) => index / 1000).reduce((best, slipAngle) => {
    return getLateralGripFraction(slipAngle) > getLateralGripFraction(best) ? slipAngle : best;
}, 0);

/** The forces a tire puts on the car, in the tire's own frame. */
export type TireForce = {
    /** Newtons along the direction the tire points. */
    longitudinal: number;
    /** Newtons toward the tire's right. */
    lateral: number;
    /** From 0 to 1, how much of the tire's grip is in use. */
    gripUsage: number;
};

/**
 * One tire's grip, which grows with the load on it but more slowly than the load does. When drive
 * or brake force and cornering together ask for more than the tire can give, each gets a share in
 * proportion to what it asked for (the friction circle).
 */
export function getTireForce({
    brakeForce,
    driveForce,
    lateralSpeed,
    load,
    lockAmount,
    longitudinalSpeed,
}: Readonly<{
    /** Newtons. */
    load: number;
    /** Meters per second the contact patch moves along the tire. */
    longitudinalSpeed: number;
    /** Meters per second the contact patch moves toward the tire's right. */
    lateralSpeed: number;
    /** Newtons pushing the tire forward. */
    driveForce: number;
    /** Newtons of braking, always positive. */
    brakeForce: number;
    /** From 0 to 1, how much the tire is locked by the handbrake. */
    lockAmount: number;
}>): TireForce {
    const maxForce = getTireGrip(load);
    const demandedLongitudinal =
        driveForce - brakeForce * Math.tanh(longitudinalSpeed / holdingSpeed);
    const overdrive = Math.max(0, Math.abs(demandedLongitudinal) / maxForce - 1);
    const availableForce =
        maxForce * (1 - (1 - saturatedFriction) * Math.min(1, overdrive / saturationRange));
    const demandedLateral =
        -maxForce *
        getLateralGripFraction(
            Math.atan2(lateralSpeed, Math.max(Math.abs(longitudinalSpeed), minSlipSpeed)),
        );
    const demandScale = Math.min(
        1,
        availableForce / Math.max(Math.hypot(demandedLongitudinal, demandedLateral), 1e-6),
    );
    const rollingLongitudinal = demandedLongitudinal * demandScale;
    const rollingLateral = demandedLateral * demandScale;
    const slideSpeed = Math.max(Math.hypot(longitudinalSpeed, lateralSpeed), holdingSpeed);
    const longitudinal =
        rollingLongitudinal +
        (-slidingFriction * maxForce * (longitudinalSpeed / slideSpeed) - rollingLongitudinal) *
            lockAmount;
    const lateral =
        rollingLateral +
        (-slidingFriction * maxForce * (lateralSpeed / slideSpeed) - rollingLateral) * lockAmount;

    return {
        gripUsage: maxForce > 0 ? Math.hypot(longitudinal, lateral) / maxForce : 0,
        lateral,
        longitudinal,
    };
}
