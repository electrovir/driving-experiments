import {defineAnthaMod} from '@antha/engine';
import {createArray} from '@augment-vir/common';
import {css, html, nothing, svg} from 'element-vir';
import {type FlatPlaneState} from './flat-plane-state.js';

const dialMaxKph = 160;
const tickStepKph = 10;
/** Degrees the needle travels from zero to the top of the dial, centered on straight up. */
const dialSweep = 240;
const kphPerMetersPerSecond = 3.6;

/** Degrees clockwise from straight up. */
function kphToAngle(kph: number) {
    return -dialSweep / 2 + (Math.min(kph, dialMaxKph) / dialMaxKph) * dialSweep;
}

const dialMarks = createArray(dialMaxKph / tickStepKph + 1, (index) => {
    const kph = index * tickStepKph;
    const angle = kphToAngle(kph);
    const isLabeled = index % 2 === 0;
    const radians = (angle * Math.PI) / 180;

    return svg`
        <line
            x1="0"
            y1="-46"
            x2="0"
            y2=${isLabeled ? -38 : -42}
            stroke="white"
            stroke-width=${isLabeled ? 2 : 1}
            transform="rotate(${angle})"
        ></line>
        ${
            isLabeled
                ? svg`
                  <text
                      x=${Math.sin(radians) * 30}
                      y=${-Math.cos(radians) * 30 + 3}
                      fill="white"
                      font-size="8"
                      text-anchor="middle"
                  >
                      ${kph}
                  </text>
              `
                : nothing
        }
    `;
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

            /** Ground speed, so the needle still reads true while the car slides sideways. */
            const kph = Math.hypot(state.car.speed, state.car.lateralSpeed) * kphPerMetersPerSecond;

            return html`
                <svg
                    viewBox="-50 -50 100 100"
                    style=${css`
                        bottom: 16px;
                        font-family: sans-serif;
                        left: 16px;
                        pointer-events: none;
                        position: absolute;
                        width: 160px;
                    `}
                >
                    <circle
                        r="49"
                        fill="rgba(0, 0, 0, 0.55)"
                        stroke="white"
                        stroke-width="1"
                    ></circle>
                    ${dialMarks}
                    <text y="22" fill="white" font-size="7" text-anchor="middle">km/h</text>
                    ${state.carControls?.handbrake
                        ? svg`
                              <g
                                  transform="translate(0 33) scale(0.3)"
                                  fill="none"
                                  stroke="#ff4030"
                                  stroke-width="2.5"
                              >
                                  <circle r="11"></circle>
                                  <path
                                      d="M -15 -10 A 16 16 0 0 0 -15 10"
                                      stroke-linecap="round"
                                  ></path>
                                  <path
                                      d="M 15 -10 A 16 16 0 0 1 15 10"
                                      stroke-linecap="round"
                                  ></path>
                                  <text
                                      y="5"
                                      fill="#ff4030"
                                      stroke="none"
                                      font-size="14"
                                      font-weight="bold"
                                      text-anchor="middle"
                                  >
                                      P
                                  </text>
                              </g>
                          `
                        : nothing}
                    <line
                        x1="0"
                        y1="8"
                        x2="0"
                        y2="-40"
                        stroke="#ff4030"
                        stroke-linecap="round"
                        stroke-width="2.5"
                        transform="rotate(${kphToAngle(kph)})"
                    ></line>
                    <circle r="3.5" fill="white"></circle>
                </svg>
            `;
        },
    });
}
