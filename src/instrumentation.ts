import * as Sentry from '@sentry/nextjs';
import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
}

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  // Bind the terminal boundary to this error, never a process-wide request scope.
  Sentry.captureException(error, {
    mechanism: { type: 'auto.function.nextjs.on_request_error', handled: false },
    captureContext: { tags: { operation: context.routeType } },
  });
  await Sentry.flush(2000);
};
