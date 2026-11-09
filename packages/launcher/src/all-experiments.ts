import {arrayToObject, extractDuplicates} from '@augment-vir/common';
import {type DrivingExperiment} from '@evir/driving-core';
import {flatPlaneExperiment} from '@evir/driving-flat-plane';

export const allExperiments: ReadonlyArray<DrivingExperiment> = [
    flatPlaneExperiment,
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
