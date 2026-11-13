const {baseConfig} = require('@virmator/spellcheck/configs/cspell.config.base.cjs');

module.exports = {
    ...baseConfig,
    ignorePaths: [
        ...baseConfig.ignorePaths,
        '**/LICENSE-SHIFT',
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
