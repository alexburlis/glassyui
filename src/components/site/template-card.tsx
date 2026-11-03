import Image from 'next/image';
import type { ReactNode } from 'react';
import type { ProCard } from '@/lib/template-gallery';

export function TemplateCardBody({
  action,
  card,
  chip,
  sizes,
  tier,
}: {
  action: ReactNode;
  card: Pick<ProCard, 'kind' | 'name' | 'poster'>;
  chip: string;
  sizes: string;
  tier: 'free' | 'pro';
}) {
  return (
    <>
      <div className="template-card-poster">
        <Image
          alt={tier === 'pro' ? `${card.name} design preview` : `${card.name} template`}
          height={800}
          sizes={sizes}
          src={card.poster}
          width={1280}
        />
        <span className="template-chip" data-tier={tier}>
          {chip}
        </span>
      </div>
      <div className="template-card-meta">
        <h4 className="template-card-title">{card.name}</h4>
        <span className="template-card-text">{card.kind}</span>
        <span className="template-card-action">{action}</span>
      </div>
    </>
  );
}
