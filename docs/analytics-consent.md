# Optional PostHog analytics

This integration adds one optional purpose to `glassyui.com` and
`pro.glassyui.com`: public-page usage and Pro checkout-link clicks. It does not
change checkout, pricing, eligibility, licensing, delivery or appearance
settings. It does not establish completed purchases. `/thanks` is only a page
view.

The two origins are built from separate repositories. This public repository
owns the free-site integration; the private Pro app preserves the same purpose,
choice cookie and SDK privacy contract.

## Collection contract

- `$pageview`, `$pageleave`, `$web_vitals` and `pro_checkout_click` events are
  permitted. Pageviews and SPA exits are manual; document exits and
  non-attributed Web Vitals use the pinned SDK.
- The SDK is lazy-loaded after the permission gate permits collection. No events
  from a disallowed period are queued or replayed after acceptance.
- Events carry a known public path or coarse route family, the canonical Glassy
  UI origin, event time, document-memory visitor, session and pageview
  identifiers, the processing basis, browser/device categories, screen
  dimensions, scroll depth, page duration, scalar Web Vitals and a `direct` /
  `same_site` / `external` referrer category. Dynamic path segments, queries,
  fragments, full referrers and free-form content are excluded.
- No person profile is created. Payloads set `$process_person_profile: false`,
  `$geoip_disable: true` and `$ip: '0.0.0.0'`. PostHog still receives connection
  information, including the network IP and browser user agent; payload
  minimization does not eliminate infrastructure processing.
- Autocapture, replay, heatmaps, performance attribution, console recording,
  surveys, flags, experiments and automatic exceptions are disabled. There is no
  advertising, marketing integration or cookieless tracking fallback.
- The SDK's public `before_send` hook replaces SDK delivery with one abortable
  request and always returns `null`. The SDK receives no events to batch, retry
  or flush on shutdown. The application transport has no retry or unload beacon.
  Exit/vitals requests use fetch keepalive so document closure need not cancel
  delivery; withdrawal still aborts them. The first-party `/api/pulse/i/v0/e`
  route rewrites only to EU ingestion. SDK assets are bundled locally, with no
  remote configuration or dependency requests.
- Withdrawal closes the gate synchronously, invalidates pending SDK loads,
  aborts in-flight application requests and clears optional PostHog storage.
  Already transmitted data cannot be recalled by aborting a browser request.

## Regional decision

**Only trusted United States visits use default-on analytics.**
`REVIEWED_OPT_OUT_COUNTRIES` in `src/lib/analytics/consent.ts` contains only
`US`. The portfolio's broader default-on list is not inherited. EU/EEA, UK,
Switzerland, unknown locations and every other country remain opt-in. A valid
PostHog configuration is required in either mode.

The server trusts `CF-IPCountry` only when the runtime variable
`ANALYTICS_TRUST_CLOUDFLARE_PROXY` is exactly `true` and the immediate
proxy-reported peer matches the 22 pinned
[official Cloudflare IPv4/IPv6 ranges](https://www.cloudflare.com/ips/), checked
with Node's `net.BlockList`. Missing, false or invalid attestation keeps the
country unknown. A request containing `CF-Worker` is also unknown/opt-in. A
trusted reverse proxy must set a single `X-Real-IP` from its TCP peer and remove
client-supplied values and underscore aliases. Recheck that invariant before
retaining the attestation after a proxy change. An arbitrary header or
`X-Forwarded-For` chain never grants a permissive decision. No new geolocation
vendor is added. A missing, malformed or non-Cloudflare peer produces an unknown
country and opt-in. The response's country code is used only for the regional
decision, never stored as a choice or included in analytics events.

The application listener must be reachable only through that trusted proxy. The
proxy must not trust client-supplied forwarding headers. Direct access to the
application would let a client forge the reported peer and invalidate the
country attestation.

The configuration endpoint uses `Cache-Control: private, no-store` and disables
CDN caching; HTML contains no permissive regional decision. US default-on
visitors see an immediately available **Turn off** action. Absence of a choice
remains `undecided` and the basis is `legitimate_interest`; it is never stored
or displayed as explicit consent. A move to an opt-in location requires actual
acceptance. A remembered rejection and Global Privacy Control or Do Not Track
override the regional default and prior acceptance. The Privacy settings control
in either footer allows later acceptance or refusal. An explicit choice is
shared across the two sites for at most 180 days; appearance preferences remain
independent.

Before adding a jurisdiction, record a product-specific assessment of the exact
processing, Article 6 basis, applicable local law, German terminal-storage
rules, notice and objection route. GDPR Article 3(1) still applies to this
German controller's activities; location outside Europe alone does not establish
a legal basis. A reviewed opt-out mode also requires a trusted country path and
proof that the CDN cannot cache a permissive answer for another visitor. Missing
or invalid configuration/location data must remain opt-in with no optional
collection before permission. Update the notices and tests with any approved
change.

## Browser storage

| Name                                | Purpose and contents                                                                                                                               | Scope and lifetime                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glassy-ui-analytics-consent`       | Necessary choice record: `accepted` or `rejected`, `purpose: analytics`, `version: analytics-v1`, `updatedAt`, `expiresAt`. No visitor identifier. | HTTPS production: `Domain=glassyui.com; Path=/; Secure; SameSite=Lax`, shared by the two sites. Localhost: host-only, Secure when HTTPS. Maximum 180 days. |
| `glassyui_analytics_sdk_permission` | Optional SDK technical capture flag (`1`/`0`), written only after the application gate allows initialization. It is not the user's consent record. | Production: `Domain=glassyui.com; Path=/; Secure; SameSite=Lax`; localhost: host-only. Maximum 180 days; removed on withdrawal.                            |
| `glassy-ui-preferences`             | Requested appearance/accessibility settings; independent of analytics.                                                                             | Origin-local `localStorage`, no application expiry. Preserved on withdrawal.                                                                               |
| `glassy-ui-docs-platform`           | Requested React / React Native documentation choice; independent of analytics.                                                                     | Origin-local `localStorage`, no application expiry. Preserved on withdrawal.                                                                               |

SDK identifier persistence is disabled: `persistence: 'memory'`,
`disable_persistence: true`. Optional cleanup also removes the owned legacy
namespace `ph_glassyui_analytics` and its `_window_id`, `_primary_window_exists`
and `_session_registered_properties` variants from cookies, local storage and
session storage. No legacy key is used to grant consent. Cookie expiry is not
provider event deletion. Refusals survive a notice-version change; expired,
invalid or old acceptances do not grant permission. A material purpose change
requires a new `CONSENT_VERSION` and renewed acceptance.

## Configuration

Set `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` as runtime-only variables. The
upstream host must be `https://eu.i.posthog.com`; the client receives only the
fixed first-party `/api/pulse` path; missing, invalid or other-host
configuration disables tracking. The project token is public client
configuration. Personal/admin keys never belong in this endpoint or client code.
Set `ANALYTICS_TRUST_CLOUDFLARE_PROXY=true` only after verifying the
reverse-proxy trust invariant above.

## Verification

The decision and browser scripts exercise unknown/EU/UK locations, acceptance,
rejection, reload, navigation, withdrawal, shared-subdomain choices,
session/pageview identity, exit duration/scroll, real browser Web Vitals,
first-party routing, refused/old/ expired preferences, GPC/DNT, absent
configuration and untrusted country headers. US opt-out checks distinguish
`legitimate_interest` from explicit consent and verify that remembered refusal
and GPC/DNT override the default. Regional checks cover Cloudflare country
replacement, trusted proxy peers and public-origin header spoofing; forged or
unavailable region data must not enable default-on collection. Browser checks
inspect both network traffic and storage, including interrupted SDK
loading/delivery and preservation of appearance/documentation choices. Keyboard
and mobile interactions are part of the browser check. Keep actual command
results and artifact locations in the PR, rather than treating this list as
passing evidence.

## Sources checked on October 4, 2026

- [PostHog JavaScript SDK documentation](https://posthog.com/docs/libraries/js),
  [official documentation source](https://github.com/PostHog/posthog.com/blob/master/contents/docs/libraries/js/index.mdx)
  and installed `posthog-js` 1.434.15 source. Its technical consent cookie name
  is exactly `consent_persistence_name`; the SDK boolean is not proof of a UI
  choice.
- [PostHog DPA](https://posthog.com/dpa) and
  [subprocessors](https://posthog.com/subprocessors). The EU Cloud storage
  listing specifies Germany; worldwide infrastructure processing is also
  disclosed.
- [PostHog event-retention API contract](https://posthog.com/docs/api/events-retention):
  describes a read-only plan-based queryable window, not a deletion guarantee.
- [PostHog event-retention documentation source](https://github.com/PostHog/posthog.com/blob/master/contents/docs/data/events-retention.mdx):
  paid plans provide a seven-year query window; this does not delete older data,
  and a shorter window is not available as a deletion mechanism.
- [German TDDDG Section 25](https://www.gesetze-im-internet.de/ttdsg/__25.html)
  and [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), especially
  Articles 3, 6, 7, 13 and 28. The EUR-Lex HTML reader presented a JavaScript
  challenge; the
  [official consolidated PDF](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?qid=1789247945921&uri=CELEX%3A02016R0679-20160504)
  supplies the regulation text.

## Web Analytics reporting limits

The minimized transport must preserve `$session_id`, `$window_id`,
`$pageview_id`, previous-page identity, duration and scroll properties. Dropping
these produces pageview events that cannot form Web Analytics sessions.
`$lib_custom_api_host` identifies the first-party transport. Web Vitals retain
numeric values only, excluding DOM attribution and resource URLs. Blog routes
use `/blog` or `/blog/[page]`.

Visitors here mean browsers permitted to run analytics, with identifiers limited
to the current document. Reloads and cross-host navigations start a new
identity. This is not a count of all human visitors or returning people.
Rejected visits, opt-in visits without acceptance, DNT/GPC, and blocked
JavaScript remain excluded. Historic events missing session IDs cannot be
reliably stitched into sessions after the fact.

## Checking the two applications

Default public CI runs the existing browser owner against the free app only. Its
report explicitly records that Pro and cross-subdomain proof are not part of
that run. For a change affecting both apps, start their standalone servers on
different loopback ports, then run:

```sh
pnpm check:analytics-consent http://127.0.0.1:3100 /absolute/paired-evidence http://127.0.0.1:3102
```

The browser sees the HTTPS production origins while each origin is forwarded to
its actual app. The owner intercepts telemetry and checkout navigation; it makes
no provider or payment write. The paired proof covers shared acceptance,
refusal, withdrawal and checkout-link events. An omitted private target cannot
silently reuse the free server as Pro.

To rerun one browser scenario, pass its name as a fourth argument. Use an empty
third argument for a focused free-only check.
