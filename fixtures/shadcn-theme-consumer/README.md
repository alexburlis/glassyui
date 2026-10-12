# shadcn theme consumer fixtures

Two stock shadcn/ui apps that `pnpm check:shadcn-theme` installs the
`glassy-theme` registry item into. Each one was created with the shadcn CLI on 7
October 2026, and its components are the CLI's own output. Do not edit those
component files; re-add them with the CLI instead.

| Fixture      | Created with                                                      | Primitives                 | CLI that installs the theme                                                               |
| ------------ | ----------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| `new-york/`  | `components.json` style `new-york`, then `shadcn@4.14.1 add …`    | Radix through `radix-ui`   | the repository's pinned `shadcn` 4.14.1                                                   |
| `base-nova/` | `shadcn@4.14.1 init -t next -b base -p nova`, then `shadcn add …` | Base UI (`@base-ui/react`) | `shadcn` 4.14.1, then the fixture's own `shadcn` (4.21.0); both must write the same bytes |

The covered components are: accordion, alert, avatar, badge, button, card,
checkbox, command, dialog, dropdown-menu, input, kbd, popover, radio-group,
select, sheet, skeleton, slider, switch, tabs, textarea and tooltip. The
base-nova `command` also pulled in `input-group`.

`palettes.json` holds four of shadcn's colour themes (blue, violet, orange and
yellow), taken from `https://ui.shadcn.com/r/themes.css` and wrapped in `hsl()`
for Tailwind CSS 4. The check applies each one to a copy of new-york before its
stock baseline, the way a person pastes a theme into `globals.css`, and runs it
as its own fixture (`new-york-blue` and so on).

Only these files belong to the test harness rather than the stock app:

- `app/page.tsx`, the kitchen sink. Its query string picks the backdrop
  (`?backdrop=plain|wallpaper`), the scheme (`?scheme=light|dark`) and one open
  overlay (`?open=dropdown|select|popover|tooltip|dialog|sheet|command`).
- `app/harness.css`, which paints the backdrops and the striped strip under the
  overlays.
- `public/`, with the Vermilion wallpapers and an avatar image.
- `app/layout.tsx`. In base-nova it drops `next/font/google`, so the app builds
  offline, and sets the system font stack in `harness.css` instead.

`new-york/app/globals.css` is the classic Tailwind v4 neutral template, with
tokens from `https://ui.shadcn.com/r/colors/neutral.json`.
`base-nova/app/globals.css` is the CLI's own `init` output.
