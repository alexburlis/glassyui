---
name: glassyui
description:
  Build or restyle React, Next.js, and Expo interfaces with Glassy UI. Use for
  its glass components, shadcn theme or drop-in sets, and glass-style web or
  native screens built with this library.
---

# Build glass interfaces with Glassy UI

Glassy UI installs editable source into the user's app through the shadcn CLI.
Use the app's existing framework, import aliases, package manager, and theme.

## Choose the right install

Read `package.json` and `components.json` before selecting a registry.

| App and requested change                                                      | Registry item                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| React 19+ with Tailwind CSS 4, adding Glassy UI components                    | `@glassyui/<item-name>`                                                                     |
| Existing stock shadcn/ui components, changing their appearance through CSS    | `@glassyui/glassy-theme`                                                                    |
| Existing shadcn/ui components, replacing their source with Glassy UI versions | `@glassyui/glassy-ui-new-york` or `@glassyui/glassy-ui-base-nova`, matching the app's style |
| Expo / React Native                                                           | `@glassyui-native/<item-name>`                                                              |

Use the web components for browser apps and the native components for Expo. Read
the current [web index](https://glassyui.com/r/registry.json) or
[native index](https://glassyui.com/r/native/registry.json) to confirm item
names. Inspect the selected item's public JSON and source when checking exports,
props, dependencies, or examples. Never assume web and native props match.

The components and theme are free and MIT-licensed. The separate Pro templates
are not required for these installs.

## React and Next.js

For a web consumer, confirm React 19+ and Tailwind CSS 4. If shadcn is not
configured, use its normal initialization for that app before adding components.
Keep `tailwind.cssVariables` set to `true` in `components.json`; the pinned CLI
can corrupt space-separated source literals when it is false.

For a screen with a scene, a panel, and an action:

```sh
pnpm dlx shadcn@4.14.1 add @glassyui/glass-scene @glassyui/glass-panel @glassyui/glass-button
```

Install only the items the screen uses. The CLI includes each item's file and
package dependency closure. Use the installed files' exports and the app's
configured import alias.

The installed `glass-provider` module imports the shared CSS automatically. A
registry install needs neither a separate stylesheet copy nor a provider wrapper
merely to render.

Set `data-lg-theme="light"` or `data-lg-theme="dark"` on the app's root element,
matching the actual background. Keep that attribute in sync when the app changes
theme. Use `GlassProvider` when synchronized material preferences are needed,
with `defaultTheme` matching the initial theme.

Read the current
[installation guide](https://github.com/alexburlis/glassyui/blob/main/docs/registry-installation.md)
for setup details. Read a component's usage at
`https://glassyui.com/components/<item-name>` before composing unfamiliar APIs.
Preserve keyboard interaction, labels, focus states, and the user's existing
motion and transparency preferences.

## Restyle an existing shadcn/ui app

Use the CSS-only theme when the user wants to retain the existing components:

```sh
pnpm dlx shadcn@4.14.1 add @glassyui/glassy-theme
```

The drop-in sets replace sixteen component files. Choose the set that matches
the app's style and review the existing files before using `--overwrite`.
Preserve local changes before replacement. Do not overwrite custom components
merely to apply the theme.

A drop-in set replaces the CSS-only theme. Remove that theme's `@layer glassy`
block and `--glassy-*` tokens before installing a set. For a theme upgrade,
remove its previous generated block and tokens before re-adding it. The CLI does
not remove old theme rules.

## Expo and React Native

Use the native registry. Do not run web `shadcn init` to configure Expo. If
`components.json` is missing, adapt the public
[Expo fixture configuration](https://github.com/alexburlis/glassyui/blob/main/fixtures/expo-consumer/components.json)
to the app's actual directories. Its registry mapping targets a loopback test
server. Omit that mapping for public installs, or replace it with the hosted
native registry URL. An existing mapping overrides the public directory. Keep
`tailwind.cssVariables` set to `true`, even though this is a native app, and
match the `@/` alias in `tsconfig.json`.

```sh
pnpm dlx shadcn@4.14.1 add @glassyui-native/glass-button @glassyui-native/glass-panel
pnpm exec expo install --fix
```

Run the Expo alignment command after a successful add. The pinned shadcn CLI
passes Expo dependencies after `--`, so `expo install --fix` is needed to match
the consumer SDK. Rebuild an existing development build after adding native
modules.

Use React Native props and the component's native usage example. The native
registry draws the system's own glass on supported iOS 26 devices. On Android
12+, put the background content in `GlassBackdrop` so glass can blur it. Android
outside that backdrop, and older Android versions, use translucent tint. Other
supported platforms use the blur fallback. A browser preview does not prove
native materials or haptics.

Check SDK compatibility for the selected items. `glass-picker`,
`glass-swipe-row`, and `glass-card-stack` require the SDK 57 fixture's app-only
setup. Gesture items require `GestureHandlerRootView` above `GlassProvider` and
around native Modal contents. Consult the
[Expo guide](https://glassyui.com/guides/expo) and the selected item's
dependencies.

## Finish in the consumer

Run the app's relevant type check or build after installation. Open the actual
screen and exercise its controls when a UI runtime is available. Check the
matching theme and reduced-motion or reduced-transparency behavior. Report the
actual checked platform and any runtime check that could not run.
