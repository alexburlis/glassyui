export type AnalyticsConfig = {
  token: string | null;
  host: string;
  mode: 'opt-in' | 'opt-out';
  signal: boolean;
};

export const POSTHOG_PROXY = '/api/pulse';

export const POSTHOG_HOST = 'https://eu.i.posthog.com';

export function parseAnalyticsConfig(raw: string): AnalyticsConfig | null {
  try {
    const value: AnalyticsConfig | null = JSON.parse(raw);

    if (
      !value ||
      value.host !== POSTHOG_PROXY ||
      (value.token !== null && !/^phc_[a-zA-Z0-9_-]+$/.test(value.token)) ||
      (value.mode !== 'opt-in' && value.mode !== 'opt-out') ||
      (value.signal !== true && value.signal !== false)
    )
      return null;

    return { token: value.token, host: value.host, mode: value.mode, signal: value.signal };
  } catch {
    return null;
  }
}
