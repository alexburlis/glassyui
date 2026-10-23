import path from 'node:path';
import { assertPublishable, createMdxBlog, type MdxBlogPost } from 'mdx-blog-kit';
import { DEFAULT_AUTHOR_ID, getAuthor, type Author } from '@/lib/authors';
import { shareCard } from '@/lib/share';
import { SITE_URL } from '@/lib/site-links';

/**
 * Alex's own hands-on test of what the article describes. Only Alex supplies it, from notes kept
 * in docs/testing-evidence/<slug>.md; writers never add or infer it.
 */
type BlogTesting = {
  /** The day of the test, never after today. */
  testedOn: Date;
  /** One or two sentences shown in the byline. */
  summary: string;
  environment: string;
  /** docs/testing-evidence/<slug>.md, which smoke:blog requires for a post that shows the badge. */
  evidence: string;
};

type BlogExtra = {
  author: Author;
  /** Two to four sentences restating the article; empty when the post has none. */
  tldr: string[];
  testing?: BlogTesting;
};

export type BlogPost = Omit<MdxBlogPost<BlogExtra>, 'body'>;

/** A value YAML can produce. Frontmatter is authored by hand, so any field may hold any of them. */
type YamlValue = string | number | boolean | Date | null | undefined | YamlValue[] | YamlRecord;

type YamlRecord = { [key: string]: YamlValue };

const TLDR_MAX = 220;

const TESTING_SUMMARY_MAX = 280;

const TESTING_FIELDS = new Set(['testedOn', 'summary', 'environment', 'evidence']);

/** Text with its line breaks folded into single spaces, or undefined for anything that is not text. */
function readText(value: YamlValue) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Decode hand-written YAML at the content boundary.
  if (typeof value !== 'string') return undefined;

  return value.replace(/\s+/g, ' ').trim() || undefined;
}

function isYamlRecord(value: YamlValue): value is YamlRecord {
  return value !== null && value !== undefined && Object.getPrototypeOf(value) === Object.prototype;
}

function readTldr(value: YamlValue, slug: string) {
  if (value === undefined) return [];

  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    throw new Error(`Blog post "${slug}": tldr must list 2 to 4 sentences.`);
  }

  return value.map((item, index) => {
    const text = readText(item);
    const label = `Blog post "${slug}": tldr item ${index + 1}`;

    if (!text) throw new Error(`${label} must be text.`);

    if (text.length > TLDR_MAX) throw new Error(`${label} is over ${TLDR_MAX} characters.`);

    // The box renders plain text, so Markdown would show literally.
    if (/[`*<>]|\]\(/.test(text)) throw new Error(`${label} must be plain text, not Markdown.`);

    if (!/[.!?]$/.test(text)) throw new Error(`${label} must be a complete sentence.`);

    return text;
  });
}

/** Fourteen hours ahead of UTC, the first time zone to reach a new day. */
const EARLIEST_ZONE_OFFSET = 14 * 60 * 60 * 1000;

function readTestedOn(value: YamlValue, slug: string) {
  // YAML turns an unquoted date into a Date, rolling an impossible day such as 2026-02-30 into the
  // next month and a timestamp into UTC, so only the quoted text can be checked.
  if (value instanceof Date) {
    throw new Error(`Blog post "${slug}": quote testing.testedOn, as in testedOn: '2026-10-18'.`);
  }

  const text = readText(value);

  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`Blog post "${slug}": testing.testedOn must be a date such as '2026-10-18'.`);
  }

  const date = new Date(`${text}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`Blog post "${slug}": testing.testedOn "${text}" is not a real date.`);
  }

  // Today wherever the day has begun, so a test logged just after midnight in Europe is not early.
  if (text > new Date(Date.now() + EARLIEST_ZONE_OFFSET).toISOString().slice(0, 10)) {
    throw new Error(`Blog post "${slug}": testing.testedOn "${text}" is in the future.`);
  }

  return date;
}

/** An incomplete or unknown testing record fails the build; it never quietly hides the badge. */
function readTesting(value: YamlValue, slug: string, author: Author): BlogTesting | undefined {
  if (value === undefined) return undefined;

  if (!isYamlRecord(value)) throw new Error(`Blog post "${slug}": testing must be an object.`);
  const unknownFields = Object.keys(value).filter((key) => !TESTING_FIELDS.has(key));

  if (unknownFields.length) {
    throw new Error(`Blog post "${slug}": unknown testing field ${unknownFields.join(', ')}.`);
  }

  // The badge says the author tested it, and Alex is the only person who tests.
  if (author.id !== DEFAULT_AUTHOR_ID) {
    throw new Error(`Blog post "${slug}": only Alex Burlis's own posts can carry testing.`);
  }

  const required = (field: 'summary' | 'environment' | 'evidence') => {
    const text = readText(value[field]);

    if (!text) throw new Error(`Blog post "${slug}": testing.${field} is required.`);

    return text;
  };

  const summary = required('summary');

  if (summary.length > TESTING_SUMMARY_MAX) {
    throw new Error(
      `Blog post "${slug}": testing.summary is over ${TESTING_SUMMARY_MAX} characters.`,
    );
  }

  const evidence = required('evidence');

  if (evidence !== `docs/testing-evidence/${slug}.md`) {
    throw new Error(
      `Blog post "${slug}": testing.evidence must be docs/testing-evidence/${slug}.md.`,
    );
  }

  return {
    testedOn: readTestedOn(value.testedOn, slug),
    summary,
    environment: required('environment'),
    evidence,
  };
}

const blog = createMdxBlog<MdxBlogPost<BlogExtra>>({
  contentDir: path.join(process.cwd(), 'content/blog'),
  baseUrl: SITE_URL,
  routeBase: '/blog',
  mapFrontmatter(raw, slug) {
    // SAFETY: the package parses frontmatter with js-yaml, whose values are all YamlValue; every
    // field read below is checked before use.
    const fields = raw as YamlRecord;
    const authorId = fields.author === undefined ? DEFAULT_AUTHOR_ID : readText(fields.author);

    if (!authorId) throw new Error(`Blog post "${slug}": author must be an author id.`);
    const author = getAuthor(authorId);

    return {
      extra: {
        author,
        tldr: readTldr(fields.tldr, slug),
        testing: readTesting(fields.testing, slug, author),
      },
    };
  },
  validatePost(post) {
    if (!isBlogSlug(post.slug)) {
      throw new Error(`Invalid blog slug: ${post.slug}`);
    }

    if (post.status !== 'published') return;
    assertPublishable(post);

    if (!post.excerpt) {
      throw new Error(`Published blog post "${post.slug}" is missing excerpt.`);
    }

    if (post.heroImage !== `/share/blog/${post.slug}.jpg`) {
      throw new Error(`Blog post "${post.slug}" must use its own link-preview card as heroImage.`);
    }
  },
});

function isBlogSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  return blog.getVisiblePosts();
}

export async function getBlogPost(slug: string) {
  if (!isBlogSlug(slug)) return undefined;

  return blog.getVisiblePostSourceBySlug(slug);
}

export async function getBlogPostForStudio(slug: string) {
  if (process.env.NODE_ENV !== 'development' || !isBlogSlug(slug)) return undefined;

  return blog.getPostSourceBySlug(slug, { includeDrafts: true });
}

export function getBlogSlugs() {
  return blog.getVisibleSlugs();
}

export function getBlogSitemapEntries() {
  return blog.getSitemapEntries();
}

export function renderBlogRss() {
  return blog.renderRss(new Date(), {
    title: 'Glassy UI blog',
    description: 'Practical guides to liquid glass on the web, iOS and Android.',
    language: 'en',
  });
}

export function blogPostShareCard(post: BlogPost) {
  return shareCard(`blog/${post.slug}`, post.heroImageAlt!);
}

export function formatBlogDate(date: Date) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
