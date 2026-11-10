import {AnthaEngine, AnthaUi} from '@antha/engine';
import {createAnthaInputBindingsMod, createAnthaReadRawInputMod} from '@antha/input';
import {
    createPlayerOneBindings,
    createSceneMod,
    driveGamepadInputs,
    driveKeyboardKeys,
    type DriveBinding,
} from '@evir/driving-common';
import {defineDrivingElement} from '@evir/driving-core';
import {css, html} from 'element-vir';
import {createDriveMod} from './drive.mod.js';
import {createGaugesMod} from './gauges.mod.js';
import {
    gearGamepadInputs,
    gearKeyboardKeys,
    tiresAndGearsControlsHint,
    type GearBinding,
} from './gear-binding.js';
import {type TiresAndGearsState} from './tires-and-gears-state.js';
import {trackLayout} from './track-layout.js';
import {getBodyLean, initialVehicleState} from './vehicle.js';

export const TiresAndGearsGame = defineDrivingElement()({
    tagName: 'driving-tires-and-gears-game',
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
            top: 8px;
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
            engine: new AnthaEngine<TiresAndGearsState>({
                initState: {
                    bindingAssignments: createPlayerOneBindings({
                        gamepadInputs: {
                            ...driveGamepadInputs,
                            ...gearGamepadInputs,
                        },
                        keyboardKeys: {
                            ...driveKeyboardKeys,
                            ...gearKeyboardKeys,
                        },
                    }),
                    car: initialVehicleState,
                    carBodyLean: getBodyLean(initialVehicleState),
                },
                mods: [
                    createAnthaReadRawInputMod(),
                    createAnthaInputBindingsMod<DriveBinding | GearBinding>(),
                    createDriveMod(),
                    createSceneMod({
                        track: trackLayout,
                    }),
                    createGaugesMod(),
                ],
            }),
        };
    },
    render({state}) {
        return html`
            <${AnthaUi.assign({
                engine: state.engine,
            })}></${AnthaUi}>
            <div class="controls">${tiresAndGearsControlsHint}</div>
        `;
    },
});
