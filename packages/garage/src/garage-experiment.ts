import {type DrivingExperiment} from '@evir/driving-core';
import {createUtcFullDate} from 'date-vir';

export const garageExperiment: DrivingExperiment = {
    experimentName: 'Garage',
    pathId: 'garage',
    startDate: createUtcFullDate('2026-11-10T00:00:00.000Z'),
    async loadElement() {
        return (await import('./garage.element.js')).GarageGame;
    },
};
