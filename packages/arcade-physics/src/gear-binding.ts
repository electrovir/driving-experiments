import {KnownInput} from '@antha/gamepad-type';
import {InputDirection} from '@antha/input';
import {driveControlsHint, type GamepadInputs, type KeyboardKeys} from '@evir/driving-common';

export enum GearBinding {
    ShiftUp = 'shift-up',
    ShiftDown = 'shift-down',
    ToggleAutomatic = 'toggle-automatic',
}

export const gearKeyboardKeys: KeyboardKeys<GearBinding> = {
    [GearBinding.ShiftUp]: [
        'KeyE',
    ],
    [GearBinding.ShiftDown]: [
        'KeyQ',
    ],
    [GearBinding.ToggleAutomatic]: [
        'KeyT',
    ],
};

export const gearGamepadInputs: GamepadInputs<GearBinding> = {
    [GearBinding.ShiftUp]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.R1,
        },
    ],
    [GearBinding.ShiftDown]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.L1,
        },
    ],
    [GearBinding.ToggleAutomatic]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.FaceAlt2,
        },
    ],
};

/** On-screen summary of every control. Update it with the key and gamepad maps. */
export const arcadePhysicsControlsHint = [
    driveControlsHint,
    'Q / E / L1 / R1: shift',
    'T / gamepad Y: automatic or manual',
    'R / gamepad Select: put the car back on its wheels',
].join(' · ');
