import Image from 'next/image';
import { CardBackdrop } from '@/components/site/card-backdrop';
import type { ProCard } from '@/lib/template-gallery';

/** A template's poster in a glass browser window. */
export function TemplateWindow({
  alt,
  className = 'template-window',
  sizes,
  src,
}: {
  alt: string;
  className?: string;
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
      <div className="template-card-poster">
        <Image alt={alt} height={800} sizes={sizes} src={src} width={1280} />
      </div>
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
  sizes,
  tag,
  tier,
}: {
  /** The card's place in the gallery, which picks its form and material. */
  backdrop: number;
  card: Pick<ProCard, 'kind' | 'name' | 'poster'>;
  sizes: string;
  /** When the template arrives, for one that is not out yet and has a date. */
  tag?: string;
  tier: 'free' | 'pro';
}) {
  return (
    <>
      <div className="template-card-stage">
        <CardBackdrop index={backdrop} />
        <TemplateWindow
          alt={tier === 'pro' ? `${card.name} design preview` : `${card.name} template`}
          sizes={sizes}
          src={card.poster}
        />
      </div>
      <div className="template-card-meta">
        <div className="template-card-heading">
          <h4 className="template-card-title">{card.name}</h4>
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
