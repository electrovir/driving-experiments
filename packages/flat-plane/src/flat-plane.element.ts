import {AnthaEngine, AnthaUi} from '@antha/engine';
import {createAnthaInputBindingsMod, createAnthaReadRawInputMod} from '@antha/input';
import {
    createPlayerOneBindings,
    createSceneMod,
    driveControlsHint,
    driveGamepadInputs,
    driveKeyboardKeys,
    type DriveBinding,
} from '@evir/driving-common';
import {defineDrivingElement} from '@evir/driving-core';
import {css, html} from 'element-vir';
import {initialCarState} from './car.js';
import {createDriveMod} from './drive.mod.js';
import {type FlatPlaneState} from './flat-plane-state.js';
import {createSpeedometerMod} from './speedometer.mod.js';

export const FlatPlaneGame = defineDrivingElement()({
    tagName: 'driving-flat-plane-game',
    styles: css`
        :host {
            display: block;
            height: 100%;
            overflow: hidden;
            position: relative;
            width: 100%;
        }

        ${AnthaUi} {
            display: block;
            height: 100%;
            padding: 0;
            position: relative;
            width: 100%;
        }

        .controls {
            bottom: 8px;
            color: white;
            font-family: sans-serif;
            pointer-events: none;
            position: absolute;
            right: 8px;
            text-shadow: 0 0 4px black;
            z-index: 1;
        }
    `,
    state() {
        return {
            engine: new AnthaEngine<FlatPlaneState>({
                initState: {
                    bindingAssignments: createPlayerOneBindings({
                        gamepadInputs: driveGamepadInputs,
                        keyboardKeys: driveKeyboardKeys,
                    }),
                    car: initialCarState,
                },
                mods: [
                    createAnthaReadRawInputMod(),
                    createAnthaInputBindingsMod<DriveBinding>(),
                    createDriveMod(),
                    createSceneMod(),
                    createSpeedometerMod(),
                ],
            }),
        };
    },
    render({state}) {
        return html`
            <${AnthaUi.assign({
                engine: state.engine,
            })}></${AnthaUi}>
            <div class="controls">${driveControlsHint}</div>
        `;
    },
});
