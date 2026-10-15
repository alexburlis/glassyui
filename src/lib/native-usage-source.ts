import { readFileSync } from 'node:fs';
import path from 'node:path';
import nativeRegistry from '../../registry-native.json';
import { installCommand } from './install-command';

const nativeTitles = new Map(nativeRegistry.items.map((item) => [item.name, item.title]));

// GlassBackdrop ships inside the glass-surface item.
const ITEM_OF_MODULE = new Map([['glass-backdrop', 'glass-surface']]);

/** Install native items, then match their packages to the consumer's Expo SDK. */
export function nativeInstallCommand(items: readonly string[]) {
  return installCommand(items, 'react-native');
}

/**
 * The React Native usage for a registry item, or null when the item is web-only. The source is
 * the file the Expo fixture type-checks and renders, without its lint directives, so the page
 * shows code that runs. `example` installs every item the example imports.
 */
export function getNativeUsage(item: string) {
  if (!nativeTitles.has(item)) return null;

  const source = readFileSync(
    path.join(process.cwd(), 'fixtures/expo-consumer/usage', `${item}.tsx`),
    'utf8',
  ).replace(/^\s*\/\/ eslint-disable-next-line.*\n/gm, '');

  const imported = [...source.matchAll(/@\/components\/glassyui\/(glass-[a-z-]+)/g)].map(
    (match) => ITEM_OF_MODULE.get(match[1]) ?? match[1],
  );

  const items = [...new Set([item, ...imported])];

  return {
    items,
    /** Titles of the other items the example imports. */
    alsoUses: items.slice(1).map((name) => nativeTitles.get(name) ?? name),
    example: nativeInstallCommand(items),
    install: nativeInstallCommand([item]),
    source,
  };
}
