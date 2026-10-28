/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads config plugins as CommonJS. */
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy')
      throw new Error(
        'NewPM release signing requires the Expo Groovy template.',
      );
    const marker = '// NewPM release signing (managed by config plugin)';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `\n${marker}\napply from: new File(rootProject.projectDir.parentFile, "gradle/release-signing.gradle")\n`;
    }
    return config;
  });
};
