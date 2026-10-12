# Anti-slop provenance

Source: https://github.com/dmmulroy/anti-slop

Revision: `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`

Copied from `skills/install-anti-slop/assets/anti-slop/` at that revision.
The installed skill bundle was compared byte-for-byte against this upstream
snapshot before copying. Recover the pristine files from that immutable commit.

Installed entry points: `index.ts` and optional `effect/index.ts`.
All generic rules and `oxc/no-accumulating-spread` are enabled at error severity.
Effect rules are not enabled: no direct Effect dependency in this repository.

Local source deviations in `shared/dictionary-types.ts`:

- Remove the unused pure helper `isPopulatedObjectExpression`.
- Keep the live `WideningTargetKind` type private to its module.

Preserve these deviations on updates. Additions: this provenance file, the
upstream root MIT LICENSE, and a local private package.json declaring type=module
for unambiguous Node loading.
The nested `vendor/eslint-stylistic/LICENSE` and `UPSTREAM.md` are preserved.
