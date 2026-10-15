import Link from 'next/link';
import type { Metadata } from 'next';
import { shareCard, shareMetadata } from '@/lib/share';
import {
  componentDocs,
  glassThemeRoot,
  initializeShadcn,
  publicRegistryMapping,
} from '@/components/docs/component-docs-data';
import { CopyCodeBlock } from '@/components/docs/copy-code-block';
import { DocsShell } from '@/components/docs/docs-shell';
import { PRO_ORIGIN } from '@/lib/site-links';
import { installCommand } from '@/lib/install-command';

const description =
  'Install a Glassy UI component with the shadcn CLI or copy its source into your React app.';

export const metadata: Metadata = {
  title: 'Getting Started',
  description,
  alternates: {
    canonical: '/docs',
  },
  ...shareMetadata({
    card: shareCard(
      'docs',
      'The shadcn install command on red ribbon artwork, beside the words: Get started. With shadcn.',
    ),
    title: 'Get started with Glassy UI',
    description,
    url: '/docs',
    type: 'article',
  }),
};

const minimalUsage = `import { GlassButton } from "@/components/glassyui/glass-button";

export default function Page() {
  return <GlassButton>Launch</GlassButton>;
}`;

const optionalProviderUsage = `import { GlassProvider } from "@/components/glassyui/glass-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <GlassProvider defaultTheme="light">{children}</GlassProvider>;
}`;

const gettingStartedToc = [
  { href: '#installation', title: 'Installation' },
  { href: '#usage', title: 'Usage' },
  { href: '#next-steps', title: 'Next steps' },
];

export default function DocsPage() {
  return (
    <DocsShell contribute={{ subject: 'Getting started' }} current="/docs" toc={gettingStartedToc}>
      <article>
        <div className="docs-page-header">
          <p className="docs-eyebrow">Getting Started</p>
          <h1>Add Glassy UI to your app</h1>
          <p>Browse a component, preview it, then install it with the CLI or copy its source.</p>
        </div>

        <section className="docs-section" id="installation">
          <h2>Installation</h2>
          <p>
            Start with a React 19+ app on Tailwind CSS 4. If it does not have a shadcn{' '}
            <code>components.json</code>, initialize it first:
          </p>
          <CopyCodeBlock code={initializeShadcn} label="Initialize shadcn" language="shell" />
          <p>Install a component directly from its URL:</p>
          <CopyCodeBlock
            code={installCommand(['glass-button'], 'react')}
            label="Install Glass Button"
            language="shell"
          />
          <p>
            Each <Link href="/components">component page</Link> offers npm, pnpm, yarn and bun
            commands, plus Manual installation with every required file. The Yarn command uses
            modern Yarn with <code>dlx</code>.
          </p>
          <p>
            Building with Expo? See <Link href="/guides/expo">Add Glassy UI to an Expo app</Link>.
          </p>
          <details>
            <summary>Optional registry shorthand</summary>
            <p>
              Existing namespace commands still work. Merge this mapping into your{' '}
              <code>components.json</code> to use <code>@glassyui/glass-button</code> instead of the
              full URL.
            </p>
            <CopyCodeBlock
              code={publicRegistryMapping}
              label="Optional components.json registry mapping"
              language="json"
            />
          </details>
          <p>
            Already have stock shadcn/ui components? The Glassy UI theme restyles them without code
            changes; see{' '}
            <Link href="/guides/shadcn-theme">Make a shadcn/ui app glassy with one command</Link>.
          </p>
        </section>

        <section className="docs-section" id="usage">
          <h2>Usage</h2>
          <p>
            Set <code>data-lg-theme="light"</code> on your root element for a light page, or{' '}
            <code>data-lg-theme="dark"</code> for a dark page. Update this attribute with your
            app&rsquo;s theme switch so glass labels stay readable.
          </p>
          <CopyCodeBlock code={glassThemeRoot} label="Root element in a light app" />
          <p>
            Every component imports <code>styles/liquid.css</code>, either directly or through the
            provider module it depends on, so this example needs no separate CSS import or provider
            wrapper.
          </p>
          <CopyCodeBlock code={minimalUsage} label="Minimal usage" />
          <p>
            Wrap an app or preview area in <code>GlassProvider</code> only when its children need
            synchronized theme, quality, motion, and transparency preferences. Match{' '}
            <code>defaultTheme</code> to the app&rsquo;s initial theme.
          </p>
          <CopyCodeBlock code={optionalProviderUsage} label="Optional preferences provider" />
          <p>
            Render <code>LiquidFilters</code> only when legacy or global CSS refers to the shared{' '}
            <code>#lg-liquid-refraction</code> SVG filter. Supplied-background surface refraction
            creates its own filter.
          </p>
        </section>

        <section className="docs-section" id="next-steps">
          <h2>Next steps</h2>
          <p>
            Browse all <Link href="/components">{componentDocs.length} components</Link>. Each page
            offers CLI and Manual installation with every required file.
          </p>
          <p>
            Follow the <Link href="/guides/shadcn">step-by-step installation guide</Link>, or start
            from a complete site with a <a href={PRO_ORIGIN}>Glassy UI Pro template</a>.
          </p>
        </section>
      </article>
    </DocsShell>
  );
}
