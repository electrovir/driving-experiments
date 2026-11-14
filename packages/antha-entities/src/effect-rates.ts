// cspell:words randomation
import {clamp01, rotateVector, type Quaternion} from './physics/vector.js';
import {skidSlipStart} from './skid-marks.js';
import {type LightsView, type VehicleImpact, type WheelView} from './vehicle-view.js';

/** The car's yaw in radians: 0 faces +z and positive turns toward +x. */
export function getHeading(rotation: Readonly<Quaternion>) {
    const forward = rotateVector(rotation, {
        x: 0,
        y: 0,
        z: 1,
    });

    return Math.atan2(forward.x, forward.z);
}

/**
 * Turns an emission rate into a whole number of particles this frame, carrying the fraction over so
 * slow rates still emit.
 */
export function takeEmission({
    carry,
    dtSeconds,
    ratePerSecond,
}: Readonly<{
    carry: number;
    ratePerSecond: number;
    dtSeconds: number;
}>) {
    const total = carry + ratePerSecond * dtSeconds;
    const count = Math.floor(total);

    return {
        carry: total - count,
        count,
    };
}

const tireSmokePerSecond = 30;

/** Puffs per second for one tire: none until it skids, then rising to full by slip 1. */
export function getTireSmokeRate({
    isGrounded,
    slip,
}: Readonly<Pick<WheelView, 'isGrounded' | 'slip'>>) {
    return isGrounded
        ? tireSmokePerSecond * clamp01((slip - skidSlipStart) / (1 - skidSlipStart))
        : 0;
}

/** Slowest scrape that throws sparks. */
const scrapeSparkSpeed = 3;
const crashSparkCount = 36;
const scrapeSparkCount = 4;
const maxSparkImpactsPerFrame = 6;

/**
 * Sparks to throw for each impact this frame, a crash many and a fast scrape a few. The physics
 * reports an impact per scraping spot per step, so only the hardest few are kept.
 */
export function getSparkBursts(impacts: ReadonlyArray<Readonly<VehicleImpact>>) {
    return impacts
        .filter((impact) => impact.isCrash || impact.speed > scrapeSparkSpeed)
        .toSorted((left, right) => right.speed - left.speed)
        .slice(0, maxSparkImpactsPerFrame)
        .map((impact) => {
            return {
                count: impact.isCrash ? crashSparkCount : scrapeSparkCount,
                impact,
            };
        });
}

/** Emissive strengths for the lamps, on top of each lamp's own color. */
export function getLampStrengths({areHeadlightsOn, brake, isReversing}: Readonly<LightsView>) {
    return {
        brake: 0.4 + 3.5 * clamp01(brake),
        headlight: areHeadlightsOn ? 4 : 0.15,
        reverse: isReversing ? 3 : 0,
    };
}

/** How bright a hover pad glows: more as it presses against the ground and as throttle rises. */
export function getPadGlow({
    compression,
    throttle,
}: Readonly<{
    compression: number;
    throttle: number;
}>) {
    return 0.8 + 3 * clamp01(compression) + 3 * clamp01(throttle);
}
