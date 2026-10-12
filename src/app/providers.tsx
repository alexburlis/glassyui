'use client';

import { PreferencesProvider } from '@/components/liquid';
import { AnalyticsConsent } from '@/components/site/analytics-consent';
import type { GlassyUiTheme } from '@/lib/liquid/preferences';

export function Providers({
  children,
  defaultTheme,
}: {
  children: React.ReactNode;
  defaultTheme: GlassyUiTheme;
}) {
  return (
    <PreferencesProvider defaultTheme={defaultTheme}>
      <AnalyticsConsent>{children}</AnalyticsConsent>
    </PreferencesProvider>
  );
}
