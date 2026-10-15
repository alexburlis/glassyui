# Lead with component discovery and make installation complete

## Plan Metadata

Schema: 2

Kind: feature

State: executing

Risk: high

Boundary: external-or-stateful

Mutation: external

## Purpose / Big Picture

A visitor first chooses a component, sees its preview and then installs the
version they need. The homepage hero has Browse components as its primary action
and Star on GitHub as the secondary button on its right. Each component's
Installation section offers CLI and Manual modes, with npm, pnpm, yarn and bun
recipes. The existing React/React Native choice determines every installation
and usage detail on that page.

The original design and planning artifacts were delivered in commit d02ef04.
Alex subsequently approved implementation and live delivery to main, adding Star
on GitHub as the secondary hero button. This revision executes that scope.

## Scope Contract

Requested outcome: Implement the approved component discovery and installation
flow, with a secondary Star on GitHub hero button to the right of Browse
components; verify it, commit, push to main and confirm the live rollout.

In scope: The approved UI, shared recipes, complete generated registry payloads,
affected text/docs/search/share surfaces and checks, these living plan/design
artifacts, exact scoped commit and push to main, and the existing website's
normal deployment trigger and bounded verification.

Out of scope: Component behavior, glass optics, branding or keynote animation
changes; a custom npm installer, new package listing/account/service; analytics;
provider spend; unrelated local commits and upstream dependency changes.

Authority: Alex approved all other design details and explicitly requested
“commit and push it live into main.” This authorizes implementation, the hero
secondary button, verified scoped commit, main push and its existing rollout. It
does not authorize new spending, services or deployment settings changes.

Acceptance signal: Local static/build, clean web/Expo CLI and Manual installs,
platform/clipboard/loading/error/keyboard/mobile browser checks pass. Remote
main contains the verified commit, and the running website serves the new hero
and complete item/installation flow with healthy deployment and runtime signals.

## Current Facts and Sources

Inspection date: 2026-10-15. Paths are relative to this repository.

- `src/app/page.tsx` already contains Browse components, Get started, a copied
  default install command and Replay intro. The lower installation walkthrough
  repeats initialization, registry mapping and the same button command.
- `src/components/site/install-command.ts` defines
  `pnpm dlx shadcn@4.14.1 add @glassyui/glass-button`. The shared command also
  feeds `src/components/site/site-search.tsx` and the installation stage in
  `src/components/share/share-studio.tsx`.
- `src/app/components/[slug]/page.tsx` repeats a command in the header and the
  Installation section. It already has Preview, Usage, examples and API
  sections. `src/components/docs/native-component-doc.tsx` handles native-only
  pages separately, so both page owners need the new installation UI.
- `src/components/docs/component-docs-data.ts` follows the namespaced source
  registry graph to derive installed files and packages. Its closure is useful
  existing machinery; do not create a second handwritten inventory.
- `registry.json` and `registry-native.json` are the authoring graphs;
  `public/r` and `public/r/native` contain generated item JSON. The web button
  currently points to `@glassyui/glass-provider`; the native button points to
  its provider and surface. A URL for only the root item cannot resolve those
  namespaces in an unconfigured project.
- `src/lib/native-usage-source.ts` correctly appends
  `&& npx expo install --fix`. Native examples can import additional components.
  `src/lib/launch-example-source.ts` similarly derives complete web example
  installs from real source imports. Preserve both behaviors.
- `scripts/smoke-registry-install.mjs` and `scripts/smoke-expo-consumer.mjs`
  insert a mapping before running shadcn. Those checks currently establish the
  configured installation path, not a first installation by URL without a
  mapping.
- The pinned CLI is shadcn 4.14.1. Its supported item schema accepts complete
  `files` and npm `dependencies`; its add command prompts to create
  `components.json` when missing. That prompt is not a claim that any arbitrary
  framework can install the library, and it does not initialize Expo apps.
- Governing design and checks are `DESIGN.md`, `CONTRIBUTING.md` and
  `docs/launch-readiness.md`. The package scripts remain the toolchain contract.

Observed baseline: In temporary clean consumer apps, the live hero command
exited 1 with Unknown registry without a mapping and exited 0 after the mapping
was added, creating ten files. A direct root URL also failed on its namespaced
provider dependency. A temporary root payload with the provider expressed as a
full URL installed successfully without a mapping. These are CLI installation
observations, not proof that a production UI change has shipped.

A second bounded experiment served complete items on loopback from the
checked-in payloads. The web button installed without a mapping. Comparing two
clean consumers, one using the original namespaced graph and one using the
complete item, produced the same ten destination files and identical installed
bytes. Comparing raw payload content directly to installed content was not a
valid identity check because shadcn transforms source during installation; the
two-consumer comparison accounts for that. A native complete-item dry run
resolved eight files and the two declared packages, `expo-blur` and
`expo-glass-effect`. It did not install or bundle an Expo app. All experiment
consumers and dependencies were removed after their checks.

A multi-item experiment then installed complete button and dialog payloads in
one invocation with no mapping or overwrite flag: the CLI created the expected
13 unique files, including their shared dependencies, without an overwrite
prompt. The broader real example builds remain implementation acceptance.

The original design is authored by the workflow worker using the live-verified
selection `claude-code / claude-opus-5-5 / max`, workflow
`wfr_dbc23ac4-8b49-41cd-9882-9ac64c091ce4`. The parent owns the technical plan,
integration and final verification. No third-party library identity, code,
layout, wording or reference link belongs in the deliverables.

## Plan of Work

### 1. Bind the original design to the existing product

Use `docs/design/component-installation.md` as the interaction specification and
its sibling HTML as the visual reference. Preserve the site's own palette, type
stacks, control sizes, component demonstrations and source-copy model. The mock
demonstrates layout and interaction; it does not prove the production glass
renderer or native rendering.

Remove the hero's default install chip and Get started action. Keep Browse
components and Replay intro in their existing visual system. Place a neutral
GlassButton linking the existing public source repository to its right, labelled
Star on GitHub and using one outline star. Keep the headline, announcement,
keynote and live desk. Replace the lower homepage's code-heavy setup walkthrough
with three concise steps: choose a component, install it your way, make it
yours. Link those steps to the existing catalogue and setup docs. Do not
redesign adjacent sections.

On component pages, remove duplicated header install chips. Keep source and
guide links. Put one Installation section after Preview and before Usage. Retain
examples and API below Usage. Native-only pages keep their truthful content
instead of acquiring a fabricated web preview.

Remove the equivalent arbitrary button-install chip from the `/mobile` hero,
preserving that page's existing Expo setup and browsing actions. Its explicitly
labelled web/native Glass Button comparison examples keep their purpose and use
the shared recipe helper; no adjacent mobile-page redesign is required.

Outcome: The homepage leads to discovery and each component page owns its
installation choices. Stop if the work requires changing the component or
keynote behavior; that is outside this design change.

### 2. Publish a complete item at each existing registry URL

Keep the namespaced authoring graphs. Their source closures and existing
developer tooling already work. Add one deterministic publication transform
after the official pinned shadcn build: each published component item includes
the files and npm dependencies from its full source dependency closure and omits
internal `registryDependencies`. Use the same item URL and item name. There is
no second installer or alternative production endpoint.

Implement the transform in `scripts/build-install-registry.mjs`, called by
`registry:build`. Run the official build into an owned temporary directory, then
publish the transformed results. Visit dependencies before their parent;
deduplicate identical target files and identical declared packages. A repeated
target with different content or incompatible declarations is a visible build
failure, not a last-writer-wins overwrite. No generic configuration merger is
needed: current component closures contribute files and package dependencies.
Preserve a root item's schema, type, title, descriptions and metadata.

Leave the CSS-only theme and already complete drop-in items unchanged. Rebuild
both public catalogues so their item descriptions agree with the actual item
payloads. Do not edit generated JSON by hand. Run the same transform in
fresh-generation comparison checks, with expected closures calculated from the
source graph rather than trusting the output under test.

Correct the stale Glass Button description in `registry.json` to the existing
component documentation's description before rebuilding: the current registry
says the button swells, while the docs and `DESIGN.md` say a press sets it down.
The published item and catalogue then inherit the corrected source metadata.

This is preferred to embedding production-host dependency URLs: a complete item
installs from production or a loopback server with no namespace mapping, and
local tests cannot accidentally fetch dependencies from the live service. It
also supplies Manual mode with the exact complete source inventory. Deletion
alone would leave the current commands broken; a custom npm wrapper would
duplicate the existing CLI; a second publication namespace is unnecessary.

Existing configured namespace commands remain compatible because they resolve to
the same item URLs. Keep optional namespace setup documentation for existing
consumers, but remove it as a prerequisite for the primary URL install path.

Outcome: Every offered URL installs its complete closure without adding a Glassy
UI registry mapping. Stop on a conflicting closure; repair the source
declaration before generating publication output.

### 3. Derive recipes and Manual content from one installation contract

Add a small shared recipe helper in `src/lib/install-command.ts`. Its inputs are
platform, item names and package manager. Validate item names against their
existing catalogue, deduplicate example items, retain shadcn 4.14.1 and form
URLs under `https://glassyui.com/r/` or `/r/native/`. Do not introduce an npm
runtime package or environment variable.

| Manager | Component invocation                     | Manual web dependencies |
| ------- | ---------------------------------------- | ----------------------- |
| npm     | `npx shadcn@4.14.1 add ITEM_URLS`        | `npm install PACKAGES`  |
| pnpm    | `pnpm dlx shadcn@4.14.1 add ITEM_URLS`   | `pnpm add PACKAGES`     |
| yarn    | `yarn dlx shadcn@4.14.1 add ITEM_URLS`   | `yarn add PACKAGES`     |
| bun     | `bunx --bun shadcn@4.14.1 add ITEM_URLS` | `bun add PACKAGES`      |

Yarn's recipe is for modern Yarn with `dlx`; do not claim compatibility with
Yarn Classic. Verify command-runner support before freezing recipes. Native CLI
recipes append the visible `&& npx expo install --fix` step regardless of the
runner used for shadcn. Manual native packages use `npx expo install PACKAGES`
so Expo selects versions for the consumer SDK. Setup docs retain the required
Expo `components.json`, framework and native-provider instructions.

Expo documents lockfile-based selection of npm, pnpm, Yarn and bun in its
[CLI package-manager contract](https://docs.expo.dev/more/expo-cli/#install-package-managers).
Keep that documented behavior separate from the future actual fixture smoke. In
`src/components/docs/expo-setup.ts`, remove the primary example's mandatory
Glassy UI mapping while preserving the required aliases and framework fields.
Show the old namespace mapping separately as optional compatibility guidance.

Change `component-docs-data.ts`, `native-usage-source.ts` and
`launch-example-source.ts` to use the helper. Keep the source graph as the
documentation metadata owner. Serve Manual source from the complete existing
item payload, avoiding separately authored code samples for implementation
files. Fetch it on the first Manual selection; do not server-render every
closure's source into every initial page. No new API is necessary.

Update `/docs`, the installation and Expo guides, `/llms.txt`, `/llms-full.txt`
and `src/lib/component-markdown.ts` to describe the same primary URL recipe.
Keep the existing CSS theme/drop-in instructions and overwrite warning intact.
Replace global search's arbitrary Copy install command action with a link to
installation guidance. The installation share stage is an explicitly labelled
Glass Button example and uses the same recipe helper; recapture only its
affected share card if the visible recipe changes. That stage is the docs card
in `src/app/share-studio/[...card]/page.tsx`: on a development server, run
`node scripts/capture-share-cards.mjs http://127.0.0.1:3000 docs.jpg` to refresh
only `public/share/docs.jpg`. The studio is development-only; do not run its
capture against the production-build server used for release smokes. Remove the
old global constant only when all of its consumers have moved.

Outcome: A page, its copied command, its plain-text representation and the
downloaded item agree. Stop if an example's imported item is absent from its
derived recipe; fix that source-to-item mapping.

### 4. Implement one installation panel for both page owners

Add `src/components/docs/component-installation.tsx` and a small installation
preference module only if shared state needs it. Reuse `CopyCodeBlock` and
existing Glassy UI controls; keep styling in the established docs styles. Both
`src/app/components/[slug]/page.tsx` and
`src/components/docs/native-component-doc.tsx` use this panel.

Expose the existing platform store's read hook from `platform-switch.tsx` for
this real production caller. Pass the web/native installation descriptors into
one panel instance; it selects the descriptor through that same hook. A
native-only page fixes the panel to its one available platform. Do not infer the
active platform from DOM visibility or create another selection store.

The panel receives a known item, active platform, title, derived packages and
payload URL. CLI/Manual and manager choices follow the design specification. The
manager defaults to npm and persists under `glassy-ui-docs-package-manager`,
following the existing stored-choice pattern; the repository's own pnpm tooling
is unaffected. CLI/Manual defaults to CLI on a new page and remains selected
when the platform changes. Keep the existing platform storage key and URL
override semantics. Hide inactive platform panels from focus and accessibility
trees. Changing platform must invalidate or abort a pending Manual request so
web files cannot appear under native instructions. The two platforms
intentionally use some identical destination paths; they are choices for
separate target apps, not a promise that both implementations can be installed
into the same directory together.

Manual mode includes the package command, every required file at its target
path, complete source, required styles and the existing provider/setup guidance.
Use the original design's grouped file rows: the component first, then shared
dependency groups. Open the main file initially; leave other rows closed and
bound each open code viewer to 360px with internal scrolling. Reveal/highlight
file source on demand instead of expanding every long file at once. Copy file
copies the whole selected file, including lines beyond the visible viewport. The
stylesheet's import already comes from the web provider; do not tell a consumer
to import the same stylesheet twice. Display one concise alias note where
copying source requires adapting project paths.

Replace the old direct-versus-complete registry declaration accordion with this
useful Manual inventory. Keep registry metadata in its existing source and JSON
links. Extend `CopyCodeBlock` with CSS or plain-text rendering for stylesheets
rather than labelling CSS as TSX; no syntax-highlighting dependency is
necessary.

Show a real loading state while source loads and a visible Retry action if the
request or schema validation fails. Do not substitute stale source or silently
switch to another endpoint. Copy success is announced only after the clipboard
promise succeeds. Copy failure leaves the source selectable and reports the
failure. Reset feedback when the copied content changes.

Outcome: Every installation control changes the visible and copied content
together, without breaking platform choice or existing preference controls.

## Concrete Steps

All commands run from the repository root unless stated otherwise.

1. Preserve the original planning delivery on
   `docs/component-installation-design` at d02ef04 and its Chrome/review
   receipts.
2. Inspect the actual public-main source and local Next.js guides before
   editing. Transfer scoped changes while preserving newer public code and both
   unrelated local main commits; do not treat the private planning history as
   the live source.
3. Before production edits, extend the existing browser/consumer checks with the
   failure cases in Validation and Acceptance. Use the test-audit skill. Do not
   add unit tests that mirror command-string construction.
4. Add the deterministic publication transform and update `registry:build`,
   `scripts/check-generated-registry.mjs`, `scripts/check-registry.mjs`,
   `scripts/check-native-registry.mjs` and `scripts/smoke-registry-routes.mjs`.
   Keep source-graph import validation.
5. Run `pnpm registry:build`, `pnpm registry:check-generated`,
   `pnpm check:registry` and `pnpm check:native-registry`.
6. Add shared recipes and the installation panel, update the two page owners,
   homepage and affected documentation consumers, then format exact paths.
   Update the keynote/site-motion selectors that currently require the removed
   hero chip or secondary hero action; retain their real behavior checks.
7. Run `pnpm exec oxlint --fix CHANGED_SOURCE_FILES`, then
   `pnpm exec oxfmt CHANGED_FILES`. Run `pnpm lint`,
   `pnpm exec oxlint --deny-warnings --format=agent`,
   `pnpm format:check CHANGED_FILES`, `pnpm check:dead-code` and `pnpm build`.
8. Serve the built app on loopback using
   `pnpm exec next start -H 127.0.0.1 -p 3100`, reusing a suitable existing
   server if present. Use the dev-servers skill before opening a server.
9. Run the browser, clean-consumer and served-route proofs below. Repair a
   failure and rerun its original proof plus the affected checks. Do not claim
   publication or native-device behavior from a local bundle.
10. After verification, commit exact owned paths. Refresh public main, preserve
    the independent CI owner's changes if already integrated, then push normally
    under Alex's explicit main/live authority. Confirm the resulting deployment
    SHA and live user flow within the documented bounded window.

## Interfaces and Dependencies

| Owner                                              | Contract                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry.json`, `registry-native.json`            | Editable component graph, direct files and declared packages; retain source namespaces.                                                                                |
| `scripts/build-install-registry.mjs`               | Official build followed by complete-item publication; accepts an explicit output directory for fresh-generation checks; cleans its owned temporary build in `finally`. |
| `public/r`, `public/r/native`                      | One complete payload per existing item URL; deterministic dependency/file order, no unresolved internal namespace.                                                     |
| `src/lib/install-command.ts`                       | One pinned CLI recipe for a known platform, item list and manager; no state, network or new runtime dependency.                                                        |
| `component-docs-data.ts`, `native-usage-source.ts` | Existing component identity, source graph, example imports and platform metadata.                                                                                      |
| `component-installation.tsx`                       | CLI/Manual interaction, active-manager recipe and active-platform source selection.                                                                                    |
| `copy-code-block.tsx`                              | Exact displayed/copy source and truthful clipboard feedback.                                                                                                           |
| `platform-switch.tsx`                              | Existing platform selection, persisted key and linked override.                                                                                                        |

No new library, backend, account, telemetry event, package publication or
installer process is required. Do not replace source graph validation with
checks that merely trust the generated payload. Existing aliases and target
placement retain their current contract; the design does not expand arbitrary
framework or alias compatibility.

## Validation and Acceptance

### Before-state baseline

Proof ID: component-discovery-installation

Artifact: The Current Facts and Sources section above; temporary clean-app CLI
observations recorded during this planning task; future baseline screenshot and
manifest under `.artifacts/component-installation/before`.

Command: On a later implementation turn, run the extended
`node scripts/check-platform-switch.mjs http://127.0.0.1:3100 .artifacts/component-installation/before`
against the unchanged baseline. In an initialized temporary consumer with
`registries: {}`, run the pinned CLI against the served button item URL. Use the
existing consumer fixture and cleanup lifecycle, without adding a mapping.

Expected signal: The baseline exposes the arbitrary hero command, lacks the
CLI/Manual and manager controls, and the unconfigured URL install fails on its
namespaced provider. Retain these intentional baseline failures; unrelated
network or setup errors are not the expected reproduction.

### Post-change behavioral proof

Proof ID: component-discovery-installation

Artifact: `.artifacts/component-installation/after` screenshots, clipboard
observations, hashed result manifest and browser trace;
`.artifacts/component-installation/consumer` install and bundle reports.

Command: Run the same browser check against the changed build, followed by
`pnpm smoke:registry-routes http://127.0.0.1:3100`,
`pnpm smoke:registry-install http://127.0.0.1:3100`,
`pnpm smoke:expo-consumer http://127.0.0.1:3100 .artifacts/component-installation/consumer`,
`GLASSYUI_BASE_URL=http://127.0.0.1:3100 pnpm smoke:docs-routes`,
`pnpm check:agent-discovery http://127.0.0.1:3100`,
`pnpm smoke:release-ui http://127.0.0.1:3100 .artifacts/component-installation/release-ui`,
`pnpm check:keynote http://127.0.0.1:3100 .artifacts/component-installation/keynote`
and
`pnpm check:site-motion http://127.0.0.1:3100 .artifacts/component-installation/site-motion`.
Use each script's inspected CLI syntax if it changes before execution.

Expected signal: All of the following hold:

- The hero has Browse components and working Replay intro; no default install
  chip or redundant Get started action remains. Browsing reaches the catalogue
  and a chosen component. Keynote completion and scroll alignment still work.
- At 390px and desktop widths, all offered manager choices display and copy the
  correct pinned recipe. A real clipboard read matches the visible complete
  command. Manual Copy file matches the complete selected source.
- Existing platform choice and persistence still work. Native-only pages expose
  native installation, with no fictitious React option. An in-flight web source
  request cannot replace the current native file selection.
- CLI/Manual and file selection work by keyboard with truthful labels, visible
  focus, correct selected states and one copy announcement. Inactive panels
  expose no focusable controls. Loading, network failure, Retry and clipboard
  refusal can be induced and never display false success.
- Dark/light, reduced motion and reduced transparency do not prevent reading or
  operating the install controls. At 200% zoom controls wrap; long source lines
  scroll inside the code block without widening the page.
- A clean web consumer with no Glassy UI mapping installs the served URL, builds
  and renders the existing real component/interaction smoke. A consumer with an
  existing mapping continues to install that namespace successfully.
- A clean Expo consumer with its required configuration but no Glassy UI mapping
  installs native URLs, performs SDK matching, type-checks and bundles for iOS,
  Android and web. This does not establish physical-device rendering.
- Manual installation of the complete web button and native button closures into
  fresh respective consumers produces equivalent files/imports and passes their
  build or bundle checks. Every file and declared package is accounted for by
  content; a filename list or a successful download is insufficient.
- Consumer recipes for examples include their additional imported components.
  The text/Markdown routes and registry catalogues describe the same install
  path. Source snapshots or stale fallback commands are never presented as live.

The primary install regression belongs in the existing clean-consumer checks;
the UI matrix belongs in the existing platform/browser checks. For package
manager runners, exercise npm and pnpm against clean consumers and verify the
actual modern Yarn and bun runner capability before offering their recipes.
Install missing free local tooling only if it is within current authority; never
replace an unverified runner with a claimed pass.

### Planning-delivery verification

Artifact: The three planning artifacts and the final documentation commit.

Command: Run the v2 validator specified by the current plan policy; run the
local formatter and its exact-path check; inspect the standalone HTML in
headless Chrome at 1440px and 390px and exercise its controls; verify the
documentation branch with
`git ls-remote origin refs/heads/docs/component-installation-design`.

Expected signal: The structural validator and the single independent plan lane
pass; the original mock works at both sizes with no page overflow; owned content
contains no competing library identity or link; only the three owned artifacts
are committed and their remote tip matches the local commit.

### Verified design receipt

The requested Opus 5.5 maximum-reasoning workflow completed successfully and
produced the original HTML and design specification. The design author reports
38 passing Chrome checks at desktop and 390px. The parent independently ran 27
checks on the final layout and interaction code, inspected desktop and phone
screenshots, and verified all eight CLI strings against actual clipboard
read-back, 10/8 Manual file inventories and truthful excerpt copies, refusal
feedback, keyboard method tabs, preference operability, no page overflow and no
uncaught page errors. A subsequent prose-only clarification distinguishes source
supplied to the CLI from source transformed during installation.

The artifact intentionally embeds labelled source excerpts, uses CSS to stand in
for the production material, and keeps its interactions local. Browser-wide
manager persistence, asynchronous payload fetching and full-file Manual copies
are implementation requirements, not claimed capabilities of this mock. The
parent resolved the specification's ten integration choices into explicit
instructions. No product decision is left pending.

All clean-consumer experiment directories and temporary inspection screenshots
were removed and their absence verified. The design author's scratch was also
removed. The retained deliverables are these three small repository artifacts;
no compiler output, browser process or disposable checkout remains.

## Context / Tool Boundary

This planning request uses repository files, the existing browser/CLI tools and
one explicitly requested design worker through the existing provider context.
The model, provider and maximum-reasoning selection were checked in the live
catalogue before dispatch. No fast service tier, paid provider activation,
additional usage setting, account or billable resource is authorized.

The implementation branch descends from public `origin/main`; the original
design commit belongs to the separate private planning history. Preserve both
unrelated local main policy commits. Push the verified implementation tip to
remote main with a normal fast-forward; do not force-push, rewrite unrelated
history or change deployment settings. Main push runs CI and the existing
configured rollout. Verify the exact remote SHA before live checks.

The product proofs use an explicit loopback server and clean temporary
consumers. Complete payloads must not resolve a dependency through production
while supposedly testing a local build. Package downloads use public registries;
they require no new account or credential. Clipboard refusal and source-fetch
failure remain visible UI states. The current request supplies authority for
this exact website rollout.

Keep small deliverables in the repository. Temporary consumers, dependencies,
screenshots used only for inspection and compiler output belong in exact owned
temporary directories with cleanup in `finally`. Retain only required small
proof under the then-current storage policy and verify scratch removal.

## Review Record

### Installation contract and acceptance

Reviewer: `/root/installation_plan_review`, independent of the plan author and
the Opus design author.

Scope: Discovery to per-component installation, complete-item publication,
platform and Manual isolation, Expo contracts, acceptance quality and current
authority.

Plan revision: R2 implementation and rollout, 2026-10-15; installation sections
retained from R1; rollout delta SHA256
`2f2a5d9ae7603da1c798042fa204f2de4bf8e3f9e2c6f673067e7f8090ba347e`.

Evidence inputs: Both source registries and generated payloads; installed shadcn
4.14.1 schema; package scripts; registry, served-route, web/Expo consumer and
platform checks; homepage and both component-page owners; recipe, example and
clipboard owners; design system, contributing and launch docs; CI workflow.

Disposition: Pass; no blocking findings. The reviewer independently assembled
all 36 web and 29 native component closures in memory: all resolved, were
acyclic, contained no conflicting target content and passed the installed item
schema. This supports publication feasibility, not consumer or UI acceptance.
The structural validator passed. One initial lane used; no closure lane was
needed. The parent subsequently clarified the existing platform-hook interface
and CSS viewer treatment without changing scope, publication architecture or the
acceptance meaning. Actual visual-design verification is a separate parent
delivery check, not another plan-review lane.

### Main and live rollout

Reviewer: `/root/rollout_plan_review`, independent of the implementation author.

Scope: Main/live authority, Git preservation, rollout/recovery bounds and
verification.

Plan revision: R2 implementation and rollout, 2026-10-15; installation sections
retained from R1; rollout delta SHA256
`2f2a5d9ae7603da1c798042fa204f2de4bf8e3f9e2c6f673067e7f8090ba347e`.

Evidence inputs: Complete plan, current request, plan policy, CI workflow,
package scripts, release verification document, Coolify policy and actual branch
ancestry.

Disposition: Pass; no blocking findings. Preserve unrelated local main commit
2e34f24 and use a normal fast-forward main push. Before publication verify the
actual existing Coolify repository/main linkage and bind the live smoke to the
resulting deployment SHA. This records the second required initial high-risk
lane; the previous installation-contract lane remains valid.

## Idempotence and Recovery

Registry generation is deterministic and fails visibly on conflicting source
closures. Rerunning it replaces only owned generated outputs. Browser checks use
isolated contexts; consumer checks use owned temporary apps and cleanup.

The rollout uses the existing main trigger, with no configuration or account
changes. Observe for at most 15 minutes, with two unchanged checkpoints ending
repeated polling. Success requires the new hero and complete payloads live,
healthy service and no new crash/repeated severe runtime errors. Stop on failed
deploy, failing live install/hero or new severe runtime errors. Diagnose
locally; do not change providers, disable checks or repeatedly redeploy.
Preserve the previous remote SHA for a reviewable revert; production rollback
remains an explicit user decision unless already authorized for the exact
effect.

## Progress

- [x] Original design and elevated-risk installation-contract review delivered.
- [x] Current implementation/main/live authority and GitHub hero correction
      recorded.
- [x] Implement complete publication, recipes, UI and related documentation.
- [x] Pass static/build, clean consumer and browser acceptance.
- [ ] Push verified commit to main and confirm live rollout.

## Decision Log

2026-10-15: Alex approved the original design and implementation, requested a
secondary Star on GitHub button on the right, and authorized main/live delivery.
This materially expands the original plan-only scope; the existing installation
review remains relevant, and a separate rollout/recovery review is added before
production mutation. No new provider spend is permitted.

## Implementation Storage

Root-owned disposable scratch: `/tmp/glassyui-implementation-Bzf7WV`, created
for baseline/after browser evidence, local smoke output and inspection
screenshots. Restore inputs are the source commit and documented check commands.
Expected size is under 500 MB before producer cleanup. Retain only small final
reports and selected screenshots outside scratch; remove scratch and verify
absence after all bound proofs finish. Registry and consumer workers own and
close their own explicit temporary build/consumer paths. Existing shared `.next`
is not newly claimed disposable data.

### Production-source reconciliation

Coolify application `vcmtmquuccqckdxefpqkmado` deploys `alexburlis/glassyui`
main, follows HEAD and has automatic deploy enabled. The planning checkout's
private origin is a different history. Implementation was transferred by scoped
hunks into an isolated public-main worktree at 5f6b347; newer native
reference/navigation, React 19/theme setup, registry engine and consent/CI
changes were retained. Generated payloads are rebuilt from that public tree, not
copied from the older private sources. Push the public branch tip to its
existing public main; do not modify deployment linkage or publish an unrelated
source snapshot. Preserve private main2e34f24 and public main ecf3b5b.

The public source worktree is `/tmp/glassyui-implementation-Bzf7WV/live`, owned
by this task. Dependencies/builds are disposable, expected under 5 GB; restore
inputs are public5f6b347, scoped implementation commit and documented checks.
Remove only after exact commit survives on remote main and required proof is
retained. User additionally requested a star icon and Opus5.5/max consultation;
the first worker failed before content with an expired OAuth session, and a
bounded retry uses the existing healthy pooled subscription with no routing,
account, plan, credit or spending change.

### Verification checkpoint

2026-10-15: Exact Opus5.5/max consultation completed in workflow
`wfr_e2a85fed-e614-4d6d-8ba2-60a9908262c8`; its outline star, neutral secondary
hero button and narrow-screen stacking are implemented and visually inspected.
Production build, full lint/format, generated registries, native
closure/dead-code checks and plan validation pass. Expo URL and Manual installs
pass file equality, type-checking and iOS/Android/web bundles; clean consumers
were removed. Modern Yarn4 and Bun runners were actually launched.

The production installation browser check passes all manager/platform recipes,
clipboard equality, full Manual files, lazy loading, Retry, stale requests, copy
refusal, keyboard controls and preserved native route/reference behavior. Served
registry/docs and agent-discovery checks pass. Standalone harness static files
were corrected before these checks; no application fix was needed. Web CLI and
Manual builds plus Chromium consumer interactions pass; installing the pinned
missing Firefox/WebKit binaries enables the unchanged full three-engine rerun.

The independent CI owner uses public PR7 and owns five CI paths; the only
overlap is a distinct CONTRIBUTING paragraph. Refresh main before either push
and preserve whichever verified scope lands first. No application pin or
provider/deployment setting change is part of this task.

### Protected-main delivery contract

Fresh GitHub readback confirms main protection enforces administrators, requires
`release-gate` and requires an up-to-date base. Publish the verified feature
branch and use the normal PR checks/merge path; never bypass protection or set a
synthetic status. The merged main commit triggers the existing Coolify rollout.
Preserve a concurrent verified CI change if it lands first, and rerun the
existing required gates on the resulting merged tree.

The final evidence binding review confirmed the stored Expo composite hashes and
all14 installation-browser screenshot hashes. Against the candidate snapshot,
only the living plan and release-UI check changed; no product payload/source
bytes changed after the passing build and consumer proofs. Mac ordinary work was
explicitly released; no maintenance or fleet gate remains on this website task.

### Hero hit-area repair

The full keynote check reproduced a real default-motion regression after the
shorter hero: the negative pinning margin puts the empty `.turn` and its
`.home-desk` section over both CTA centres. Browser hit-testing returned those
containers rather than the links. A harmless browser-only CSS trial restored
both hit targets and actual Browse navigation while preserving the live desk
menu. The source repair disables pointers on the empty section only while
`data-keynote` is active; existing interactive desk/phone hosts retain their
explicit pointer behavior. No animation geometry or material is changed.

The keynote check now guards both hero actions. A separate Firefox delayed-
hydration wheel timeout did not reproduce on the unchanged original flow; its
predicate and2second threshold stay intact. Rebuild and rerun the original
keynote check and affected site-motion/platform checks after the scoped CSS
repair; prior registry/consumer proof remains bound to unchanged payload bytes.

### Final local verification and cumulative CI integration

The complete web proof passes all36 items/50 files and installed interactions in
Chromium, Firefox and WebKit. The Expo composite passes all29 items/45files and
URL/Manual type checks plus six platform bundles; no device rendering is
claimed. The final installation browser replay passes. The full16-state
release-UI matrix passes; reviewed existing moderate accessibility findings
remain nonblocking. The scoped hero pointer repair passes both actions and
retains the live desk. Rebuilt production output passes TypeScript and64routes.

Two measurement defects in existing browser checks were reproduced before
repair. A screenshot before the opener sample let ordinary playback cross its
absolute cutoff; capture now follows measurement, with thresholds unchanged. The
lower CTA's350ms return transition could complete between driver reads: a
controlled242.6ms delay produced zero driver intermediate samples but three
prearmed browser samples. The no-departure control correctly rejected both. The
check now records browser frames before pointer movement and retains its
original motion thresholds. Firefox's native anchor rounds integer scrollY while
the heading keeps a fractional document position: two native round trips
reproduce top−0.28334px. Comparing the rounded top accepts native alignment;
a2px displaced negative control still fails in all three engines. Firefox's
one-second keyboard skip timeout did not reproduce in three traced cases; its
deadline remains unchanged. The original affected suites run again after these
measurement repairs. No further product animation or material change is made.

The CI owner explicitly handed final delivery for its verified scope to this
thread. Preserve signed0250964 and29d0f126, tree
`c6a28937593d1f46699e0c89687fba54298974c8`, through one cumulative checkedPR.
Verify the five CI code postimages and exact CONTRIBUTING CI excerpt against its
owner receipt, retaining this plan's separate generator documentation hunk.
Require all selected hosted owners, including both stock themes and both
drop-ins, then a normal protected merge, successful mainCI and exact healthy
Coolify/main release header with quiet logs. The original failedPR7 is not
passing acceptance; its owner retires it only after final containment.

2026-10-15: The final unchanged production runtime passes the original full
keynote and site-motion suites in all three engines after the verified
measurement repairs; final platform/installation replay, full lint and full
formatter checks pass. Required installation/build/browser acceptance is now
complete. Publication and live acceptance remain the next protected step.
