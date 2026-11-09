import {type FullSpaRoute, SpaRouter} from 'spa-router-vir';
import {allExperimentsByPathId} from './all-experiments.js';

/** Empty for the experiment list, or one experiment's `pathId`. */
export type ExperimentPaths = [] | [string];

export type ExperimentRoute = Readonly<FullSpaRoute<ExperimentPaths, undefined, undefined>>;

export const listRoute: ExperimentRoute = {
    hash: undefined,
    paths: [],
    search: undefined,
};

export type ExperimentRouter = SpaRouter<ExperimentPaths>;

export function createExperimentRouter() {
    return new SpaRouter<ExperimentPaths, undefined, undefined>({
        basePath: 'driving-experiments',
        sanitizeRoute(route) {
            const pathId = route.paths[0];

            return pathId && Object.hasOwn(allExperimentsByPathId, pathId)
                ? {
                      ...listRoute,
                      paths: [
                          pathId,
                      ],
                  }
                : listRoute;
        },
    });
}
