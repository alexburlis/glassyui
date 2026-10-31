/*
  The free templates. Each one installs as a single registry item and has its own page at
  /templates/<slug>. A template marked soon appears in the gallery without a link until its page
  ships. Pro templates are advertised from pro-teaser.ts and sold on the Pro site.
*/

export type FreeTemplateSlug = 'halcyon' | 'fieldnotes' | 'still';

export interface FreeTemplate {
  /** The line under the name on a gallery card. */
  kind: string;
  name: string;
  slug: FreeTemplateSlug;
  status: 'available' | 'soon';
  /** One sentence: what a founder gets from it. */
  summary: string;
}

export const FREE_TEMPLATES: readonly FreeTemplate[] = [
  {
    kind: 'Waitlist page',
    name: 'Halcyon',
    slug: 'halcyon',
    status: 'available',
    summary: 'A waitlist page with a launch countdown, a live signup count and a referral link.',
  },
  {
    kind: 'Founder letter',
    name: 'Fieldnotes',
    slug: 'fieldnotes',
    status: 'soon',
    summary:
      'A long-form letter about why you built it, with pull quotes, margin notes and pricing.',
  },
  {
    kind: 'Landing page for a meditation app',
    name: 'Still',
    slug: 'still',
    status: 'soon',
    summary: 'A calm landing page for an app, with a breathing guide and store links.',
  },
];

export function freeTemplatePath(slug: FreeTemplateSlug) {
  return `/templates/${slug}`;
}
