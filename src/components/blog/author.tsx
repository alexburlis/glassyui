import Image from 'next/image';
import { GlassBadge } from '@/components/liquid';
import type { Author } from '@/lib/authors';
import { formatBlogDate, type BlogPost } from '@/lib/blog';

/** Twelve soft points around a circle: the seal the check sits in. */
const SEAL_POINTS = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2;
  const radius = index % 2 ? 6.4 : 7.4;

  return `${(8 + radius * Math.cos(angle)).toFixed(2)},${(8 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(' ');

function SealCheck() {
  return (
    <svg aria-hidden="true" className="blog-tested-icon" fill="none" viewBox="0 0 16 16">
      <polygon
        points={SEAL_POINTS}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <path
        d="m5.3 8.2 1.9 1.9 3.6-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/**
 * Who wrote the article, under its title. The badge and the test summary appear only when the post
 * records Alex's own hands-on test; otherwise the summary slot holds the post's description.
 */
export function BlogByline({ post }: { post: BlogPost }) {
  const { author, testing } = post.extra;
  const published = post.publishedAtDate;

  // The same days as the structured data: an update shows only when it falls on a later day, so a
  // same-day edit doesn't repeat the publish date.
  const updated =
    post.updatedAtDate && formatBlogDate(post.updatedAtDate) !== formatBlogDate(published)
      ? post.updatedAtDate
      : undefined;

  return (
    <div className="blog-byline">
      <div className="blog-byline-person">
        <div className="blog-byline-text">
          <p className="blog-byline-label">Written by</p>
          <p className="blog-byline-name">
            <a href="#author">{author.name}</a>
            {testing ? (
              <GlassBadge className="blog-tested-badge" data-blog-tested="" tone="green">
                <SealCheck />
                Personally tested
              </GlassBadge>
            ) : null}
          </p>
          <p className="blog-byline-role">{author.role}</p>
          <p className="blog-byline-summary">{testing ? testing.summary : post.description}</p>
        </div>
        <Image
          alt={author.name}
          className="blog-byline-portrait"
          height={800}
          sizes="(max-width: 560px) 96px, 120px"
          src={author.portrait}
          width={640}
        />
      </div>
      <p className="blog-byline-dates">
        <span>
          Published <time dateTime={published.toISOString()}>{formatBlogDate(published)}</time>
        </span>
        {updated ? (
          <span>
            Updated <time dateTime={updated.toISOString()}>{formatBlogDate(updated)}</time>
          </span>
        ) : null}
      </p>
    </div>
  );
}

const PROFILE_SITES = new Map([
  ['github.com', 'GitHub'],
  ['x.com', 'X'],
]);

function profileLabel(url: string) {
  const { hostname, pathname } = new URL(url);
  const site = PROFILE_SITES.get(hostname);

  if (!site) throw new Error(`No profile name for ${url}. Add its site to PROFILE_SITES.`);

  return `${pathname.slice(1)} on ${site}`;
}

/** The end of the article: who wrote it, with links to the author's verified profiles. */
export function BlogAuthorCard({ author }: { author: Author }) {
  return (
    <section aria-labelledby="author-title" className="blog-author" id="author">
      <h2 id="author-title">About the author</h2>
      <div className="blog-author-person">
        <Image
          alt=""
          className="blog-author-avatar"
          height={512}
          sizes="56px"
          src={author.avatar}
          width={512}
        />
        <div>
          <p className="blog-author-name">{author.name}</p>
          <p className="blog-author-role">{author.role}</p>
        </div>
      </div>
      <p className="blog-author-bio">{author.bio}</p>
      <ul className="blog-author-links" role="list">
        {author.sameAs.map((url) => (
          <li key={url}>
            <a href={url}>{profileLabel(url)}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
