import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { componentDocs, getComponentDoc } from '@/components/docs/component-docs-data';
import {
  KeynoteBootstrap,
  KeynoteOpener,
  KeynoteReplay,
} from '@/components/keynote/keynote-opener';
import { KeynoteTurn } from '@/components/keynote/keynote-turn';
import { GlassButton } from '@/components/liquid';
import { ComponentGrid, ReleaseFeedbackProvider } from '@/components/site/component-grid';
import { GithubMark } from '@/components/site/github-mark';
import { GithubStarButton } from '@/components/site/github-star-button';
import { JsonLd } from '@/components/site/json-ld';
import { Desk } from '@/components/site/desk';
import { FeatureBento } from '@/components/site/feature-bento';
import { GlassWindow } from '@/components/site/glass-window';
import { LiquidLab } from '@/components/site/liquid-lab';
import { MobilePhones } from '@/components/site/mobile-phones';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { AlertsTile, CommandTile, NavigationTile } from '@/components/site/showcase-tiles';
import { HOME_CARD, shareMetadata } from '@/lib/share';
import { siteDescription } from '@/lib/site-description';
import { GITHUB, SITE_URL } from '@/lib/site-links';
import nativeRegistry from '../../registry-native.json';

// Tiles without a custom demo use their component's docs example.
const SHOWCASE: Array<{ demo?: ReactNode; id: string }> = [
  { id: 'glass-scene' },
  { id: 'glass-lens' },
  { id: 'glass-dock' },
  { demo: <CommandTile />, id: 'glass-command' },
  { id: 'glass-checkbox' },
  { demo: <AlertsTile />, id: 'glass-alert' },
  { id: 'glass-avatar' },
  { id: 'glass-progress' },
  { demo: <NavigationTile />, id: 'glass-pagination' },
];

// Where the showcase joins the card backdrop rotation. From here its three columns keep
// Vermilion off the tiles with small grey text and never stack two red cards.
const SHOWCASE_BACKDROP_OFFSET = 2;

function requireComponent({ demo, id }: { demo?: ReactNode; id: string }) {
  const component = getComponentDoc(id);

  if (!component?.route) throw new Error(`The homepage features ${id}, which has no page.`);

  return {
    demo,
    description: component.description,
    id: component.id,
    isNew: component.isNew,
    name: component.name,
    route: component.route,
  };
}

export const metadata: Metadata = shareMetadata({
  card: HOME_CARD,
  title: 'Glass components for React',
  description: siteDescription(componentDocs.length),
  url: '/',
});

export default function Home() {
  const showcase = SHOWCASE.map(requireComponent);
  const dock = getComponentDoc('glass-dock');

  if (!dock) {
    throw new Error('The homepage needs the dock files.');
  }

  return (
    <>
      <KeynoteBootstrap />
      <SiteNav />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          description: siteDescription(componentDocs.length),
          inLanguage: 'en',
          name: 'Glassy UI',
          url: SITE_URL,
        }}
      />
      <main className="home" id="main-content">
        <KeynoteOpener>
          <section aria-labelledby="home-title" className="home-hero">
            <Link className="home-announce" href="/mobile">
              <span className="home-announce-tag">New</span>
              <span className="home-announce-text">
                <span className="home-announce-long">Glassy UI for React Native apps</span>
                <span className="home-announce-short">Now for React Native</span>
              </span>
              <span aria-hidden> ›</span>
            </Link>
            <h1 className="home-title" id="home-title">
              Glass without effort.
            </h1>
            <p className="home-lead">
              Glassy UI brings {componentDocs.length} free React glass components to your app, with
              React Native versions for iOS and Android. Install with shadcn. Own the code.
            </p>
            <div className="home-actions">
              <GlassButton asChild size="lg" variant="prominent">
                <Link href="/components">Browse components</Link>
              </GlassButton>
              <GithubStarButton />
            </div>
            <KeynoteReplay />
          </section>

          <section aria-label="Interactive demo" className="home-desk">
            <KeynoteTurn
              caption="Every piece of this screen is a Glassy UI component. Try the menus, sliders and dock."
              nativeCount={nativeRegistry.items.length}
            >
              <div className="home-desk-frame">
                <Desk />
              </div>
            </KeynoteTurn>
          </section>
        </KeynoteOpener>

        <section aria-labelledby="home-showcase-title" className="home-section">
          <header className="home-section-header">
            <h2 className="home-section-title" id="home-showcase-title">
              Everything an app needs.
            </h2>
            <p className="home-section-lead">
              {componentDocs.length} components on one glass, and every tile is live. Copy the
              source and make it yours.
            </p>
            <Link className="home-section-link" href="/components">
              Browse all {componentDocs.length} components<span aria-hidden> ›</span>
            </Link>
          </header>
          <ReleaseFeedbackProvider>
            <ComponentGrid components={showcase} lazy offset={SHOWCASE_BACKDROP_OFFSET} />
          </ReleaseFeedbackProvider>
        </section>

        <section aria-labelledby="home-lab-title" className="home-section home-lab">
          <header className="home-section-header">
            <h2 className="home-section-title" id="home-lab-title">
              The liquid lab.
            </h2>
            <p className="home-section-lead">
              Drag the drops apart and together, then tune the glass.
            </p>
          </header>
          <div className="home-lab-frame">
            <LiquidLab />
          </div>
        </section>

        <GlassWindow />

        <section aria-labelledby="home-features-title" className="home-section">
          <header className="home-section-header">
            <h2 className="home-section-title" id="home-features-title">
              Light, depth and motion.
            </h2>
            <p className="home-section-lead">
              Every component shares one glass. It bends what sits behind it, catches light at its
              rim and moves on a spring.
            </p>
          </header>
          <FeatureBento files={dock.installedFiles} />
        </section>

        <section aria-labelledby="home-mobile-title" className="home-section">
          <header className="home-section-header">
            <h2 className="home-section-title" id="home-mobile-title">
              Glass for React Native and Expo.
            </h2>
            <p className="home-section-lead">
              Supported iOS 26+ devices draw the system&rsquo;s own glass. Earlier iOS uses blur;
              Android blurs content inside <code>GlassBackdrop</code>.
            </p>
            <Link className="home-section-link" href="/mobile">
              See React Native<span aria-hidden> ›</span>
            </Link>
          </header>
          <MobilePhones />
        </section>

        <section aria-labelledby="home-install-title" className="home-section">
          <header className="home-section-header">
            <h2 className="home-section-title" id="home-install-title">
              From preview to your app.
            </h2>
            <p className="home-section-lead">
              Glassy UI installs through the shadcn CLI, so every file lands in your repo.
            </p>
          </header>
          <ol className="home-steps home-discovery-steps">
            <li className="home-step">
              <div className="home-step-text">
                <span aria-hidden className="home-step-number">
                  1
                </span>
                <h3>Choose a component</h3>
                <p>Try the preview and find your starting point.</p>
                <Link className="home-section-link" href="/components">
                  Browse components<span aria-hidden> ›</span>
                </Link>
              </div>
            </li>
            <li className="home-step">
              <div className="home-step-text">
                <span aria-hidden className="home-step-number">
                  2
                </span>
                <h3>Install it your way</h3>
                <p>Use the CLI or copy the source into your app.</p>
                <Link className="home-section-link" href="/docs#installation">
                  Installation guide<span aria-hidden> ›</span>
                </Link>
              </div>
            </li>
            <li className="home-step">
              <div className="home-step-text">
                <span aria-hidden className="home-step-number">
                  3
                </span>
                <h3>Make it yours</h3>
                <p>Every file is in your repo, ready to change.</p>
                <Link className="home-section-link" href="/components/glass-button">
                  Explore Glass Button<span aria-hidden> ›</span>
                </Link>
              </div>
            </li>
          </ol>
        </section>

        <section aria-labelledby="home-cta-title" className="home-section home-cta">
          <h2 className="home-section-title" id="home-cta-title">
            Start with one component.
          </h2>
          <p className="home-section-lead">
            Free and open source. Every file is yours to read and change.
          </p>
          <div className="home-actions">
            <GlassButton asChild size="lg" variant="prominent">
              <Link href="/components">Browse components</Link>
            </GlassButton>
            <a className="home-section-link home-cta-github" href={GITHUB.repository}>
              <GithubMark className="home-cta-mark" />
              Star on GitHub<span aria-hidden> ›</span>
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
