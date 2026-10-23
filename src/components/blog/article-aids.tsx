import Image from 'next/image';
import Link from 'next/link';
import { componentDocs } from '@/components/docs/component-docs-data';
import { DocsTocLinks } from '@/components/docs/docs-toc-links';
import { GlassButton } from '@/components/liquid';
import type { BlogHeading } from '@/lib/blog-headings';
import controlCentreDark from '../../../public/previews/desk-control-centre-dark.webp';
import controlCentreLight from '../../../public/previews/desk-control-centre-light.webp';

/**
 * The desk's control centre, cropped from the phone duo's inner screen in each appearance
 * (public/previews/phone-duo-inner*.webp). The card shows the one that matches the page's theme.
 */
const CONTROL_CENTRE = [
  { src: controlCentreLight, theme: 'light' },
  { src: controlCentreDark, theme: 'dark' },
] as const;

/**
 * The table of contents where the right column folds away: one card above the TL;DR, closed until
 * the reader opens it.
 */
export function BlogTocDisclosure({ items }: { items: BlogHeading[] }) {
  return (
    <details className="blog-toc">
      <summary>Table of contents</summary>
      <nav aria-label="Table of contents">
        <DocsTocLinks items={items} />
      </nav>
    </details>
  );
}

/** The article's short answer, restated from its body, before the body starts. */
export function BlogTldr({ items }: { items: string[] }) {
  return (
    <section aria-labelledby="tldr-title" className="blog-tldr" data-blog-tldr="">
      <h2 id="tldr-title">TL;DR</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function Check() {
  return (
    <svg aria-hidden="true" className="blog-cta-check" fill="none" viewBox="0 0 16 16">
      <path
        d="m3.5 8.4 2.9 2.9 6.1-6.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * The way from an article to the library, in words the home page already uses. A neutral tile with
 * the standard blue action: the Pro card stays the site's one Vermilion card.
 */
export function BlogComponentsCta() {
  return (
    <div className="blog-cta" data-blog-cta="">
      {CONTROL_CENTRE.map((image) => (
        <Image
          key={image.theme}
          alt="A glass control panel built from Glassy UI: switches and a segmented control over red ribbon artwork."
          className="blog-cta-image"
          data-theme={image.theme}
          sizes="(min-width: 1280px) 198px, (min-width: 560px) 390px, calc(100vw - 34px)"
          src={image.src}
        />
      ))}
      <div className="blog-cta-body">
        <p className="blog-cta-title">Start with one component.</p>
        <p className="blog-cta-text">
          Glassy UI installs through the shadcn CLI, so every file lands in your repo.
        </p>
        <ul className="blog-cta-points" role="list">
          <li>
            <Check />
            {componentDocs.length} free React glass components
          </li>
          <li>
            <Check />
            React Native versions for iOS and Android
          </li>
          <li>
            <Check />
            Free and open source
          </li>
        </ul>
        <GlassButton asChild size="sm" variant="prominent">
          <Link href="/components">Browse components</Link>
        </GlassButton>
      </div>
    </div>
  );
}
