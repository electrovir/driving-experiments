import {defineAnthaMod} from '@antha/engine';
import {mapObjectValues} from '@augment-vir/common';
import {renderDial, renderDialFace} from '@evir/driving-common/src/dial.js';
import {css, html, svg, type HtmlInterpolation} from 'element-vir';
import {type GarageState} from './garage-state.js';
import {toKph} from './hud-format.js';
import {carPresets} from './physics/vehicle-preset.js';

const speedometerFace = renderDialFace({
    max: 240,
    tickStep: 20,
    unit: 'km/h',
});

const tachometerFaces = mapObjectValues(carPresets, (preset, tuning) => {
    const redlineKiloRpm = tuning.engine.maxRpm / 1000;

    return renderDialFace({
        max: Math.ceil(redlineKiloRpm) + 1,
        redlineStart: redlineKiloRpm,
        tickStep: 1,
        unit: '×1000 rpm',
    });
});

function renderGauges(state: Readonly<Pick<GarageState, 'garage' | 'vehicleView'>>) {
    const {engine, preset} = state.vehicleView;
    const gearReadout = svg`
        <text y="38" fill="white" font-size="11" font-weight="bold" text-anchor="middle">
            ${engine.gearLabel}
        </text>
        <text x="-16" y="38" fill="#bbbbbb" font-size="7" text-anchor="middle">
            ${engine.shiftModeLabel}
        </text>
    `;

    return html`
        <div
            style=${css`
                align-items: flex-end;
                bottom: 16px;
                display: flex;
                gap: 8px;
                left: 16px;
                pointer-events: none;
                position: absolute;
            `}
        >
            ${renderDial({
                face: speedometerFace,
                value: toKph(state.vehicleView.forwardSpeed),
            })}
            ${renderDial({
                extras: gearReadout,
                face: tachometerFaces[preset],
                value: engine.kiloRpm,
            })}
        </div>
    `;
}

function renderMenu(state: Readonly<Pick<GarageState, 'garage' | 'vehicleView'>>) {
    return html`
        <div
            style=${css`
                background: rgba(0, 0, 0, 0.7);
                border: 1px solid white;
                color: white;
                display: flex;
                flex-direction: column;
                font-family: sans-serif;
                gap: 6px;
                left: 16px;
                padding: 12px;
                pointer-events: none;
                position: absolute;
                top: 40px;
                width: 280px;
            `}
        >
            <div
                style=${css`
                    font-size: 18px;
                    font-weight: bold;
                `}
            >
                Garage
            </div>
            <div
                style=${css`
                    font-size: 12px;
                    opacity: 0.8;
                `}
            >
                Drive into a parked car to take it, then out toward the track.
            </div>
            <div
                style=${css`
                    font-weight: bold;
                `}
            >
                ${carPresets[state.vehicleView.preset].label}
            </div>
            <div
                style=${css`
                    font-size: 12px;
                    opacity: 0.85;
                `}
            >
                ${carPresets[state.vehicleView.preset].description}
            </div>
        </div>
    `;
}

const garageReminder: HtmlInterpolation = html`
    <div
        style=${css`
            color: white;
            font-family: sans-serif;
            font-size: 12px;
            left: 16px;
            pointer-events: none;
            position: absolute;
            text-shadow: 0 0 4px black;
            top: 40px;
        `}
    >
        G / Start: back to the garage
    </div>
`;

/**
 * Draws the garage menu while parked inside, otherwise a reminder of how to return, plus the
 * speedometer and tachometer.
 */
export function createGarageHudMod() {
    return defineAnthaMod<GarageState>({
        modName: 'garage-hud',
        execute({state}) {
            const {garage, vehicleView} = state;

            if (!vehicleView || !garage) {
                return;
            }

            const hudState = {
                garage,
                vehicleView,
            };

            return html`
                ${garage.isInGarage ? renderMenu(hudState) : garageReminder}
                ${renderGauges(hudState)}
            `;
        },
    });
}
