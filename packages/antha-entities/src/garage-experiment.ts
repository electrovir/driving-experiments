import {type DrivingExperiment} from '@evir/driving-core';
import {createUtcFullDate} from 'date-vir';

export const anthaEntitiesExperiment: DrivingExperiment = {
    experimentName: 'Antha Entities',
    pathId: 'antha-entities',
    startDate: createUtcFullDate('2026-11-13T00:00:00.000Z'),
    async loadElement() {
        return (await import('./garage.element.js')).AnthaEntitiesGame;
    },
};
