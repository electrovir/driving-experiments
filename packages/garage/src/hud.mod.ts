import {defineAnthaMod} from '@antha/engine';
import {mapObjectValues} from '@augment-vir/common';
import {renderDial, renderDialFace} from '@evir/driving-common/src/dial.js';
import {css, html, nothing, svg, unsafeCSS, type HtmlInterpolation} from 'element-vir';
import {type GarageState} from './garage-state.js';
import {getBarFraction, getPresetGauges, toKph} from './hud-format.js';
import {carPresets} from './physics/vehicle-preset.js';

const speedometerFace = renderDialFace({
    max: 240,
    tickStep: 20,
    unit: 'km/h',
});

const tachometerFaces = mapObjectValues(carPresets, (preset) => {
    const {redlineKiloRpm} = getPresetGauges(preset);

    return renderDialFace({
        max: Math.ceil(redlineKiloRpm) + 1,
        redlineStart: redlineKiloRpm,
        tickStep: 1,
        unit: '×1000 rpm',
    });
});

function renderBar({
    color,
    fraction,
    isGlowing,
    label,
}: Readonly<{
    color: string;
    fraction: number;
    isGlowing?: boolean | undefined;
    label: string;
}>) {
    return html`
        <div
            style=${css`
                align-items: center;
                display: flex;
                font-size: 12px;
                gap: 6px;
            `}
        >
            <span
                style=${css`
                    width: 44px;
                `}
            >
                ${label}
            </span>
            <div
                style=${css`
                    background: rgba(0, 0, 0, 0.55);
                    border: 1px solid white;
                    height: 10px;
                    width: 120px;
                `}
            >
                <div
                    style=${css`
                        background: ${unsafeCSS(color)};
                        box-shadow: ${unsafeCSS(isGlowing ? `0 0 10px 3px ${color}` : 'none')};
                        height: 100%;
                        width: ${getBarFraction(fraction) * 100}%;
                    `}
                ></div>
            </div>
        </div>
    `;
}

function renderGauges(state: Readonly<Pick<GarageState, 'garage' | 'vehicleView'>>) {
    const {boost, engine, health, preset} = state.vehicleView;
    const gauges = getPresetGauges(preset);

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
                extras: svg`
                    <text y="38" fill="white" font-size="11" font-weight="bold" text-anchor="middle">
                        ${engine.gearLabel}
                    </text>
                `,
                face: speedometerFace,
                value: toKph(state.vehicleView.forwardSpeed),
            })}
            ${gauges.hasTachometer
                ? renderDial({
                      face: tachometerFaces[preset],
                      value: engine.kiloRpm,
                  })
                : nothing}
            <div
                style=${css`
                    color: white;
                    display: flex;
                    flex-direction: column;
                    font-family: sans-serif;
                    gap: 6px;
                `}
            >
                ${renderBar({
                    color: '#ffb020',
                    fraction: boost.amount,
                    isGlowing: boost.isBoosting,
                    label: 'Boost',
                })}
                ${gauges.hasHealth
                    ? renderBar({
                          color: '#30d050',
                          fraction: health,
                          label: 'Health',
                      })
                    : nothing}
            </div>
        </div>
    `;
}

function renderStunts(state: Readonly<Pick<GarageState, 'garage' | 'vehicleView'>>) {
    const {isCrashing, stunt} = state.vehicleView;

    return html`
        <div
            style=${css`
                align-items: center;
                color: ${unsafeCSS(isCrashing ? '#ff4030' : 'white')};
                display: flex;
                flex-direction: column;
                font-family: sans-serif;
                gap: 8px;
                left: 50%;
                pointer-events: none;
                position: absolute;
                text-align: center;
                text-shadow: 0 0 6px black;
                top: 20%;
                transform: translateX(-50%);
            `}
        >
            ${isCrashing
                ? html`
                      <div
                          style=${css`
                              font-size: 32px;
                              font-weight: bold;
                          `}
                      >
                          Crashed
                      </div>
                  `
                : nothing}
            ${stunt.current
                ? html`
                      <div
                          style=${css`
                              font-size: 36px;
                              font-weight: bold;
                          `}
                      >
                          ${stunt.current}
                      </div>
                  `
                : nothing}
            ${stunt.lastCompleted
                ? html`
                      <div
                          style=${css`
                              animation: garage-hud-fade-in 1s ease-out;
                              color: #ffd040;
                              font-size: 22px;
                          `}
                      >
                          ${stunt.lastCompleted}
                      </div>
                  `
                : nothing}
        </div>
        <div
            style=${css`
                color: white;
                font-family: sans-serif;
                font-size: 20px;
                font-weight: bold;
                pointer-events: none;
                position: absolute;
                right: 16px;
                text-shadow: 0 0 4px black;
                top: 40px;
            `}
        >
            Score ${stunt.totalScore.toFixed(1)}
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
 * speedometer, tachometer, boost and health bars, and the stunt readout.
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
                <style>
                    @keyframes garage-hud-fade-in {
                        from {
                            opacity: 0;
                        }
                        to {
                            opacity: 1;
                        }
                    }
                </style>
                ${garage.isInGarage ? renderMenu(hudState) : garageReminder}
                ${renderGauges(hudState)} ${renderStunts(hudState)}
            `;
        },
    });
}
