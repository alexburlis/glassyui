'use client';

import { Content as TabsContent } from '@radix-ui/react-tabs';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { GlassTabs, GlassTabsList, GlassTabsTrigger } from '@/components/liquid';
import type { ComponentInstallationData } from '@/lib/component-installation-data';
import {
  PACKAGE_MANAGERS,
  chooseDocsPackageManager,
  useDocsPackageManager,
} from '@/lib/docs-package-manager';
import {
  dependencyCommand,
  installCommand,
  registryItemUrl,
  type InstallPlatform,
} from '@/lib/install-command';
import { CopyCodeBlock } from './copy-code-block';
import { useDocsPlatform } from './platform-switch';

function PackageManagerChoices() {
  const manager = useDocsPackageManager();
  const name = useId();

  return (
    <fieldset className="docs-package-managers" role="radiogroup" aria-label="Package manager">
      {PACKAGE_MANAGERS.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name={name}
            value={option}
            checked={manager === option}
            onChange={() => chooseDocsPackageManager(option)}
          />
          <span>{option}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Example recipes share the same manager preference as the Installation section. */
export function InstallCommandBlock({
  items,
  platform,
  label,
}: {
  items: readonly string[];
  platform: InstallPlatform;
  label: string;
}) {
  const manager = useDocsPackageManager();

  return (
    <CopyCodeBlock
      code={installCommand(items, platform, manager)}
      label={label}
      language="shell"
      header={<PackageManagerChoices />}
      copyLabel={`the ${manager} install command`}
      command
    />
  );
}

function PackageCommand({ data }: { data: ComponentInstallationData }) {
  const manager = useDocsPackageManager();

  return (
    <CopyCodeBlock
      code={dependencyCommand(data.packages, data.platform, manager)}
      label="Install packages"
      language="shell"
      header={
        data.platform === 'react' ? (
          <PackageManagerChoices />
        ) : (
          <span>Expo picks the versions for your SDK</span>
        )
      }
      command
    />
  );
}

function packageNames(packages: readonly string[]) {
  if (packages.length < 2) return packages[0] ?? '';

  return `${packages.slice(0, -1).join(', ')} and ${packages.at(-1)}`;
}

function InstallationSummary({ data }: { data: ComponentInstallationData }) {
  const fileCount = data.groups.flatMap((group) => group.targets).length;
  const packages = packageNames(data.packages);

  return (
    <p className="docs-install-summary">
      Adds {fileCount} {fileCount === 1 ? 'file' : 'files'} to <code>components/glassyui</code>
      {packages ? (
        data.platform === 'react-native' ? (
          <>
            , then matches {packages} to your Expo SDK. Rebuild your development build after adding
            native packages.
          </>
        ) : (
          <> and installs {packages}.</>
        )
      ) : (
        '.'
      )}
    </p>
  );
}

type FileSources = Map<string, string>;

/** Decode the payload at its I/O boundary; a bad publication remains a visible error. */
function decodeFiles(text: string, item: string): FileSources {
  const payload = JSON.parse(text);

  if (payload?.name !== item || !Array.isArray(payload.files)) {
    throw new Error('The registry payload does not match this component.');
  }

  const sources: FileSources = new Map();

  for (const file of payload.files) {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate external JSON before using source as clipboard text.
    if (!file || typeof file.target !== 'string' || typeof file.content !== 'string') {
      throw new Error('The registry payload contains an invalid file.');
    }

    if (sources.has(file.target)) throw new Error('The registry payload repeats a file target.');
    sources.set(file.target, file.content);
  }

  return sources;
}

function ManualFile({
  target,
  main,
  content,
  loading,
  failed,
}: {
  target: string;
  main: boolean;
  content: string | undefined;
  loading: boolean;
  failed: boolean;
}) {
  const [expanded, setExpanded] = useState(main);
  const viewerId = useId();
  const path = target.replace(/^components\/glassyui\//, '');

  const message = loading
    ? 'Loading the files…'
    : failed
      ? "Couldn't load the files."
      : content === undefined
        ? "This file isn't in the published payload."
        : undefined;

  return (
    <div data-target={target}>
      <CopyCodeBlock
        code={content ?? ''}
        label={path}
        language={/\.[cm]?[jt]sx?$/.test(path) ? 'tsx' : 'plain'}
        header={
          <button
            type="button"
            className="docs-file-toggle"
            aria-expanded={expanded}
            aria-controls={viewerId}
            onClick={() => setExpanded(!expanded)}
          >
            <span className="docs-file-chevron" aria-hidden="true">
              ›
            </span>
            <span className="docs-file-path">{path}</span>
            {path === 'styles/liquid.css' ? (
              <span className="docs-file-note">Imported by glass-provider.tsx</span>
            ) : null}
          </button>
        }
        expanded={expanded}
        onReveal={() => setExpanded(true)}
        disabled={content === undefined}
        emptyMessage={message}
        viewerId={viewerId}
        target={target}
        file
      />
    </div>
  );
}

function ManualFiles({
  data,
  cache,
}: {
  data: ComponentInstallationData;
  cache: Map<string, FileSources>;
}) {
  const payloadUrl = new URL(registryItemUrl(data.item, data.platform)).pathname;
  const [sources, setSources] = useState(() => cache.get(payloadUrl));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loading = !sources && !failed;

  useEffect(() => {
    if (cache.has(payloadUrl)) return;

    const controller = new AbortController();

    async function loadFiles() {
      try {
        const response = await fetch(payloadUrl, { signal: controller.signal });

        if (!response.ok) throw new Error(`Registry request failed: ${response.status}`);

        const loaded = decodeFiles(await response.text(), data.item);

        for (const group of data.groups) {
          for (const target of group.targets) {
            if (!loaded.has(target)) {
              throw new Error(`The published payload is missing ${target}.`);
            }
          }
        }

        if (controller.signal.aborted) return;
        cache.set(payloadUrl, loaded);
        setSources(loaded);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn('Glassy UI could not load the component files', error);
        setFailed(true);
      }
    }

    void loadFiles();

    return () => controller.abort();
  }, [attempt, cache, data.groups, data.item, payloadUrl]);

  return (
    <>
      {failed ? (
        <p className="docs-file-error" role="status">
          Couldn&rsquo;t load the files.{' '}
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt(attempt + 1);
            }}
          >
            Try again
          </button>{' '}
          or <a href={payloadUrl}>open the registry JSON</a>.
        </p>
      ) : null}
      {data.groups.map((group) =>
        group.targets.length ? (
          <div className="docs-file-group" key={group.name}>
            <h4>{group.title}</h4>
            {group.shared ? <p>Shared with other components</p> : null}
            {group.targets.map((target, index) => (
              <ManualFile
                key={target}
                target={target}
                main={!group.shared && index === 0}
                content={sources?.get(target)}
                loading={loading}
                failed={failed}
              />
            ))}
          </div>
        ) : null,
      )}
    </>
  );
}

export function ComponentInstallation({
  react,
  native,
}: {
  react?: ComponentInstallationData;
  native?: ComponentInstallationData;
}) {
  const platform = useDocsPlatform();
  const [method, setMethod] = useState('cli');
  const [cache] = useState(() => new Map<string, FileSources>());
  const data = (!react || platform === 'react-native') && native ? native : react;

  if (!data) throw new Error('A component needs an installation platform.');

  return (
    <section className="docs-section docs-installation" id="installation" aria-label="Installation">
      <h2>Installation</h2>
      <p className="docs-install-platform">
        {data.platform === 'react'
          ? 'For React 19+ apps with Tailwind CSS 4.'
          : `For Expo SDK ${data.expoFloor} or later.`}
      </p>
      <GlassTabs value={method} onValueChange={setMethod}>
        <GlassTabsList className="docs-install-method" aria-label="Installation method">
          <GlassTabsTrigger value="cli">CLI</GlassTabsTrigger>
          <GlassTabsTrigger value="manual">Manual</GlassTabsTrigger>
        </GlassTabsList>
        <TabsContent className="docs-install-panel" value="cli">
          {data.platform === 'react-native' ? (
            <p>
              Add a <code>components.json</code> to your app first, as the{' '}
              <Link href="/guides/expo">Expo guide</Link> shows.
            </p>
          ) : null}
          <InstallCommandBlock
            items={[data.item]}
            platform={data.platform}
            label={`Install ${data.title}`}
          />
          <InstallationSummary data={data} />
        </TabsContent>
        <TabsContent className="docs-install-panel" value="manual">
          {data.packages.length ? (
            <div className="docs-install-step">
              <h3>1. Install the packages</h3>
              <PackageCommand data={data} />
            </div>
          ) : null}
          <div className="docs-install-step">
            <h3>
              {data.packages.length ? '2' : '1'}. Add the files to <code>components/glassyui</code>
            </h3>
            <p>
              Keep the <code>lib</code>
              {data.platform === 'react' ? (
                <>
                  {' '}
                  and <code>styles</code> folders
                </>
              ) : (
                ' folder'
              )}
              , since the files import each other by relative path. If your <code>@/</code> alias
              points at <code>src</code>, use <code>src/components/glassyui</code>.
            </p>
            <ManualFiles key={`${data.platform}/${data.item}`} data={data} cache={cache} />
          </div>
          <p>
            <Link href={data.platform === 'react' ? '/docs#usage' : '/guides/expo'}>
              Set up GlassProvider
            </Link>{' '}
            for shared theme and accessibility preferences.
          </p>
          {data.platform === 'react-native' && data.packages.length ? (
            <p>Then rebuild your development build.</p>
          ) : null}
        </TabsContent>
      </GlassTabs>
    </section>
  );
}
