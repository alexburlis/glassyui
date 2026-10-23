import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import { BlogComponentsCta, BlogTldr, BlogTocDisclosure } from '@/components/blog/article-aids';
import { BlogAuthorCard, BlogByline } from '@/components/blog/author';
import { blogMdxComponents } from '@/components/blog/mdx-components';
import { DocsShell } from '@/components/docs/docs-shell';
import { JsonLd } from '@/components/site/json-ld';
import { blogPostShareCard, getBlogPost, getBlogSlugs } from '@/lib/blog';
import { remarkHeadingIds, type BlogHeading } from '@/lib/blog-headings';
import { shareMetadata } from '@/lib/share';
import { SITE_URL } from '@/lib/site-links';

type BlogPageProps = { params: Promise<{ slug: string }> };

/** Ids the page sets itself, which no heading may take. */
const PAGE_IDS = ['author', 'author-title', 'main-content', 'tldr-title'];

const CTA_LABEL = 'Glassy UI components';

export const revalidate = 900;

export async function generateStaticParams() {
  return (await getBlogSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const source = await getBlogPost(slug);

  if (!source) notFound();

  const post = source.metadata;
  const url = `/blog/${post.slug}`;

  const shared = shareMetadata({
    card: blogPostShareCard(post),
    title: post.title,
    description: post.description,
    type: 'article',
    url,
  });

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.extra.author.name }],
    alternates: { canonical: url, types: { 'application/rss+xml': '/blog/rss' } },
    ...shared,
    openGraph: {
      ...shared.openGraph,
      type: 'article',
      publishedTime: post.publishedAtDate.toISOString(),
      modifiedTime: (post.updatedAtDate ?? post.publishedAtDate).toISOString(),
      authors: [post.extra.author.name],
    },
    ...(post.noindex ? { robots: { index: false, follow: true } } : null),
  };
}

export default async function BlogPostPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const source = await getBlogPost(slug);

  if (!source) notFound();

  const post = source.metadata;
  const { author, tldr } = post.extra;
  const url = `${SITE_URL}/blog/${post.slug}`;
  const toc: BlogHeading[] = [];

  const { content } = await compileMDX({
    source: source.body,
    components: blogMdxComponents,
    options: {
      mdxOptions: { remarkPlugins: [remarkGfm, remarkHeadingIds(toc, PAGE_IDS)] },
    },
  });

  // The table of contents and the card share the right column, so every article lists sections.
  if (!toc.length) {
    throw new Error(`Blog post "${post.slug}" needs at least one ## section heading.`);
  }

  return (
    <DocsShell
      current={`/blog/${post.slug}`}
      rail={{ content: <BlogComponentsCta />, label: CTA_LABEL }}
      toc={toc}
      tocTitle="Table of contents"
    >
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          url,
          mainEntityOfPage: url,
          image: new URL(blogPostShareCard(post).image, SITE_URL).href,
          inLanguage: 'en',
          datePublished: post.publishedAtDate.toISOString(),
          dateModified: (post.updatedAtDate ?? post.publishedAtDate).toISOString(),
          author: {
            '@type': 'Person',
            name: author.name,
            jobTitle: author.role,
            image: new URL(author.avatar, SITE_URL).href,
            sameAs: [...author.sameAs],
          },
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', item: SITE_URL, name: 'Glassy UI', position: 1 },
            { '@type': 'ListItem', item: `${SITE_URL}/blog`, name: 'Blog', position: 2 },
            { '@type': 'ListItem', item: url, name: post.title, position: 3 },
          ],
        }}
      />
      <article className="blog-article">
        <header className="docs-page-header">
          <nav aria-label="Breadcrumb" className="docs-eyebrow blog-breadcrumbs">
            <ol role="list">
              <li>
                <Link href="/">Glassy UI</Link>
              </li>
              <li>
                <span aria-hidden>/</span>
                <Link href="/blog">Blog</Link>
              </li>
            </ol>
          </nav>
          <h1>{post.title}</h1>
          <BlogByline post={post} />
        </header>
        <BlogTocDisclosure items={toc} />
        {tldr.length ? <BlogTldr items={tldr} /> : null}
        <div className="blog-prose">{content}</div>
        <BlogAuthorCard author={author} />
        <aside aria-label={CTA_LABEL} className="blog-cta-inline">
          <BlogComponentsCta />
        </aside>
        <p className="blog-feed-link">
          <Link href="/blog">
            More from the blog<span aria-hidden> ›</span>
          </Link>
        </p>
      </article>
    </DocsShell>
  );
}
