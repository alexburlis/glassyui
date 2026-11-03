import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ComponentDoc } from '@/components/docs/component-docs-data';
import { installCommand } from './install-command';

const exampleFiles = new Map([
  ['glass-scene', 'scene-example.tsx'],
  ['glass-lens', 'lens-example.tsx'],
  ['glass-dock', 'dock-example.tsx'],
]);

/** The rendered module is also the copy source; only its consumer import paths differ. */
function getExampleSource(file: string) {
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

export function getLaunchExampleSource(id: string) {
  const file = exampleFiles.get(id);

  return file ? getExampleSource(file) : null;
}

/** An example's code. The painted backdrop shows the source of the example it runs. */
export function getExampleCode(example: ComponentDoc['examples'][number]) {
  return 'code' in example ? example.code : getExampleSource('painted-scene-example.tsx').source;
}
