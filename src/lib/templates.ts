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
  /** The registry item that installs it. Its registry dependencies are the components it uses. */
  registryItem?: string;
  /** The appearance it is drawn for. Its preview pins it over the visitor's site theme. */
  theme?: 'light' | 'dark';
}

export const FREE_TEMPLATES: readonly FreeTemplate[] = [
  {
    kind: 'Waitlist page',
    name: 'Halcyon',
    slug: 'halcyon',
    status: 'available',
    summary: 'A waitlist page with a launch countdown, a live signup count and a referral link.',
    registryItem: 'template-halcyon',
    theme: 'dark',
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

/** A template whose page has shipped, with what its page needs; undefined for any other slug. */
export function getAvailableTemplate(slug: string) {
  const template = FREE_TEMPLATES.find(
    (candidate) => candidate.slug === slug && candidate.status === 'available',
  );

  if (!template) return undefined;

  if (!template.registryItem || !template.theme) {
    throw new Error(`The ${template.name} template needs its registry item and theme.`);
  }

  return { ...template, registryItem: template.registryItem, theme: template.theme };
}

/** A template's bare preview, which its page frames: /templates/<slug>/preview. */
export function isTemplatePreviewPath(pathname: string) {
  return /^\/templates\/[^/]+\/preview\/?$/.test(pathname);
}
