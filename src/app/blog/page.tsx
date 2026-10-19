import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';
import { blogPostShareCard, formatBlogDate, getBlogPosts } from '@/lib/blog';
import { shareCard, shareMetadata } from '@/lib/share';

const description = 'Practical guides to liquid glass on the web, iOS and Android.';

export const revalidate = 900;

export function generateMetadata(): Metadata {
  return {
    title: 'Liquid glass guides and examples',
    description,
    alternates: { canonical: '/blog', types: { 'application/rss+xml': '/blog/rss' } },
    ...shareMetadata({
      card: shareCard(
        'blog',
        'Glass controls over ribbon artwork, beside the words: Build with glass.',
      ),
      title: 'Liquid glass guides and examples',
      description,
      url: '/blog',
    }),
  };
}

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <DocsShell current="/blog">
      <header className="docs-page-header">
        <p className="docs-eyebrow">Blog</p>
        <h1>Build with glass.</h1>
        <p>{description}</p>
      </header>
      <div className="blog-post-list">
        {posts.map((post) => (
          <article className="blog-post-card" key={post.slug}>
            <Link className="blog-post-image" href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden>
              <Image
                src={blogPostShareCard(post).image}
                alt=""
                width={1200}
                height={630}
                sizes="(min-width: 1200px) 340px, (min-width: 768px) 45vw, 100vw"
              />
            </Link>
            <div className="blog-post-summary">
              <p className="blog-post-meta">
                <time dateTime={post.publishedAtDate.toISOString()}>
                  {formatBlogDate(post.publishedAtDate)}
                </time>
              </p>
              <h2>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>
              <p>{post.excerpt}</p>
              <Link className="blog-post-read" href={`/blog/${post.slug}`}>
                Read article<span aria-hidden> ›</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="blog-feed-link">
        <Link href="/blog/rss" prefetch={false}>
          Follow the RSS feed<span aria-hidden> ›</span>
        </Link>
      </p>
    </DocsShell>
  );
}
