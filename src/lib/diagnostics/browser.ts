import type { BrowserOptions, Event } from '@sentry/nextjs';
import { preferenceSignal } from '../analytics/browser';
import { sanitizeErrorEvent } from './sanitize';

const COOKIE = 'glassy-ui-error-reports';

const MAX_AGE = 180 * 86400;

let client: ReturnType<(typeof import('@sentry/nextjs'))['init']>;

let generation = 0;

let starting: Promise<void> | undefined;

let activeChoice: string | undefined;

let refused = false;

const pending = new Set<AbortController>();

function acceptedChoice() {
  if (typeof document === 'undefined' || refused || preferenceSignal()) return undefined;

  try {
    const raw = document.cookie.split('; ').find((entry) => entry.startsWith(`${COOKIE}=`));

    if (!raw) return undefined;
    const value = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1)));
    const now = Date.now();

    const valid =
      value.decision === 'accepted' &&
      value.purpose === 'errors' &&
      value.version === 'errors-v1' &&
      Number.isSafeInteger(value.updatedAt) &&
      Number.isSafeInteger(value.expiresAt) &&
      value.updatedAt >= 0 &&
      value.updatedAt <= now &&
      value.expiresAt > now &&
      value.expiresAt - value.updatedAt <= MAX_AGE * 1000;

    return valid ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function errorReportsAllowed() {
  return acceptedChoice() !== undefined;
}

function currentChoice(current: number, choice: string) {
  return current === generation && acceptedChoice() === choice;
}

function stopErrorReports() {
  generation += 1;
  starting = undefined;
  activeChoice = undefined;
  pending.forEach((controller) => controller.abort());
  pending.clear();
  const previous = client;
  client = undefined;
  // Close before re-enabling: transport checks the captured generation as well as permission.
  void previous?.close(0);
}

export function chooseErrorReports(allow: boolean) {
  stopErrorReports();
  refused = true;
  const now = Date.now();

  const value = {
    decision: allow ? 'accepted' : 'rejected',
    version: 'errors-v1',
    purpose: 'errors',
    updatedAt: now,
    expiresAt: now + MAX_AGE * 1000,
    // Distinguish withdrawal/re-acceptance across tabs even within one millisecond.
    revision: window.crypto.randomUUID(),
  };

  const productionHost = ['glassyui.com', 'pro.glassyui.com', 'www.glassyui.com'].includes(
    location.hostname,
  );

  if (productionHost && location.protocol !== 'https:') return false;
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${productionHost ? '; Domain=glassyui.com' : ''}`;

  const saved = document.cookie
    .split('; ')
    .includes(`${COOKIE}=${encodeURIComponent(JSON.stringify(value))}`);

  if (saved && allow) refused = false;
  window.dispatchEvent(new Event('glassy-ui-error-reports-changed'));

  return saved;
}

export function syncErrorReports(): Promise<void> {
  const choice = acceptedChoice();

  if (!choice) {
    stopErrorReports();

    return Promise.resolve();
  }

  if (activeChoice && activeChoice !== choice) stopErrorReports();

  if (client || !process.env.NEXT_PUBLIC_SENTRY_DSN) return Promise.resolve();

  if (starting) return starting;
  const current = generation;
  activeChoice = choice;
  starting = initialize(current, choice);

  return starting;
}

async function initialize(current: number, choice: string) {
  try {
    const Sentry = await import('@sentry/nextjs');

    if (!currentChoice(current, choice)) return;

    const options: BrowserOptions = {
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      sendDefaultPii: false,
      sendClientReports: false,
      enableLogs: false,
      tracesSampleRate: 0,
      integrations: (defaults) =>
        defaults.filter((integration) =>
          [
            'InboundFilters',
            'FunctionToString',
            'BrowserApiErrors',
            'GlobalHandlers',
            'Dedupe',
            'LinkedErrors',
          ].includes(integration.name),
        ),
      beforeSend: (event, hint) =>
        currentChoice(current, choice) ? sanitizeErrorEvent(event, 'browser', hint) : null,
      transport: (options) => {
        const transport = Sentry.makeFetchTransport(options, async (url, init) => {
          if (!currentChoice(current, choice)) return new Response(null, { status: 204 });
          const controller = new AbortController();
          pending.add(controller);

          try {
            return await fetch(url, {
              ...init,
              credentials: 'omit',
              referrerPolicy: 'no-referrer',
              keepalive: false,
              signal: controller.signal,
            });
          } finally {
            pending.delete(controller);
          }
        });

        return {
          flush: (timeout) => transport.flush(timeout),
          send: (envelope) => {
            if (!currentChoice(current, choice)) return Promise.resolve({ statusCode: 204 });
            envelope[0] = { event_id: envelope[0].event_id };

            for (let index = envelope[1].length - 1; index >= 0; index -= 1) {
              if (envelope[1][index][0].type !== 'event') envelope[1].splice(index, 1);
            }

            for (const [, payload] of envelope[1]) {
              // SAFETY: only SDK event items remain after the envelope type filter.
              const event = payload as Event;
              event.sdk = {
                name: 'sentry.javascript.nextjs',
                version: '10.73.0',
                settings: { infer_ip: 'never' },
              };
            }

            return envelope[1].length
              ? transport.send(envelope)
              : Promise.resolve({ statusCode: 204 });
          },
        };
      },
    };

    client = Sentry.init(options);
  } finally {
    if (current === generation) starting = undefined;
  }
}

export async function captureRenderError(error: Error & { digest?: string }) {
  // A server render failure is already owned by onRequestError; do not duplicate it in the browser.
  const choice = acceptedChoice();

  if (error.digest || !choice) return;
  const initialized = syncErrorReports();
  const current = generation;
  await initialized;

  if (client && currentChoice(current, choice)) {
    const Sentry = await import('@sentry/nextjs');

    if (client && currentChoice(current, choice))
      Sentry.captureException(error, { tags: { operation: 'render' } });
  }
}
