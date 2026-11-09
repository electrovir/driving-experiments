import {type FullDate} from 'date-vir';
import {type DeclarativeElementDefinition} from 'element-vir';

/** One experiment that the launcher lists and can switch to. */
export type DrivingExperiment = {
    /** Shown in the launcher's list. */
    experimentName: string;
    /** The URL path segment that opens this experiment. Must be URL safe and unique. */
    pathId: string;
    /** When this experiment was started. The launcher lists the newest first. */
    startDate: Readonly<FullDate>;
    /**
     * Loads the element that runs this experiment. It must stop all of its work (render loops,
     * input listeners) when it disconnects.
     *
     * Keep this a dynamic `import()` so each experiment is its own chunk and the launcher doesn't
     * download every experiment up front.
     */
    loadElement: () => Promise<DeclarativeElementDefinition<any, Record<string, never>>>;
};
