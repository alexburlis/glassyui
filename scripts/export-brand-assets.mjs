import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// The SVGs in public/brand are the source of the mark. Every raster icon is rendered from them by
// Chrome, so the favicon, the touch icon and the exports cannot drift from the vector artwork.
const BRAND = 'public/brand';

const RENDERS = [
  { source: 'glassyui-logo.svg', size: 1024, file: 'glassyui-logo.png' },
  { source: 'glassyui-logo.svg', size: 512, file: 'glassyui-logo-512.png' },
  { source: 'glassyui-logo.svg', size: 192, file: 'glassyui-logo-192.png' },
  // Small sizes take the compact cut: a slightly thicker band for legibility.
  { source: 'glassyui-logo-compact.svg', size: 48, file: 'favicon-48.png' },
  { source: 'glassyui-logo-compact.svg', size: 32, file: 'favicon-32.png' },
  { source: 'glassyui-logo-compact.svg', size: 16, file: 'favicon-16.png' },
  // The app icon is a full-bleed square, because iOS and avatar crops round it themselves.
  { source: 'glassyui-app-icon.svg', size: 1024, file: 'glassyui-app-icon.png' },
  { source: 'glassyui-app-icon.svg', size: 180, file: 'apple-touch-icon.png' },
];

const FAVICONS = ['favicon-16.png', 'favicon-32.png', 'favicon-48.png'];

// An ICO whose entries are PNGs, which every current browser and Windows accept.
function toIco(images) {
  const header = Buffer.alloc(6 + images.length * 16);

  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length;

  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;

    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const browser = await chromium.launch({
  args: ['--disable-updater-scheduler'],
  channel: 'chrome',
  headless: true,
});

try {
  const pngs = new Map();

  for (const { source, size, file } of RENDERS) {
    // A fresh page at the final size avoids stale paint fragments after a viewport resize.
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });

    const svg = await fs.readFile(`${BRAND}/${source}`);

    await page.setContent(
      `<style>*{margin:0}</style><img alt="" height="${size}" width="${size}" src="data:image/svg+xml;base64,${svg.toString('base64')}">`,
    );
    await page.locator('img').evaluate((image) => image.decode());

    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: true,
    });

    pngs.set(file, { size, png });
    await fs.writeFile(`${BRAND}/${file}`, png);
    await page.close();
  }

  const ico = toIco(FAVICONS.map((file) => pngs.get(file)));

  await fs.writeFile(`${BRAND}/favicon.ico`, ico);

  // Next.js serves these alongside the adaptive SVG written by brand:build.
  await fs.writeFile('src/app/favicon.ico', ico);
  await fs.copyFile(`${BRAND}/apple-touch-icon.png`, 'src/app/apple-icon.png');
} finally {
  await browser.close();
}
