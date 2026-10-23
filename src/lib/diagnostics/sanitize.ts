import type { ErrorEvent, EventHint, Exception, StackFrame } from '@sentry/nextjs';

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

// These categories distinguish dependency failures without sending messages or endpoints.
const failureCodes = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EPIPE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
] as const;

function failureCode(hint?: EventHint) {
  const seen = new Set<object>();
  let current: object = Object(hint?.originalException);

  for (let depth = 0; depth < 4; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);

    // Never execute arbitrary accessors while projecting an error into the safe contract.
    try {
      const candidate = Object.getOwnPropertyDescriptor(current, 'code')?.value;
      const code = failureCodes.find((allowed) => allowed === candidate);

      if (code) return code;
      const cause = Object.getOwnPropertyDescriptor(current, 'cause')?.value;

      if (cause == null) break;
      current = Object(cause);
    } catch {
      break;
    }
  }

  return 'unknown';
}

const operations = ['render', 'route', 'action', 'proxy'] as const;

function operationName(hint?: EventHint) {
  try {
    const tags = Object.getOwnPropertyDescriptor(Object(hint?.captureContext), 'tags')?.value;
    const candidate = Object.getOwnPropertyDescriptor(Object(tags), 'operation')?.value;

    return operations.find((allowed) => allowed === candidate) ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

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
  hint?: EventHint,
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
    tags: {
      runtime,
      service: 'glassyui',
      channel: 'web',
      operation: operationName(hint),
      failure_code: failureCode(hint),
    },
    exception: {
      values: event.exception.values.slice(-4).map((exception) => {
        const safe: Exception = {
          type: errorTypes.has(exception.type ?? '') ? exception.type : 'Error',
          value: `Unexpected ${runtime} failure`,
        };

        if (exception.mechanism) {
          safe.mechanism = {
            type: [
              'chained',
              'auto.core.linked_errors',
              'auto.function.nextjs.on_request_error',
              'auto.browser.global_handlers.onerror',
              'auto.browser.global_handlers.onunhandledrejection',
              'auto.browser.browserapierrors.setTimeout',
              'auto.browser.browserapierrors.setInterval',
              'auto.browser.browserapierrors.requestAnimationFrame',
              'auto.browser.browserapierrors.addEventListener',
              'auto.browser.browserapierrors.handleEvent',
            ].includes(exception.mechanism.type)
              ? exception.mechanism.type
              : 'generic',
            handled: exception.mechanism.handled === true,
          };

          // Preserve the SDK's bounded cause relationships for grouping/symbolication.
          for (const key of ['exception_id', 'parent_id'] as const) {
            const value = exception.mechanism[key];

            if (Number.isSafeInteger(value) && value! >= 0 && value! <= 5)
              safe.mechanism[key] = value;
          }
        }

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
