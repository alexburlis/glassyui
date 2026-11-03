/** Where the site lives and where its source does. Change either here and every link follows. */
export const SITE_URL = 'https://glassyui.com';

export const PRO_ORIGIN = 'https://pro.glassyui.com';

/**
 * Pro's Stripe Payment Link with the early-bird code filled in: the link behind the Pro site's own
 * pre-order button (`PRO_CHECKOUT_URL` in the private app's `src/lib/pro.ts`). Once the code has
 * been used 100 times, the same link charges the regular price.
 */
export const PRO_CHECKOUT_URL =
  'https://buy.stripe.com/3cI3co4IY9aU20qbBNcZa00?prefilled_promo_code=EARLYBIRD';

export const REPOSITORY = 'https://github.com/alexburlis/glassyui';

export const GITHUB = {
  changelog: `${REPOSITORY}/blob/main/CHANGELOG.md`,
  contributing: `${REPOSITORY}/blob/main/CONTRIBUTING.md`,
  issues: `${REPOSITORY}/issues`,
  license: `${REPOSITORY}/blob/main/LICENSE`,
  repository: REPOSITORY,
  security: `${REPOSITORY}/blob/main/SECURITY.md`,
} as const;

/** A file in the repository, on the main branch. */
export function sourceUrl(path: string) {
  return `${REPOSITORY}/blob/main/${path}`;
}

/** The new-issue form for one of the repository's templates, with the title filled in when given. */
export function newIssueUrl(template: 'bug_report' | 'component_request', title?: string) {
  const params = new URLSearchParams({ template: `${template}.yml` });

  if (title) params.set('title', title);

  return `${REPOSITORY}/issues/new?${params.toString()}`;
}
