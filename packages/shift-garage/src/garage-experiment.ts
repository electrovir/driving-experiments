import {type DrivingExperiment} from '@evir/driving-core';
import {createUtcFullDate} from 'date-vir';

export const shiftGarageExperiment: DrivingExperiment = {
    experimentName: 'Shift Garage',
    pathId: 'shift-garage',
    startDate: createUtcFullDate('2026-11-12T00:00:00.000Z'),
    async loadElement() {
        return (await import('./garage.element.js')).ShiftGarageGame;
    },
};
