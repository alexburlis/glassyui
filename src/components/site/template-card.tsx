import Image, { getImageProps } from 'next/image';
import type { CSSProperties } from 'react';
import { CardBackdrop } from '@/components/site/card-backdrop';
import type { ProCard, TemplatePage } from '@/lib/template-gallery';

type PageStyle = CSSProperties & Record<'--page-screens', string>;

// A window shows 16:10 of the page at a time, as the poster does.
const SCREEN = 10 / 16;

/**
 * A template's whole page in its window: the top shows as the poster would, and the stylesheet
 * scrolls down the rest under a mouse or pen. A touch screen has no hover to scroll it, so it
 * loads the poster rather than the long photograph.
 */
function PagePoster({
  alt,
  page,
  poster,
  sizes,
}: {
  alt: string;
  page: TemplatePage;
  poster: string;
  sizes: string;
}) {
  const { props: whole } = getImageProps({
    alt,
    height: page.height,
    sizes,
    src: page.src,
    width: page.width,
  });

  const { props: still } = getImageProps({ alt, height: 800, sizes, src: poster, width: 1280 });

  // How many screens the page runs on past the first, which sets how long it takes to scroll.
  const style: PageStyle = {
    '--page-screens': (page.height / (page.width * SCREEN) - 1).toFixed(2),
  };

  return (
    <div className="template-card-poster" data-page style={style}>
      <picture>
        <source
          height={whole.height}
          media="(hover: hover)"
          sizes={whole.sizes}
          srcSet={whole.srcSet}
          width={whole.width}
        />
        {/* next/image's own props, in a picture so that a touch screen takes the poster. */}
        <img {...still} alt={alt} />
      </picture>
    </div>
  );
}

/** A template's poster in a glass browser window, or its whole page when it has one. */
export function TemplateWindow({
  alt,
  className = 'template-window',
  page,
  sizes,
  src,
}: {
  alt: string;
  className?: string;
  page?: TemplatePage;
  sizes: string;
  src: string;
}) {
  return (
    <div className={className}>
      <span aria-hidden className="template-window-bar">
        <i />
        <i />
        <i />
      </span>
      {page ? (
        <PagePoster alt={alt} page={page} poster={src} sizes={sizes} />
      ) : (
        <div className="template-card-poster">
          <Image alt={alt} height={800} sizes={sizes} src={src} width={1280} />
        </div>
      )}
    </div>
  );
}

/**
 * A template card's stage and caption: the template rises in a glass window out of the stage's
 * lower edge, in front of one of the component cards' sculpted forms.
 */
export function TemplateCardBody({
  backdrop,
  card,
  level,
  sizes,
  tag,
  tier,
}: {
  /** The card's place in the gallery, which picks its form and material. */
  backdrop: number;
  card: Pick<ProCard, 'kind' | 'name' | 'page' | 'poster'>;
  /** The heading level of the card's name, one below its group's. */
  level: 3 | 4;
  sizes: string;
  /** When the template arrives, for one that is not out yet and has a date. */
  tag?: string;
  tier: 'free' | 'pro';
}) {
  const Title = level === 3 ? 'h3' : 'h4';

  return (
    <>
      <div className="template-card-stage">
        <CardBackdrop index={backdrop} />
        <TemplateWindow
          alt={tier === 'pro' ? `${card.name} design preview` : `${card.name} template`}
          page={card.page}
          sizes={sizes}
          src={card.poster}
        />
      </div>
      <div className="template-card-meta">
        <div className="template-card-heading">
          <Title className="template-card-title">{card.name}</Title>
          {tag ? (
            <span className="template-tag" data-tier={tier}>
              {tag}
            </span>
          ) : null}
        </div>
        <p className="template-card-text">{card.kind}</p>
      </div>
    </>
  );
}
