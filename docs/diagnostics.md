# Glassy UI error reporting

This document describes error reporting in the Glassy UI website. Applications
built with the registry components do not inherit this integration. Local
development and builds work without a Sentry account or credentials.

## Owners and activation

| Runtime                                       | Owner                                                             | Capture and collection                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website and Pro browser                       | `src/instrumentation-client.ts`, `src/lib/diagnostics/browser.ts` | Installed `@sentry/nextjs` 10.73.0 loads only after the separate Error reports opt-in. Global exceptions/rejections and callback failures use the SDK; `app/global-error.tsx` owns React root failures. Server errors with a Next digest are not captured again in the browser. |
| Node SSR, route handlers and Next 16 proxy    | `src/instrumentation.ts`, `src/sentry.server.config.ts`           | The actual `register()` hook initializes Node; `onRequestError` owns escaping framework errors. SDK process exception/rejection handlers preserve terminal coverage. Minimized server errors do not require browser consent.                                                    |
| Optional keynote ribbon worker                | `src/components/keynote/poster-ribbon.tsx`                        | Unsupported graphics and handled shader failures recover the optional mark through the existing `down()`/intro controls. Existing local diagnostics remain; recovered presentation failures do not create a Sentry issue. No usage or worker trace stream is added.             |
| Edge / Cloudflare Worker / native application | None in this website deployment                                   | Next 16 `src/proxy.ts` uses Node. Cloudflare provides the existing DNS/CDN/security service. Registry native components are source artifacts, and `fixtures/expo-consumer` is a local consumer fixture. This integration never publishes or instruments a literal native app.   |

This artifact serves `glassyui.com` and `www.glassyui.com`. The separate private
Pro app owns `pro.glassyui.com` and has its own source commit and build
artifact. The two apps retain the existing shared preference-cookie purpose and
provider project; a local split does not establish production routing or
provider intake. Provider accounts, project identifiers, alert settings and
deployment receipts are maintained outside this repository. Local tests do not
establish provider ingestion.

## Configuration and symbols

- `NEXT_PUBLIC_SENTRY_DSN` is public routing configuration, supplied at build
  **and** runtime. An absent DSN leaves reporting unconfigured; the Error
  reports action is disabled. It does not substitute another product's DSN.
- Supply the full `SOURCE_COMMIT` when configuring reporting. Builds bind the
  SDK and `X-GlassyUI-Release` response header to `glassyui@<40-hex SHA>` from
  this repository. Pro uses its private repository SHA in the same release
  format. A configured DSN with a missing/invalid release fails the build.
  Actual Node development is labeled `development`; production artifacts are
  labeled `production`, channel `web`, with distinct `browser`/`server` runtime
  tags.
- The Sentry build plugin uses `SENTRY_AUTH_TOKEN`, injected into the build
  child or locked build-only BuildKit secret. It is never a Docker ARG or public
  variable. Source-map/release uploads are disabled without that capability.
  Uploaded maps are removed from the distributable output. A local build without
  uploads is not provider symbolication proof. `.env.build.1p.example` is an
  optional template for a reference to your own 1Password item. Forks must
  configure their own project in `next.config.ts` before enabling uploads. A
  release or source-map upload failure rejects the build with a content-free
  error and preserves the maps. The SDK cannot silently ship an unsymbolicated
  artifact after an upload failure.

## Privacy and lifecycle

Error reports use their own `glassy-ui-error-reports` preference cookie, purpose
`errors`, version `errors-v1`, with a 180-day maximum. The HTTPS production
cookie is shared across the main and Pro host. Existing PostHog preferences and
regional decisions are unchanged; analytics acceptance does not enable error
reports. Invalid/expired choices, missing configuration, GPC and DNT keep
browser reporting off.

Withdrawal closes the capture/transport gate synchronously, increments its
generation and aborts active requests. Every capture, SDK import continuation,
envelope send and actual fetch rechecks current permission. Other tabs/hosts are
checked at send time and on focus, visibility and the existing settings poll. No
events from an unconsented period are retained for later delivery. Render errors
await the shared startup promise; withdrawal invalidates that promise's capture
generation. Startup, captures and queued transmission also bind to the accepted
cookie revision, so withdrawal/re-acceptance in another document cannot revive
old errors. Each choice has a new revision, including choices made within the
same millisecond; that preference identifier is never part of an event.

`sanitizeErrorEvent` reconstructs an allowlisted event: SDK-generated event
identity/time, fixed environment/service/channel/runtime, built-in exception
type, fixed technical summary, bounded source coordinates and valid build Debug
IDs. It excludes error text, cause content, function names, source context,
user/request data, cookies, query strings, breadcrumbs, contexts, transactions
and extras. SDK-rewritten `app:///_next/server/` coordinates remain usable for
source-map matching. Final envelope handling permits error event items only,
removes transport trace/SDK metadata and sets `infer_ip: never`. The browser
transport omits credentials and referrers and has no unload beacon/keepalive.
The receiving infrastructure still processes connection information.

Usage sessions, replay, tracing, profiling, log ingestion, attachments, feedback
and broad console capture remain disabled. There is no new support store or
problem-report upload; existing support links remain the deliberate contact
path. No synthetic production failure, test notification or paid provider
feature is part of verification.

## Notifications

Production alerts target new or regressed issues rather than every repeated
event. Browser and server events use channel `web`. Notification settings and
recipients belong to the deployment's provider configuration; a local build does
not configure or verify them.

## Verification

- `pnpm test:error-reports`: actual Next request-error hook and Node SDK final
  HTTP envelope; private input removed, one event, release identity, and the
  SDK's production frame rewrite preserved.
- `pnpm test:error-startup`: actual browser SDK in an isolated DOM, root capture
  during asynchronous startup, withdrawal during startup and shared-cookie
  withdrawal/re-acceptance across documents; loopback HTTP only.
- `pnpm check:error-reports <loopback-url> <artifact-directory>`: real Chrome,
  actual startup, separate choice, refusal/reload, GPC/DNT, and serialized error
  envelopes. All ingestion is intercepted locally. It refuses public targets.
- `pnpm test:build-upload`: actual Next/Sentry post-compile hook with a local
  CLI process stub; release and map failures reject without private provider
  text, preserve maps, and keep tokenless local builds working.
- `pnpm test:analytics-consent` and `pnpm check:analytics-consent`: existing
  analytics choice and withdrawal contract. Both purposes remain independent.
- Repository lint, changed-file formatting, TypeScript and production standalone
  build are required. Public live initialization, exact deployed identity,
  provider intake/access, symbols and notifications require their own receipts.

Local tests establish neither provider delivery nor mailbox delivery. Verify
those separately for the configured deployment.
