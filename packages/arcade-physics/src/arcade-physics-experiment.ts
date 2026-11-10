import {type DrivingExperiment} from '@evir/driving-core';
import {createUtcFullDate} from 'date-vir';

export const arcadePhysicsExperiment: DrivingExperiment = {
    experimentName: 'Arcade Physics',
    pathId: 'arcade-physics',
    startDate: createUtcFullDate('2026-11-08T00:00:00.000Z'),
    async loadElement() {
        return (await import('./arcade-physics.element.js')).ArcadePhysicsGame;
    },
};
