import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import { blogMdxComponents } from '@/components/blog/mdx-components';
import { DocsShell } from '@/components/docs/docs-shell';
import { blogPostShareCard, formatBlogDate, getBlogPost, getBlogSlugs } from '@/lib/blog';
import { shareMetadata } from '@/lib/share';

type BlogPageProps = { params: Promise<{ slug: string }> };

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
    authors: [{ name: 'Glassy UI' }],
    alternates: { canonical: url, types: { 'application/rss+xml': '/blog/rss' } },
    ...shared,
    openGraph: {
      ...shared.openGraph,
      type: 'article',
      publishedTime: post.publishedAtDate.toISOString(),
      modifiedTime: (post.updatedAtDate ?? post.publishedAtDate).toISOString(),
      authors: ['Glassy UI'],
    },
    ...(post.noindex ? { robots: { index: false, follow: true } } : null),
  };
}

export default async function BlogPostPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const source = await getBlogPost(slug);

  if (!source) notFound();

  const post = source.metadata;

  const { content } = await compileMDX({
    source: source.body,
    components: blogMdxComponents,
    options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
  });

  return (
    <DocsShell current={`/blog/${post.slug}`}>
      <article className="blog-article">
        <header className="docs-page-header">
          <p className="docs-eyebrow">
            <Link href="/blog">Blog</Link>
          </p>
          <h1>{post.title}</h1>
          <p>{post.description}</p>
          <div className="blog-post-meta">
            <span>Glassy UI</span>
            <span aria-hidden>·</span>
            <time dateTime={post.publishedAtDate.toISOString()}>
              {formatBlogDate(post.publishedAtDate)}
            </time>
          </div>
        </header>
        <Image
          className="blog-article-image"
          src={blogPostShareCard(post).image}
          alt={post.heroImageAlt!}
          width={1200}
          height={630}
          sizes="(min-width: 1200px) 800px, (min-width: 768px) 65vw, 100vw"
          priority
        />
        <div className="blog-prose">{content}</div>
        <p className="blog-feed-link">
          <Link href="/blog">
            More from the blog<span aria-hidden> ›</span>
          </Link>
        </p>
      </article>
    </DocsShell>
  );
}
