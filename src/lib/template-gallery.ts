import { PRO_TEMPLATE_TEASERS, type ProTemplateTeaser } from '@/lib/pro-teaser';
import { PRO_ORIGIN } from '@/lib/site-links';
import { FREE_TEMPLATES, freeTemplatePath, type FreeTemplateSlug } from '@/lib/templates';

/** The home page's gallery mixes the tiers, so the first row already shows free and Pro. */
const GALLERY_ORDER = [
  'northstar',
  'halcyon',
  'tempo',
  'fieldnotes',
  'relay',
  'quill',
  'penny',
  'orbit',
  'still',
  'beacon',
  'tally',
  'cohort',
  'hush',
] as const;

interface GalleryCard {
  /** The line that says what a click does. */
  action: string;
  /** The label on the poster: the tier, then the status. */
  chip: string;
  kind: string;
  name: string;
  poster: string;
}

export type GalleryEntry =
  | (GalleryCard & { href: string; slug: FreeTemplateSlug; status: 'available'; tier: 'free' })
  | (GalleryCard & { slug: FreeTemplateSlug; status: 'soon'; tier: 'free' })
  | (GalleryCard & {
      href: string;
      slug: string;
      status: ProTemplateTeaser['status'];
      tier: 'pro';
    });

const poster = (slug: string) => `/templates/${slug}.jpg`;

const freeEntries = FREE_TEMPLATES.map((template): GalleryEntry => {
  const card = { kind: template.kind, name: template.name, poster: poster(template.slug) };

  return template.status === 'available'
    ? {
        ...card,
        action: 'Use free template',
        chip: 'Free',
        href: freeTemplatePath(template.slug),
        slug: template.slug,
        status: 'available',
        tier: 'free',
      }
    : {
        ...card,
        action: 'Coming soon',
        chip: 'Free · Soon',
        slug: template.slug,
        status: 'soon',
        tier: 'free',
      };
});

const proEntries = PRO_TEMPLATE_TEASERS.map((template): GalleryEntry => ({
  action: template.status === 'first-release' ? 'Pre-order in Pro' : 'See in Pro',
  chip: template.status === 'first-release' ? 'Pro · First release' : 'Pro · Planned',
  href: `${PRO_ORIGIN}/#${template.slug}`,
  kind: template.kind,
  name: template.name,
  poster: poster(template.slug),
  slug: template.slug,
  status: template.status,
  tier: 'pro',
}));

function inGalleryOrder(entries: GalleryEntry[]) {
  const bySlug = new Map<string, GalleryEntry>();

  for (const entry of entries) {
    if (bySlug.has(entry.slug)) throw new Error(`Two templates use the slug ${entry.slug}.`);
    bySlug.set(entry.slug, entry);
  }

  const ordered = GALLERY_ORDER.map((slug, index) => {
    if (GALLERY_ORDER.indexOf(slug) !== index) {
      throw new Error(`The gallery order lists ${slug} twice.`);
    }

    const entry = bySlug.get(slug);

    if (!entry) throw new Error(`The gallery order lists ${slug}, which no catalogue has.`);
    bySlug.delete(slug);

    return entry;
  });

  if (bySlug.size > 0) {
    throw new Error(`The gallery order leaves out ${[...bySlug.keys()].join(', ')}.`);
  }

  return ordered;
}

/** Every template, free and Pro, in the order the home page shows them. */
export const GALLERY = inGalleryOrder([...freeEntries, ...proEntries]);
