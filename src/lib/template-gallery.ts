import { PRO_OFFER, PRO_TEMPLATE_TEASERS, type ProTemplateTeaser } from '@/lib/pro-teaser';
import { PRO_ORIGIN } from '@/lib/site-links';
import TEMPLATE_PAGES from '@/lib/template-pages.json';
import {
  FREE_TEMPLATES,
  freeTemplatePath,
  type FreeTemplate,
  type FreeTemplateSlug,
} from '@/lib/templates';

/**
 * A photograph of a template's whole page at its poster's width, taken by
 * scripts/capture-template-pages.mjs.
 */
export interface TemplatePage {
  height: number;
  src: string;
  width: number;
}

interface Card {
  kind: string;
  name: string;
  /** The page its window scrolls down under a pointer; with only a poster, the card holds still. */
  page?: TemplatePage;
  poster: string;
}

export type FreeCard =
  | (Card & { href: string; slug: FreeTemplateSlug; status: 'available' })
  | (Card & { slug: FreeTemplateSlug; status: 'soon' });

export interface ProCard extends Card {
  /** "Coming <month>" for the first release, "Coming soon" for the rest. */
  chip: string;
  /** Where the card leads without script or with a modifier key: `${PRO_ORIGIN}/#${slug}`. */
  href: string;
  slug: string;
  status: ProTemplateTeaser['status'];
  /** The first release's line in the dialog, "First release, estimated <month> <year>". */
  timing?: string;
}

const { month, year } = PRO_OFFER.firstRelease;

const PRO_STATUS: Record<ProTemplateTeaser['status'], Pick<ProCard, 'chip' | 'timing'>> = {
  'first-release': { chip: `Coming ${month}`, timing: `First release, estimated ${month} ${year}` },
  planned: { chip: 'Coming soon' },
};

const poster = (slug: string) => `/templates/${slug}.jpg`;

const pages: Record<string, Omit<TemplatePage, 'src'>> = TEMPLATE_PAGES;

function pageOf(slug: string): TemplatePage | undefined {
  const page = pages[slug];

  return page ? { ...page, src: `/templates/pages/${slug}.jpg` } : undefined;
}

function freeCard(template: FreeTemplate): FreeCard {
  const card = {
    kind: template.kind,
    name: template.name,
    page: pageOf(template.slug),
    poster: poster(template.slug),
    slug: template.slug,
  };

  return template.status === 'available'
    ? { ...card, href: freeTemplatePath(template.slug), status: 'available' }
    : { ...card, status: 'soon' };
}

function proCard(template: ProTemplateTeaser): ProCard {
  return {
    ...PRO_STATUS[template.status],
    href: `${PRO_ORIGIN}/#${template.slug}`,
    kind: template.kind,
    name: template.name,
    page: pageOf(template.slug),
    poster: poster(template.slug),
    slug: template.slug,
    status: template.status,
  };
}

export const FREE_CARDS: readonly FreeCard[] = [
  ...FREE_TEMPLATES.filter((template) => template.status === 'available'),
  ...FREE_TEMPLATES.filter((template) => template.status === 'soon'),
].map(freeCard);

export const PRO_CARDS: readonly ProCard[] = [
  ...PRO_TEMPLATE_TEASERS.filter((template) => template.status === 'first-release'),
  ...PRO_TEMPLATE_TEASERS.filter((template) => template.status === 'planned'),
].map(proCard);

// Both tiers name their posters in public/templates by slug, so no two templates may share one.
const slugs = [...FREE_CARDS, ...PRO_CARDS].map((card) => card.slug);

const repeated = slugs.find((slug, index) => slugs.indexOf(slug) !== index);

if (repeated) throw new Error(`Two templates use the slug ${repeated}.`);

const strayPage = Object.keys(pages).find((slug) => !slugs.includes(slug));

if (strayPage) throw new Error(`A page photograph names ${strayPage}, which no template uses.`);
