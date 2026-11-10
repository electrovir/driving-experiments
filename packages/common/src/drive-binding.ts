import {KnownInput} from '@antha/gamepad-type';
import {
    defaultPlayerGamepads,
    getAxisValue,
    getDirectionalInput,
    InputDirection,
    type ActiveBindings,
    type BindingAssignment,
    type PlayersBindingAssignments,
} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {clamp, mapObjectValues} from '@augment-vir/common';
import {type CarControls} from './car-controls.js';

/** The `deviceKey` Antha gives keyboard inputs. */
export const keyboardDeviceKey = 'keyboard' as const;

export enum DriveBinding {
    Throttle = 'throttle',
    Brake = 'brake',
    SteerLeft = 'steer-left',
    SteerRight = 'steer-right',
    Handbrake = 'handbrake',
    LookLeft = 'look-left',
    LookRight = 'look-right',
    LookUp = 'look-up',
    LookDown = 'look-down',
}

/** Keyboard `KeyboardEvent.code` values for each binding. */
export type KeyboardKeys<Binding extends string> = Readonly<Record<Binding, ReadonlyArray<string>>>;

/** Gamepad inputs for each binding. */
export type GamepadInputs<Binding extends string> = Readonly<
    Record<Binding, ReadonlyArray<Readonly<Pick<BindingAssignment, 'direction' | 'inputName'>>>>
>;

export const driveKeyboardKeys: KeyboardKeys<DriveBinding> = {
    [DriveBinding.Throttle]: [
        'KeyW',
        'ArrowUp',
    ],
    [DriveBinding.Brake]: [
        'KeyS',
        'ArrowDown',
    ],
    [DriveBinding.SteerLeft]: [
        'KeyA',
        'ArrowLeft',
    ],
    [DriveBinding.SteerRight]: [
        'KeyD',
        'ArrowRight',
    ],
    [DriveBinding.Handbrake]: [
        'Space',
        'ShiftLeft',
        'ShiftRight',
    ],
    /** The mouse already orbits the camera, so looking around needs no keys. */
    [DriveBinding.LookLeft]: [],
    [DriveBinding.LookRight]: [],
    [DriveBinding.LookUp]: [],
    [DriveBinding.LookDown]: [],
};

export const driveGamepadInputs: GamepadInputs<DriveBinding> = {
    [DriveBinding.Throttle]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.R2,
        },
    ],
    [DriveBinding.Brake]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.L2,
        },
    ],
    [DriveBinding.SteerLeft]: [
        {
            direction: InputDirection.Negative,
            inputName: KnownInput.LeftStickX,
        },
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.DPadLeft,
        },
    ],
    [DriveBinding.SteerRight]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.LeftStickX,
        },
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.DPadRight,
        },
    ],
    [DriveBinding.Handbrake]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.FaceAccept,
        },
    ],
    [DriveBinding.LookLeft]: [
        {
            direction: InputDirection.Negative,
            inputName: KnownInput.RightStickX,
        },
    ],
    [DriveBinding.LookRight]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.RightStickX,
        },
    ],
    [DriveBinding.LookUp]: [
        {
            direction: InputDirection.Negative,
            inputName: KnownInput.RightStickY,
        },
    ],
    [DriveBinding.LookDown]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.RightStickY,
        },
    ],
};

/** On-screen summary of {@link driveKeyboardKeys} and {@link driveGamepadInputs}. Update it with them. */
export const driveControlsHint =
    'WASD / arrows / gamepad · Space / Shift / gamepad A: handbrake · drag / right stick: camera';

/** Assigns every binding's keyboard keys and gamepad inputs to player one and the first gamepad. */
export function createPlayerOneBindings<Binding extends string>({
    gamepadInputs,
    keyboardKeys,
}: Readonly<{
    keyboardKeys: KeyboardKeys<Binding>;
    gamepadInputs: GamepadInputs<Binding>;
}>): PlayersBindingAssignments<Binding> {
    return {
        [LocalPlayerPosition.One]: mapObjectValues(
            keyboardKeys,
            (binding, keys): BindingAssignment[] => {
                return [
                    ...gamepadInputs[binding].map((input) => {
                        return {
                            ...input,
                            deviceKey: defaultPlayerGamepads[LocalPlayerPosition.One],
                        };
                    }),
                    ...keys.map((key) => {
                        return {
                            deviceKey: keyboardDeviceKey,
                            direction: InputDirection.Positive,
                            inputName: `button-${key}`,
                        };
                    }),
                ];
            },
        ),
    };
}

/**
 * Antha adds up every held input bound to a control, so holding two keys for one control reads as
 * 2.
 */
const pedalRange = {
    max: 1,
    min: 0,
};

/** Reads player one's driving controls, clamped to {@link CarControls}' ranges. */
export function readCarControls(
    activeBindings: Readonly<ActiveBindings<DriveBinding>> | undefined,
): CarControls {
    return {
        brake: clamp(activeBindings?.[DriveBinding.Brake]?.value ?? 0, pedalRange),
        handbrake: clamp(activeBindings?.[DriveBinding.Handbrake]?.value ?? 0, pedalRange),
        steer: clamp(
            getAxisValue({
                negative: getDirectionalInput({
                    activeBindings,
                    bindingName: DriveBinding.SteerLeft,
                }),
                positive: getDirectionalInput({
                    activeBindings,
                    bindingName: DriveBinding.SteerRight,
                }),
            }),
            {
                max: 1,
                min: -1,
            },
        ),
        throttle: clamp(activeBindings?.[DriveBinding.Throttle]?.value ?? 0, pedalRange),
    };
}
