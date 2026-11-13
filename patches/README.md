# Local package patches

## `braces@3.0.3`

The upstream package has no published fix for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The
local patch keeps the installed package at its published version so `pnpm audit`
continues to report the advisory. It bounds combined curly-brace and parenthesis
nesting at 100, and checks direct AST inputs iteratively before recursive
operations. Cyclic AST child and parent chains raise `SyntaxError`; shared AST
subtrees remain valid.

Patterns deeper than 100 nested braces or parentheses now raise `SyntaxError`.
This is an intentional input limit that prevents stack exhaustion. Remove this
patch when an upstream release fixes the advisory and passes the security
contract in `scripts/test-braces-security.mjs`.

## `deepmerge@4.3.1`

The upstream package has no published fix for
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Its
prototype-poisoning guard inspects the target object rather than the key, so a
`__proto__` key still sets the prototype of the merged result when the target
has a null prototype, holds a `null` placeholder or has its own `__proto__` key.
The local patch applies the remedy proposed in
[TehShrike/deepmerge#273](https://github.com/TehShrike/deepmerge/issues/273):
both copy loops in `mergeObject` skip the keys `__proto__`, `constructor` and
`prototype`, whatever the target's shape, so merging drops own keys with those
names. It patches `index.js` and both builds in `dist/`; the root and the
`base-nova` fixture apply the same file. Like the `braces` patch, it keeps the
published version, so `pnpm audit` and Dependabot continue to report the
advisory. Remove the patch when an upstream release fixes the advisory.

## Container certificate trust

The Docker build installs the updated Alpine `ca-certificates` package. Build
commands and the server select Node's documented `--use-openssl-ca` mode, so
HTTPS uses that distro store instead of Node's bundled roots. Existing
`NODE_OPTIONS` remain in place; the server adds the CA option on its command
line.

This mitigates the
[eMudhra intermediate compromise](https://emudhra.we-have-a-problem.com/) while
Node's bundled-root update is pending. Normal HTTPS must succeed and both
incident test hosts must fail certificate validation under the exact runtime.
Reconsider this mitigation only after the selected upstream Node image rejects
both incident chains with its default trust configuration.

The October Node security rebuild uses the official 22.23.4 executable while
keeping the existing Alpine base, npm and Corepack. The AMD64 musl artifact and
ARM64 source archive have pinned SHA-256 values from Node's release manifest.
The recipe follows `nodejs/docker-node` commit
`84410eeaede25daf49826da8265fbf548cc604fe`; it rejects other architectures.
ARM64 uses the vendor's source-build path with two compiler jobs and a one-hour
compile limit, so it needs a separate build capacity reservation. This
campaign's production runtime verification covers AMD64; the ARM64 branch has
source review only until that build runs.

## `posthog-js@1.434.15`

The pinned SDK saves raw session entry URLs/referrers and search keywords even
when both `save_referrer` and `save_campaign_params` are false. Cookie
persistence would retain private query values outside the application transport.
This patch makes those switches govern session-source persistence and search
keywords in the CommonJS implementation and the bundled `no-external` import
used by both Glassy UI apps. It changes no dependency versions.

Keep the bounded acquisition model in the application. Remove the patch only
when an upstream SDK honors the same storage contract and the paired analytics
browser checks prove that query, referrer and search content stay out of
cookies, other SDK storage and transmitted events.

## Security overrides

`pnpm.overrides` in `package.json` pins transitive packages whose published
security fix their parents do not yet require. Dependabot cannot raise these
itself; its security runs report each one as not possible. Each pin is exact, so
it holds the package at that version until it is removed. Drop a pin once its
parent's own range resolves a fixed version.

Two groups sit outside their parents' declared ranges:

- `glob` 14.0.3 under `@sentry/bundler-plugin-core` and
  `@sentry/bundler-plugins`, which ask for glob 13. Sentry's build plugin calls
  only `glob(patterns, options)`, which glob 14 keeps. Remove both pins when the
  installed Sentry SDK requires glob 14.
- `minimatch` 11.0.4 under `@ts-morph/common` and
  `@typescript-eslint/typescript-estree`, which ask for minimatch 10. Both call
  only `minimatch(path, pattern, options)`, which minimatch 11 keeps. Remove
  these pins, and the same pin in `fixtures/shadcn-theme-consumer/base-nova`,
  when those parents require minimatch 11.

`zod` 3.25.76 still carries an advisory, because the pinned shadcn CLI 4.14.1
requires zod 3. It arrives only through the shadcn CLI, which runs in local
registry tooling and is not part of the deployed site.
