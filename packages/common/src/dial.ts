import {clamp, createArray} from '@augment-vir/common';
import {html, nothing, svg, type HtmlInterpolation} from 'element-vir';

/** Degrees the needle travels from zero to the top of the dial, centered on straight up. */
const dialSweep = 240;

/** An analog gauge's scale, drawn by {@link renderDial}. */
export type DialScale = {
    max: number;
    /** The value between neighboring ticks. Every other tick gets a number. */
    tickStep: number;
    /** Shown under the dial's center. */
    unit: string;
    /** Values from here up get a red band. Omit for no band. */
    redlineStart?: number | undefined;
    /** Divides the tick numbers so they stay short, like 1000 to show rpm in thousands. */
    labelDivisor?: number | undefined;
};

/** Degrees clockwise from straight up. */
function toAngle({max, value}: Readonly<{max: number; value: number}>) {
    return (
        -dialSweep / 2 +
        (clamp(value, {
            max,
            min: 0,
        }) /
            max) *
            dialSweep
    );
}

function toPoint({angle, radius}: Readonly<{angle: number; radius: number}>) {
    const radians = (angle * Math.PI) / 180;

    return {
        x: Math.sin(radians) * radius,
        y: -Math.cos(radians) * radius,
    };
}

function renderRedline({max, redlineStart}: Readonly<{max: number; redlineStart: number}>) {
    const radius = 44;
    const start = toPoint({
        angle: toAngle({
            max,
            value: redlineStart,
        }),
        radius,
    });
    const end = toPoint({
        angle: toAngle({
            max,
            value: max,
        }),
        radius,
    });

    return svg`
        <path
            d="M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}"
            fill="none"
            stroke="#ff4030"
            stroke-width="4"
        ></path>
    `;
}

/** A drawn gauge face, which keeps its scale's `max` so the needle can't be drawn on another scale. */
export type DialFace = ReturnType<typeof renderDialFace>;

/**
 * The face of a gauge: background, red band, ticks, numbers, and unit. Pass it to
 * {@link renderDial}.
 */
export function renderDialFace({
    labelDivisor = 1,
    max,
    redlineStart,
    tickStep,
    unit,
}: Readonly<DialScale>) {
    const marks = createArray(Math.floor(max / tickStep) + 1, (index) => {
        const value = index * tickStep;
        const angle = toAngle({
            max,
            value,
        });
        const isLabeled = index % 2 === 0;
        const label = toPoint({
            angle,
            radius: 30,
        });

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
                      <text x=${label.x} y=${label.y + 3} fill="white" font-size="8" text-anchor="middle">
                          ${value / labelDivisor}
                      </text>
                  `
                    : nothing
            }
        `;
    });

    const markup = svg`
        <circle r="49" fill="rgba(0, 0, 0, 0.55)" stroke="white" stroke-width="1"></circle>
        ${
            redlineStart == undefined
                ? nothing
                : renderRedline({
                      max,
                      redlineStart,
                  })
        }
        ${marks}
        <text y="22" fill="white" font-size="7" text-anchor="middle">${unit}</text>
    `;

    return {
        markup,
        max,
    };
}

/**
 * An analog gauge in a 100 by 100 SVG centered on 0,0. `face` comes from {@link renderDialFace} and
 * sets the needle's scale; build it once since it never changes. `extras` draw over the face and
 * under the needle.
 */
export function renderDial({
    extras,
    face,
    value,
}: Readonly<{
    face: Readonly<DialFace>;
    value: number;
    extras?: HtmlInterpolation | undefined;
}>) {
    return html`
        <svg viewBox="-50 -50 100 100" width="160" font-family="sans-serif">
            ${face.markup} ${extras ?? nothing}
            <line
                x1="0"
                y1="8"
                x2="0"
                y2="-40"
                stroke="#ff4030"
                stroke-linecap="round"
                stroke-width="2.5"
                transform="rotate(${toAngle({
                    max: face.max,
                    value,
                })})"
            ></line>
            <circle r="3.5" fill="white"></circle>
        </svg>
    `;
}

/** The dashboard parking brake light, sized to sit under a dial's unit. */
export const parkingBrakeLight = svg`
    <g transform="translate(0 33) scale(0.3)" fill="none" stroke="#ff4030" stroke-width="2.5">
        <circle r="11"></circle>
        <path d="M -15 -10 A 16 16 0 0 0 -15 10" stroke-linecap="round"></path>
        <path d="M 15 -10 A 16 16 0 0 1 15 10" stroke-linecap="round"></path>
        <text y="5" fill="#ff4030" stroke="none" font-size="14" font-weight="bold" text-anchor="middle">P</text>
    </g>
`;
