import {colorCss} from '@electrovir/color';
import {defineDrivingElement, type DrivingExperiment} from '@evir/driving-core';
import {asyncProp, css, html, renderAsync} from 'element-vir';
import {themeDefaultKey} from 'theme-vir';
import {ViraLink, viraTheme} from 'vira';
import {listRoute, type ExperimentRouter} from '../../experiment-router.js';

export const DrivingExperimentPage = defineDrivingElement<{
    experiment: DrivingExperiment;
    router: ExperimentRouter;
}>()({
    tagName: 'driving-experiment-page',
    styles: css`
        :host {
            display: block;
            height: 100%;
            overflow: clip;
            position: relative;
            width: 100%;
        }

        .back {
            ${colorCss(viraTheme.colors[themeDefaultKey])}
            border: 2px solid ${viraTheme.colors[themeDefaultKey].foreground.value};
            border-bottom-right-radius: 4px;
            left: 0;
            padding: 4px 8px;
            position: absolute;
            top: 0;
            z-index: 1;
        }

        .status {
            padding: 48px 32px;
        }
    `,
    state() {
        return {
            experimentElement: asyncProp({
                async updateCallback({experiment}: Readonly<{experiment: DrivingExperiment}>) {
                    return await experiment.loadElement();
                },
            }),
        };
    },
    render({inputs, state}) {
        state.experimentElement.update({
            experiment: inputs.experiment,
        });

        return html`
            <${ViraLink.assign({
                route: {
                    route: listRoute,
                    router: inputs.router,
                },
            })}
                class="back"
            >
                ← Back
            </${ViraLink}>
            ${renderAsync(
                state.experimentElement,
                html`
                    <p class="status">Loading…</p>
                `,
                (experimentElement) => {
                    return html`
                        <${experimentElement}></${experimentElement}>
                    `;
                },
                (error) => {
                    return html`
                        <p class="status">Failed to load: ${error.message}</p>
                    `;
                },
            )}
        `;
    },
});
