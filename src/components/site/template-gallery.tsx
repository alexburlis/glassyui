import Image from 'next/image';
import Link from 'next/link';
import { PRO_OFFER, PRO_TEMPLATE_TEASERS } from '@/lib/pro-teaser';
import { PRO_ORIGIN } from '@/lib/site-links';
import { GALLERY, type GalleryEntry } from '@/lib/template-gallery';

const firstRelease = new Intl.ListFormat('en', { type: 'conjunction' }).format(
  PRO_TEMPLATE_TEASERS.filter((template) => template.status === 'first-release').map(
    (template) => template.name,
  ),
);

function TemplateCardBody({ entry }: { entry: GalleryEntry }) {
  return (
    <>
      <div className="template-card-poster">
        <Image
          alt={entry.tier === 'pro' ? `${entry.name} design preview` : `${entry.name} template`}
          height={800}
          sizes="(min-width: 1024px) 390px, 50vw"
          src={entry.poster}
          width={1280}
        />
        <span className="template-chip" data-tier={entry.tier}>
          {entry.chip}
        </span>
      </div>
      <div className="template-card-meta">
        <h3 className="template-card-title">{entry.name}</h3>
        <span className="template-card-text">{entry.kind}</span>
        <span className="template-card-action">
          {entry.action}
          {entry.status === 'soon' ? null : (
            <span aria-hidden>{entry.tier === 'pro' ? ' ↗' : ' ›'}</span>
          )}
        </span>
      </div>
    </>
  );
}

function TemplateCard({ entry }: { entry: GalleryEntry }) {
  if (entry.status === 'soon') {
    return (
      <div className="template-card" data-status="soon">
        <TemplateCardBody entry={entry} />
      </div>
    );
  }

  // A template's page is a whole site, so it loads when chosen rather than whenever it scrolls by.
  if (entry.tier === 'free') {
    return (
      <Link className="template-card" href={entry.href} prefetch={false}>
        <TemplateCardBody entry={entry} />
      </Link>
    );
  }

  return (
    <a className="template-card" data-analytics-source="template" href={entry.href}>
      <TemplateCardBody entry={entry} />
    </a>
  );
}

/** Every template, free and Pro, closed by the one Pro tile on the page and its price. */
export function TemplateGallery() {
  return (
    <>
      <div className="template-gallery">
        {GALLERY.map((entry) => (
          <TemplateCard entry={entry} key={entry.slug} />
        ))}
        <a className="template-pro-tile" data-analytics-source="template" href={PRO_ORIGIN}>
          <span className="template-pro-tile-copy">
            <span className="template-pro-tile-title">Every Pro template, one price</span>
            <span className="template-pro-tile-text">
              {PRO_OFFER.earlyBirdOpen
                ? `$${PRO_OFFER.earlyBirdPrice} for the first ${PRO_OFFER.earlyBirdCap}, then $${PRO_OFFER.regularPrice}.`
                : `$${PRO_OFFER.regularPrice}, paid once.`}{' '}
              {firstRelease} arrive first, estimated {PRO_OFFER.firstReleaseEstimate}.
            </span>
            <span className="template-pro-tile-action">
              Pre-order Pro<span aria-hidden> ↗</span>
            </span>
          </span>
        </a>
      </div>
      <p className="template-gallery-note">
        Pro images are design previews. Planned templates have no date yet.
      </p>
    </>
  );
}
