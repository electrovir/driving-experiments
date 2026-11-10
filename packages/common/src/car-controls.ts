/**
 * Each control's range: `throttle`, `brake`, and `handbrake` from 0 to 1, `steer` from -1 (left) to
 * 1 (right).
 */
export type CarControls = {
    throttle: number;
    brake: number;
    handbrake: number;
    steer: number;
};
