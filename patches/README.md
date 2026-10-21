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
