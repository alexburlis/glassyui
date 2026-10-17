import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// Draws the README's artwork: the lockup, the desk and the Today screen on three platforms. Each
// comes as a light and a dark file on a transparent ground, and the README's <picture> elements
// pick one by GitHub's appearance. The desk is photographed from the running site; the lockup and
// the phones are set from the repository's own brand files and mobile captures.
//
//   node scripts/build-readme-art.mjs http://127.0.0.1:3000

const baseUrl = process.argv[2];

if (!baseUrl || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  throw new Error('Usage: node scripts/build-readme-art.mjs <loopback-url>');
}

const OUT = '.github/readme';

const THEMES = ['light', 'dark'];

// DESIGN.md's text colours, and a hairline that keeps each picture's edge on GitHub's page.
const INK = { light: '#222224', dark: '#f5f5f7' };

const SECONDARY = { light: '#66666a', dark: '#b8b8be' };

const HAIRLINE = { light: 'rgba(0, 0, 0, 0.1)', dark: 'rgba(255, 255, 255, 0.14)' };

// The detail cut from 64 px up, black on light pages and white on dark ones.
const MARK = {
  light: 'public/brand/glassyui-logo.svg',
  dark: 'public/brand/glassyui-logo-white.svg',
};

const PLATFORMS = [
  { label: 'iOS', file: 'ios' },
  { label: 'Android', file: 'android' },
  { label: 'Web', file: 'web' },
];

// Chrome's own encoder: the photographs keep their alpha at a fraction of a PNG's size.
const WEBP_QUALITY = 0.9;

async function dataUrl(file, type) {
  return `data:${type};base64,${(await fs.readFile(file)).toString('base64')}`;
}

/** A page of its own for one composition, on a transparent ground, in the system font. */
function studio(body, css) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; background: transparent; }
    body { font-family: system-ui; -webkit-font-smoothing: antialiased; }
    #art { display: inline-flex; }
    ${css}
  </style></head><body>${body}</body></html>`;
}

async function shoot(page, html) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  return page.locator('#art').screenshot({ omitBackground: true, type: 'png' });
}

/** Re-encodes a transparent PNG as WebP in the browser, keeping its alpha. */
async function webp(page, png) {
  const encoded = await page.evaluate(
    async ({ source, quality }) => {
      const image = new Image();

      image.src = source;
      await image.decode();

      const canvas = document.createElement('canvas');

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);

      return canvas.toDataURL('image/webp', quality);
    },
    { source: `data:image/png;base64,${png.toString('base64')}`, quality: WEBP_QUALITY },
  );

  assert.ok(encoded.startsWith('data:image/webp;base64,'), 'Chrome must encode WebP');

  return Buffer.from(encoded.slice(encoded.indexOf(',') + 1), 'base64');
}

async function write(name, bytes) {
  await fs.writeFile(`${OUT}/${name}`, bytes);
  console.log(`  ${OUT}/${name}  ${(bytes.length / 1024).toFixed(0)} KB`);
}

/** The home page's desk in one appearance, with its corner radius in CSS pixels. */
async function photographDesk(browser, theme) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1.5,
    colorScheme: theme,
  });

  await context.addInitScript((value) => {
    localStorage.setItem(
      'glassy-ui-preferences',
      JSON.stringify({ theme: value, reduceMotion: false, reduceTransparency: false }),
    );
  }, theme);

  try {
    const page = await context.newPage();
    const privacy = page.getByRole('region', { name: 'Analytics privacy settings' });

    // The analytics prompt waits for the opener to make way. Whenever it shows, it is refused
    // before the next action, and Playwright waits for it to leave.
    await page.addLocatorHandler(privacy, () =>
      privacy.getByRole('button', { name: 'Reject analytics', exact: true }).click(),
    );

    const response = await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });

    assert.equal(response?.status(), 200, 'the home page must resolve');

    // The keynote's opener covers the desk until it lands; a key press moves it on.
    if (await page.evaluate(() => document.documentElement.hasAttribute('data-keynote-intro'))) {
      await page.keyboard.press('Escape');
    }

    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-keynote-intro'));

    const desk = page.locator('.desk-screen');

    await desk.scrollIntoViewIfNeeded();
    // A desk drawn without WebGL is not the desk the README shows, so this fails rather than
    // photographs whatever is there.
    await desk.locator('xpath=..').locator('[data-lg-scene-renderer="webgl"]').waitFor();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(800);

    const radius = await desk.evaluate((element) =>
      parseFloat(getComputedStyle(element).borderTopLeftRadius),
    );

    const box = await desk.boundingBox();

    assert.ok(radius > 0 && box, 'the desk must have rounded corners and a size');

    return {
      png: await desk.screenshot({ type: 'png', animations: 'disabled' }),
      radius,
      width: box.width,
      height: box.height,
    };
  } finally {
    await context.close();
  }
}

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

try {
  for (const theme of THEMES) {
    console.log(`${theme}:`);

    // The lockup: DESIGN.md's mark and wordmark, scaled up from the share image's 44, 30 and 14 px.
    const lockup = await browser.newPage({ deviceScaleFactor: 3 });
    const mark = await dataUrl(MARK[theme], 'image/svg+xml');

    await write(
      `lockup-${theme}.png`,
      await shoot(
        lockup,
        studio(
          `<div id="art"><img src="${mark}" alt=""><span>Glassy UI</span></div>`,
          `#art { align-items: center; gap: 20px; padding: 4px; }
           img { width: 64px; height: 64px; }
           span { color: ${INK[theme]}; font-size: 44px; font-weight: 600; letter-spacing: 0.012em; line-height: 1; }`,
        ),
      ),
    );
    await lockup.close();

    // The desk, clipped to its own corners so GitHub's page shows round them.
    const desk = await photographDesk(browser, theme);

    const deskPage = await browser.newPage({
      deviceScaleFactor: 1.5,
      viewport: { width: Math.ceil(desk.width) + 40, height: Math.ceil(desk.height) + 40 },
    });

    const deskPng = await shoot(
      deskPage,
      studio(
        `<div id="art"><img src="data:image/png;base64,${desk.png.toString('base64')}" alt=""></div>`,
        `#art { position: relative; overflow: hidden; border-radius: ${desk.radius + 0.5}px; }
         #art::after { content: ''; position: absolute; inset: 0; border-radius: inherit;
           box-shadow: inset 0 0 0 1px ${HAIRLINE[theme]}; }
         img { display: block; width: ${desk.width}px; height: ${desk.height}px; }`,
      ),
    );

    await write(`desk-${theme}.webp`, await webp(deskPage, deskPng));
    await deskPage.close();

    // The Today screen on each platform, the same size, in a thin black bezel. The screen's
    // corners stay small enough to keep Android's status bar whole. Android's capture is a little
    // taller; its system bar below the app is cut away.
    const phones = await browser.newPage({
      deviceScaleFactor: 2,
      viewport: { width: 1100, height: 800 },
    });

    const figures = [];

    for (const platform of PLATFORMS) {
      const screen = await dataUrl(
        `public/previews/mobile/${platform.file}-${theme}.webp`,
        'image/webp',
      );

      figures.push(
        `<figure><div class="bezel"><div class="screen"><img src="${screen}" alt=""></div></div><figcaption>${platform.label}</figcaption></figure>`,
      );
    }

    const phonesPng = await shoot(
      phones,
      studio(
        `<div id="art">${figures.join('')}</div>`,
        `#art { gap: 40px; padding: 4px; }
         figure { margin: 0; }
         .bezel { padding: 8px; border-radius: 36px; background: #0b0b0c;
           box-shadow: inset 0 0 0 1px ${HAIRLINE.dark}; }
         .screen { overflow: hidden; width: 300px; height: 652px; border-radius: 28px; }
         img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
         figcaption { margin-top: 16px; color: ${SECONDARY[theme]}; font-size: 15px; font-weight: 600;
           letter-spacing: -0.01em; text-align: center; }`,
      ),
    );

    await write(`platforms-${theme}.webp`, await webp(phones, phonesPng));
    await phones.close();
  }
} finally {
  await browser.close();
}
