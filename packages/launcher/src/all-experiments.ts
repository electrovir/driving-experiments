import {arrayToObject, extractDuplicates} from '@augment-vir/common';
import {anthaEntitiesExperiment} from '@evir/driving-antha-entities';
import {arcadePhysicsExperiment} from '@evir/driving-arcade-physics';
import {type DrivingExperiment} from '@evir/driving-core';
import {flatPlaneExperiment} from '@evir/driving-flat-plane';
import {garageExperiment} from '@evir/driving-garage';
import {shiftGarageExperiment} from '@evir/driving-shift-garage';
import {tiresAndGearsExperiment} from '@evir/driving-tires-and-gears';

export const allExperiments: ReadonlyArray<DrivingExperiment> = [
    flatPlaneExperiment,
    tiresAndGearsExperiment,
    arcadePhysicsExperiment,
    garageExperiment,
    shiftGarageExperiment,
    anthaEntitiesExperiment,
];

export const allExperimentsByPathId = arrayToObject(allExperiments, (experiment) => {
    return {
        key: experiment.pathId,
        value: experiment,
    };
});

const duplicatePathIds = extractDuplicates(
    allExperiments.map((experiment) => experiment.pathId),
).duplicates;

if (duplicatePathIds.length) {
    throw new Error(
        `Each experiment needs its own pathId. Duplicated: ${duplicatePathIds.join(', ')}.`,
    );
}
