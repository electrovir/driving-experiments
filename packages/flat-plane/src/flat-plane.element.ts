import {AnthaEngine, AnthaUi} from '@antha/engine';
import {createAnthaInputBindingsMod, createAnthaReadRawInputMod} from '@antha/input';
import {defineDrivingElement} from '@evir/driving-core';
import {css, html} from 'element-vir';
import {initialCarState} from './car.js';
import {controlsHint, driveBindings, type DriveBinding} from './drive-binding.js';
import {createDriveMod} from './drive.mod.js';
import {type FlatPlaneState} from './flat-plane-state.js';
import {createSceneMod} from './scene.mod.js';
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
                    bindingAssignments: driveBindings,
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
            <div class="controls">${controlsHint}</div>
        `;
    },
});
