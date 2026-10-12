# Local library boundary

This repository has two intentionally separate source surfaces: the
shadcn-installable registry and the reusable source tree used by the docs app.
Neither is a published npm package.

## Installable registry

- `registry.json` owns the web component definitions, including package
  dependencies, namespaced registry dependencies, files, and install targets.
- `registry/glassyui/*` owns the editable registry source.
- `public/r/*` contains generated static registry payloads.

A consumer adds the hosted registry namespace to `components.json`:

```json
{
  "registries": {
    "@glassyui": "https://glassyui.com/r/{name}.json"
  }
}
```

It can then add an item with the pinned CLI:

```bash
pnpm dlx shadcn@4.14.1 add @glassyui/glass-button
```

For unpublished local changes, substitute the loopback registry URL
`http://127.0.0.1:3000/r/{name}.json` while the local docs app is running.

The registry's `glass-provider` file imports its delivered stylesheet.
Namespaced dependencies pull that provider into higher-level component installs,
so the supported registry path does not require a separate manual CSS copy or a
provider wrapper merely to render.

## Reusable source tree

- `src/components/liquid/index.ts`
- Every component exported by that barrel
- `src/components/liquid/provider.tsx`
- `src/components/liquid/liquid-filters.tsx`
- `src/components/liquid/internal/*`
- `src/lib/liquid/preferences.ts`
- `src/styles/liquid.css`

This source tree does not import its stylesheet from the provider. A consumer
that copies these files directly must load `src/styles/liquid.css` in its global
style layer and include each copied component's local helper imports.

## Optional behavior

- `PreferencesProvider` is needed only for synchronized and persisted
  preferences. Primitives otherwise use defaults and follow the system's
  reduced-transparency setting.
- `LiquidFilters` is needed only for legacy CSS that references
  `url(#lg-liquid-refraction)`.
- `GlassSurface` generated refraction uses a supplied decorative
  `refractionBackground` and creates its own per-surface filter. It does not
  sample an arbitrary backdrop. `refractionBackgroundSpace="viewport"`
  counterpositions that supplied replica so it remains fixed while the surface
  scrolls.

## Outside the reusable boundary

- `src/app/*`
- `src/components/site/*` and `src/components/docs/*`
- `src/components/component-gallery.tsx`
- `src/components/debug-panel.tsx`
- `src/components/performance-overlay.tsx`
- `src/components/preference-controls.tsx`

Run the registry checks after changing a shared component contract:

```bash
pnpm check:registry
pnpm registry:check-generated
pnpm check:native-registry
```
