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

After an explicitly authorized deployment, `pnpm blogkit:prove --slug <slug>`
checks article, index, RSS and sitemap on the live domain. It does not submit
IndexNow. No blog posting automation is configured by this integration.
