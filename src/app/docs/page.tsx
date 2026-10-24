import Link from 'next/link';
import type { Metadata } from 'next';
import { shareCard, shareMetadata } from '@/lib/share';
import {
  componentDocs,
  glassThemeRoot,
  initializeShadcn,
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
          <p>Install components with the shadcn CLI, or copy their source into your app.</p>
        </div>

        <section className="docs-section" id="installation">
          <h2>Installation</h2>
          <p>
            Start with a React 19+ app on Tailwind CSS 4. If it does not have a shadcn{' '}
            <code>components.json</code>, initialize it first:
          </p>
          <CopyCodeBlock code={initializeShadcn} label="Initialize shadcn" language="shell" />
          <p>
            Then add a component. Glassy UI is in the{' '}
            <a href="https://ui.shadcn.com/docs/directory">shadcn registry directory</a>, so the CLI
            finds <code>@glassyui</code> with no setup:
          </p>
          <CopyCodeBlock
            code={installCommand(['glass-button'], 'react')}
            label="Install Glass Button"
            language="shell"
          />
          <p>
            Each <Link href="/components">component page</Link> has npm, pnpm, yarn and bun
            commands, and a manual install with every file. Yarn commands need modern Yarn for{' '}
            <code>dlx</code>.
          </p>
          <p>
            Building with Expo? See <Link href="/guides/expo">Add Glassy UI to an Expo app</Link>.
          </p>
          <p>
            Already using shadcn/ui components? The Glassy UI theme restyles them without code
            changes:{' '}
            <Link href="/guides/shadcn-theme">Make a shadcn/ui app glassy with one command</Link>.
          </p>
        </section>

        <section className="docs-section" id="usage">
          <h2>Usage</h2>
          <p>
            Set <code>data-lg-theme="light"</code> or <code>data-lg-theme="dark"</code> on your root
            element, and update it with your app&rsquo;s theme switch so glass labels stay readable.
          </p>
          <CopyCodeBlock code={glassThemeRoot} label="Root element in a light app" />
          <p>
            Components import <code>styles/liquid.css</code> themselves, so you need no CSS import
            or provider:
          </p>
          <CopyCodeBlock code={minimalUsage} label="Minimal usage" />
          <p>
            Add <code>GlassProvider</code> when components should share theme, quality, motion and
            transparency preferences. Match <code>defaultTheme</code> to the app&rsquo;s initial
            theme.
          </p>
          <CopyCodeBlock code={optionalProviderUsage} label="Optional preferences provider" />
          <p>
            Render <code>LiquidFilters</code> only if your own CSS refers to the{' '}
            <code>#lg-liquid-refraction</code> SVG filter. No Glassy UI component needs it.
          </p>
        </section>

        <section className="docs-section" id="next-steps">
          <h2>Next steps</h2>
          <p>
            Browse all <Link href="/components">{componentDocs.length} components</Link>.
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
