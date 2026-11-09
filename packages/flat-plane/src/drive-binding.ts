import {KnownInput} from '@antha/gamepad-type';
import {
    defaultPlayerGamepads,
    InputDirection,
    type BindingAssignment,
    type PlayersBindingAssignments,
} from '@antha/input';
import {LocalPlayerPosition} from '@antha/util';
import {mapEnumToObject} from '@augment-vir/common';

export enum DriveBinding {
    Throttle = 'throttle',
    Brake = 'brake',
    SteerLeft = 'steer-left',
    SteerRight = 'steer-right',
    Handbrake = 'handbrake',
}

const keyboardKeys: Readonly<Record<DriveBinding, ReadonlyArray<string>>> = {
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
};

const gamepadInputs: Readonly<
    Record<
        DriveBinding,
        ReadonlyArray<Readonly<Pick<BindingAssignment, 'direction' | 'inputName'>>>
    >
> = {
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
};

/** On-screen summary of {@link keyboardKeys} and {@link gamepadInputs}. Update it with them. */
export const controlsHint = 'WASD / arrows / gamepad · Space / Shift / gamepad A: handbrake';

/** WASD, the arrow keys, or the first gamepad. */
export const driveBindings: PlayersBindingAssignments<DriveBinding> = {
    [LocalPlayerPosition.One]: mapEnumToObject(DriveBinding, (binding): BindingAssignment[] => {
        return [
            ...gamepadInputs[binding].map((input) => {
                return {
                    ...input,
                    deviceKey: defaultPlayerGamepads[LocalPlayerPosition.One],
                };
            }),
            ...keyboardKeys[binding].map((key) => {
                return {
                    deviceKey: 'keyboard' as const,
                    direction: InputDirection.Positive,
                    inputName: `button-${key}`,
                };
            }),
        ];
    }),
};
