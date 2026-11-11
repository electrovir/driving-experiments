import {AnthaEngine, AnthaUi} from '@antha/engine';
import {createAnthaInputBindingsMod, createAnthaReadRawInputMod} from '@antha/input';
import {
    createPlayerOneBindings,
    driveGamepadInputs,
    driveKeyboardKeys,
    type DriveBinding,
} from '@evir/driving-common/src/drive-binding.js';
import {defineDrivingElement} from '@evir/driving-core';
import {css, html} from 'element-vir';
import {garageSpawn} from './arena-layout.js';
import {createDriveMod} from './drive.mod.js';
import {
    garageControls,
    garageGamepadInputs,
    garageKeyboardKeys,
    type GarageBinding,
} from './garage-binding.js';
import {createParkedVehicles} from './garage-parking.js';
import {type GarageState} from './garage-state.js';
import {createGarageHudMod} from './hud.mod.js';
import {CarPreset} from './physics/vehicle-preset.js';
import {createVehicleSimulation, getVehicleView} from './physics/vehicle-sim.js';
import {createGarageSceneMod} from './scene.mod.js';
import {createGarageSoundMod} from './sound.mod.js';

const vehicle = createVehicleSimulation({
    heading: garageSpawn.heading,
    point: garageSpawn.point,
    preset: CarPreset.Sedan,
});

export const GarageGame = defineDrivingElement()({
    tagName: 'driving-garage-game',
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
            border-collapse: collapse;
            bottom: 8px;
            color: white;
            font-family: sans-serif;
            font-size: 11px;
            pointer-events: none;
            position: absolute;
            right: 8px;
            text-shadow: 0 0 4px black;
            z-index: 1;

            & th,
            & td {
                padding: 1px 6px;
                text-align: left;
            }

            & th {
                opacity: 0.7;
            }
        }
    `,
    state() {
        return {
            engine: new AnthaEngine<GarageState>({
                initState: {
                    bindingAssignments: createPlayerOneBindings({
                        gamepadInputs: {
                            ...driveGamepadInputs,
                            ...garageGamepadInputs,
                        },
                        keyboardKeys: {
                            ...driveKeyboardKeys,
                            ...garageKeyboardKeys,
                        },
                    }),
                    garage: {
                        isInGarage: true,
                        parkedVehicles: createParkedVehicles(),
                    },
                    vehicle,
                    vehicleView: getVehicleView(vehicle),
                },
                mods: [
                    createAnthaReadRawInputMod(),
                    createAnthaInputBindingsMod<DriveBinding | GarageBinding>(),
                    createDriveMod(),
                    createGarageSceneMod(),
                    createGarageHudMod(),
                    createGarageSoundMod(),
                ],
            }),
        };
    },
    render({state}) {
        return html`
            <${AnthaUi.assign({
                engine: state.engine,
            })}></${AnthaUi}>
            <table class="controls">
                <tr>
                    <th></th>
                    <th>Keyboard</th>
                    <th>Gamepad</th>
                </tr>
                ${garageControls.map((control) => {
                    return html`
                        <tr>
                            <td>${control.action}</td>
                            <td>${control.keyboard}</td>
                            <td>${control.gamepad}</td>
                        </tr>
                    `;
                })}
            </table>
        `;
    },
});
