import {clamp, type MinMax} from '@augment-vir/common';
import {convertDuration} from 'date-vir';
import {wrapAngle} from './car-pose.js';

/** The user's drag offset on top of the normal chase camera angle. */
export type CameraOrbit = {
    /** Radians around the car, added to the car's heading. */
    yaw: number;
    /** Radians added to the camera's normal angle above the car. */
    pitch: number;
    isDragging: boolean;
    /** Set while a stick aims the camera, and until the camera swings back behind the car after. */
    isStickAiming: boolean;
    secondsSinceRelease: number;
    /** Pointer motion since the last frame, in pixels. */
    pendingDrag: {
        x: number;
        y: number;
    };
    destroy: () => void;
};

const radiansPerPixel = 0.005;
/** How far a stick must tilt before it aims the camera, so a resting stick's drift doesn't. */
const stickAimTilt = 0.1;
/** How quickly the camera swings to where the stick aims, and back behind the car after. */
const stickAimRate = 12;

/** Moves `yaw` part of the way to `target`, the shorter way around, and unwinds any extra turns. */
function easeYaw({ease, target, yaw}: Readonly<{yaw: number; target: number; ease: number}>) {
    const wrappedYaw = wrapAngle(yaw);

    return wrappedYaw + wrapAngle(target - wrappedYaw) * ease;
}

/** Starts tracking click-and-drag on `target`. Call `destroy` to remove the listeners. */
export function createCameraOrbit(target: HTMLElement): CameraOrbit {
    const orbit: CameraOrbit = {
        destroy() {
            target.removeEventListener('pointerdown', onDown);
            target.removeEventListener('pointermove', onMove);
            target.removeEventListener('pointerup', onUp);
            target.removeEventListener('pointercancel', onUp);
        },
        isDragging: false,
        isStickAiming: false,
        pendingDrag: {
            x: 0,
            y: 0,
        },
        pitch: 0,
        secondsSinceRelease: 0,
        yaw: 0,
    };

    function onDown(event: PointerEvent) {
        /** Capturing keeps the drag going when the pointer leaves the canvas mid-drag. */
        target.setPointerCapture(event.pointerId);
        orbit.isDragging = true;
        event.preventDefault();
    }
    function onMove(event: PointerEvent) {
        if (orbit.isDragging) {
            orbit.pendingDrag.x += event.movementX;
            orbit.pendingDrag.y += event.movementY;
        }
    }
    function onUp() {
        orbit.isDragging = false;
        orbit.secondsSinceRelease = 0;
    }

    target.style.touchAction = 'none';
    target.addEventListener('pointerdown', onDown);
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);

    return orbit;
}

/**
 * Applies the drag since the last frame, then eases the camera back behind the car once the user
 * has let go for long enough. A tilted stick instead aims the camera the way it points, and the
 * camera swings straight back once it's released. `pitchRange` must include 0, the resting pitch.
 */
export function updateCameraOrbit({
    dtSeconds,
    lookStick,
    orbit,
    pitchRange,
}: Readonly<{
    orbit: CameraOrbit;
    dtSeconds: number;
    pitchRange: Readonly<MinMax>;
    /** Each axis from -1 to 1, with up and right negative and positive like a gamepad's. */
    lookStick?: Readonly<{x: number; y: number}> | undefined;
}>) {
    const hasDrag = !!orbit.pendingDrag.x || !!orbit.pendingDrag.y;

    orbit.yaw -= orbit.pendingDrag.x * radiansPerPixel;
    orbit.pitch = clamp(orbit.pitch + orbit.pendingDrag.y * radiansPerPixel, pitchRange);
    orbit.pendingDrag = {
        x: 0,
        y: 0,
    };

    if (orbit.isDragging || hasDrag) {
        orbit.isStickAiming = false;
        return;
    }

    const stickTilt = lookStick
        ? clamp((Math.hypot(lookStick.x, lookStick.y) - stickAimTilt) / (1 - stickAimTilt), {
              max: 1,
              min: 0,
          })
        : 0;
    const isStickTilted = !!lookStick && stickTilt > 0;

    if (isStickTilted || orbit.isStickAiming) {
        const ease = 1 - Math.exp(-dtSeconds * stickAimRate);
        /**
         * Stick up faces forward and the car's right is a negative yaw. A partly tilted stick turns
         * the camera only part of the way toward where it points.
         */
        const target = isStickTilted ? -Math.atan2(lookStick.x, -lookStick.y) * stickTilt : 0;

        orbit.yaw = easeYaw({
            ease,
            target,
            yaw: orbit.yaw,
        });
        orbit.pitch -= orbit.pitch * ease;
        orbit.secondsSinceRelease = 0;
        orbit.isStickAiming = isStickTilted || Math.abs(orbit.yaw) > 1e-3;

        return;
    }

    orbit.secondsSinceRelease += dtSeconds;

    if (
        orbit.secondsSinceRelease >
        convertDuration(
            {
                seconds: 2,
            },
            {
                seconds: true,
            },
        ).seconds
    ) {
        const ease = 1 - Math.exp(-dtSeconds * 2.5);

        /** Unwind through the shorter way around instead of spinning back over several turns. */
        orbit.yaw = easeYaw({
            ease,
            target: 0,
            yaw: orbit.yaw,
        });
        orbit.pitch -= orbit.pitch * ease;
    }
}
