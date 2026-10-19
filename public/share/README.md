# Link previews

Every page's share card: 1200 × 630 JPEGs that `src/lib/share.ts` puts in each
page's Open Graph and X tags. Each address carries a hash of its file, so a
changed card gets a new address and every platform fetches it afresh. A missing
card fails the build.

| File                             | What it shows                                               | Made by                        |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| `home.jpg`, `loops/home.mp4`     | A pill of clear glass springing across the real dock        | `link-previews/`, `home` cut   |
| `mobile.jpg`, `loops/mobile.mp4` | The pill springing between the real Today screen's segments | `link-previews/`, `mobile` cut |
| `components.jpg`                 | Four live demos                                             | Share studio                   |
| `docs.jpg`, `guides.jpg`         | The install command; the lens                               | Share studio                   |
| `guides/<slug>.jpg`              | Each guide's demo beside its title                          | Share studio                   |
| `blog.jpg`, `blog/<slug>.jpg`    | The blog and each article, illustrated with live web demos  | Share studio                   |
| `components/<slug>.jpg`          | Each component's live demo beside its name, overlays opened | Share studio                   |

Expo-only components share the React Native card; pages without tags of their
own share the home card.

## The loops

Messages plays a card's `og:video` in place of its image: it downloads the MP4,
starts it at once and loops it. The loops repeat exactly every six seconds and
start on the frame their JPEG shows, so neither the seam nor the hand-over from
the still is visible. Messages only attaches a video it can read by byte range,
so `Range` requests must get 206. The proxy in front of the app gzips whole
responses, and Cloudflare cannot cut a range from a gzipped copy, so
`next.config.ts` keeps `/share/loops` out of shared caches and the app answers
the ranges itself; every other `/share` file is cached for good.
`pnpm smoke:release-ui` checks the range answer.

The loops are rendered by the film engine in `link-previews/`, from copies of
this repository's desk (captured at 4× in the light theme), the Expo fixture's
iOS Today screen and the compact mark. To render them again:

```sh
cd link-previews
pnpm install --ignore-workspace
CUT=home node render.mjs
CUT=mobile node render.mjs
cp out/home.jpg out/mobile.jpg ../public/share/
cp out/home.mp4 out/mobile.mp4 ../public/share/loops/
```

Each render verifies itself: H.264 High at 24 fps, 144 frames, BT.709, fast
start, silent, at most 3.5 MB; the poster at most 400 KB; decoded frames, the
seam and banding (CAMBI) measured. Recapture the desk there when the desk
changes.

## The studio cards

With `pnpm dev` running, photograph the cards that do not exist yet, every card,
or only the ones named:

```sh
node scripts/capture-share-cards.mjs http://127.0.0.1:3000 --missing
node scripts/capture-share-cards.mjs http://127.0.0.1:3000
node scripts/capture-share-cards.mjs http://127.0.0.1:3000 components/glass-button.jpg
```

The cards are drawn by the development-only share studio
(`/share-studio/card/component/glass-button` and so on) from the real components
in the light theme. A new component or guide needs its card before the build
passes, and the build's error names the command. Shoot every card again when the
site's look changes. Keep counts and prices out of the artwork: a card is a
photograph and would go stale.
