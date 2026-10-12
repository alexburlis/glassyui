import type { KnipConfig } from 'knip';
import webRegistry from './registry.json';
import nativeRegistry from './registry-native.json';

// CSS-only registry themes have no source files; check:registry validates that contract.
const webEntries = webRegistry.items.flatMap((item) => (item.files ?? []).map((file) => file.path));

const nativeEntries = nativeRegistry.items.flatMap((item) => item.files.map((file) => file.path));

const publicExports = ['exports', 'types'] as const;

const config: KnipConfig = {
  includeEntryExports: true,
  // The preview capture command uses the system's WebP encoder, not an npm bin.
  ignoreBinaries: ['cwebp'],
  ignoreIssues: {
    // These exports are the documented source-copy API, not private app code.
    'src/components/liquid/*.tsx': [...publicExports],
    'src/components/liquid/index.ts': [...publicExports],
    'src/lib/liquid/preferences.ts': [...publicExports],
    'src/components/examples/*.tsx': [...publicExports],
    ...Object.fromEntries(webEntries.map((path) => [path, [...publicExports]])),
    // Drop-ins resolve consumer aliases and packages after installation.
    // check:shadcn-dropins verifies both stock consumers against their declared packages.
    'registry/glassyui-shadcn/**/*.tsx': ['unlisted', 'unresolved'],
    // Native packages belong to each install closure in registry-native.json.
    // check:native-registry owns their declaration contract.
    ...Object.fromEntries(nativeEntries.map((path) => [path, [...publicExports, 'unlisted']])),
    // Both provider names are supported aliases in the installable API.
    'registry/glassyui/glass-provider.tsx': [...publicExports, 'duplicates'],
    'registry/glassyui-native/glass-provider.tsx': [...publicExports, 'unlisted', 'duplicates'],
  },
  workspaces: {
    '.': {
      entry: [
        'scripts/*.{js,mjs}',
        '!scripts/{register-tsx,check-consumer-command,check-consumer-transparency}.mjs',
        'src/components/liquid/index.ts',
        'src/components/examples/*.tsx',
        'src/lib/liquid/preferences.ts',
        'src/app/globals.css',
        ...webEntries,
        ...nativeEntries,
      ],
      project: [
        'src/**/*.{ts,tsx,css}',
        'registry/**/*.{ts,tsx}',
        'scripts/*.{js,mjs}',
        '*.{ts,mjs}',
      ],
    },
    'fixtures/shadcn-consumer': {
      entry: ['app/globals.css'],
      project: ['app/**/*.{ts,tsx,css}', '*.{ts,mjs}'],
      paths: {
        '@/components/glassyui/*': ['../../registry/glassyui/*'],
      },
    },
    'fixtures/expo-consumer': {
      entry: ['usage/*.tsx'],
      project: ['*.{ts,tsx}', 'showcase/*.tsx', 'usage/*.tsx'],
      // The SDK declares this bin; root CI does not install the nested fixture.
      ignoreBinaries: ['expo'],
      paths: {
        '../components/glassyui/*': ['../../registry/glassyui-native/*'],
        './components/glassyui/*': ['../../registry/glassyui-native/*'],
        '@/components/glassyui/*': ['../../registry/glassyui-native/*'],
      },
      ignoreIssues: { 'usage/*.tsx': [...publicExports] },
      // Canonical registry sources belong to the root workspace. Their imports
      // use these fixture packages; check:native-registry verifies the closures.
      ignoreDependencies: [
        '@expo/ui',
        'expo-blur',
        'expo-glass-effect',
        'expo-haptics',
        'react-native-reanimated',
        'react-native-svg',
        'react-native-worklets',
        // Knip infers OTA updates even when no update module/config is present.
        'expo-updates',
      ],
    },
    'tools/oxlint/anti-slop': {
      entry: ['index.ts', 'effect/index.ts'],
      project: ['**/*.ts'],
      ignoreIssues: {
        // Oxlint loads these plugin objects rather than importing their exports.
        'index.ts': ['exports'],
        'effect/index.ts': ['exports'],
        // Preserve the generated upstream declaration surface and checksum.
        'vendor/eslint-stylistic/padding-line-options.d.ts': ['types'],
      },
    },
  },
};

export default config;
