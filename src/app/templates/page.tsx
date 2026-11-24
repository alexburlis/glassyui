import type { Metadata } from 'next';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { TemplateGallery } from '@/components/site/template-gallery';
import { shareCard, shareMetadata } from '@/lib/share';
import { FREE_CARDS, PRO_CARDS } from '@/lib/template-gallery';

const title = 'Glass landing page templates for React';

const description = `Landing pages built from Glassy UI's glass components: ${FREE_CARDS.length} free templates that install with one shadcn command, and ${PRO_CARDS.length} more coming to Glassy UI Pro.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/templates' },
  ...shareMetadata({
    card: shareCard(
      'templates',
      'The Halcyon template, live, beside the words: Templates. Whole pages.',
    ),
    title: 'Glassy UI templates',
    description,
    url: '/templates',
  }),
};

export default function TemplatesPage() {
  return (
    <>
      <SiteNav />
      <main className="home" id="main-content">
        <section aria-labelledby="templates-title" className="home-hero">
          <h1 className="home-title" id="templates-title">
            Start from a whole page.
          </h1>
          <p className="home-lead">
            Landing page templates built from Glassy UI components. Free ones install in one
            command. Pre&#8209;order Pro to get new ones first.
          </p>
        </section>
        <div className="templates-gallery">
          <TemplateGallery level={2} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
