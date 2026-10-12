# Glassy UI logo

The ribbon is a slim, flat silhouette with one full twist and an open centre.
The mark is black on light surfaces and white on dark surfaces. A short
Vermilion underside (`#f04a28`) appears at the lower-right fold, with a clean
edge across the band. The glyph remains available in one colour.

| Asset                                                | Use                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `glassyui-logo.svg`                                  | Detail cut for 64 px and up                                                    |
| `glassyui-logo-white.svg`                            | White compact cut with a red accent for dark surfaces                          |
| `glassyui-logo-compact.svg`                          | Compact cut for 16 to 48 px: favicons, headers and menus                       |
| `glassyui-app-icon.svg`                              | Accented black ribbon on a plain white tile, full bleed, for icons and avatars |
| `glassyui-glyph.svg`                                 | Compact cut in `currentColor`, both faces solid                                |
| `glassyui-logo.png`                                  | 1024 × 1024 export of the detail cut                                           |
| `glassyui-logo-512.png`, `glassyui-logo-192.png`     | Smaller exports of the detail cut                                              |
| `glassyui-app-icon.png`                              | 1024 × 1024 app icon for avatars and store listings                            |
| `apple-touch-icon.png`                               | 180 × 180 iOS icon                                                             |
| `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | Browser icons from the compact cut                                             |
| `favicon.ico`                                        | Combined 16, 32 and 48 px browser icon                                         |

The site uses the compact cut for the adaptive favicon in `src/app/icon.svg` and
for `BrandMark` in `src/components/site/app-icons.tsx` and the link-preview
cards in `public/share`, the glyph in white on Glassy UI Pro's Vermilion card,
and the app icon for `src/app/apple-icon.png`.

How to use the mark, its construction and its colours are in the brand guide,
`DESIGN.md` at the repository root.

## Changing the mark

The construction lives in `scripts/build-brand-mark.mjs`. Change it there and
run `pnpm brand:build` to rewrite the SVGs in this folder and the adaptive
favicon in `src/app`, mirror the compact cut in `BrandMark`, then run
`pnpm brand:export`. That renders every PNG and the ICO with Chrome and copies
the ICO and touch icon into `src/app`.
