/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads this config plugin through CommonJS, including in ESM apps. */
const fs = require('node:fs');

const path = require('node:path');

const { withDangerousMod } = require('expo/config-plugins');

const originalImport = 'import eightbitlab.com.blurview.BlurView';

const sharedImport = 'import eightbitlab.com.blurview.SharedBlurView as BlurView';

function withGlassyBlur(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const root = mod.modRequest.projectRoot;
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      const autolinking = manifest.expo?.autolinking;
      const sourcePackages = autolinking?.android?.buildFromSource ?? autolinking?.buildFromSource;

      if (!Array.isArray(sourcePackages) || !sourcePackages.includes('expo-blur')) {
        throw new Error(
          'Glassy UI: add "expo": { "autolinking": { "android": { "buildFromSource": ["expo-blur"] } } } to package.json, then rebuild Android. A prebuilt expo-blur cannot include shared glass.',
        );
      }

      const blurRoot = path.dirname(require.resolve('expo-blur/package.json', { paths: [root] }));
      const blurManifest = JSON.parse(fs.readFileSync(path.join(blurRoot, 'package.json'), 'utf8'));
      const android = path.join(blurRoot, 'android');
      const gradle = fs.readFileSync(path.join(android, 'build.gradle'), 'utf8');
      const viewFile = path.join(android, 'src/main/java/expo/modules/blur/ExpoBlurView.kt');
      const source = fs.readFileSync(viewFile, 'utf8');

      const imports = source
        .split('\n')
        .filter((line) => line === originalImport || line === sharedImport);

      if (
        blurManifest.version !== '57.0.3' ||
        !gradle.includes("implementation 'com.github.Dimezis:BlurView:version-3.1.0'") ||
        imports.length !== 1 ||
        !source.includes('private val blurView = BlurView(context)') ||
        !source.includes('blurView.setupWith(dimezisBlurTarget)')
      ) {
        throw new Error(
          'Glassy UI shared Android blur requires expo-blur 57.0.3 with BlurView 3.1.0. The installed native contract changed; verify it before enabling this plugin.',
        );
      }

      const destination = path.join(android, 'src/main/java/eightbitlab/com/blurview');
      fs.mkdirSync(destination, { recursive: true });

      for (const name of ['SharedBlurView.java', 'SharedBlurController.java']) {
        fs.copyFileSync(path.join(__dirname, name), path.join(destination, name));
      }

      if (imports[0] === originalImport) {
        fs.writeFileSync(viewFile, source.replace(originalImport, sharedImport));
      }

      return mod;
    },
  ]);
}

module.exports = withGlassyBlur;
