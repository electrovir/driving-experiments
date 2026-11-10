import {defineAnthaMod} from '@antha/engine';
import {parkingBrakeLight, renderDial, renderDialFace} from '@evir/driving-common';
import {css, html, nothing} from 'element-vir';
import {type FlatPlaneState} from './flat-plane-state.js';

const dialMaxKph = 160;
const kphPerMetersPerSecond = 3.6;
const dialFace = renderDialFace({
    max: dialMaxKph,
    tickStep: 10,
    unit: 'km/h',
});

/**
 * Draws an analog speedometer over the bottom left corner of the game, with the dashboard parking
 * brake light in its face while the handbrake is held.
 */
export function createSpeedometerMod() {
    return defineAnthaMod<FlatPlaneState>({
        modName: 'flat-plane-speedometer',
        execute({state}) {
            if (!state.car) {
                return;
            }

            return html`
                <div
                    style=${css`
                        bottom: 16px;
                        left: 16px;
                        pointer-events: none;
                        position: absolute;
                    `}
                >
                    ${renderDial({
                        extras: state.carControls?.handbrake ? parkingBrakeLight : nothing,
                        face: dialFace,
                        /**
                         * Ground speed, so the needle still reads true while the car slides
                         * sideways.
                         */
                        value:
                            Math.hypot(state.car.speed, state.car.lateralSpeed) *
                            kphPerMetersPerSecond,
                    })}
                </div>
            `;
        },
    });
}
