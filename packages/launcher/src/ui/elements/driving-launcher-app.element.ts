import {defineDrivingElement} from '@evir/driving-core';
import {toSimpleDatePartString, toTimestamp} from 'date-vir';
import {css, html} from 'element-vir';
import {noNativeSpacing, ViraLink} from 'vira';
import {allExperiments, allExperimentsByPathId} from '../../all-experiments.js';
import {createExperimentRouter, listRoute} from '../../experiment-router.js';
import {DrivingExperimentPage} from './driving-experiment-page.element.js';

export const DrivingLauncherApp = defineDrivingElement()({
    tagName: 'driving-launcher-app',
    styles: css`
        :host {
            display: block;
            font-family: sans-serif;
            height: 100%;
            width: 100%;
        }

        ol {
            ${noNativeSpacing}
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 32px 32px 32px calc(32px + 1em);
        }
    `,
    state() {
        return {
            router: createExperimentRouter(),
            currentRoute: listRoute,
            stopListening: undefined satisfies undefined | (() => void) as undefined | (() => void),
        };
    },
    init({state, updateState}) {
        state.stopListening?.();
        updateState({
            stopListening: state.router.listen(true, (currentRoute) => {
                updateState({
                    currentRoute,
                });
            }),
        });
    },
    cleanup({state, updateState}) {
        state.stopListening?.();
        updateState({
            stopListening: undefined,
        });
    },
    render({state}) {
        const pathId = state.currentRoute.paths[0];
        const experiment =
            pathId && Object.hasOwn(allExperimentsByPathId, pathId)
                ? allExperimentsByPathId[pathId]
                : undefined;

        if (experiment) {
            globalThis.document.title = `Driving Experiments: ${experiment.experimentName}`;

            return html`
                <${DrivingExperimentPage.assign({
                    experiment,
                    router: state.router,
                })}></${DrivingExperimentPage}>
            `;
        }

        globalThis.document.title = 'Driving Experiments';

        /**
         * Newest start date first. Reversing before the stable sort puts the later entry of
         * `allExperiments` first among experiments that started on the same day.
         */
        const listItems = allExperiments
            .toReversed()
            .toSorted(
                (first, second) => toTimestamp(second.startDate) - toTimestamp(first.startDate),
            )
            .map((listedExperiment) => {
                return html`
                    <li>
                        <${ViraLink.assign({
                            route: {
                                route: {
                                    paths: [
                                        listedExperiment.pathId,
                                    ],
                                },
                                router: state.router,
                            },
                        })}>
                            ${toSimpleDatePartString(listedExperiment.startDate)}:
                            ${listedExperiment.experimentName}
                        </${ViraLink}>
                    </li>
                `;
            });

        return html`
            <ol reversed>
                ${listItems}
            </ol>
        `;
    },
});
