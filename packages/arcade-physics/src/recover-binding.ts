import {KnownInput} from '@antha/gamepad-type';
import {InputDirection} from '@antha/input';
import {type GamepadInputs, type KeyboardKeys} from '@evir/driving-common';

export enum RecoverBinding {
    Recover = 'recover',
}

export const recoverKeyboardKeys: KeyboardKeys<RecoverBinding> = {
    [RecoverBinding.Recover]: [
        'KeyR',
    ],
};

export const recoverGamepadInputs: GamepadInputs<RecoverBinding> = {
    [RecoverBinding.Recover]: [
        {
            direction: InputDirection.Positive,
            inputName: KnownInput.Select,
        },
    ],
};
