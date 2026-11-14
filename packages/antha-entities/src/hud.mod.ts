import {defineAnthaMod} from '@antha/engine';
import {mapObjectValues} from '@augment-vir/common';
import {renderDial, renderDialFace} from '@evir/driving-common/src/dial.js';
import {css, html, nothing, svg} from 'element-vir';
import {type GarageState} from './garage-state.js';
import {getPresetGauges, toKph} from './hud-format.js';
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

function renderGauges(state: Readonly<Pick<GarageState, 'garage' | 'vehicleView'>>) {
    const {engine, preset} = state.vehicleView;
    const gauges = getPresetGauges(preset);
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
                extras: gauges.hasTachometer ? nothing : gearReadout,
                face: speedometerFace,
                value: toKph(state.vehicleView.forwardSpeed),
            })}
            ${gauges.hasTachometer
                ? renderDial({
                      extras: gearReadout,
                      face: tachometerFaces[preset],
                      value: engine.kiloRpm,
                  })
                : nothing}
        </div>
    `;
}

/** The car's scene position, so a spot can be shared for debugging. */
function renderCoordinates(vehicleView: Readonly<GarageState['vehicleView']>) {
    return html`
        <div
            style=${css`
                color: white;
                font-family: monospace;
                font-size: 12px;
                pointer-events: none;
                position: absolute;
                right: 16px;
                text-shadow: 0 0 4px black;
                top: 40px;
            `}
        >
            x ${vehicleView.position.x.toFixed(2)} y ${vehicleView.position.y.toFixed(2)} z
            ${vehicleView.position.z.toFixed(2)}
        </div>
    `;
}

/** Frames drawn over the last second, refreshed once a second so it stays readable. */
function renderFps(fps: number) {
    return html`
        <div
            style=${css`
                color: white;
                font-family: monospace;
                font-size: 12px;
                left: 16px;
                pointer-events: none;
                position: absolute;
                text-shadow: 0 0 4px black;
                top: 40px;
            `}
        >
            ${fps} fps
        </div>
    `;
}

/** Draws a frame-rate counter, the car's position, and the speedometer and tachometer. */
export function createGarageHudMod() {
    /** Mutated each frame rather than rebuilt, since it updates on every render. */
    const frameRate = {
        elapsedMs: 0,
        fps: 0,
        frames: 0,
    };

    return defineAnthaMod<GarageState>({
        modName: 'garage-hud',
        execute({msSinceLastExecute, state}) {
            const {garage, vehicleView} = state;

            frameRate.frames++;
            frameRate.elapsedMs += msSinceLastExecute;

            if (frameRate.elapsedMs >= 1000) {
                frameRate.fps = Math.round((frameRate.frames * 1000) / frameRate.elapsedMs);
                frameRate.frames = 0;
                frameRate.elapsedMs = 0;
            }

            if (!vehicleView || !garage) {
                return;
            }

            return html`
                ${renderFps(frameRate.fps)} ${renderCoordinates(vehicleView)}
                ${renderGauges({
                    garage,
                    vehicleView,
                })}
            `;
        },
    });
}
