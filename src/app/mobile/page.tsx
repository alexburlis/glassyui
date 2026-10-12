import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyCodeBlock } from '@/components/docs/copy-code-block';
import { expoComponentsJson } from '@/components/docs/expo-setup';
import { GlassButton } from '@/components/liquid';
import { CopyChip } from '@/components/site/copy-chip';
import { GithubMark } from '@/components/site/github-mark';
import { INSTALL_COMMAND } from '@/components/site/install-command';
import { MobilePhones } from '@/components/site/mobile-phones';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { nativeInstallCommand } from '@/lib/native-usage-source';
import { MOBILE_CARD, shareMetadata } from '@/lib/share';
import { GITHUB } from '@/lib/site-links';
import nativeRegistry from '../../../registry-native.json';

const NATIVE_INSTALL_COMMAND = nativeInstallCommand(['glass-button']);

const title = 'Glassy UI for React Native';

const description = `${nativeRegistry.items.length} Glassy UI components for React Native and Expo. iOS 26 draws them with the system’s own glass; Android and the web blur. Install with shadcn and own the code.`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/mobile' },
  ...shareMetadata({ card: MOBILE_CARD, title, description, url: '/mobile' }),
};

const reactSnippet = `<GlassButton variant="prominent" onClick={save}>
  Save
</GlassButton>`;

const nativeSnippet = `<GlassButton variant="prominent" onPress={save}>
  Save
</GlassButton>`;

export default function MobilePage() {
  return (
    <>
      <SiteNav />
      <main className="home" id="main-content">
        <section aria-labelledby="mobile-title" className="home-hero">
          <h1 className="home-title" id="mobile-title">
            Glassy UI, in your app.
          </h1>
          <p className="home-lead">
            Glass controls and native interactions for React Native and Expo. iOS 26 draws the
            system&rsquo;s own glass; Android and the web blur. Install with shadcn. Own the code.
          </p>
          <div className="home-actions">
            <GlassButton asChild size="lg" variant="prominent">
              <Link href="/guides/expo">Set up in Expo</Link>
            </GlassButton>
            <Link className="home-section-link" href="/components">
              Browse components<span aria-hidden> ›</span>
            </Link>
          </div>
          <CopyChip
            command={NATIVE_INSTALL_COMMAND}
            label="Copy the React Native install command"
          />
        </section>

        <section aria-label="One screen on iOS, Android and the web" className="home-section">
          <MobilePhones />
        </section>

        <section aria-labelledby="mobile-platforms-title" className="home-section">
          <header className="home-section-header">
            <h2 className="home-section-title" id="mobile-platforms-title">
              React and React Native.
            </h2>
            <p className="home-section-lead">
              Shared controls keep their names and use React Native props. App-only components add
              system pickers and touch gestures.
            </p>
          </header>
          <div className="mobile-platforms">
            <article className="mobile-platform">
              <h3>React</h3>
              <p>
                For React 19+ apps such as Next.js and Vite, with Tailwind CSS 4. The glass is drawn
                with CSS, SVG and WebGL.
              </p>
              <CopyCodeBlock code={INSTALL_COMMAND} label="Install for React" language="shell" />
              <CopyCodeBlock code={reactSnippet} label="React" />
            </article>
            <article className="mobile-platform">
              <h3>React Native</h3>
              <p>
                For Expo apps on iOS, Android and the web. iOS 26 draws the glass itself; elsewhere
                it blurs.
              </p>
              <CopyCodeBlock
                code={NATIVE_INSTALL_COMMAND}
                label="Install for React Native"
                language="shell"
              />
              <CopyCodeBlock code={nativeSnippet} label="React Native" />
            </article>
          </div>
        </section>

        <section aria-labelledby="mobile-steps-title" className="home-section">
          <header className="home-section-header">
            <h2 className="home-section-title" id="mobile-steps-title">
              Three steps to glass.
            </h2>
            <p className="home-section-lead">
              The shadcn CLI copies each component into your app, so every file is yours.
            </p>
            <Link className="home-section-link" href="/guides/expo">
              Read the Expo guide<span aria-hidden> ›</span>
            </Link>
          </header>
          <ol className="home-steps">
            <li className="home-step">
              <div className="home-step-text">
                <span aria-hidden className="home-step-number">
                  1
                </span>
                <h3>Add the registry</h3>
                <p>Add components.json and match the @/ import alias in tsconfig.json.</p>
              </div>
              <CopyCodeBlock code={expoComponentsJson} label="components.json" language="json" />
            </li>
            <li className="home-step">
              <div className="home-step-text">
                <span aria-hidden className="home-step-number">
                  2
                </span>
                <h3>Add a component</h3>
                <p>Install its packages and match them to your Expo SDK.</p>
              </div>
              <CopyCodeBlock
                code={NATIVE_INSTALL_COMMAND}
                label="Install Glass Button"
                language="shell"
              />
            </li>
            <li className="home-step">
              <div className="home-step-text">
                <span aria-hidden className="home-step-number">
                  3
                </span>
                <h3>Use it in your app</h3>
                <p>Import the component and put it on your screen.</p>
              </div>
              <CopyCodeBlock code={nativeSnippet} label="Use Glass Button" />
            </li>
          </ol>
        </section>

        <section aria-labelledby="mobile-components-title" className="home-section">
          <header className="home-section-header">
            <h2 className="home-section-title" id="mobile-components-title">
              {nativeRegistry.items.length} components, ready for apps.
            </h2>
            <p className="home-section-lead">
              Open one to see its React Native code. Scene, lens and the other web patterns stay on
              the web.
            </p>
          </header>
          <ul className="mobile-components">
            {nativeRegistry.items.map((item) => (
              <li key={item.name}>
                <Link href={`/components/${item.name}?platform=react-native`}>
                  {item.title.replace('Glass ', '')}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="mobile-cta-title" className="home-section home-cta">
          <h2 className="home-section-title" id="mobile-cta-title">
            Start with one component.
          </h2>
          <p className="home-section-lead">Free and open source, on the web and in apps.</p>
          <div className="home-actions">
            <GlassButton asChild size="lg" variant="prominent">
              <Link href="/guides/expo">Set up in Expo</Link>
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
