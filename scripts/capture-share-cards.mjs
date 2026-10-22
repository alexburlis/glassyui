import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createMdxBlog } from 'mdx-blog-kit';
import { chromium } from 'playwright';

const baseUrl = process.argv[2];

if (!baseUrl || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  throw new Error(
    'Usage: node scripts/capture-share-cards.mjs <loopback-url> [--missing | card-file ...]',
  );
}

// `--missing` photographs only cards without a file yet, such as a new component's; card files
// (for example `components/glass-button.jpg`) photograph just those; otherwise every card.
const missingOnly = process.argv.includes('--missing');

const only = new Set(process.argv.slice(3).filter((argument) => argument !== '--missing'));

const OUT = 'public/share';

// Link previews are 1200 x 630. The studio draws each card at that size; the photograph is taken
// at twice the density and halved, so edges and type stay smooth.
const CARD = { width: 1200, height: 630 };

// Facebook, X and LinkedIn take far larger files, but a small card loads at once everywhere.
const MAX_BYTES = 350 * 1024;

// Overlay demos open before the photograph, so a card shows the component, not its trigger.
const OPENED = new Set([
  'glass-accordion',
  'glass-command',
  'glass-dialog',
  'glass-menu',
  'glass-popover',
  'glass-select',
  'glass-sheet',
  'glass-toast',
  'glass-tooltip',
]);

// The pages that get a studio card, from the server's own sitemap. Expo-only components share
// the React Native card, whose loop link-previews/ renders (public/share/README.md).
const sitemap = await (await fetch(new URL('/sitemap.xml', baseUrl))).text();

const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => new URL(match[1]).pathname,
);

const webComponents = new Set(
  JSON.parse(await fs.readFile('registry.json', 'utf8')).items.map((item) => item.name),
);

const slugUnder = (prefix) =>
  pages.flatMap((page) => (page.startsWith(prefix) ? [page.slice(prefix.length)] : []));

// Artwork must be ready while a post is still a draft or scheduled for a future date.
const blogPosts = await createMdxBlog({
  contentDir: path.resolve('content/blog'),
  baseUrl: new URL(baseUrl).origin,
  routeBase: '/blog',
}).getAllPosts({ includeDrafts: true });

const cards = [
  { file: 'components.jpg', route: 'components' },
  { file: 'docs.jpg', route: 'docs' },
  { file: 'guides.jpg', route: 'guides' },
  { file: 'blog.jpg', route: 'blog' },
  ...slugUnder('/guides/').map((slug) => ({ file: `guides/${slug}.jpg`, route: `guide/${slug}` })),
  ...blogPosts.map(({ slug }) => ({
    file: `blog/${slug}.jpg`,
    route: `post/${slug}`,
  })),
  ...slugUnder('/components/').flatMap((slug) =>
    webComponents.has(slug) ? [{ file: `components/${slug}.jpg`, route: `component/${slug}` }] : [],
  ),
].filter((card) => only.size === 0 || only.has(card.file));

const pending = missingOnly
  ? cards.filter((card) => !existsSync(path.join(OUT, card.file)))
  : cards;

if (missingOnly && pending.length === 0) {
  console.log('Every page already has its card.');
  process.exit(0);
}

assert.ok(pending.length > 0, 'No card matches the names given.');

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

const context = await browser.newContext({
  viewport: CARD,
  deviceScaleFactor: 2,
  colorScheme: 'light',
});

// The light appearance, as the site opens; motion and transparency stay on, or the glass would
// fall back to its plain fill.
await context.addInitScript(() => {
  localStorage.setItem(
    'glassy-ui-preferences',
    JSON.stringify({ theme: 'light', reduceMotion: false, reduceTransparency: false }),
  );
});

/** Halves a 2x photograph in Chrome's own high-quality resampler and encodes it as JPEG. */
async function toJpeg(page, png) {
  const data = await page.evaluate(
    async ({ source, width, height }) => {
      const image = new Image();

      image.src = source;
      await image.decode();

      const canvas = document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';

      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }

      return btoa(binary);
    },
    { source: `data:image/png;base64,${png.toString('base64')}`, ...CARD },
  );

  return Buffer.from(data, 'base64');
}

/** The pixel size a JPEG declares in its first frame header. */
function jpegSize(bytes) {
  for (let offset = 2; offset < bytes.length;) {
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }

    offset += 2 + length;
  }

  throw new Error('No JPEG frame header found.');
}

const written = [];

try {
  const page = await context.newPage();

  for (const card of pending) {
    const url = new URL(`/share-studio/card/${card.route}`, baseUrl).href;
    const response = await page.goto(url, { waitUntil: 'networkidle' });

    assert.equal(response?.status(), 200, `${url} must resolve`);
    await page.evaluate(() => document.fonts.ready);

    // Every stage frame has drawn its demo.
    for (const frame of page.frames().filter((entry) => entry !== page.mainFrame())) {
      await frame.waitForSelector('[data-share-stage-page]');
      await frame.evaluate(() => document.fonts.ready);

      const id = await frame
        .locator('[data-share-stage-page]')
        .getAttribute('data-share-stage-page');

      // A scene drawn without WebGL, or a laptop with its lid down, is not the demo the card
      // promises, so these wait rather than photograph whatever is there.
      if (id === 'glass-scene') await frame.locator('[data-lg-scene-renderer="webgl"]').waitFor();

      if (id === 'glass-laptop') {
        await frame.locator('[data-screen="on"]').waitFor();
        await page.waitForTimeout(1200);
      }

      // The reveal's card holds the glass mid-pass, on the demo's own timeline: Home, then 38
      // steps of 1%.
      if (id === 'glass-logo-reveal') {
        await frame.locator('.lg-logo-reveal[data-renderer="webgl"]').waitFor();
        await frame.getByRole('slider', { name: 'Moment' }).focus();
        await page.keyboard.press('Home');

        for (let step = 0; step < 38; step++) await page.keyboard.press('ArrowRight');

        await frame.locator('.lg-logo-reveal[data-state="held"]').waitFor();
      }

      if (OPENED.has(id)) {
        const trigger = frame
          .locator('.docs-release-demo button, .docs-release-demo [role="combobox"]')
          .first();

        // By keyboard: a frame's zoom moves pointer coordinates, but focus and keys still land.
        await trigger.focus();

        if (id !== 'glass-tooltip') await page.keyboard.press('Enter');
      }
    }

    // Let the glass settle: filters regenerate, overlays finish rising.
    await page.waitForTimeout(900);

    const png = await page.locator('[data-share-card]').screenshot({ animations: 'disabled' });
    const jpeg = await toJpeg(page, png);
    const size = jpegSize(jpeg);
    const target = path.join(OUT, card.file);

    assert.deepEqual(size, CARD, `${card.file} must be ${CARD.width} x ${CARD.height}`);
    assert.ok(jpeg.length <= MAX_BYTES, `${card.file} is ${jpeg.length} bytes`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, jpeg);
    written.push(`${card.file} ${(jpeg.length / 1024).toFixed(0)} KB`);

    // A blank page between cards, so one card's open overlay never shows in the next.
    await page.goto('about:blank');
  }
} finally {
  await browser.close();
}

console.log(`Captured ${written.length} share cards in ${OUT}:\n  ${written.join('\n  ')}`);
