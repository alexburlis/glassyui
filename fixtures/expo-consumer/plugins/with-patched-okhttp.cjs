/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads config plugins through CommonJS. */
const { withAppBuildGradle } = require('expo/config-plugins');

const dependency = "implementation platform('com.squareup.okhttp3:okhttp-bom:4.12.1')";

module.exports = function withPatchedOkHttp(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('The OkHttp dependency requires a Groovy app build.gradle.');
    }

    if (!mod.modResults.contents.includes(dependency)) {
      mod.modResults.contents += `\ndependencies {\n    ${dependency}\n}\n`;
    }

    return mod;
  });
};
