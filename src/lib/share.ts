import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site-links';

/*
  Link previews. Every card is a 1200 x 630 file in public/share. The home and React Native cards
  and their loops are renders from link-previews/, a film engine with its own package; every other card is
  photographed from the share studio by scripts/capture-share-cards.mjs. Messages plays a card's
  loop where it has one; everywhere else shows the image, the loop's first frame.

  Each address carries a hash of its file, so a changed card gets a new address and every
  platform's cache fetches it afresh. A missing file fails the build.
*/

const SIZE = { width: 1200, height: 630 } as const;

function versioned(file: string) {
  const target = path.join(process.cwd(), 'public/share', file);

  if (!existsSync(target)) {
    throw new Error(
      `No link-preview card at public/share/${file}. With pnpm dev running, capture every missing card: node scripts/capture-share-cards.mjs http://127.0.0.1:3000 --missing (public/share/README.md)`,
    );
  }

  const bytes = readFileSync(target);

  return `/share/${file}?v=${createHash('sha256').update(bytes).digest('hex').slice(0, 10)}`;
}

export type ShareCard = { alt: string; image: string; video: string | null };

/** The card public/share/<name>.jpg, with its loop loops/<name>.mp4 when it has one. */
export function shareCard(name: string, alt: string, { loop = false } = {}): ShareCard {
  return {
    alt,
    image: versioned(`${name}.jpg`),
    video: loop ? versioned(`loops/${name}.mp4`) : null,
  };
}

export const HOME_CARD = shareCard(
  'home',
  'A pill of clear glass bending the icons of a dock, beside the words: Bends light. In any browser.',
  { loop: true },
);

export const MOBILE_CARD = shareCard(
  'mobile',
  'A pill of clear glass over the segmented control of a phone’s Today screen, beside the words: Bends light. In your app.',
  { loop: true },
);

type ShareOptions = {
  card: ShareCard;
  description?: string;
  siteName?: string;
  /** Leave the site's name to og:site_name: Messages and chat apps show both. */
  title?: string;
  type?: 'article' | 'website';
  url?: string;
};

/**
 * Open Graph and X tags for a card. A layout passes only the card, so pages that set no tags of
 * their own share its picture without borrowing its address or title.
 */
export function shareMetadata({
  card,
  description,
  siteName = 'Glassy UI',
  title,
  type = 'website',
  url,
}: ShareOptions): Pick<Metadata, 'openGraph' | 'twitter'> {
  const image = { url: card.image, ...SIZE, type: 'image/jpeg', alt: card.alt };

  return {
    openGraph: {
      type,
      siteName,
      locale: 'en_US',
      ...(url ? { url } : null),
      ...(title ? { title } : null),
      ...(description ? { description } : null),
      images: [image],
      // Next resolves image addresses against metadataBase but leaves video addresses as given.
      ...(card.video
        ? { videos: [{ url: new URL(card.video, SITE_URL).href, type: 'video/mp4', ...SIZE }] }
        : null),
    },
    twitter: {
      card: 'summary_large_image',
      ...(title ? { title } : null),
      ...(description ? { description } : null),
      images: [image],
    },
  };
}
