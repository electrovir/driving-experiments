import {defineAnthaMod} from '@antha/engine';
import {clamp, getObjectTypedEntries, getObjectTypedValues} from '@augment-vir/common';
import {
    type CarControls,
    parkingBrakeLight,
    renderDial,
    renderDialFace,
} from '@evir/driving-common';
import {css, html, nothing, svg} from 'element-vir';
import {redlineRpm} from './drivetrain.js';
import {type TiresAndGearsState} from './tires-and-gears-state.js';
import {getWheelOffset, initialVehicleState, type VehicleState} from './vehicle.js';

const speedometerMaxKph = 240;
const tachometerMaxRpm = 8000;
const kphPerMetersPerSecond = 3.6;
const speedometerFace = renderDialFace({
    max: speedometerMaxKph,
    tickStep: 20,
    unit: 'km/h',
});
const tachometerFace = renderDialFace({
    labelDivisor: 1000,
    max: tachometerMaxRpm,
    redlineStart: redlineRpm,
    tickStep: 500,
    unit: '×1000 rpm',
});

/** SVG units per meter in the tire load diagram. */
const tireDiagramScale = 15;
/** A tire at its resting load gets this radius; the area grows with the load. */
const restingTireRadius = 5;
const restingLoad =
    getObjectTypedValues(initialVehicleState.tires).reduce((sum, tire) => sum + tire.load, 0) /
    getObjectTypedValues(initialVehicleState.tires).length;

/** Pedal bars fill from the bottom, like a sim racing input display. */
function renderPedals(controls: Readonly<Pick<CarControls, 'brake' | 'throttle'>>) {
    const barHeight = 60;
    const bars = [
        {
            color: '#ff4030',
            label: 'B',
            value: controls.brake,
        },
        {
            color: '#30d050',
            label: 'T',
            value: controls.throttle,
        },
    ];

    return html`
        <svg viewBox="0 0 34 80" width="34" font-family="sans-serif">
            ${bars.map((bar, index) => {
                const x = 2 + index * 16;
                const height =
                    barHeight *
                    clamp(bar.value, {
                        max: 1,
                        min: 0,
                    });

                return svg`
                    <rect x=${x} y="4" width="12" height=${barHeight} fill="rgba(0, 0, 0, 0.55)" stroke="white" stroke-width="1"></rect>
                    <rect x=${x} y=${4 + barHeight - height} width="12" height=${height} fill=${bar.color}></rect>
                    <text x=${x + 6} y="76" fill="white" font-size="8" text-anchor="middle">${bar.label}</text>
                `;
            })}
        </svg>
    `;
}

/** Each tire, viewed from above with the nose up, sized by its load and colored by its grip use. */
function renderTireLoads(tires: Readonly<VehicleState['tires']>) {
    return html`
        <svg viewBox="-30 -40 60 80" width="72" font-family="sans-serif">
            <rect
                x="-10"
                y="-30"
                width="20"
                height="60"
                rx="5"
                fill="rgba(0, 0, 0, 0.55)"
                stroke="white"
                stroke-width="1"
            ></rect>
            ${getObjectTypedEntries(tires).map(
                ([
                    position,
                    tire,
                ]) => {
                    const offset = getWheelOffset(position);

                    return svg`
                    <circle
                        cx=${offset.right * tireDiagramScale}
                        cy=${-offset.forward * tireDiagramScale}
                        r=${restingTireRadius * Math.sqrt(tire.load / restingLoad)}
                        fill="hsl(${120 * (1 - Math.min(tire.gripUsage, 1))} 80% 50%)"
                        stroke="black"
                        stroke-width="0.5"
                    ></circle>
                `;
                },
            )}
        </svg>
    `;
}

/**
 * Draws the speedometer, the tachometer with the gear and gearbox mode, a diagram of how much
 * weight each tire carries, and the throttle and brake inputs.
 */
export function createGaugesMod() {
    return defineAnthaMod<TiresAndGearsState>({
        modName: 'tires-and-gears-gauges',
        execute({state}) {
            if (!state.car) {
                return;
            }

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
                        extras: state.carControls?.handbrake ? parkingBrakeLight : nothing,
                        face: speedometerFace,
                        /**
                         * Ground speed, so the needle still reads true while the car slides
                         * sideways.
                         */
                        value:
                            Math.hypot(state.car.speed, state.car.lateralSpeed) *
                            kphPerMetersPerSecond,
                    })}
                    ${renderDial({
                        extras: svg`
                            <text y="38" fill="white" font-size="13" font-weight="bold" text-anchor="middle">
                                ${state.car.drivetrain.gear}
                            </text>
                            <text x="11" y="38" fill="white" font-size="6" text-anchor="start">
                                ${state.car.drivetrain.isAutomatic ? 'A' : 'M'}
                            </text>
                        `,
                        face: tachometerFace,
                        value: state.car.drivetrain.rpm,
                    })}
                    ${renderTireLoads(state.car.tires)}
                    ${state.carControls ? renderPedals(state.carControls) : nothing}
                </div>
            `;
        },
    });
}
