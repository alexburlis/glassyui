# Agent discovery

The free homepage advertises `llms.txt`, full documentation, the getting started
guide and registry index through RFC 8288 `Link` response headers. These
resources describe the source-copy library and its installation workflow.

The Pro application is built from a separate private repository. This app keeps
external Pro links and redirects legacy `/pro` addresses there. It contains no
Pro product pages, checkout catalogue or private template payloads.

Public HTML pages negotiate Markdown when `Accept: text/markdown` has an equal
or higher quality value than HTML. Requests without that explicit preference
keep HTML. JSON, images, Next.js assets and React Server Component requests keep
their existing formats.

The Markdown route fetches the page from the same server over loopback and
converts its HTML with Turndown. It does not forward cookies or follow external
redirects. Markdown keeps the page's status, links, headings and code examples.
Pro redirects pass back to the caller without fetching the private application.
Markdown responses use `Cache-Control: no-store`.

Both representations advertise `Vary: Accept`. The pinned Next.js 16.3.8 patch
preserves custom `Vary` values alongside Next.js's own RSC values; the unpatched
HTML renderer overwrites the header. Keep the HTTP check when updating Next.js,
and remove the patch when the upstream renderer preserves the header itself.

The free robots response declares the supplied Content Signals:
`search=yes, ai-input=no, ai-train=no`. Existing crawl exclusions and sitemap
remain intact. Signals express preferences; they do not enforce crawler
behaviour. The private app owns Pro's separate robots response.

The site exposes documentation and source registries. It has no MCP/A2A service,
agent authentication or commerce API to advertise. DNS and provider settings are
outside these repository checks.

Run the repeatable HTTP check against a running free server:

```sh
pnpm check:agent-discovery http://127.0.0.1:3000 /absolute/evidence/directory
```

The result records requests, negotiated types, headers, statuses, checks and
body hashes in `result.json`. It follows advertised free resources, tests Accept
quality values, preserves RSC/JSON/HEAD/404 responses and rejects paths that
could leave the page-conversion boundary. Its Pro probes prove external
redirects and the absence of Pro pages/assets from the free app; they never
follow the remote checkout or fetch the private site.
