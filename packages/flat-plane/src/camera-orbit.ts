import {clamp, type MinMax} from '@augment-vir/common';
import {convertDuration} from 'date-vir';

/** The user's drag offset on top of the normal chase camera angle. */
export type CameraOrbit = {
    /** Radians around the car, added to the car's heading. */
    yaw: number;
    /** Radians added to the camera's normal angle above the car. */
    pitch: number;
    isDragging: boolean;
    secondsSinceRelease: number;
    /** Pointer motion since the last frame, in pixels. */
    pendingDrag: {
        x: number;
        y: number;
    };
    destroy: () => void;
};

const radiansPerPixel = 0.005;

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
 * has let go for long enough. `pitchRange` must include 0, the resting pitch.
 */
export function updateCameraOrbit({
    dtSeconds,
    orbit,
    pitchRange,
}: Readonly<{
    orbit: CameraOrbit;
    dtSeconds: number;
    pitchRange: Readonly<MinMax>;
}>) {
    orbit.yaw -= orbit.pendingDrag.x * radiansPerPixel;
    orbit.pitch = clamp(orbit.pitch + orbit.pendingDrag.y * radiansPerPixel, pitchRange);
    orbit.pendingDrag = {
        x: 0,
        y: 0,
    };

    if (orbit.isDragging) {
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
        const wrappedYaw = Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw));

        orbit.yaw = wrappedYaw - wrappedYaw * ease;
        orbit.pitch -= orbit.pitch * ease;
    }
}
