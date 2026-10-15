import Link from 'next/link';
import { getNativeComponentDoc } from '@/lib/native-component-docs';
import { getNativeUsage } from '@/lib/native-usage-source';
import { sourceUrl } from '@/lib/site-links';
import { getComponentInstallation } from '@/lib/component-installation-data';
import { ComponentInstallation, InstallCommandBlock } from './component-installation';
import { CopyCodeBlock } from './copy-code-block';
import { DocsShell } from './docs-shell';

export function NativeComponentDoc({ id }: { id: string }) {
  const component = getNativeComponentDoc(id);
  const usage = getNativeUsage(id);

  if (!component || !usage) throw new Error(`Missing Expo documentation: ${id}`);
  const { item } = component;

  return (
    <DocsShell
      current={`/components/${id}`}
      contribute={{ sourcePath: `registry/glassyui-native/${id}.tsx`, subject: item.title }}
      toc={[
        { href: '#installation', title: 'Installation' },
        { href: '#usage', title: 'Usage' },
        { href: '#api', title: 'API' },
        { href: '#notes', title: 'Notes' },
      ]}
    >
      <article className="docs-component-doc">
        <header className="docs-page-header">
          <p className="docs-eyebrow">
            React Native · Expo SDK 57 <span className="new-tag">New</span>
          </p>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
          <div className="docs-page-links">
            <a href={sourceUrl(`registry/glassyui-native/${id}.tsx`)}>View source on GitHub</a>
            <a href={`/r/native/${id}.json`}>Registry JSON</a>
            <Link href="/guides/expo">Set up in Expo</Link>
          </div>
        </header>
        <ComponentInstallation key={id} native={getComponentInstallation(id, 'react-native')} />
        <section className="docs-section" id="usage">
          <h2>Usage</h2>
          <CopyCodeBlock code={usage.source} label={`${item.title} usage`} />
          {usage.alsoUses.length ? (
            <>
              <p>
                This example also uses {usage.alsoUses.join(' and ')}. Install everything it uses:
              </p>
              <InstallCommandBlock
                items={usage.items}
                platform="react-native"
                label="Install example components"
              />
            </>
          ) : null}
        </section>
        <section className="docs-section" id="api">
          <h2>API</h2>
          <div className="docs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prop</th>
                  <th>Type</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                {component.api.map((row) => (
                  <tr key={row.prop}>
                    <td>
                      <code>{row.prop}</code>
                    </td>
                    <td>
                      <code>{row.type}</code>
                    </td>
                    <td>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Each component also accepts <code>style</code> and <code>testID</code>.
          </p>
        </section>
        <section className="docs-section" id="notes">
          <h2>Notes</h2>
          <ul>
            {component.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p>
            <Link href="/mobile">Browse the Expo components</Link>.
          </p>
        </section>
      </article>
    </DocsShell>
  );
}
