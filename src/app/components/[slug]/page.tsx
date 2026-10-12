import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ComponentPreview } from '@/components/docs/component-preview';
import { CopyCodeBlock } from '@/components/docs/copy-code-block';
import { FixedWallpaperExample } from '@/components/docs/fixed-wallpaper-example';
import {
  componentDocs,
  getAdjacentComponents,
  getComponentDoc,
} from '@/components/docs/component-docs-data';
import { DocsShell } from '@/components/docs/docs-shell';
import { PlatformPane, PlatformSwitch } from '@/components/docs/platform-switch';
import { CopyChip } from '@/components/site/copy-chip';
import { JsonLd } from '@/components/site/json-ld';
import { getLaunchExampleSource } from '@/lib/launch-example-source';
import { getNativeUsage } from '@/lib/native-usage-source';
import { MOBILE_CARD, shareCard, shareMetadata } from '@/lib/share';
import { SITE_URL, sourceUrl } from '@/lib/site-links';
import { getNativeComponentDoc, nativeComponentDocs } from '@/lib/native-component-docs';
import { NativeComponentDoc } from '@/components/docs/native-component-doc';

/** The React version alone, or both versions behind the page's platform switch. */
function ByPlatform({ native, react }: { native: ReactNode; react: ReactNode }) {
  if (!native) return react;

  return (
    <>
      <PlatformPane platform="react">{react}</PlatformPane>
      <PlatformPane platform="react-native">{native}</PlatformPane>
    </>
  );
}

function RegistryFactList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <h4>{label}</h4>
      {values.length ? (
        <ul>
          {values.map((value) => (
            <li key={value}>
              <code>{value}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p>None declared.</p>
      )}
    </div>
  );
}

export function generateStaticParams() {
  return [...componentDocs, ...nativeComponentDocs].map((component) => ({ slug: component.id }));
}

type ComponentPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ComponentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const native = getNativeComponentDoc(slug);

  // Expo-only components have no web demo to photograph, so they share the React Native card.
  if (native) {
    const title = `${native.item.title} for Expo`;

    return {
      title,
      description: native.item.description,
      alternates: { canonical: `/components/${slug}` },
      ...shareMetadata({
        card: MOBILE_CARD,
        title,
        description: native.item.description,
        url: `/components/${slug}`,
        type: 'article',
      }),
    };
  }

  const component = getComponentDoc(slug);

  if (!component) {
    return {};
  }

  const name = component.searchTitle ?? `${component.name} for React`;
  const canonical = `/components/${component.id}`;

  return {
    title: name,
    description: component.description,
    alternates: {
      canonical,
    },
    ...shareMetadata({
      card: shareCard(
        `components/${component.id}`,
        `${component.name}, live on red ribbon artwork beside its name.`,
      ),
      title: name,
      description: component.description,
      url: canonical,
      type: 'article',
    }),
  };
}

export default async function ComponentPage({ params }: ComponentPageProps) {
  const { slug } = await params;

  if (getNativeComponentDoc(slug)) return <NativeComponentDoc id={slug} />;
  const component = getComponentDoc(slug);

  if (!component) {
    notFound();
  }

  const adjacent = getAdjacentComponents(slug);
  const native = getNativeUsage(component.registryItem);
  const example = getLaunchExampleSource(slug);
  const usage = example?.source ?? component.usage;

  if (!usage) throw new Error(`Missing usage source for ${slug}`);

  return (
    <DocsShell
      contribute={{ sourcePath: `registry/glassyui/${component.id}.tsx`, subject: component.name }}
      current={component.route ?? '/components'}
      toc={component.pageToc}
    >
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', item: SITE_URL, name: 'Glassy UI', position: 1 },
            {
              '@type': 'ListItem',
              item: `${SITE_URL}/components`,
              name: 'Components',
              position: 2,
            },
            {
              '@type': 'ListItem',
              item: `${SITE_URL}${component.route ?? '/components'}`,
              name: component.name,
              position: 3,
            },
          ],
        }}
      />
      <article className="docs-component-doc">
        <div className="docs-page-header">
          <p className="docs-eyebrow">
            {component.category}
            {component.isNew ? <span className="new-tag">New</span> : null}
          </p>
          <h1>{component.name}</h1>
          <p>{component.description}</p>
          {native ? <PlatformSwitch /> : null}
          <ByPlatform
            native={
              native ? (
                <>
                  <CopyChip
                    command={native.install}
                    label={`Copy the ${component.name} React Native install command`}
                  />
                  <div className="docs-page-links">
                    <a href={sourceUrl(`registry/glassyui-native/${component.registryItem}.tsx`)}>
                      View source on GitHub
                    </a>
                    <a href={`/r/native/${component.registryItem}.json`}>Registry JSON</a>
                    <Link href="/guides/expo">Read the Expo guide</Link>
                  </div>
                </>
              ) : null
            }
            react={
              <>
                <CopyChip
                  command={component.install}
                  label={`Copy the ${component.name} install command`}
                />
                <div className="docs-page-links">
                  <a href={sourceUrl(`registry/glassyui/${component.id}.tsx`)}>
                    View source on GitHub
                  </a>
                  <a href={`/r/${component.id}.json`}>Registry JSON</a>
                  {component.guide ? <Link href={component.guide}>Read the guide</Link> : null}
                </div>
              </>
            }
          />
        </div>

        <section className="docs-section" id="preview">
          <h2>Preview</h2>
          <ComponentPreview id={component.id} />
          {native ? (
            <PlatformPane platform="react-native">
              <p>
                This preview runs the React version. In an app, iOS 26 and later draw the React
                Native version with the system&rsquo;s own glass.{' '}
                <Link href="/mobile">See it on a phone</Link>.
              </p>
            </PlatformPane>
          ) : null}
        </section>

        <section className="docs-section" id="installation">
          <h2>Installation</h2>
          <ByPlatform
            native={
              native ? (
                <>
                  <p>
                    First add the <code>@glassyui-native</code> mapping to{' '}
                    <code>components.json</code> as shown in the{' '}
                    <Link href="/guides/expo">Expo guide</Link>. Then add the component and match
                    its packages to your Expo SDK:
                  </p>
                  <CopyCodeBlock
                    code={native.install}
                    label={`Install ${component.name} for React Native`}
                    language="shell"
                  />
                </>
              ) : null
            }
            react={
              <>
                <p>
                  Use React 19+ and Tailwind CSS 4. Configure the <code>@glassyui</code> mapping and
                  your glass theme as shown in{' '}
                  <Link href="/docs#installation">Getting Started</Link>. Then run the pinned item
                  command:
                </p>
                <CopyCodeBlock
                  code={component.install}
                  label={`Install ${component.name}`}
                  language="shell"
                />

                <details className="docs-files">
                  <summary>
                    What this installs
                    <span>
                      {component.installedFiles.length}{' '}
                      {component.installedFiles.length === 1 ? 'file' : 'files'}
                      {component.installedDependencies.length
                        ? `, ${component.installedDependencies.length} ${
                            component.installedDependencies.length === 1 ? 'package' : 'packages'
                          }`
                        : ''}
                    </span>
                  </summary>
                  <div className="docs-registry-facts">
                    <div>
                      <h3>Direct registry declarations</h3>
                      <p>
                        These values belong to <code>@glassyui/{component.registryItem}</code>{' '}
                        itself in <code>registry.json</code>.
                      </p>
                      <RegistryFactList
                        label="Package dependencies"
                        values={component.dependencies}
                      />
                      <RegistryFactList
                        label="Registry dependencies"
                        values={component.registryDependencies}
                      />
                      <RegistryFactList label="File targets" values={component.directFiles} />
                    </div>

                    <div>
                      <h3>Complete installed closure</h3>
                      <p>
                        This follows every namespaced registry dependency recursively and
                        de-duplicates the packages and target files installed with this item.
                      </p>
                      <RegistryFactList
                        label="Package dependencies"
                        values={component.installedDependencies}
                      />
                      <RegistryFactList label="Installed files" values={component.installedFiles} />
                    </div>
                  </div>
                </details>
              </>
            }
          />
        </section>

        <section className="docs-section" id="usage">
          <h2>Usage</h2>
          <ByPlatform
            native={
              native ? (
                <>
                  <CopyCodeBlock code={native.source} label="React Native usage" />
                  {native.alsoUses.length > 0 ? (
                    <>
                      <p>
                        This example also uses {native.alsoUses.join(' and ')}. Install everything
                        it uses:
                      </p>
                      <CopyCodeBlock
                        code={native.example}
                        label="Install example components"
                        language="shell"
                      />
                    </>
                  ) : null}
                </>
              ) : null
            }
            react={
              example ? (
                <>
                  <p>
                    Save this as <code>{example.file}</code>. It is the complete example shown
                    above, including its artwork.
                  </p>
                  <CopyCodeBlock code={example.source} label="Usage" />
                  <p>After configuring the registry, install every component this example uses:</p>
                  <CopyCodeBlock
                    code={example.install}
                    label="Install example components"
                    language="shell"
                  />
                </>
              ) : (
                <CopyCodeBlock code={usage} label="Usage" />
              )
            }
          />
        </section>

        <section className="docs-section" id="examples">
          <h2>Examples</h2>
          <ByPlatform
            native={native ? <Link href="/guides/expo">Build a glass screen with Expo</Link> : null}
            react={component.examples.map((example) => (
              <Fragment key={example.title}>
                {example.live === 'fixed-wallpaper' ? <FixedWallpaperExample /> : null}
                <CopyCodeBlock code={example.code} label={example.title} />
              </Fragment>
            ))}
          />
        </section>

        <section className="docs-section" id="api">
          <h2>API</h2>
          <ByPlatform
            native={
              native ? (
                <>
                  {component.id === 'glass-button' ? (
                    <p>
                      <code>GlassButtonProps</code> accepts React Native Pressable events and
                      accessibility props, plus <code>size</code>, <code>variant</code> and{' '}
                      <code>style</code>. Handle taps with <code>onPress</code>.
                    </p>
                  ) : component.id === 'glass-menu' ? (
                    <p>
                      <code>GlassMenu</code> accepts <code>open</code>, <code>defaultOpen</code>
                      and <code>onOpenChange</code>. Its trigger takes one pressable child. Build a
                      single-level menu with items, checkbox items and radio groups.
                    </p>
                  ) : null}
                  <p>
                    Read the{' '}
                    <a href={sourceUrl(`registry/glassyui-native/${component.registryItem}.tsx`)}>
                      React Native props and exports
                    </a>{' '}
                    in the component&rsquo;s copied source.
                  </p>
                </>
              ) : null
            }
            react={
              <div className="docs-api-list">
                {component.api.map((item) => (
                  <div key={item.name}>
                    <code>{item.name}</code>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            }
          />
        </section>

        <section className="docs-section" id="notes">
          <h2>Notes</h2>
          <ByPlatform
            native={
              native ? (
                <p>
                  The <Link href="/guides/expo">Expo guide</Link> covers native glass, shared
                  preferences and platform differences.
                </p>
              ) : null
            }
            react={
              <div className="docs-note-grid">
                {component.notes?.map((note) => (
                  <div key={note.title}>
                    <h3>{note.title}</h3>
                    <p>{note.body}</p>
                  </div>
                ))}
                <div>
                  <h3>Accessibility</h3>
                  <p>
                    Keep the Radix-backed semantics intact and preserve visible labels, focus
                    states, and keyboard operation when copying the source.
                  </p>
                </div>
                <div>
                  <h3>Performance</h3>
                  <p>
                    Use provider quality preferences for dense app screens. Reserve strong
                    refraction for hero or showcase surfaces.
                  </p>
                </div>
              </div>
            }
          />
        </section>

        <nav className="docs-pagination" aria-label="Component pagination">
          {adjacent.previous ? (
            <Link href={adjacent.previous.route ?? '/components'}>
              Previous: {adjacent.previous.name}
            </Link>
          ) : (
            <span />
          )}
          {adjacent.next ? (
            <Link href={adjacent.next.route ?? '/components'}>Next: {adjacent.next.name}</Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </DocsShell>
  );
}
