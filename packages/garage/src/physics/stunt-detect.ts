import {getEnumValues} from '@augment-vir/common';
import {
    createVector,
    dotVectors,
    getVectorLength,
    normalizeVector,
    subtractVectors,
    type Vector3,
} from './vector.js';

/** Randomation Vehicle Physics counts its per-step rates at Unity's default physics rate. */
const unityStepSeconds = 0.02;
/** How long a drift keeps counting after the car stops sliding, so wiggles join into one drift. */
const driftConnectSeconds = 0.6;
const driftSlideSpeed = 5;
/** Short hops over bumps don't show as jumps. */
const minJumpSeconds = 0.25;
const flipDegrees = 300;
const flipPrecision = 0.8;
const radiansToDegrees = 180 / Math.PI;

/** Same as the stunts in Randomation Vehicle Physics' demo `StuntManager`. */
export enum FlipStunt {
    FrontFlip = 'Front Flip',
    BackFlip = 'Back Flip',
    RightSpin = 'Right Spin',
    LeftSpin = 'Left Spin',
    LeftBarrelRoll = 'Left Barrel Roll',
    RightBarrelRoll = 'Right Barrel Roll',
}

/** In the car's own axes, the way the car spins during each stunt. */
const flipAxes: Readonly<Record<FlipStunt, Readonly<Vector3>>> = {
    [FlipStunt.FrontFlip]: createVector({
        x: 1,
        y: 0,
        z: 0,
    }),
    [FlipStunt.BackFlip]: createVector({
        x: -1,
        y: 0,
        z: 0,
    }),
    [FlipStunt.RightSpin]: createVector({
        x: 0,
        y: 1,
        z: 0,
    }),
    [FlipStunt.LeftSpin]: createVector({
        x: 0,
        y: -1,
        z: 0,
    }),
    [FlipStunt.LeftBarrelRoll]: createVector({
        x: 0,
        y: 0,
        z: 1,
    }),
    [FlipStunt.RightBarrelRoll]: createVector({
        x: 0,
        y: 0,
        z: -1,
    }),
};

export type StuntState = {
    driftHoldSeconds: number;
    driftDistance: number;
    driftScore: number;
    jumpStart: Vector3;
    jumpDistance: number;
    jumpSeconds: number;
    /** Degrees spun so far for each flip started this jump, in the order they started. */
    flips: ReadonlyArray<Readonly<{stunt: FlipStunt; degrees: number}>>;
    /** Flips that passed a full turn this jump, in the order they did. */
    doneFlips: ReadonlyArray<FlipStunt>;
    current: string;
    /** Score earned since {@link StuntState.current} last went from empty to showing something. */
    comboScore: number;
    lastCompleted: string;
    totalScore: number;
};

export function createStuntState(position: Readonly<Vector3>): StuntState {
    return {
        comboScore: 0,
        current: '',
        doneFlips: [],
        driftDistance: 0,
        driftHoldSeconds: 0,
        driftScore: 0,
        flips: [],
        jumpDistance: 0,
        jumpSeconds: 0,
        jumpStart: {
            ...position,
        },
        lastCompleted: '',
        totalScore: 0,
    };
}

function formatMeters(meters: number) {
    return `${Math.round(meters)} m`;
}

/**
 * Same as Randomation Vehicle Physics' `StuntDetect`: drifts, jumps, and flips, scored when they
 * end. Also returns the boost they earn this step.
 */
export function stepStunts({
    dtSeconds,
    groundedWheelCount,
    isCrashing,
    localAngularVelocity,
    localVelocity,
    position,
    stunt,
}: Readonly<{
    stunt: Readonly<StuntState>;
    /** The body's origin, in the physics' frame. */
    position: Readonly<Vector3>;
    localVelocity: Readonly<Vector3>;
    localAngularVelocity: Readonly<Vector3>;
    groundedWheelCount: number;
    isCrashing: boolean;
    dtSeconds: number;
}>): {stunt: StuntState; boostGain: number} {
    const steps = dtSeconds / unityStepSeconds;
    const isGrounded = groundedWheelCount > 0;
    const lateralSpeed = Math.abs(localVelocity.x);

    const driftHoldSeconds = isCrashing
        ? 0
        : isGrounded
          ? lateralSpeed > driftSlideSpeed
              ? driftConnectSeconds
              : Math.max(0, stunt.driftHoldSeconds - dtSeconds)
          : 0;
    const isDrifting = driftHoldSeconds > 0;
    const drift = isDrifting
        ? {
              boost: 0.1 * lateralSpeed * 0.0002 * steps,
              distance: stunt.driftDistance + getVectorLength(localVelocity) * dtSeconds,
              earned: 0,
              score: stunt.driftScore + 0.01 * lateralSpeed * steps,
          }
        : {
              boost: 0,
              distance: 0,
              earned: isCrashing ? 0 : stunt.driftScore,
              score: 0,
          };

    const isAirborne = !isGrounded && !isCrashing;
    const jumpDistance = isAirborne
        ? getVectorLength(
              subtractVectors({
                  left: position,
                  right: stunt.jumpStart,
              }),
          )
        : 0;
    const jumpSeconds = isAirborne ? stunt.jumpSeconds + dtSeconds : 0;
    const jump = isAirborne
        ? {
              boost: 0.1 * 0.01 * steps,
              earned: 0,
          }
        : {
              boost: isCrashing ? 0 : (stunt.jumpDistance + stunt.jumpSeconds) * 0.1 * 0.01,
              earned: isCrashing ? 0 : (stunt.jumpDistance + stunt.jumpSeconds) * 0.01,
          };

    const spinSpeed = getVectorLength(localAngularVelocity);
    const spinDirection =
        spinSpeed > 0
            ? normalizeVector(localAngularVelocity)
            : createVector({
                  x: 0,
                  y: 0,
                  z: 0,
              });
    const spinningStunts = getEnumValues(FlipStunt).filter((flipStunt) => {
        return (
            dotVectors({
                left: spinDirection,
                right: flipAxes[flipStunt],
            }) >= flipPrecision
        );
    });
    const flips = isAirborne
        ? [
              ...stunt.flips,
              ...spinningStunts
                  .filter((flipStunt) => !stunt.flips.some((flip) => flip.stunt === flipStunt))
                  .map((flipStunt) => {
                      return {
                          degrees: 0,
                          stunt: flipStunt,
                      };
                  }),
          ].map((flip) => {
              return spinningStunts.includes(flip.stunt)
                  ? {
                        ...flip,
                        degrees: flip.degrees + spinSpeed * radiansToDegrees * dtSeconds,
                    }
                  : flip;
          })
        : [];
    const doneFlips = isAirborne
        ? [
              ...stunt.doneFlips,
              ...flips
                  .filter((flip) => {
                      return flip.degrees >= flipDegrees && !stunt.doneFlips.includes(flip.stunt);
                  })
                  .map((flip) => flip.stunt),
          ]
        : [];
    const landedFlips = isAirborne || isCrashing ? [] : stunt.flips;
    const flipEarned = landedFlips.reduce(
        (sum, flip) => sum + flip.degrees * Math.floor(flip.degrees / flipDegrees),
        0,
    );
    const flipBoost = landedFlips.reduce((sum, flip) => sum + flip.degrees * 0.1 * 0.01, 0);

    const driftText = isDrifting ? `Drift: ${formatMeters(drift.distance)}` : '';
    const jumpText =
        isAirborne && jumpSeconds >= minJumpSeconds ? `Jump: ${formatMeters(jumpDistance)}` : '';
    const flipText = doneFlips
        .map((flipStunt) => {
            const degrees = flips.find((flip) => flip.stunt === flipStunt)?.degrees ?? 0;
            return degrees >= flipDegrees * 2
                ? `${flipStunt} x${Math.floor(degrees / flipDegrees)}`
                : flipStunt;
        })
        .join(' + ');
    const current = isCrashing
        ? 'Crashed'
        : [
              driftText,
              jumpText,
              flipText,
          ]
              .filter((text) => text)
              .join(' + ');
    const earned = drift.earned + jump.earned + flipEarned;
    const comboScore = stunt.current ? stunt.comboScore + earned : earned;
    const didComboEnd = !current && !!stunt.current && stunt.current !== 'Crashed';

    return {
        boostGain: drift.boost + jump.boost + flipBoost,
        stunt: {
            comboScore: didComboEnd ? 0 : comboScore,
            current,
            doneFlips,
            driftDistance: drift.distance,
            driftHoldSeconds,
            driftScore: drift.score,
            flips,
            jumpDistance,
            jumpSeconds,
            jumpStart: isAirborne
                ? stunt.jumpStart
                : {
                      ...position,
                  },
            lastCompleted: didComboEnd
                ? `${stunt.current}: ${comboScore.toFixed(1)} points`
                : stunt.lastCompleted,
            totalScore: stunt.totalScore + earned,
        },
    };
}
