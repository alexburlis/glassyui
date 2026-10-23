# Writing the Glassy UI blog

The blog uses the internal `mdx-blog-kit` package shared with Paraspeech,
GamesLike and Codewert. Its canonical source is the internal `mdx-blog-kit`
repository. Glassy UI installs the same vendored 0.1.2 artifact and
compatibility patch as Paraspeech. Keep package fixes in the shared package; do
not fork its loader or visibility rules in this site.

The package owns frontmatter, file loading, draft and date visibility, RSS,
sitemap entries and publication proof. The site owns MDX rendering, content,
components, styling and routes. Reuse the package in another landing page with a
site adapter and its own design; it has no React or Next.js dependency.

## Create a post

Add `content/blog/<slug>.mdx` with a lowercase, hyphenated slug:

```mdx
---
title: 'A clear answer to a developer question'
description: 'The decision this article helps the reader make.'
excerpt: 'A short introduction for the article index.'
publishedAt: '2026-10-19T09:00:00+02:00'
status: draft
tags:
  - React
heroImage: '/share/blog/<slug>.jpg'
heroImageAlt: 'Describe the actual product capture.'
tldr:
  - 'One complete sentence that restates the body.'
  - 'Another, with no claim the body does not make.'
---

Give the direct answer first. Use normal Markdown, fenced code and useful links.
The page supplies the H1, so start body sections at H2.
```

MDX is trusted repository content compiled on the server, never visitor input.
Code fences use the site's copyable code block; GFM tables scroll on narrow
screens. Article code must match the current registry and its install closure.
Use `<BlogGlassDemo variant="scene" />`, `variant="expo"` or `variant="android"`
for a live example near the opening answer. These are React browser demos;
native articles must distinguish the preview from the native code and material.
Keep demo components in `src/components/blog` and their styling scoped to the
demo. Index and social cards use the hero image; articles lead with live
content. Drafts stay hidden from public routes even in development. Changing
`status` to `published` makes a post eligible only after `publishedAt`; lists,
RSS, sitemap and article routes use the package's visible-post helpers. Pages
revalidate every 15 minutes. This mechanism needs no daily writer or deployment
automation. Publishing the site still requires explicit authority.

## Article page

Every article follows the same layout, top to bottom:

1. Breadcrumbs, Glassy UI / Blog, and the H1.
2. The byline: "Written by" Alex Burlis, the role "Founder of Glassy UI", the
   post's `description` and the cut-out portrait resting on a hairline, then
   "Published" and, when `updatedAt` falls on a later day than `publishedAt`,
   "Updated". The visible days are the structured data's days.
3. From 1280 px wide, where the article keeps its full measure beside it, the
   right column holds the table of contents, titled "Table of contents", with
   the components card under it; both stay in view. Narrower, the table of
   contents is one closed card above the TL;DR and the components card appears
   once after the author card.
4. The TL;DR box, then the body, then "About the author".

The table of contents lists the body's H2 headings, so every article needs at
least one H2; the build fails without one. Every H2 and H3 gets an id from its
text, including inline code, and ids never repeat. An id that would start with a
digit starts with `section-` instead. The components card is a neutral tile with
a capture of the desk's control centre in the page's theme and the blue Browse
components button; the Pro card stays the site's one Vermilion card. The page
carries `BlogPosting` structured data with Alex Burlis as a `Person` author and
a `BreadcrumbList` matching the visible breadcrumbs. Glassy UI defines no
`Organization`, so the posting names no publisher.

`src/lib/blog.ts` checks these optional fields; an invalid value fails the build
rather than hiding quietly:

- `author`: an id from `src/lib/authors.ts`. It defaults to `alex-burlis`, the
  only author. Add a person there before naming them.
- `tldr`: 2 to 4 complete sentences, each plain text (no Markdown) of at most
  220 characters. They restate the body: no new claims, numbers, first-person
  experience or anecdotes. A post without `tldr` shows no box.
- `testing`: see below.

Adding `tldr` or `author` presents unchanged content, so it never changes
`updatedAt`.

### Testing and reviewers

A "Personally tested" badge, and a test summary in place of the description,
appear only when the post records Alex's own hands-on test:

```yaml
testing:
  testedOn: '2026-10-18'
  summary: 'What Alex did and saw, in at most 280 characters.'
  environment: 'Device, OS, browser and package versions.'
  evidence: docs/testing-evidence/<slug>.md
```

All four fields are required. `testedOn` is a quoted `YYYY-MM-DD` date, because
YAML quietly turns an unquoted impossible date such as 2026-02-30 into another
day; it cannot be after today in the earliest time zone, so a test logged just
after midnight in Europe passes. `evidence` must be
`docs/testing-evidence/<slug>.md`, Alex's own notes as that folder's `README.md`
describes. `pnpm smoke:blog` fails when a badge shows without that file or with
an empty one. Writers and agents never add or infer `testing`, never write
first-person experience and never claim Alex tested anything; when a test would
help, the run notes say "testing: needs Alex". Repository checks such as smoke
or visual suites are not a personal test.

Articles name no reviewer. There is no "Reviewed by" line and no `reviewedBy`
structured data; automated review passes are quality checks, not a reviewer.

## Editorial checks

The Paraspeech and GamesLike workflows inform these rules, without importing
those projects' weekly quotas, research budgets or publication authority:

- Give each article a distinct reader, question and answer promise. Existing
  installation guides remain the owners of complete setup instructions.
- Answer early, then teach concrete decisions with current source-backed code.
- Keep compatibility limits beside the relevant claim. Distinguish native system
  glass, blur and web refraction. Do not claim measured performance without a
  matching measurement.
- Earn every section. There is no required length, keyword count, FAQ or table.
- Edit generic prose and check the actual article at desktop and phone widths.
- Use meaningful product captures instead of decorative illustrations.

## Verify locally

Run `pnpm dev`, then give each new post a card in
`src/app/share-studio/[...card]/page.tsx`. Capture missing cards:

```sh
node scripts/capture-share-cards.mjs http://127.0.0.1:3000 --missing
```

The index and every article require their own 1200 by 630 product card. The
development-only studio and capture script include drafts and future posts so
their artwork is ready before publication. Inspect those images, format changed
files, run lint and build, then run the blog smoke against the local server:

```sh
pnpm smoke:blog http://127.0.0.1:3000 /absolute/evidence-directory
```

At 1440 and 390 px wide, the smoke also checks the byline, the TL;DR, exactly
one table of contents and one components card, and that the `Person` author,
dates and breadcrumbs in the structured data match the page.

After an explicitly authorized deployment, `pnpm blogkit:prove --slug <slug>`
checks article, index, RSS and sitemap on the live domain. It does not submit
IndexNow. No blog posting automation is configured by this integration.
