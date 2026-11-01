import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { FramedPreviewAnchors } from '@/components/site/framed-preview-anchors';
import { TEMPLATE_FONTS } from '@/lib/template-fonts';
import {
  FREE_TEMPLATES,
  freeTemplatePath,
  getAvailableTemplate,
  type FreeTemplateSlug,
} from '@/lib/templates';
import { Fieldnotes } from '../../../../../registry/glassyui/templates/fieldnotes/fieldnotes';
import { Halcyon } from '../../../../../registry/glassyui/templates/halcyon/halcyon';
import { Still } from '../../../../../registry/glassyui/templates/still/still';

// The installed source itself, so the preview is exactly what the command adds.
const PREVIEWS: Partial<Record<FreeTemplateSlug, ReactNode>> = {
  halcyon: <Halcyon />,
  fieldnotes: <Fieldnotes />,
  still: <Still />,
};

export const dynamicParams = false;

export function generateStaticParams() {
  return FREE_TEMPLATES.flatMap((template) =>
    template.status === 'available' ? [{ slug: template.slug }] : [],
  );
}

type PreviewProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PreviewProps): Promise<Metadata> {
  const template = getAvailableTemplate((await params).slug);

  if (!template) return {};

  return {
    title: `${template.name} preview`,
    description: template.summary,
    robots: { index: false, follow: true },
    alternates: { canonical: freeTemplatePath(template.slug) },
  };
}

/**
 * A template alone, as its page frames it: no site header, footer or analytics, in the template's
 * own appearance whatever the visitor chose for the site.
 */
export default async function TemplatePreviewPage({ params }: PreviewProps) {
  const template = getAvailableTemplate((await params).slug);
  const preview = template ? PREVIEWS[template.slug] : undefined;

  if (!template || !preview) notFound();

  const fonts = TEMPLATE_FONTS[template.slug];

  return (
    <>
      {/* Runs before the template paints. The only interpolated value is the catalogue's theme. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.setAttribute('data-lg-theme','${template.theme}')`,
        }}
      />
      {fonts ? <style dangerouslySetInnerHTML={{ __html: `:root { ${fonts} }` }} /> : null}
      <FramedPreviewAnchors />
      {preview}
    </>
  );
}
