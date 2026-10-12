# Link previews storyboard

The viewer should understand that Glassy UI is real glass for real interfaces
through one pill of clear glass bending the actual product, inside the chat
bubble where the link was shared.

Destination: Open Graph video and image for glassyui.com (`home`) and
glassyui.com/mobile (`mobile`). 1200 × 630, 24 fps, six seconds, silent,
seamless. Messages autoplays and loops the MP4; X, LinkedIn, Slack, WhatsApp and
Google show the still, the loop's first frame. The direction follows the
approved Through glass film: the real product in a bright ivory studio, one pill
of glass over high-contrast detail, a long lens, real depth of field, type on
clean space to the left of the product.

Copy, fully visible on every frame (a loop has no entrance): the lockup (44 px
compact mark, 30 px semibold wordmark), then "Bends light." over a second line
in the tertiary colour, at 76 px: "In any browser." for `home`, "In your app."
for `mobile`.

## home

| Time      | On screen                                                                                    |
| --------- | -------------------------------------------------------------------------------------------- |
| 0–0.9 s   | The pill rests over Calendar and Maps, bending them; the camera breathes and drifts by hand. |
| 0.9–2 s   | It springs left along the icons (bounce 0.12), swelling a little, focus following it.        |
| 2–3.6 s   | It rests over Messages, Photos and Notes; the key light travels around its rim.              |
| 3.6–4.7 s | It springs back right.                                                                       |
| 4.7–6 s   | It settles where it began; frame 144 is frame 0.                                             |

## mobile

| Time      | On screen                                                                     |
| --------- | ----------------------------------------------------------------------------- |
| 0–0.7 s   | The pill rests on Day, the size of a segment; the desk soft behind the phone. |
| 0.7–2.2 s | It springs to Week (bounce 0.15), swelling ×1.14 as it slides.                |
| 2.2–3.9 s | It springs to Month.                                                          |
| 3.9–6 s   | It glides back to Day on a slower spring and settles; frame 144 is frame 0.   |

A still capture cannot change its selected segment, so the glass stays a lens
over the control; nothing implies a tap.

## Verification contract

- 144 frames at 1200 × 630 and 24 fps, H.264 High 4:2:0, BT.709 limited range,
  fast start, no audio, at most 3.5 MB; the poster at most 400 KB and the same
  size.
- Decoded key frames at least 38 dB PSNR from the lossless render.
- The frame one loop after the first at least 40 dB from the first: equal but
  for grain and dither.
- Banding by CAMBI: at most 0.5 mean and 1.5 max on the loop, 1.5 on the poster.
- A fresh browser renders a spread of frames byte-identical to the first run.
- Media checks do not establish taste, playback on a phone or what a platform
  does with its cached preview.
