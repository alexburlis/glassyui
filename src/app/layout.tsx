import type { Metadata } from 'next';
import { preload } from 'react-dom';
import { componentDocs } from '@/components/docs/component-docs-data';
import { HOME_CARD, shareMetadata } from '@/lib/share';
import { siteDescription as describeSite } from '@/lib/site-description';
import { SITE_URL } from '@/lib/site-links';
import { Providers } from './providers';
import './globals.css';

const siteDescription = describeSite(componentDocs.length);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Glassy UI — Glass components for React',
    template: '%s | Glassy UI',
  },
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
  // Every page shares the home card until it sets its own. Pages name their own address and
  // title, so a page with no tags of its own never borrows the home page's.
  ...shareMetadata({ card: HOME_CARD }),
  robots: { 'max-image-preview': 'large' },
};

// The theme a visitor sees until they choose one, whatever their system prefers. The server
// markup, the script below and the provider all use it, so the page never flashes the other one.
const DEFAULT_THEME = 'light';

// Sets data-lg-theme before paint, a saved choice or otherwise the default, and a saved choice to
// reduce motion or transparency, so the page neither plays its entrance nor flashes glass for a
// visitor who turned them off. The only interpolated value is the constant above.
const themeBootstrap = `(function(){try{var t,p;var raw=localStorage.getItem('glassy-ui-preferences');if(raw){p=JSON.parse(raw);t=p&&p.theme;}if(t!=='light'&&t!=='dark'){t='${DEFAULT_THEME}';}var r=document.documentElement;r.setAttribute('data-lg-theme',t);if(!r.getAttribute('data-lg-mode')){r.setAttribute('data-lg-mode','clear');}if(p&&typeof p.reduceMotion==='boolean'){r.setAttribute('data-lg-reduce-motion',p.reduceMotion?'1':'0');}if(p&&typeof p.reduceTransparency==='boolean'){r.setAttribute('data-lg-reduce-transparency',p.reduceTransparency?'1':'0');}}catch(e){document.documentElement.setAttribute('data-lg-theme','${DEFAULT_THEME}');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Both appearances must be available before the visitor first changes the theme.
  for (const theme of ['light', 'dark']) {
    preload(`/wallpapers/vermilion-${theme}.svg`, { as: 'image' });
  }

  return (
    <html lang="en" data-lg-theme={DEFAULT_THEME} data-lg-mode="clear" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="antialiased">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Providers defaultTheme={DEFAULT_THEME}>{children}</Providers>
      </body>
    </html>
  );
}
