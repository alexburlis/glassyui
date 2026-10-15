import { readFileSync } from 'node:fs';
import path from 'node:path';
import { installCommand } from './install-command';

const exampleFiles = new Map([
  ['glass-scene', 'scene-example.tsx'],
  ['glass-lens', 'lens-example.tsx'],
  ['glass-dock', 'dock-example.tsx'],
]);

/** The rendered module is also the copy source; only its consumer import paths differ. */
export function getLaunchExampleSource(id: string) {
  const file = exampleFiles.get(id);

  if (!file) return null;

  const installedItems = new Set<string>();

  const source = readFileSync(
    path.join(process.cwd(), 'src/components/examples', file),
    'utf8',
  ).replace(/(['"])\.\.\/liquid\/([a-z-]+)\1/g, (_match, quote: string, name: string) => {
    const item = `glass-${name}`;
    installedItems.add(item);

    return `${quote}@/components/glassyui/${item}${quote}`;
  });

  return {
    source,
    file,
    items: [...installedItems],
    install: installCommand([...installedItems], 'react'),
  };
}
