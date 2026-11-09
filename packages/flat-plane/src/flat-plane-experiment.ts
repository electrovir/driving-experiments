import {type DrivingExperiment} from '@evir/driving-core';
import {createUtcFullDate} from 'date-vir';

export const flatPlaneExperiment: DrivingExperiment = {
    experimentName: 'Flat Plane',
    pathId: 'flat-plane',
    startDate: createUtcFullDate('2026-11-08T00:00:00.000Z'),
    async loadElement() {
        return (await import('./flat-plane.element.js')).FlatPlaneGame;
    },
};
