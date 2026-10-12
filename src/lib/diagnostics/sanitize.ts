import type { ErrorEvent, Exception, StackFrame } from '@sentry/nextjs';

const errorTypes = new Set([
  'Error',
  'TypeError',
  'ReferenceError',
  'RangeError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'DOMException',
]);

function safeFilename(filename: string | undefined, runtime: 'browser' | 'server') {
  if (!filename) return undefined;

  if (runtime === 'browser') {
    try {
      const url = new URL(filename);

      if (typeof location === 'undefined' || url.origin !== location.origin) return undefined;

      if (
        !/^\/_next\/static\/[a-zA-Z0-9_./[\]()-]+\.js$/.test(url.pathname) ||
        url.pathname.includes('..')
      )
        return undefined;

      return `${url.origin}${url.pathname}`;
    } catch {
      return undefined;
    }
  }

  // Server build/package coordinates only. No machine home directories or source context.
  if (
    /^app:\/\/\/_next\/server\/[a-zA-Z0-9_./[\]()-]+\.js$/.test(filename) &&
    !filename.includes('..')
  )
    return filename;
  const relative = filename.match(/(?:^|\/)(\.next\/server\/[a-zA-Z0-9_./[\]()-]+\.js)$/)?.[1];

  if (relative && !relative.includes('..')) return `app:///${relative}`;

  return /^node:[a-z_/-]+$/.test(filename) ? filename : undefined;
}

function safeFrame(frame: StackFrame, runtime: 'browser' | 'server'): StackFrame {
  const filename = safeFilename(frame.filename, runtime);
  const result: StackFrame = {};

  if (filename) result.filename = filename;

  if (Number.isSafeInteger(frame.lineno) && frame.lineno! > 0) result.lineno = frame.lineno;

  if (Number.isSafeInteger(frame.colno) && frame.colno! > 0) result.colno = frame.colno;

  if (frame.in_app === true || frame.in_app === false) result.in_app = frame.in_app;

  return result;
}

export function sanitizeErrorEvent(
  event: ErrorEvent,
  runtime: 'browser' | 'server',
): ErrorEvent | null {
  if (event.type || !event.exception?.values?.length) return null;
  const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE;

  if (!release || !/^glassyui@[0-9a-f]{40}$/.test(release)) return null;

  const result: ErrorEvent = {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: 'javascript',
    level: event.level === 'fatal' ? 'fatal' : 'error',
    release,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    tags: { runtime, service: 'glassyui', channel: 'web' },
    exception: {
      values: event.exception.values.slice(-4).map((exception) => {
        const safe: Exception = {
          type: errorTypes.has(exception.type ?? '') ? exception.type : 'Error',
          value: `Unexpected ${runtime} failure`,
        };

        if (exception.mechanism)
          safe.mechanism = { type: 'generic', handled: exception.mechanism.handled === true };

        if (exception.stacktrace?.frames)
          safe.stacktrace = {
            frames: exception.stacktrace.frames
              .slice(-40)
              .map((frame) => safeFrame(frame, runtime)),
          };

        return safe;
      }),
    },
  };

  if (runtime === 'browser') result.tags!.diagnostics_basis = 'consent';
  // Keep build Debug IDs and source coordinates; exclude arbitrary SDK/source context.
  const images: NonNullable<NonNullable<ErrorEvent['debug_meta']>['images']> = [];

  for (const image of event.debug_meta?.images ?? []) {
    if (image.type !== 'sourcemap' || !/^[0-9a-f-]{36}$/.test(image.debug_id ?? '')) continue;
    const filename = safeFilename(image.code_file, runtime);

    if (filename) images.push({ type: 'sourcemap', debug_id: image.debug_id, code_file: filename });

    if (images.length === 40) break;
  }

  if (images.length) result.debug_meta = { images };

  return result;
}
