import registry from '../../registry.json';
import nativeRegistry from '../../registry-native.json';
import type { InstallPlatform } from './install-command';

type AuthoringItem = {
  name: string;
  title?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{ path: string; target?: string }>;
};

type InstallationFileGroup = {
  name: string;
  title: string;
  shared: boolean;
  targets: string[];
};

export type ComponentInstallationData = {
  item: string;
  title: string;
  platform: InstallPlatform;
  packages: string[];
  groups: InstallationFileGroup[];
  expoFloor: number;
};

const webItems = new Map<string, AuthoringItem>(registry.items.map((item) => [item.name, item]));

const nativeItems = new Map<string, AuthoringItem>(
  nativeRegistry.items.map((item) => [item.name, item]),
);

/** Small source-graph metadata only; full source is fetched when Manual opens. */
export function getComponentInstallation(itemName: string, platform: InstallPlatform) {
  const items = platform === 'react' ? webItems : nativeItems;
  const namespace = platform === 'react' ? '@glassyui/' : '@glassyui-native/';
  const visited = new Set<string>();
  const targets = new Set<string>();
  const packages = new Set<string>();
  const groups: InstallationFileGroup[] = [];

  function visit(name: string) {
    if (visited.has(name)) return;

    const item = items.get(name);

    if (!item) throw new Error(`Missing installation item: ${platform}/${name}`);
    visited.add(name);

    const groupTargets: string[] = [];

    for (const file of item.files ?? []) {
      if (!file.target?.startsWith('components/glassyui/')) {
        throw new Error(`Unsupported component installation target: ${file.path}`);
      }

      if (!targets.has(file.target)) {
        targets.add(file.target);
        groupTargets.push(file.target);
      }
    }

    groups.push({
      name,
      title: item.title ?? name,
      shared: name !== itemName,
      targets: groupTargets,
    });

    for (const dependency of item.dependencies ?? []) packages.add(dependency);

    for (const dependency of item.registryDependencies ?? []) {
      if (!dependency.startsWith(namespace)) {
        throw new Error(`Unsupported installation dependency: ${dependency}`);
      }

      visit(dependency.slice(namespace.length));
    }
  }

  visit(itemName);

  return {
    item: itemName,
    title: groups[0].title,
    platform,
    packages: [...packages],
    groups,
    expoFloor: ['glass-picker', 'glass-swipe-row', 'glass-card-stack'].includes(itemName) ? 57 : 55,
  } satisfies ComponentInstallationData;
}
