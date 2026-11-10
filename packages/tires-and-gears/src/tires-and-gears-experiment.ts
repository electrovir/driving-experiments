import {type DrivingExperiment} from '@evir/driving-core';
import {createUtcFullDate} from 'date-vir';

export const tiresAndGearsExperiment: DrivingExperiment = {
    experimentName: 'Tires and Gears',
    pathId: 'tires-and-gears',
    startDate: createUtcFullDate('2026-11-08T00:00:00.000Z'),
    async loadElement() {
        return (await import('./tires-and-gears.element.js')).TiresAndGearsGame;
    },
};
