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
import {type ArcadePhysicsState} from './arcade-physics-state.js';
import {cityLayout} from './city-layout.js';
import {createDriveMod} from './drive.mod.js';
import {createGaugesMod} from './gauges.mod.js';
import {
    arcadePhysicsControlsHint,
    gearGamepadInputs,
    gearKeyboardKeys,
    type GearBinding,
} from './gear-binding.js';
import {recoverGamepadInputs, recoverKeyboardKeys, type RecoverBinding} from './recover-binding.js';
import {createSoundMod} from './sound.mod.js';
import {getBodyLean, initialVehicleState, wheelOffsets} from './vehicle.js';

export const ArcadePhysicsGame = defineDrivingElement()({
    tagName: 'driving-arcade-physics-game',
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
            engine: new AnthaEngine<ArcadePhysicsState>({
                initState: {
                    bindingAssignments: createPlayerOneBindings({
                        gamepadInputs: {
                            ...driveGamepadInputs,
                            ...gearGamepadInputs,
                            ...recoverGamepadInputs,
                        },
                        keyboardKeys: {
                            ...driveKeyboardKeys,
                            ...gearKeyboardKeys,
                            ...recoverKeyboardKeys,
                        },
                    }),
                    car: initialVehicleState,
                    carBodyLean: getBodyLean(initialVehicleState),
                },
                mods: [
                    createAnthaReadRawInputMod(),
                    createAnthaInputBindingsMod<DriveBinding | GearBinding | RecoverBinding>(),
                    createDriveMod(),
                    createSceneMod({
                        roads: cityLayout,
                        wheelPositions: wheelOffsets,
                    }),
                    createGaugesMod(),
                    createSoundMod(),
                ],
            }),
        };
    },
    render({state}) {
        return html`
            <${AnthaUi.assign({
                engine: state.engine,
            })}></${AnthaUi}>
            <div class="controls">${arcadePhysicsControlsHint}</div>
        `;
    },
});
