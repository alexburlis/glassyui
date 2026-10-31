'use client';

import { usePathname } from 'next/navigation';
import { PreferencesProvider } from '@/components/liquid/provider';
import { AnalyticsConsent } from '@/components/site/analytics-consent';
import type { GlassyUiTheme } from '@/lib/liquid/preferences';
import { isTemplatePreviewPath } from '@/lib/templates';

export function Providers({
  children,
  defaultTheme,
}: {
  children: React.ReactNode;
  defaultTheme: GlassyUiTheme;
}) {
  const pathname = usePathname();

  // A template's preview is the template alone, in its own appearance: the site's saved
  // preferences, consent notice and analytics stay out of it.
  if (isTemplatePreviewPath(pathname)) return children;

  return (
    <PreferencesProvider defaultTheme={defaultTheme}>
      <AnalyticsConsent>{children}</AnalyticsConsent>
    </PreferencesProvider>
  );
}
