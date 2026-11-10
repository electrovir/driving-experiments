import {convertDuration, type AnyDuration} from 'date-vir';

/**
 * The engine loop runs on `requestAnimationFrame`, so the gap between runs grows to seconds while
 * the tab is hidden. Capping it keeps the car from jumping when the tab comes back.
 */
const maxPhysicsStep: AnyDuration = {
    milliseconds: 50,
};

/** Seconds to advance a car's physics by for one engine run, capped so a long gap can't jump it. */
export function getPhysicsStepSeconds(msSinceLastExecute: number) {
    return Math.min(
        convertDuration(maxPhysicsStep, {
            seconds: true,
        }).seconds,
        convertDuration(
            {
                milliseconds: msSinceLastExecute,
            },
            {
                seconds: true,
            },
        ).seconds,
    );
}
