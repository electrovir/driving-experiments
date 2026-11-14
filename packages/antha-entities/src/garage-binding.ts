import {KnownInput} from '@antha/gamepad-type';
import {InputDirection} from '@antha/input';
import {type GamepadInputs, type KeyboardKeys} from '@evir/driving-common/src/drive-binding.js';

export enum GarageBinding {
    Boost = 'boost',
    /** Only does anything while shifting manually. */
    Clutch = 'clutch',
    CycleCamera = 'cycle-camera',
    /** In the air, rolls the car. Pitch and yaw come from the throttle, brake, and steering. */
    RollLeft = 'roll-left',
    RollRight = 'roll-right',
    Recover = 'recover',
    ReturnToGarage = 'return-to-garage',
    ShiftDown = 'shift-down',
    ShiftUp = 'shift-up',
    ToggleHeadlights = 'toggle-headlights',
    ToggleManualShifting = 'toggle-manual-shifting',
}

export const garageKeyboardKeys: KeyboardKeys<GarageBinding> = {
    [GarageBinding.Boost]: [
        'KeyF',
    ],
    [GarageBinding.Clutch]: [
        'KeyV',
    ],
    [GarageBinding.CycleCamera]: [
        'KeyC',
    ],
    [GarageBinding.RollLeft]: [
        'KeyQ',
    ],
    [GarageBinding.RollRight]: [
        'KeyE',
    ],
    [GarageBinding.Recover]: [
        'KeyR',
    ],
    [GarageBinding.ReturnToGarage]: [
        'KeyG',
    ],
    [GarageBinding.ShiftDown]: [
        'KeyZ',
    ],
    [GarageBinding.ShiftUp]: [
        'KeyX',
    ],
    [GarageBinding.ToggleHeadlights]: [
        'KeyH',
    ],
    [GarageBinding.ToggleManualShifting]: [
        'KeyT',
    ],
};

export const garageGamepadInputs: GamepadInputs<GarageBinding> = {
    [GarageBinding.Boost]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.FaceAlt1,
        },
    ],
    [GarageBinding.Clutch]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.FaceCancel,
        },
    ],
    [GarageBinding.CycleCamera]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.FaceAlt2,
        },
    ],
    [GarageBinding.RollLeft]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.L1,
        },
    ],
    [GarageBinding.RollRight]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.R1,
        },
    ],
    [GarageBinding.Recover]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.Select,
        },
    ],
    [GarageBinding.ReturnToGarage]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.Start,
        },
    ],
    [GarageBinding.ShiftDown]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.DPadLeft,
        },
    ],
    [GarageBinding.ShiftUp]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.DPadRight,
        },
    ],
    [GarageBinding.ToggleHeadlights]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.DPadUp,
        },
    ],
    [GarageBinding.ToggleManualShifting]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.DPadDown,
        },
    ],
};

/** On-screen table of every control. Update it with the key and gamepad maps. */
export const garageControls: ReadonlyArray<
    Readonly<{
        action: string;
        keyboard: string;
        gamepad: string;
    }>
> = [
    {
        action: 'Drive',
        gamepad: 'R2 / L2, left stick',
        keyboard: 'WASD / arrows',
    },
    {
        action: 'Handbrake',
        gamepad: 'A',
        keyboard: 'Space / Shift',
    },
    {
        action: 'Boost',
        gamepad: 'X',
        keyboard: 'F',
    },
    {
        action: 'Spin in the air',
        gamepad: 'L1 / R1',
        keyboard: 'Q / E',
    },
    {
        action: 'Look around',
        gamepad: 'right stick',
        keyboard: 'drag',
    },
    {
        action: 'Camera',
        gamepad: 'Y',
        keyboard: 'C',
    },
    {
        action: 'Manual / automatic',
        gamepad: 'D-pad down',
        keyboard: 'T',
    },
    {
        action: 'Shift down / up (manual)',
        gamepad: 'D-pad left / right',
        keyboard: 'Z / X',
    },
    {
        action: 'Clutch (manual)',
        gamepad: 'B',
        keyboard: 'V',
    },
    {
        action: 'Headlights',
        gamepad: 'D-pad up',
        keyboard: 'H',
    },
    {
        action: 'Back on wheels',
        gamepad: 'Select',
        keyboard: 'R',
    },
    {
        action: 'Back to garage',
        gamepad: 'Start',
        keyboard: 'G',
    },
];
