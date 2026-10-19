import path from 'node:path';
import { assertPublishable, createMdxBlog, type MdxBlogPost } from 'mdx-blog-kit';
import { shareCard } from '@/lib/share';
import { SITE_URL } from '@/lib/site-links';

export type BlogPost = Omit<MdxBlogPost, 'body'>;

const blog = createMdxBlog({
  contentDir: path.join(process.cwd(), 'content/blog'),
  baseUrl: SITE_URL,
  routeBase: '/blog',
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
