import type { Metadata } from 'next';
import { shareCard, shareMetadata } from '@/lib/share';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';
import { guides } from '@/components/docs/guide-data';

const description =
  'Practical guides to installing, customizing and shipping Glassy UI components for React.';

export const metadata: Metadata = {
  title: 'React guides',
  description,
  alternates: { canonical: '/guides' },
  ...shareMetadata({
    card: shareCard(
      'guides',
      'A glass lens magnifying the words "A closer look at the details", beside the words: Guides. React and Expo.',
    ),
    title: 'Glassy UI React guides',
    description,
    url: '/guides',
  }),
};

export default function GuidesPage() {
  return (
    <DocsShell current="/guides">
      <header className="docs-page-header">
        <p className="docs-eyebrow">Guides</p>
        <h1>From a glass demo to your own app.</h1>
        <p>Install a component, build a mockup, and keep the result usable.</p>
      </header>
      {guides.map((guide) => (
        <section className="docs-section" key={guide.slug}>
          <h2>
            <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
          </h2>
          <p>{guide.description}</p>
        </section>
      ))}
    </DocsShell>
  );
}
