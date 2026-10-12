# Anti-slop linting

Run `pnpm run lint` from the repository root. The existing linter, where
present, remains part of that command. `pnpm run lint:anti-slop` runs the
repository-owned Oxlint rules alone, including nested JavaScript/TypeScript
source. Native Swift, Rust, C# and Kotlin code is outside this tool's scope.

`oxlint` and `@oxlint/plugins` are development-only dependencies, pinned to
matching versions. The plugin lives in `anti-slop/`; see its `UPSTREAM.md` for
the exact source revision. Keep the plugin out of application typechecks and
formatters so it remains a reviewable upstream copy with documented local
deviations.

These are opinionated rules. Installation does not migrate existing source; a
lint failure lists actual findings and must not be presented as a passing check.
Customize policy deliberately and preserve local changes when updating.

New checkouts install dependencies using the repository's package manager. No
machine-global plugin, credential, background process or paid service is
required. In repositories containing independent nested packages, install the
root development dependencies as well to use this lint command.
