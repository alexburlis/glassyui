import Link from 'next/link';
import { componentCategories, componentDocs } from '@/components/docs/component-docs-data';
import { PRO_ORIGIN, GITHUB, newIssueUrl } from '@/lib/site-links';
import { BrandMark } from './app-icons';
import { GithubMark } from './github-mark';
import { PrivacySettingsButton } from './analytics-consent';

const FOOTER_CATEGORIES = componentCategories.filter((category) => category !== 'Core');

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <Link className="site-brand" href="/">
              <BrandMark className="site-brand-mark" />
              Glassy UI
            </Link>
            <p>Glassy UI components for React.</p>
          </div>
          <nav aria-label="Project" className="site-footer-project">
            <a className="site-footer-github" href={GITHUB.repository}>
              <GithubMark className="site-footer-github-mark" />
              GitHub
            </a>
            <a href={newIssueUrl('bug_report')}>Report an issue</a>
            <a href={GITHUB.contributing}>Contributing</a>
            <a href={GITHUB.changelog}>Changelog</a>
            <a href={GITHUB.license}>MIT license</a>
            <a href={GITHUB.security}>Security</a>
            <a href="/r/registry.json">Registry JSON</a>
            <a href="/llms.txt">llms.txt</a>
          </nav>
        </div>
        <nav aria-label="Footer" className="site-footer-columns">
          <div>
            <h2>Get started</h2>
            <Link href="/docs">Installation</Link>
            <Link href="/components">All components</Link>
            <Link href="/mobile">React Native</Link>
            <Link href="/components/glass-provider">Theming</Link>
            <a href={PRO_ORIGIN}>Templates</a>
            <Link href="/guides">Guides</Link>
          </div>
          {FOOTER_CATEGORIES.map((category) => (
            <div key={category}>
              <h2>{category}</h2>
              {componentDocs
                .filter((component) => component.category === category)
                .map((component) => (
                  <Link key={component.id} href={component.route ?? '/components'}>
                    {component.name.replace('Glass ', '')}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <nav aria-label="Legal" className="site-footer-legal-links">
          <Link href="/imprint">Imprint</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookie-policy">Cookies</Link>
          <PrivacySettingsButton />
        </nav>
      </div>
    </footer>
  );
}
