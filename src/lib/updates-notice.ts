// The consent notice for Glassy UI updates by email. The footer form shows this text beside its
// Subscribe button, and the backend records the same text and version with each request, so the
// words someone agreed to are the words on the page. Give changed wording a new version.

export const UPDATES_NOTICE_VERSION = '2026-10-20-v1';

export const UPDATES_NOTICE_TEXT =
  'Email me about new Glassy UI components and tutorials, and about Glassy UI Pro launches, templates and offers.';

export const UPDATES_LABELS = {
  heading: 'Glassy UI updates',
  email: 'Email address',
  submit: 'Subscribe',
  submitting: 'Subscribing…',
  privacy: 'Privacy',
  success: 'Check your inbox to confirm.',
  change: 'Use another address',
  invalid: 'Enter a valid email address.',
  rateLimited: 'Too many attempts. Try again later.',
  failed: 'Something went wrong. Try again later.',
} as const;
