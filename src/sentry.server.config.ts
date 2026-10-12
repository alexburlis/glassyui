import * as Sentry from '@sentry/nextjs';
import { sanitizeErrorEvent } from './lib/diagnostics/sanitize';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const client = Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    sendDefaultPii: false,
    sendClientReports: false,
    enableLogs: false,
    tracesSampleRate: 0,
    skipOpenTelemetrySetup: true,
    integrations: (defaults) =>
      defaults.filter((integration) =>
        [
          'InboundFilters',
          'FunctionToString',
          'Dedupe',
          'RewriteFrames',
          'DistDirRewriteFrames',
          'OnUncaughtException',
          'OnUnhandledRejection',
        ].includes(integration.name),
      ),
    beforeSend: (event) => sanitizeErrorEvent(event, 'server'),
  });

  client?.on('beforeEnvelope', (envelope) => {
    envelope[0] = { event_id: envelope[0].event_id };

    for (let index = envelope[1].length - 1; index >= 0; index -= 1) {
      if (envelope[1][index][0].type !== 'event') envelope[1].splice(index, 1);
    }

    for (const [, payload] of envelope[1]) {
      // SAFETY: only SDK event items remain after the envelope type filter.
      const event = payload as Sentry.Event;
      event.sdk = {
        name: 'sentry.javascript.nextjs',
        version: '10.73.0',
        settings: { infer_ip: 'never' },
      };
    }
  });
}
