import Link from 'next/link';
import { ProTemplates } from '@/components/site/pro-templates';
import { TemplateCardBody } from '@/components/site/template-card';
import { TemplatePointer } from '@/components/site/template-pointer';
import { FREE_CARDS, type FreeCard } from '@/lib/template-gallery';

// From 640 to 1023 px the free cards sit two to a row, so the first of an odd number spans the
// row rather than leave the last one alone.
const firstSpans = FREE_CARDS.length % 2 === 1;

function FreeTemplateCard({
  card,
  index,
  level,
  wide,
}: {
  card: FreeCard;
  index: number;
  level: 3 | 4;
  wide: boolean;
}) {
  const sizes = `(min-width: 1024px) 340px, (min-width: 640px) ${wide ? '560px' : '45vw'}, 80vw`;

  if (card.status === 'soon') {
    return (
      <div className="template-card" data-status="soon" data-wide={wide || undefined}>
        <TemplateCardBody
          backdrop={index}
          card={card}
          level={level}
          sizes={sizes}
          tag="Coming soon"
          tier="free"
        />
      </div>
    );
  }

  // A template's page is a whole site, so it loads when chosen rather than whenever it scrolls by.
  return (
    <Link className="template-card" data-wide={wide || undefined} href={card.href} prefetch={false}>
      <TemplateCardBody backdrop={index} card={card} level={level} sizes={sizes} tier="free" />
    </Link>
  );
}

/**
 * Every template, free ones first. `level` is the heading level of the groups' titles: 3 under
 * the home page's section title, 2 on the templates page.
 */
export function TemplateGallery({ level = 3 }: { level?: 2 | 3 }) {
  const Title = level === 2 ? 'h2' : 'h3';
  const cardLevel = level === 2 ? 3 : 4;

  return (
    <TemplatePointer className="template-gallery">
      <div className="template-group">
        <header className="template-group-header">
          <Title className="template-group-title">Free templates</Title>
          <span className="template-group-count">{FREE_CARDS.length}</span>
        </header>
        <div className="template-grid">
          {FREE_CARDS.map((card, index) => (
            <FreeTemplateCard
              card={card}
              index={index}
              key={card.slug}
              level={cardLevel}
              wide={firstSpans && index === 0}
            />
          ))}
        </div>
      </div>
      <ProTemplates backdropOffset={FREE_CARDS.length} level={level} />
    </TemplatePointer>
  );
}
