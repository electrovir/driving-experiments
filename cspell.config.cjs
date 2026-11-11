const {baseConfig} = require('@virmator/spellcheck/configs/cspell.config.base.cjs');

module.exports = {
    ...baseConfig,
    ignorePaths: [
        ...baseConfig.ignorePaths,
    ],
    words: [
        ...baseConfig.words,
        'downforce',
        'ebrake',
        'lerp',
        'lerped',
        'lerps',
        'Mathf',
        'Randomation',
        'substep',
    ],
};
