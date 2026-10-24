import items from './install-items.json';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type InstallPlatform = 'react' | 'react-native';

const runners: Record<PackageManager, string> = {
  npm: 'npx',
  pnpm: 'pnpm dlx',
  yarn: 'yarn dlx',
  bun: 'bunx --bun',
};

const packageInstallers: Record<PackageManager, string> = {
  npm: 'npm install',
  pnpm: 'pnpm add',
  yarn: 'yarn add',
  bun: 'bun add',
};

function assertItem(name: string, platform: InstallPlatform) {
  if (!items[platform].includes(name)) {
    throw new Error(`Unknown ${platform} registry item: ${name}`);
  }
}

/** The published item URL; the shadcn registry directory maps both namespaces here. */
export function registryItemUrl(name: string, platform: InstallPlatform) {
  assertItem(name, platform);

  return `https://glassyui.com/r/${platform === 'react-native' ? 'native/' : ''}${name}.json`;
}

/** The item's name in the shadcn registry directory, which needs no consumer setup. */
function registryItemName(name: string, platform: InstallPlatform) {
  assertItem(name, platform);

  return `${platform === 'react-native' ? '@glassyui-native' : '@glassyui'}/${name}`;
}

/** Add complete item payloads by their directory names. */
export function installCommand(
  itemNames: readonly string[],
  platform: InstallPlatform,
  manager: PackageManager = 'npm',
) {
  const names = [...new Set(itemNames)];

  if (names.length === 0) throw new Error('An install command needs at least one registry item.');

  const command = `${runners[manager]} shadcn@4.14.1 add ${names.map((name) => registryItemName(name, platform)).join(' ')}`;

  return platform === 'react-native' ? `${command} && npx expo install --fix` : command;
}

/** Expo selects package versions compatible with the app's SDK. */
export function dependencyCommand(
  packages: readonly string[],
  platform: InstallPlatform,
  manager: PackageManager = 'npm',
) {
  const names = [...new Set(packages)];

  if (names.length === 0) return '';

  return `${platform === 'react-native' ? 'npx expo install' : packageInstallers[manager]} ${names.join(' ')}`;
}
