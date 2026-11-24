import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

/*
  Photographs templates' whole pages at their posters' width, 1280 pixels, for the gallery cards
  that scroll down them under a pointer. Each photograph goes to public/templates/pages/<slug>.jpg
  and its size to src/lib/template-pages.json, which the gallery reads.

    node scripts/capture-template-pages.mjs <loopback-url> [<slug>[=<loopback-page-url>] ...]

  The free templates come from the site's own previews, /templates/<slug>/preview: all of them, or
  the slugs named. A template served by another app, such as a Pro template run from its own
  source, comes from the page address given with its slug.
*/

const OUT = 'public/templates/pages';

const MANIFEST = 'src/lib/template-pages.json';

// The posters' size: the window shows this much of the page before it scrolls.
const VIEWPORT = { height: 800, width: 1280 };

// The tallest page an AVIF variant can hold, which next/image serves to most browsers.
const MAX_HEIGHT = 16_384;

const loopback = (address) => ['127.0.0.1', 'localhost'].includes(new URL(address).hostname);

const [baseUrl, ...requests] = process.argv.slice(2);

if (!baseUrl || !loopback(baseUrl)) {
  throw new Error(
    'Usage: node scripts/capture-template-pages.mjs <loopback-url> [<slug>[=<loopback-page-url>] ...]',
  );
}

/** The free templates the site's sitemap lists, each with a page under /templates/<slug>. */
async function freeTemplates() {
  const sitemap = await (await fetch(new URL('/sitemap.xml', baseUrl))).text();

  return [...sitemap.matchAll(/<loc>[^<]*\/templates\/([a-z0-9-]+)<\/loc>/g)].map(
    (match) => match[1],
  );
}

const preview = (slug) => new URL(`/templates/${slug}/preview`, baseUrl).href;

const targets =
  requests.length === 0
    ? (await freeTemplates()).map((slug) => ({ slug, url: preview(slug) }))
    : requests.map((request) => {
        const [slug, url] = request.split(/=(.*)/s, 2);

        assert.match(slug, /^[a-z0-9-]+$/, `${request}: a slug is lower case`);

        if (url && !loopback(url)) throw new Error(`${slug}: photograph only a loopback page.`);

        return { slug, url: url || preview(slug) };
      });

assert.ok(targets.length > 0, 'No template to photograph.');

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

const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));

const browser = await chromium.launch();

try {
  for (const { slug, url } of targets) {
    const context = await browser.newContext({ deviceScaleFactor: 1, viewport: VIEWPORT });

    try {
      const page = await context.newPage();
      const response = await page.goto(url, { waitUntil: 'networkidle' });

      assert.equal(response?.status(), 200, `${url} must load`);
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await page.evaluate(() => document.fonts.ready);

      // Down the page at reading pace, so every section that comes in as it scrolls into view has
      // done so, then back to the top, where the photograph starts as the poster does.
      await page.evaluate(async () => {
        const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        for (let top = 0; top < document.documentElement.scrollHeight; top += 240) {
          window.scrollTo({ behavior: 'instant', top });
          await pause(160);
        }

        await pause(1200);
        window.scrollTo({ behavior: 'instant', top: 0 });
        await pause(1600);
      });

      const unrevealed = await page.locator('[data-reveal-state="armed"]').count();

      assert.equal(unrevealed, 0, `${slug}: ${unrevealed} sections never came in`);

      const bytes = await page.screenshot({ fullPage: true, quality: 72, type: 'jpeg' });
      const size = jpegSize(bytes);

      assert.equal(size.width, VIEWPORT.width, `${slug}: the page lays out wider than its poster`);
      assert.ok(size.height <= MAX_HEIGHT, `${slug}: ${size.height} pixels is too tall to serve`);

      await fs.mkdir(OUT, { recursive: true });
      await fs.writeFile(path.join(OUT, `${slug}.jpg`), bytes);
      manifest[slug] = size;
      console.log(`${slug}: ${size.width} × ${size.height}, ${Math.round(bytes.length / 1024)} KB`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const sorted = Object.fromEntries(
  Object.entries(manifest).sort(([one], [other]) => one.localeCompare(other)),
);

await fs.writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
