import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { componentDocs, getComponentDoc } from '@/components/docs/component-docs-data';
import { getGuide, guides } from '@/components/docs/guide-data';
import { ShareCard, ShareStage, type ShareCardProps } from '@/components/share/share-studio';
import { getNativeUsage } from '@/lib/native-usage-source';
import { getBlogPostForStudio } from '@/lib/blog';
import '@/styles/share-studio.css';

export const metadata: Metadata = {
  title: 'Share studio',
  robots: { follow: false, index: false },
};

// The demo each guide's card shows: the component the guide is about, or the phone for Expo.
const GUIDE_STAGES: Record<(typeof guides)[number]['slug'], string> = {
  shadcn: 'glass-button',
  'shadcn-theme': 'glass-button',
  expo: 'phone',
  'laptop-mockup': 'glass-laptop',
  'glass-accessibility': 'glass-switch',
};

// How much each demo is magnified in its card. Most demos are a control or two in the middle of
// a wide stage, so they double; demos that fill the stage keep closer to their own size.
const STAGE_ZOOM = new Map([
  ['glass-accordion', 1.5],
  ['glass-alert', 1.45],
  ['glass-badge', 2.3],
  ['glass-command', 1.15],
  ['glass-dialog', 1.3],
  ['glass-dock', 2],
  ['glass-header', 1.6],
  ['glass-laptop', 1.05],
  ['glass-lens', 1.45],
  ['glass-menu', 1.5],
  ['glass-phone-duo', 1.15],
  ['glass-popover', 1.5],
  ['glass-scene', 1.35],
  ['glass-select', 1.5],
  ['glass-sheet', 1.15],
  ['glass-spinner', 2.8],
  ['glass-tabs', 1.6],
  ['glass-textarea', 1.5],
  ['glass-toast', 1.4],
  ['install', 1.15],
  ['phone', 1],
]);

const DEFAULT_ZOOM = 1.9;

const stage = (id: string) => ({ id, zoom: STAGE_ZOOM.get(id) ?? DEFAULT_ZOOM });

// The catalogue card's tiles: one control from each family, in the gallery's materials.
const MOSAIC = ['glass-button', 'glass-switch', 'glass-slider', 'glass-segmented-control'].map(
  (id) => ({ id, zoom: 1.3 }),
);

/** What a card says and shows, from its address: /share-studio/card/<kind>/<name>. */
async function cardFor(kind: string, name: string | undefined): Promise<ShareCardProps | null> {
  if (kind === 'blog') {
    return { eyebrow: 'Blog', title: 'Build with glass.', stage: stage('glass-scene') };
  }

  if (kind === 'post' && name) {
    const post = await getBlogPostForStudio(name);

    if (!post) return null;

    const cards = new Map<string, ShareCardProps>(
      Object.entries({
        'liquid-glass-android': {
          eyebrow: 'React Native',
          title: 'Liquid glass.',
          second: 'On Android.',
          stage: stage('glass-switch'),
        },
        'liquid-glass-react-native-expo': {
          eyebrow: 'React Native',
          title: 'System glass.',
          second: 'In Expo.',
          stage: stage('glass-segmented-control'),
        },
        'liquid-glass-css-react': {
          eyebrow: 'CSS and React',
          title: 'Liquid glass.',
          second: 'On the web.',
          stage: stage('glass-scene'),
        },
      }),
    );

    return (
      cards.get(name) ?? { eyebrow: 'Blog', title: post.metadata.title, stage: stage('glass-lens') }
    );
  }

  if (kind === 'component' && name) {
    const component = getComponentDoc(name);

    if (!component) return null;

    return {
      title: component.name,
      detail: getNativeUsage(component.registryItem) ? 'React and React Native' : 'React',
      stage: stage(component.id),
    };
  }

  if (kind === 'guide' && name) {
    const guide = getGuide(name);

    if (!guide) return null;

    return { eyebrow: 'Guide', title: guide.title, stage: stage(GUIDE_STAGES[guide.slug]) };
  }

  if (kind === 'components') {
    return { title: 'Components', second: 'One glass.', mosaic: MOSAIC };
  }

  if (kind === 'docs')
    return { title: 'Get started.', second: 'With shadcn.', stage: stage('install') };

  if (kind === 'guides')
    return { title: 'Guides', second: 'React and Expo.', stage: stage('glass-lens') };

  return null;
}

/** The cards and demo stages scripts/capture-share-cards.mjs photographs. Development only. */
export default async function ShareStudioPage({ params }: { params: Promise<{ card: string[] }> }) {
  if (process.env.NODE_ENV === 'production') notFound();

  const [mode, kind, name] = (await params).card;

  if (mode === 'stage' && kind) {
    if (
      kind !== 'install' &&
      kind !== 'phone' &&
      !componentDocs.some((component) => component.id === kind)
    ) {
      notFound();
    }

    return <ShareStage id={kind} />;
  }

  const card = mode === 'card' && kind ? await cardFor(kind, name) : null;

  if (!card) notFound();

  return <ShareCard {...card} />;
}
