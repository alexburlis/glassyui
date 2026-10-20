# Email updates

The optional footer form requests Glassy UI components/tutorials and Glassy UI
Pro launches, templates and offers. Mailwerk owns confirmation, consent,
delivery, retention and unsubscribe. Submitting the form never grants marketing
consent.

## Public source and private operations

This repository contains the form, `/api/updates`, its shared versioned notice
and one generated Mailwerk client. These contain no credentials or subscriber
data. The client is generated for the site's project; it is not part of the
copy-ready component registry or an email-sending SDK for library consumers.

Email templates, project configuration, campaigns, sending credentials and
audience records belong in the private Mailwerk project. No subscriber export,
admin key, SES credential or rendered customer message belongs in this
repository or its issues, build logs or test artifacts. Public static logo PNGs
are brand assets.

## Runtime configuration

Set these only in the website's server runtime:

| Variable           | Value                                         |
| ------------------ | --------------------------------------------- |
| `MAILWERK_URL`     | `https://api.mailwerk.io`                     |
| `MAILWERK_API_KEY` | A runtime key scoped to the Glassy UI project |

Use the reference-only `.env.runtime.1p.example` for protected child-process
injection. Keep actual references and values in your own secret configuration.
Never use a `NEXT_PUBLIC_` prefix, build argument, Mailwerk installation admin
key or SES sending key. Missing configuration reports signup unavailable; the
library and documentation remain usable. Fork operators must use their own
project and sender and regenerate the client for it. Do not use the Glassy UI
audience.

Regenerate `src/lib/mailwerk.ts` with the current Mailwerk CLI's `init` command
and `--update`. Keep generated content intact; the route is the server-only
boundary. Check the runtime key with the Mailwerk CLI
`doctor --project glassyui` before activation; a successful diagnostic does not
prove delivery.

## Consent contract

`POST /api/updates` accepts only
`{ "email": "you@example.com", "consent": true }`. The server controls
`purposes: ['updates']`, the notice version/text and `source: 'website_footer'`.
Change `src/lib/updates-notice.ts` when the visible notice changes, and advance
the notice version in the same change.

Mailwerk's default `consent_confirm` template supplies a hosted confirmation
link. Its page requires a deliberate POST; opening an email link alone does not
subscribe. Suppressed and already-confirmed addresses receive the same neutral
acknowledgement. Provider failures remain failures. The form preserves the
entered address on failure and makes no automatic retry.

The subscriber identifier is a SHA-256 digest of `glassyui:updates:` plus the
trimmed, lowercase address. This is pseudonymous personal data, not anonymous
data. It stays private in Mailwerk, is never returned or logged by the route and
survives runtime-key rotation. Normalization matches Mailwerk's case handling.
There is no local audience database, email cookie or analytics event.

The route admits only the two production origins and same-origin loopback hosts,
bounds JSON to 1 KiB and permits at most three attempts per address and 100
total attempts per hour in one server process. Those counters reset on restart
and are not a distributed spending cap. Mailwerk also enforces durable DOI
limits; its project allowance and pause remain the sending controls. Do not
treat a billing alarm as a hard cap.

## Activation and verification

Keep a newly created project paused and `policy.liveAt` unset until the actual
sender/feedback configuration is verified and the updated privacy policy is
published. Keep open/click measurement disabled. A welcome and reusable update
template can be staged without starting an automatic sequence or campaign.

Run `pnpm check:updates <artifact-directory>` with port 3116 available (or set
`UPDATES_CHECK_PORT`). The script owns and closes a loopback Next dev server and
a Mailwerk protocol fixture. It verifies consent/origin/body rejection, actual
generated-client HTTP, truthful failures, neutral acknowledgements,
mobile/desktop keyboard submission and identity continuity after key rotation.
It sends no mail. Local protocol and rendering checks do not prove live SES,
mailbox authentication, feedback or withdrawal.

Before enabling collection, run the approved real-mailbox confirmation and
unsubscribe proof with the named sender, recipient and bounded send count.
Deployment, provider resources, sending costs and campaign sends require their
own explicit authority. Keep recipients and authentication tokens out of
evidence.

The existing PR install-smoke and manual release-smokes jobs run this check.
Hosted CI is separate proof; a local passing result does not claim CI passed.
