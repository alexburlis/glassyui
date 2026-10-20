import 'server-only';
import { createHash } from 'node:crypto';
import { consentRequest, MailwerkError } from '@/lib/mailwerk';
import { UPDATES_NOTICE_TEXT, UPDATES_NOTICE_VERSION } from '@/lib/updates-notice';

export const runtime = 'nodejs';

const BODY_LIMIT = 1024;

const HOUR = 60 * 60 * 1000;

const acceptedOrigins = new Set(['https://glassyui.com', 'https://pro.glassyui.com']);

// This local bound limits one process; Mailwerk also enforces durable DOI limits.
let windowStart = Date.now();

let attempts = 0;

const recipients = new Map<string, number>();

function reply(status: number, retryAfter?: number) {
  const headers = new Headers({ 'Cache-Control': 'private, no-store' });

  if (retryAfter) headers.set('Retry-After', String(retryAfter));

  return Response.json(status === 200 ? { ok: true } : { ok: false }, { status, headers });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');

  if (!origin) return false;

  try {
    const url = new URL(origin);

    const loopback =
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]', 'pro.localhost'].includes(url.hostname);

    // Next can construct request.url from its listener address behind a proxy.
    // The browser's Origin must instead match the actual, allowlisted Host.
    return (acceptedOrigins.has(origin) || loopback) && url.host === request.headers.get('host');
  } catch {
    return false;
  }
}

async function readBody(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let expired = false;

  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel();
  }, 5000);

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (expired) return null;

      if (done) break;
      length += value.byteLength;

      if (length > BODY_LIMIT) {
        await reader.cancel();

        return null;
      }

      chunks.push(value);
    }

    return Buffer.concat(chunks).toString('utf8');
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply(403);

  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    return reply(415);
  const declaredLength = request.headers.get('content-length');

  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > BODY_LIMIT))
    return reply(413);

  let input: unknown;

  try {
    const body = await readBody(request);

    if (body === null) return reply(413);
    input = JSON.parse(body);
  } catch {
    return reply(400);
  }

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Decode untrusted JSON at the HTTP boundary.
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400);
  // SAFETY: Non-null, non-array JSON object checked above; known properties are decoded below.
  const fields = input as { email?: unknown; consent?: unknown };

  if (
    Object.keys(fields).some((key) => key !== 'email' && key !== 'consent') ||
    fields.consent !== true ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Decode this field before using string methods.
    typeof fields.email !== 'string'
  )
    return reply(400);
  const email = fields.email.trim().toLowerCase();

  if (
    email.length > 254 ||
    email.split('@')[0].length > 64 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
      email,
    )
  )
    return reply(400);

  if (!process.env.MAILWERK_API_KEY || !process.env.MAILWERK_URL) return reply(503);

  const now = Date.now();

  if (now - windowStart >= HOUR) {
    windowStart = now;
    attempts = 0;
    recipients.clear();
  }

  // This stable pseudonymous ID stays inside Mailwerk and survives API-key rotation.
  const externalId = `updates:${createHash('sha256').update(`glassyui:updates:${email}`).digest('hex')}`;
  const count = recipients.get(externalId) ?? 0;

  if (attempts >= 100 || count >= 3)
    return reply(429, Math.max(1, Math.ceil((windowStart + HOUR - now) / 1000)));
  attempts += 1;
  recipients.set(externalId, count + 1);

  try {
    const result = await consentRequest(
      {
        externalId,
        email,
        purposes: ['updates'],
        noticeVersion: UPDATES_NOTICE_VERSION,
        noticeText: UPDATES_NOTICE_TEXT,
        source: 'website_footer',
      },
      { timeoutMs: 8000 },
    );

    switch (result.status) {
      case 'sent':
      case 'already_confirmed':
      case 'suppressed':
        return reply(200);
      default:
        return reply(503);
    }
  } catch (error) {
    if (error instanceof MailwerkError && error.status === 429) return reply(429, 3600);

    // Provider details can contain addresses. Keep them out of responses and logs.
    return reply(503);
  }
}
