// Renders one link-preview loop and its poster, then verifies them. From this folder, after
// `pnpm install`:
//
//   CUT=home node render.mjs
//   CUT=mobile node render.mjs
//
// writes <cut>.mp4, <cut>.jpg, a contact sheet and <cut>.qa.json to out/ (or --output <dir>).
// Development modes:
//
//   --stills 0,1.5   full-quality PNG stills at these times
//   --preview        the whole loop with six sub-frames per frame, for timing
//
// The engine is the Through glass film's: the page renders each frame in floating point and
// hands back finished Y'CbCr planes, which stream into local ffmpeg. Lossless key frames for the
// comparisons live in a temporary folder deleted when the run ends. Nothing is uploaded.

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  CUT,
  DELIVERY,
  DURATION,
  FPS,
  FRAMES,
  HEIGHT,
  POSTER_FRAME,
  SHUTTER,
  WIDTH,
} from './timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const ORIGIN = 'http://film.local';

const WORKERS = 2;

// Copies of the website's files, kept with the film: see README.md for where each came from.
const MARK_FILE = path.join(HERE, 'assets/glassyui-logo-compact.svg');

const ASSET_FILES = ['assets/desk-light-4x.webp', 'assets/ios-light.webp'].map((name) =>
  path.join(HERE, name),
);

// Messages limits a preview's media to 10 MB in all; each loop stays well inside it with its
// poster, so a slow connection still gets the video.
const BUDGET = { video: 3.5 * 1024 * 1024, poster: 400 * 1024 };

// Banding contract shared with Through glass: invisible below about 1 CAMBI.
const BANDING = { mean: 0.5, max: 1.5 };

const KEY_FRAMES = [0, 12, 24, 36, 48, 72, 96, 120, 143];

const args = process.argv.slice(2);

const option = (flag) => {
  const index = args.indexOf(flag);

  return index === -1 ? null : (args[index + 1] ?? '');
};

const OUT = path.resolve(option('--output') ?? path.join(HERE, 'out'));

function fail(message) {
  console.error(`render: ${message}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    ...options,
  });

  if (result.status !== 0) {
    fail(`${command} ${commandArgs.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** The mark's compact cut, black with its Vermilion fold: DESIGN.md's cut for 16 to 48 px. */
function markArtwork() {
  const svg = fs.readFileSync(MARK_FILE, 'utf8');

  if (!svg.includes('color="#000"')) fail('the detail mark no longer sets color="#000".');

  return svg;
}

const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.svg': 'image/svg+xml' };

async function openFilm(browser) {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });

  page.on('pageerror', (error) => console.error(`page error: ${error.message}`));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'mark.svg') {
      await route.fulfill({ body: markArtwork(), contentType: TYPES['.svg'] });

      return;
    }

    const asset = ASSET_FILES.find((file) => path.basename(file) === name);

    if (asset) {
      await route.fulfill({ path: asset, contentType: 'image/webp' });

      return;
    }

    const file = path.join(HERE, name);

    if (!file.startsWith(HERE) || !fs.existsSync(file)) {
      await route.fulfill({ status: 404, body: 'missing' });

      return;
    }

    await route.fulfill({ path: file, contentType: TYPES[path.extname(file)] ?? 'text/plain' });
  });
  await page.goto(`${ORIGIN}/film.html?cut=${CUT}`);
  await page.waitForFunction(() => window.filmReady, null, { timeout: 60_000 });

  const state = await page.evaluate(() => window.filmReady);

  if (state !== 'ready') fail(`the film page ${state}`);

  return page;
}

/** Renders one frame and returns the requested outputs as buffers. */
async function grab(page, frame, modes, subframes) {
  try {
    const result = await page.evaluate(
      async ({ index, outputs, count }) => {
        const used = window.film.render(index, count);
        const data = {};

        for (const mode of outputs) data[mode] = await window.film.read(mode);

        return { used, data };
      },
      { index: frame, outputs: modes, count: subframes ?? null },
    );

    const buffers = Object.fromEntries(
      Object.entries(result.data).map(([mode, text]) => [mode, Buffer.from(text, 'base64')]),
    );

    return { ...buffers, subframes: result.used };
  } catch (cause) {
    throw new Error(`Capture failed at frame ${frame} (${(frame / FPS).toFixed(3)} s)`, {
      cause,
    });
  }
}

async function launch() {
  return chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--force-color-profile=srgb'],
  });
}

/** Renders frames on a few pages at once and hands each to `consume` in frame order. */
async function renderFrames(frames, modesFor, consume, subframesFor = () => null) {
  const browser = await launch();

  try {
    const pages = await Promise.all(
      Array.from({ length: Math.min(WORKERS, frames.length) }, () => openFilm(browser)),
    );

    const started = Date.now();
    let written = 0;
    let samples = 0;

    for (let offset = 0; offset < frames.length; offset += pages.length) {
      const batch = frames.slice(offset, offset + pages.length);

      const results = await Promise.all(
        batch.map((frame, index) =>
          grab(pages[index], frame, modesFor(frame), subframesFor(frame)),
        ),
      );

      for (let index = 0; index < batch.length; index += 1) {
        await consume(results[index], batch[index]);
        samples += results[index].subframes;
        written += 1;

        if (written % 48 === 0 || written === frames.length) {
          console.log(
            `  ${written}/${frames.length} frames, ${((Date.now() - started) / 1000).toFixed(1)} s, ${(samples / written).toFixed(1)} sub-frames each`,
          );
        }
      }
    }

    return (await browser.version?.()) ?? null;
  } finally {
    await browser.close();
  }
}

const COLOUR_TAGS = [
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-colorspace',
  'bt709',
  '-color_range',
  'tv',
];

// The delivery drops the frame's top rows: an even count, so the 4:2:0 chroma stays aligned.
const CROP = `crop=${DELIVERY.width}:${DELIVERY.height}:0:${DELIVERY.top}`;

function rawWriter(target, outputArgs) {
  const child = spawn(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'yuv420p',
      '-s',
      `${WIDTH}x${HEIGHT}`,
      '-framerate',
      String(FPS),
      ...COLOUR_TAGS,
      '-i',
      '-',
      '-vf',
      CROP,
      ...outputArgs,
      ...COLOUR_TAGS,
      target,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );

  const done = new Promise((resolve, reject) => {
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code} for ${target}`)),
    );
  });

  return {
    write: (buffer) =>
      new Promise((resolve) => {
        if (child.stdin.write(buffer)) resolve();
        else child.stdin.once('drain', resolve);
      }),
    close: async () => {
      child.stdin.end();
      await done;
    },
  };
}

// The frames carry fine moving grain, so x264's grain tuning keeps it from smearing and adaptive
// quantization mode 3 keeps bits in the ivory gradients. One key frame per loop: the player
// loops the file, it never seeks into it.
const H264 = (crf) => [
  '-c:v',
  'libx264',
  '-preset',
  'veryslow',
  '-crf',
  String(crf),
  '-tune',
  'grain',
  '-x264-params',
  'aq-mode=3',
  '-g',
  String(FRAMES),
  '-profile:v',
  'high',
  '-level',
  '4.0',
  '-pix_fmt',
  'yuv420p',
  '-tag:v',
  'avc1',
  '-movflags',
  '+faststart',
  '-an',
];

/** An RGBA frame, cropped to the delivery, as a lossless PNG. */
function writePng(rgba, target) {
  run(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${WIDTH}x${HEIGHT}`,
      '-i',
      '-',
      '-vf',
      CROP,
      '-frames:v',
      '1',
      '-pix_fmt',
      'rgb24',
      target,
    ],
    { input: rgba, encoding: null },
  );
}

async function stills(times) {
  const dir = path.join(OUT, 'stills');

  fs.mkdirSync(dir, { recursive: true });

  const frames = times.map((time) => Math.min(FRAMES, Math.round(time * FPS)));

  await renderFrames(
    frames,
    () => ['rgb'],
    async (result, frame) => {
      const file = path.join(dir, `${CUT}-${String(frame).padStart(3, '0')}.png`);

      writePng(result.rgb, file);
      console.log(
        `  ${path.relative(HERE, file)}  t=${(frame / FPS).toFixed(3)} s, ${result.subframes} sub-frames`,
      );
    },
  );
}

async function clip(target, crf, subframesFor = () => null, keep = null) {
  const frames = Array.from({ length: FRAMES }, (_, frame) => frame);
  const writer = rawWriter(target, H264(crf));
  let chrome = null;

  try {
    chrome = await renderFrames(
      frames,
      (frame) => (keep?.has(frame) ? ['yuv8', 'rgb'] : ['yuv8']),
      async (result, frame) => {
        if (keep?.has(frame)) keep.get(frame)(result.rgb);
        await writer.write(result.yuv8);
      },
      subframesFor,
    );
  } finally {
    await writer.close();
  }

  return chrome;
}

function probe(file) {
  return JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,color_primaries,color_transfer,color_space,color_range:format=duration,size',
      '-count_frames',
      '-of',
      'json',
      file,
    ]),
  );
}

/** Whether the movie's index precedes its media, so a player can start before it downloads. */
function fastStart(file) {
  const head = fs.readFileSync(file).subarray(0, 1 << 16);

  return head.indexOf('moov') !== -1 && head.indexOf('moov') < head.indexOf('mdat');
}

function contactSheet(video, target) {
  // Four frames a second, read back from the encode.
  run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    video,
    '-vf',
    `select='not(mod(n\\,${FPS / 4}))',scale=400:-1:flags=accurate_rnd+full_chroma_int,tile=4x${Math.ceil((DURATION * 4) / 4)}:padding=4:color=0x000000`,
    '-vsync',
    '0',
    '-frames:v',
    '1',
    target,
  ]);
}

function jpeg(png, target, quality) {
  // Pillow writes the poster: 4:4:4 keeps the type's edges and the Vermilion crisp.
  run('python3', [
    '-c',
    'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], quality=int(sys.argv[3]), subsampling=0, optimize=True, progressive=True)',
    png,
    target,
    String(quality),
  ]);
}

async function full() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `link-preview-${CUT}-`));
  const clean = () => fs.rmSync(scratch, { recursive: true, force: true });

  process.on('SIGINT', () => {
    clean();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    clean();
    process.exit(143);
  });

  try {
    const video = path.join(OUT, `${CUT}.mp4`);
    const poster = path.join(OUT, `${CUT}.jpg`);
    const report = path.join(OUT, `${CUT}.qa.json`);
    const hashes = {};

    const keep = new Map(
      KEY_FRAMES.map((frame) => [
        frame,
        (rgba) => {
          const file = path.join(scratch, `source-${String(frame).padStart(3, '0')}.png`);

          writePng(rgba, file);
          hashes[frame] = sha256(fs.readFileSync(file));
        },
      ]),
    );

    fs.writeFileSync(report, `${JSON.stringify({ status: 'incomplete', cut: CUT }, null, 2)}\n`);
    console.log(
      `${CUT}: ${FRAMES} frames at ${WIDTH}x${HEIGHT}, delivered at ${DELIVERY.width}x${DELIVERY.height}`,
    );

    // Encode at the lowest CRF that fits the budget.
    let crf = 16;
    let chrome = await clip(video, crf, () => null, keep);

    while (fs.statSync(video).size > BUDGET.video && crf < 26) {
      crf += 2;
      console.log(
        `  ${(fs.statSync(video).size / 1048576).toFixed(2)} MB is over budget; CRF ${crf}`,
      );
      chrome = await clip(video, crf);
    }

    // The poster: the loop's first frame at the most samples, then the frame one loop later,
    // which must match it but for grain and dither.
    const posterPng = path.join(scratch, 'poster.png');

    await renderFrames(
      [POSTER_FRAME, FRAMES],
      () => ['rgb'],
      async (result, frame) =>
        writePng(result.rgb, frame === FRAMES ? path.join(scratch, 'seam.png') : posterPng),
      (frame) => (frame === POSTER_FRAME ? 160 : null),
    );

    let quality = 90;
    jpeg(posterPng, poster, quality);

    while (fs.statSync(poster).size > BUDGET.poster && quality > 70) {
      quality -= 4;
      jpeg(posterPng, poster, quality);
    }

    // A fresh browser renders a spread of frames again, in reverse order.
    const again = [143, 72, 24, 0];
    const mismatched = [];

    await renderFrames(
      again,
      () => ['rgb'],
      async (result, frame) => {
        const file = path.join(scratch, `seek-${String(frame).padStart(3, '0')}.png`);

        writePng(result.rgb, file);

        if (sha256(fs.readFileSync(file)) !== hashes[frame]) mismatched.push(frame);
      },
    );

    contactSheet(video, path.join(OUT, `${CUT}-contact-sheet.png`));

    const media = probe(video);
    const stream = media.streams.find((entry) => entry.codec_type === 'video');

    const measured = JSON.parse(
      run('python3', [
        path.join(HERE, 'check.py'),
        scratch,
        video,
        poster,
        KEY_FRAMES.join(','),
        String(FPS),
      ]),
    );

    const posterSize = run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      poster,
    ]).trim();

    const failures = [];
    const expect = (ok, message) => ok || failures.push(message);

    expect(media.streams.length === 1, 'the loop must be silent and video only');
    expect(
      stream.codec_name === 'h264' && stream.profile === 'High',
      `codec ${stream.codec_name} ${stream.profile}`,
    );
    expect(
      stream.width === DELIVERY.width && stream.height === DELIVERY.height,
      `size ${stream.width}x${stream.height}`,
    );
    expect(stream.r_frame_rate === `${FPS}/1`, `rate ${stream.r_frame_rate}`);
    expect(Number(stream.nb_read_frames) === FRAMES, `${stream.nb_read_frames} frames decoded`);
    expect(stream.pix_fmt === 'yuv420p', `pixel format ${stream.pix_fmt}`);
    expect(
      stream.color_primaries === 'bt709' &&
        stream.color_transfer === 'bt709' &&
        stream.color_space === 'bt709' &&
        stream.color_range === 'tv',
      'BT.709 limited-range tags',
    );
    expect(fastStart(video), 'the index must precede the media (fast start)');
    expect(fs.statSync(video).size <= BUDGET.video, `video ${fs.statSync(video).size} bytes`);
    expect(posterSize === `${DELIVERY.width},${DELIVERY.height}`, `poster ${posterSize}`);
    expect(fs.statSync(poster).size <= BUDGET.poster, `poster ${fs.statSync(poster).size} bytes`);
    expect(
      measured.decoded.every((entry) => entry.psnr_db >= 38),
      'decoded key frames under 38 dB',
    );
    expect(measured.seam.psnr_db >= 40, `seam ${measured.seam.psnr_db} dB`);
    expect(
      measured.banding.loop.mean <= BANDING.mean && measured.banding.loop.max <= BANDING.max,
      'loop banding',
    );
    expect(measured.banding.poster <= BANDING.max, 'poster banding');
    expect(mismatched.length === 0, `fresh renders differ at frames ${mismatched.join(', ')}`);

    const result = {
      status: failures.length ? 'failed' : 'passed',
      cut: CUT,
      failures,
      video: {
        file: path.basename(video),
        bytes: fs.statSync(video).size,
        sha256: sha256(fs.readFileSync(video)),
        crf,
        stream,
        duration: Number(media.format.duration),
      },
      poster: {
        file: path.basename(poster),
        bytes: fs.statSync(poster).size,
        sha256: sha256(fs.readFileSync(poster)),
        quality,
        size: posterSize,
        frame: POSTER_FRAME,
      },
      measured,
      fresh_render_mismatches: mismatched,
      inputs: Object.fromEntries(
        [
          MARK_FILE,
          ...ASSET_FILES,
          ...['timeline.mjs', 'motion.mjs', 'optics.mjs', 'film.mjs'].map((name) =>
            path.join(HERE, name),
          ),
        ].map((file) => [path.relative(HERE, file), sha256(fs.readFileSync(file))]),
      ),
      chrome,
      shutter: SHUTTER,
    };

    fs.writeFileSync(report, `${JSON.stringify(result, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          status: result.status,
          failures,
          video: result.video.bytes,
          crf,
          poster: result.poster.bytes,
          quality,
          seam: measured.seam,
          banding: measured.banding,
        },
        null,
        2,
      ),
    );

    if (failures.length) process.exitCode = 1;
  } finally {
    clean();
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const stillTimes = option('--stills');

  if (stillTimes !== null) {
    await stills(stillTimes.split(',').map(Number));

    return;
  }

  if (args.includes('--preview')) {
    console.log(`${CUT}: preview with 6 sub-frames per frame`);
    await clip(path.join(OUT, `${CUT}-preview.mp4`), 20, () => 6);

    return;
  }

  await full();
}

await main();
