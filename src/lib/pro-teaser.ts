/** Public advertising only. Keep the offer and the templates in sync with the private Pro site. */
export const PRO_OFFER = {
  earlyBirdCap: 100,
  earlyBirdOpen: true,
  earlyBirdPrice: 99,
  firstReleaseEstimate: 'November 2026',
  regularPrice: 199,
} as const;

export type ProTemplateTeaser =
  | { kind: string; name: string; release: string; slug: string; status: 'first-release' }
  | { kind: string; name: string; slug: string; status: 'planned' };

export const PRO_TEMPLATE_TEASERS: readonly ProTemplateTeaser[] = [
  {
    kind: 'Launch template · product site',
    name: 'Northstar',
    release: 'Launch',
    slug: 'northstar',
    status: 'first-release',
  },
  {
    kind: 'App template · landing page for a habit app',
    name: 'Tempo',
    release: 'App',
    slug: 'tempo',
    status: 'first-release',
  },
  { kind: 'Landing page for a developer API', name: 'Relay', slug: 'relay', status: 'planned' },
  { kind: 'Landing page for AI writing', name: 'Quill', slug: 'quill', status: 'planned' },
  { kind: 'Landing page for a budget app', name: 'Penny', slug: 'penny', status: 'planned' },
  { kind: 'Landing page for a team workspace', name: 'Orbit', slug: 'orbit', status: 'planned' },
  {
    kind: 'Landing page for uptime monitoring',
    name: 'Beacon',
    slug: 'beacon',
    status: 'planned',
  },
  { kind: 'Landing page for invoicing', name: 'Tally', slug: 'tally', status: 'planned' },
  {
    kind: 'Landing page for a creator platform',
    name: 'Cohort',
    slug: 'cohort',
    status: 'planned',
  },
  { kind: 'Landing page for a Mac app', name: 'Hush', slug: 'hush', status: 'planned' },
];
