import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

// Site motion is one entrance on the home page, a rise into place as sections scroll in,
// answers to the pointer (the menus grow out of their triggers and the theme crossfades) and
// the Pro card's slow drift beside the gallery. With JavaScript and motion allowed, the home
// page's keynote is its entrance instead (scripts/check-keynote.mjs checks it), and the ordinary
// page begins once the keynote's opener has landed. Every way it can fail:
//
// 1. The entrance does not run: without JavaScript a hero element carries no animation when
//    motion is allowed, or with JavaScript the CSS entrance plays under the keynote.
// 2. The entrance drags: an element is still moving 1.8 s after load, or the headline is not
//    painted (opacity above zero) within 150 ms of the first frame.
// 3. Something does not land: once the entrance ends, a hero element keeps an offset or a fade.
// 4. Reduced motion is ignored: with the system setting or the site preference, a site
//    animation runs, or a hero element starts hidden or offset.
// 5. Glass is cut off from the page it bends: the hero's glass button or one of its ancestors
//    animates opacity, filter, mask or clip-path, so the button loses its backdrop until the
//    animation ends.
// 6. A scroll reveal hides content: a reveal target is ever less than fully opaque, or it is
//    still offset once it is fully on screen. Engines without scroll-driven animations show
//    every target in place.
// 7. The desk replays its entrance: widgets shown again from the View menu wait out the
//    entrance delay instead of appearing, or the View trigger cannot reopen its closing menu.
// 8. Floating layers grow from the wrong place: an open menu does not take Radix's transform
//    origin, so it scales from its centre instead of its trigger.
// 9. Changing the theme stalls: the toggle does not switch the theme within 600 ms, or a
//    crossfade runs under reduced motion.
// 10. A lazy demo moves the page: ordinary wheel scrolling jumps when the command palette
//     mounts below the viewport. Its results must still scroll during keyboard navigation.
// 11. The header keeps one shape: at the top of the page it is not the open bar (wider than the
//     capsule, its glass hidden), scrolled it does not settle into the 920px glass capsule, or
//     back at the top it does not open again; or it leaves inline styles behind at rest.
// 12. The header jumps where it should morph: with motion allowed, no frame falls between the
//     open bar and the capsule.
// 13. The header's glass loses the page it bends while it moves: the glass layer, the header or
//     an ancestor has opacity, filter, mask or clip-path, or the frost stops blurring.
// 14. The morph stalls on the lens: Chromium draws a lens map, or turns the lens on, while the
//     shape is still moving.
// 15. Reduced motion is ignored by the header: with the system setting or the site preference,
//     a frame falls between the two shapes.
// 16. The Pro card's art stands still: with motion allowed, its ribbon or its window has no
//     running animation, or pointing at the card does not raise the window.
// 17. Reduced motion is ignored by the Pro card: with the system setting or the site preference,
//     its ribbon or its window animates, or pointing at the card moves the window.
// 18. The Pro card's window loses the ribbon it bends: the window or an ancestor animates
//     opacity, filter, mask or clip-path.
// 19. The desk's Appearance control waits for its bubble before applying the theme, or takes
//     page snapshots that freeze the moving bubble. Both directions must apply in the click
//     event, including the page's colors and browser color scheme. Elapsed time is diagnostic.
// 20. Repeated desk choices apply an old theme later, keyboard selection stops working, the
//     mobile settings control disagrees with the desk, or the chosen theme is lost on reload.
// 21. The prominent button does not settle: pointing at it does not lower its slab halfway to
//     the page like any button, or the slab jumps there instead of easing down.
// 22. Its rim light does not swing or its shadow wanders: with motion allowed, pointing at it
//     does not swing the light 50deg over to the top left through frames in between, leaving
//     does not ease it back to the top, or the shadow moves sideways instead of staying under
//     the slab.
// 23. Reduced motion is ignored by the slab or its light: with the system setting or the site
//     preference, a frame falls between rest and the settled slab lit from the top left.

const baseUrl = process.argv[2];

if (!baseUrl || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  console.error(
    'Usage: node scripts/check-site-motion.mjs http://127.0.0.1:3100 [artifact-directory] [theme|firefox-failures]',
  );
  process.exit(1);
}

const artifactDirectory =
  process.argv[3] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-site-motion-'));

fs.mkdirSync(artifactDirectory, { recursive: true });

const preferenceStorageKey = 'glassy-ui-preferences';

const HERO = [
  '.home-announce',
  '.home-title',
  '.home-lead',
  '.home-hero .home-actions > .lg-button',
  '.home-hero .home-actions > .home-section-link',
  '.home-hero .copy-chip',
  '.home-desk-frame',
  '.desk-widgets > :first-child',
  '.desk-dock',
  '.home-desk-caption',
];

const REVEALS = ['.home-section-header', '.component-card', '.bento-tile', '.home-step'];

const failures = [];

const themeOnly = process.argv[4] === 'theme';

const firefoxFailuresOnly = process.argv[4] === 'firefox-failures';

const activeContexts = new Set();

const manifest = {
  baseUrl,
  scope: firefoxFailuresOnly ? 'firefox-failures' : themeOnly ? 'theme' : 'full',
  failures,
  engines: {},
};

async function open(
  browser,
  {
    javaScriptEnabled = true,
    reducedMotion = 'no-preference',
    preferences = { theme: 'light' },
    width = 1280,
  } = {},
) {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    javaScriptEnabled,
    reducedMotion,
    viewport: { width, height: 860 },
  });

  activeContexts.add(context);
  context.once('close', () => activeContexts.delete(context));

  await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: preferenceStorageKey,
    value: JSON.stringify(preferences),
  });

  return { context, page: await context.newPage() };
}

// The animations an element's styles declare, when the last of them ends, and where it is now.
function readDeclared(page, selectors) {
  return page.evaluate((list) => {
    const milliseconds = (value) =>
      value.split(',').map((part) => parseFloat(part) * (part.trim().endsWith('ms') ? 1 : 1000));

    return Object.fromEntries(
      list.map((selector) => {
        const element = document.querySelector(selector);

        if (!element) return [selector, null];

        const style = getComputedStyle(element);

        const names = style.animationName
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name !== 'none');

        const delays = milliseconds(style.animationDelay);
        const durations = milliseconds(style.animationDuration);

        const ends = names.map(
          (_, index) => delays[index % delays.length] + durations[index % durations.length],
        );

        return [
          selector,
          {
            delay: delays[0],
            end: Math.max(0, ...ends),
            names,
            opacity: Number(style.opacity),
            transform: style.transform,
            translate: style.translate,
          },
        ];
      }),
    );
  }, selectors);
}

const restOf = ({ opacity, transform, translate }) => ({ opacity, transform, translate });

const isIdentity = (state) =>
  state.opacity === 1 &&
  (state.translate === 'none' || /^0px( 0px)?$/.test(state.translate)) &&
  (state.transform === 'none' || state.transform === 'matrix(1, 0, 0, 1, 0, 0)');

// With motion allowed the home page opens with the keynote's opener, which plays over the top of
// the page as it loads; a key press moves it on, and the ordinary page is there once it lands.
async function landHome(page) {
  if (!(await page.evaluate(() => document.documentElement.hasAttribute('data-keynote-intro')))) {
    return;
  }

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-keynote-intro'));
  await page.waitForTimeout(400);
}

async function check(label, run) {
  try {
    await run();
  } catch (error) {
    failures.push(`${label}: ${error.message.split('\n')[0]}`);
  } finally {
    // A failed check must not leave an animating page behind for the next check.
    for (const context of activeContexts) await context.close();
  }
}

// The page's stylesheets have loaded and a frame has passed, so any entrance has begun.
// Without JavaScript Playwright cannot poll the page, so the stylesheets' load event and the
// clock stand in for both.
async function waitForStyles(page, { script = true } = {}) {
  if (!script) {
    await page.waitForLoadState('load');
    await page.waitForTimeout(32);

    assert.ok(
      await page.evaluate(() =>
        [...document.querySelectorAll('link[rel="stylesheet"]')].every((link) => link.sheet),
      ),
      'the stylesheets must have loaded',
    );

    return;
  }

  await page.waitForFunction(
    () =>
      document.querySelector('.home-desk-caption') &&
      [...document.querySelectorAll('link[rel="stylesheet"]')].every((link) => link.sheet),
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
}

async function checkEntrance(browser, name) {
  const result = {};
  const rest = {};

  // 4: reduced motion, from the system and from the site preference. These runs also record
  // where each hero element rests, for the entrance to land on.
  for (const [mode, options] of [
    ['system', { reducedMotion: 'reduce' }],
    ['preference', { preferences: { reduceMotion: true, theme: 'light' } }],
  ]) {
    await check(`${name} reduced motion (${mode})`, async () => {
      const { context, page } = await open(browser, options);

      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'commit' });
      await waitForStyles(page);

      const states = await readDeclared(page, HERO);

      for (const selector of HERO) {
        const state = states[selector];

        assert.ok(state, `${selector} must be on the page`);
        assert.deepEqual(
          state.names.filter((animation) => animation.startsWith('site-')),
          [],
          `${selector} must hold still under reduced motion`,
        );
        assert.equal(state.opacity, 1, `${selector} must start visible under reduced motion`);
        rest[selector] ??= restOf(state);
        assert.deepEqual(
          restOf(state),
          rest[selector],
          `${selector} must rest in the same place under either setting`,
        );
      }

      await context.close();
    });
  }

  // 1: with JavaScript the keynote's opener is the entrance, so the CSS entrance must not play
  // under it.
  await check(`${name} keynote entrance`, async () => {
    const { context, page } = await open(browser);

    await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
    await waitForStyles(page);
    assert.ok(
      await page.evaluate(() => document.documentElement.hasAttribute('data-keynote')),
      'with motion allowed the keynote must run',
    );

    const declared = await readDeclared(page, HERO);

    for (const selector of HERO) {
      assert.ok(declared[selector], `${selector} must be on the page`);
      assert.deepEqual(
        declared[selector].names.filter((animation) => animation.startsWith('site-')),
        [],
        `${selector} must not play the CSS entrance under the keynote`,
      );
    }

    await context.close();
  });

  // 1, 2, 3, 5: without JavaScript the entrance runs, paints the headline at once, lands and
  // never fades glass.
  await check(`${name} entrance`, async () => {
    const { context, page } = await open(browser, { javaScriptEnabled: false });

    await page.goto(new URL('/', baseUrl).href, { waitUntil: 'commit' });
    await waitForStyles(page, { script: false });

    const declared = await readDeclared(page, HERO);

    await page.screenshot({ path: path.join(artifactDirectory, `${name}-entrance-start.png`) });

    for (const selector of HERO) {
      assert.ok(declared[selector], `${selector} must be on the page`);
      assert.ok(
        declared[selector].names.some((animation) => animation.startsWith('site-')),
        `${selector} must move in when motion is allowed`,
      );
    }

    assert.equal(declared['.home-title'].delay, 0, 'the headline must start moving in at once');
    await page.waitForTimeout(150);

    const headline = await readDeclared(page, ['.home-title']);

    assert.ok(headline['.home-title'].opacity > 0, 'the headline must be painted within 150 ms');

    // The glass button bends the page behind it, so neither it nor any ancestor may fade or filter.
    const fadingGlass = await page.evaluate(() => {
      const button = document.querySelector('.home-hero .home-actions > .lg-button');
      const offenders = [];

      for (
        let node = button;
        node && node !== document.documentElement;
        node = node.parentElement
      ) {
        for (const animation of node.getAnimations()) {
          const frames = animation.effect?.getKeyframes?.() ?? [];
          const moved = frames.flatMap((frame) => Object.keys(frame));

          if (
            moved.some((key) =>
              ['opacity', 'filter', 'mask', 'clipPath', 'webkitMask'].includes(key),
            )
          ) {
            offenders.push(`${node.className || node.tagName}: ${animation.animationName}`);
          }
        }
      }

      return offenders;
    });

    assert.deepEqual(
      fadingGlass,
      [],
      'the hero glass button must keep its backdrop while the hero moves in',
    );

    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(artifactDirectory, `${name}-entrance-400ms.png`) });

    const longest = Math.max(...HERO.map((selector) => declared[selector].end));

    result.longestMs = Math.round(longest);
    assert.ok(
      longest <= 1800,
      `the entrance must end within 1.8 s (the longest ends at ${Math.round(longest)} ms)`,
    );

    // The page cannot be polled without JavaScript; the longest entrance ends by the clock.
    await page.waitForTimeout(longest + 400);

    const settled = await readDeclared(page, HERO);

    await page.screenshot({ path: path.join(artifactDirectory, `${name}-entrance-settled.png`) });

    for (const selector of HERO) {
      assert.ok(rest[selector], `${selector} needs a resting place from the reduced-motion run`);
      assert.deepEqual(
        restOf(settled[selector]),
        rest[selector],
        `${selector} must land where it rests (${JSON.stringify(settled[selector])})`,
      );
    }

    await context.close();
  });

  return result;
}

async function checkReveals(browser, name) {
  const result = { supported: false };

  // 6: reveals rise into place, never fade, and land once on screen.
  await check(`${name} scroll reveals`, async () => {
    const { context, page } = await open(browser);

    await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
    result.supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'));

    for (const selector of REVEALS) {
      const targets = page.locator(selector);
      const count = await targets.count();
      assert.ok(count > 0, `${selector} must be on the home page`);

      for (let index = 0; index < count; index += 1) {
        const target = targets.nth(index);

        const before = await target.evaluate((element) =>
          Number(getComputedStyle(element).opacity),
        );

        assert.equal(before, 1, `${selector} #${index} must never be hidden`);
        await target.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );

        const state = await target.evaluate((element) => {
          const style = getComputedStyle(element);

          return {
            opacity: Number(style.opacity),
            transform: style.transform,
            translate: style.translate,
          };
        });

        assert.ok(
          isIdentity(state),
          `${selector} #${index} must be in place once on screen (${JSON.stringify(state)})`,
        );
      }
    }

    await context.close();
  });

  return result;
}

async function checkDeskReplay(browser, name) {
  // 7: a real pointer click during the exit reopens the menu, and widgets appear at once.
  for (const width of [1280, 390]) {
    await check(`${name} desk replay (${width}px)`, async () => {
      const { context, page } = await open(browser, { width });

      try {
        await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2_000);
        await landHome(page);

        const view = page.locator('.desk-menubar').getByRole('button', { name: 'View' });
        const menu = page.getByRole('menu');
        const itemName = width === 1280 ? 'Show Widgets' : 'Show Dock';
        const selector = width === 1280 ? '.desk-widgets' : '.desk-dock';
        const item = page.getByRole('menuitemcheckbox', { name: itemName });

        const step = (label, action) =>
          action.catch((error) => {
            throw new Error(`${label}: ${error.message.split('\n')[0]}`);
          });

        await step('open View', view.click({ timeout: 5_000 }));
        await menu.evaluate(async (element) => {
          await Promise.all(element.getAnimations().map((animation) => animation.finished));
          // Hold the actual exit animation so the next pointer click always exercises the race.
          element.addEventListener(
            'animationstart',
            () => {
              if (element.getAttribute('data-state') !== 'closed') return;

              for (const animation of element.getAnimations()) {
                animation.pause();
                animation.currentTime = 40;
              }
            },
            { once: true },
          );
        });
        await step(`uncheck ${itemName}`, item.click({ timeout: 5_000 }));
        await step(
          `${selector} gone`,
          page.waitForSelector(selector, { state: 'detached', timeout: 5_000 }),
        );
        await page.waitForFunction(
          () => {
            const element = document.querySelector('.lg-menu-content[data-state="closed"]');

            return element?.getAnimations().some((animation) => animation.playState === 'paused');
          },
          null,
          { timeout: 5_000 },
        );
        await page.screenshot({
          path: path.join(artifactDirectory, `${name}-view-closing-${width}.png`),
        });
        await step('reopen View', view.click({ timeout: 5_000 }));
        await step(
          'View remains open',
          page.waitForFunction(
            () =>
              document.querySelector('.lg-menu-content[data-state="open"]') &&
              document.querySelector('.desk-menubar [aria-expanded="true"]'),
            null,
            { timeout: 1_000 },
          ),
        );
        await menu.evaluate((element) =>
          Promise.all(element.getAnimations().map((animation) => animation.finished)),
        );
        await page.screenshot({
          path: path.join(artifactDirectory, `${name}-view-reopened-${width}.png`),
        });
        assert.equal(await item.getAttribute('aria-checked'), 'false', 'the choice must persist');
        await step(`check ${itemName}`, item.click({ timeout: 5_000 }));
        await step(
          `${selector} back`,
          page.waitForSelector(selector, { state: 'attached', timeout: 5_000 }),
        );

        const childSelector = `${selector} > :first-child`;
        const state = await readDeclared(page, [childSelector]);

        assert.deepEqual(
          state[childSelector].names.filter((animation) => animation.startsWith('site-')),
          [],
          'desk elements shown again must not replay the entrance',
        );
        manifest.engines[name] = {
          ...manifest.engines[name],
          [`view-reopen-${width}`]: { exitHeldAtMs: 40, reopened: true, restored: itemName },
        };
      } finally {
        await context.close();
      }
    });
  }
}

async function checkScrolling(browser, name) {
  const result = {};

  for (const width of [1280, 390]) {
    await check(`${name} fresh-load scrolling (${width}px)`, async () => {
      const { context, page } = await open(browser, { width });
      const positions = [];

      try {
        await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
        await landHome(page);
        await page.waitForFunction(() =>
          document
            .querySelector('.home-desk-frame')
            ?.getAnimations()
            .every((animation) => animation.playState !== 'running'),
        );
        assert.equal(
          await page.evaluate(() => window.scrollY),
          0,
          'a fresh load starts at the top',
        );

        const stage = page.locator(
          '.component-card:has(h3 a[href="/components/glass-command"]) .component-card-stage',
        );

        assert.ok(
          await stage.boundingBox(),
          'the command card must reserve its space before mounting',
        );

        // Demos above the card mount below the viewport as the page nears them and may grow, so
        // the card's place is read again before each step.
        const belowFold = async () => {
          const box = await stage.boundingBox();

          return box.y + box.height > 780;
        };

        await page.mouse.move(width - 12, 430);

        for (let expected = 0; await belowFold();) {
          const before = await page.evaluate(() => window.scrollY);
          expected += 120;
          await page.mouse.wheel(0, 120);
          await page.waitForFunction((target) => Math.abs(window.scrollY - target) <= 2, expected, {
            timeout: 10_000,
          });
          const after = await page.evaluate(() => window.scrollY);
          positions.push({ before, expected, after });

          assert.ok(
            Math.abs(after - expected) <= 2,
            `a 120px wheel step must not jump from ${before}px to ${after}px (expected ${expected}px)`,
          );
        }

        const command = stage.locator('.tile-command');
        await command.waitFor({ state: 'visible' });
        assert.equal(
          await page.evaluate(() => document.activeElement === document.body),
          true,
          'mounting a demo must not take focus',
        );

        const input = command.getByRole('combobox');
        await input.click();
        const beforeKeyboard = await page.evaluate(() => window.scrollY);
        await input.press('End');
        const last = command.getByRole('option', { name: 'Dock Navigation', exact: true });
        await last.and(command.locator('[aria-selected="true"]')).waitFor({ state: 'visible' });
        assert.ok(
          await last.evaluate((element) => {
            const row = element.getBoundingClientRect();
            const list = element.closest('[cmdk-list]').getBoundingClientRect();

            return row.top >= list.top - 2 && row.bottom <= list.bottom + 2;
          }),
          'keyboard navigation must scroll the last result into the command list',
        );
        assert.equal(
          await page.evaluate(() => window.scrollY),
          beforeKeyboard,
          'keyboard navigation must scroll the result list without moving the page',
        );
        await input.fill('dock');
        await page.waitForFunction(
          () => document.querySelectorAll('.tile-command [cmdk-item]').length === 1,
        );
        await input.press('Enter');
        await page.waitForURL(new URL('/components/glass-dock', baseUrl).href);
        result[width] = { wheelSteps: positions.length, keyboardNavigation: true };
      } finally {
        await page.screenshot({
          path: path.join(artifactDirectory, `${name}-scroll-${width}.png`),
        });
        fs.writeFileSync(
          path.join(artifactDirectory, `${name}-scroll-${width}.json`),
          `${JSON.stringify(positions, null, 2)}\n`,
        );
        await context.close();
      }
    });
  }

  return result;
}

async function checkFloatingOrigin(browser, name) {
  // 8: an open menu scales from its trigger.
  await check(`${name} menu origin`, async () => {
    const { context, page } = await open(browser);

    await page.goto(new URL('/components/glass-menu', baseUrl).href, { waitUntil: 'networkidle' });

    const trigger = page
      .locator('[data-release-demo="glass-menu"]')
      .getByRole('button', { name: 'Options' });

    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const menu = page.getByRole('menu');
    await menu.waitFor({ state: 'visible' });

    const origin = await menu.evaluate((element) => {
      const style = getComputedStyle(element);
      const radix = style.getPropertyValue('--radix-dropdown-menu-content-transform-origin').trim();

      return { origin: style.transformOrigin, radix, side: element.getAttribute('data-side') };
    });

    assert.ok(origin.radix, 'Radix must give the menu a transform origin');
    assert.notEqual(
      origin.origin,
      '50% 50%',
      `the menu must grow from its trigger, not its centre (${JSON.stringify(origin)})`,
    );
    await page.keyboard.press('Escape');

    await context.close();
  });
}

// The open bar and the capsule at the default 1280px viewport.
const HEADER_OPEN_WIDTH = 1200;

const HEADER_CAPSULE_WIDTH = 920;

async function checkHeader(browser, name) {
  const result = {};

  // 11 to 15: the header opens at the top, condenses as the page scrolls and opens again.
  for (const [mode, options] of [
    ['motion', {}],
    ['reduced (system)', { reducedMotion: 'reduce' }],
    ['reduced (preference)', { preferences: { reduceMotion: true, theme: 'light' } }],
  ]) {
    await check(`${name} header morph (${mode})`, async () => {
      const { context, page } = await open(browser, options);

      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() =>
        document.querySelector('header.lg-header')?.hasAttribute('data-condensed'),
      );

      await landHome(page);

      const readRest = () =>
        page.evaluate(() => {
          const header = document.querySelector('header.lg-header');
          const glass = header.querySelector('.lg-header-glass');

          return {
            condensed: header.dataset.condensed,
            glass: Number(getComputedStyle(glass, '::before').opacity),
            inline: header.getAttribute('style') ?? '',
            lens: glass.dataset.lgLens ?? null,
            width: Math.round(header.getBoundingClientRect().width),
          };
        });

      // Samples every frame until the header has rested for a few frames in the target state.
      const move = (top, condensed) =>
        page.evaluate(
          ({ top, condensed }) =>
            new Promise((resolve) => {
              const header = document.querySelector('header.lg-header');
              const glass = header.querySelector('.lg-header-glass');
              const frames = [];
              const started = performance.now();
              let still = 0;

              const sample = () => {
                const lineage = [glass];

                for (let node = header; node; node = node.parentElement) lineage.push(node);

                const cutOff = lineage.flatMap((node) => {
                  const style = getComputedStyle(node);

                  const isolates =
                    Number(style.opacity) < 1 ||
                    style.filter !== 'none' ||
                    (style.maskImage || style.webkitMaskImage || 'none') !== 'none' ||
                    style.clipPath !== 'none';

                  return isolates ? [node.className || node.tagName] : [];
                });

                const moving = header.style.getPropertyValue('--lg-header-spread') !== '';

                frames.push({
                  cutOff,
                  frost: getComputedStyle(glass, '::before').backdropFilter,
                  lens: glass.dataset.lgLens ?? null,
                  // A drawn lens map arrives as an feImage in the glass's own filter.
                  map: glass.querySelector('feImage') !== null,
                  moving,
                  width: header.getBoundingClientRect().width,
                });

                const rested = !moving && header.dataset.condensed === String(condensed);

                still = rested ? still + 1 : 0;

                if (still >= 5 || performance.now() - started > 10_000) {
                  resolve({
                    frames,
                    ms: Math.round(performance.now() - started),
                    settled: still >= 5,
                  });
                } else {
                  requestAnimationFrame(sample);
                }
              };

              window.scrollTo(0, top);
              requestAnimationFrame(sample);
            }),
          { top, condensed },
        );

      const reduced = mode !== 'motion';
      const stepped = [];

      const atTop = await readRest();

      assert.equal(atTop.condensed, 'false', 'the header must start open at the top');
      assert.equal(atTop.width, HEADER_OPEN_WIDTH, 'the open bar must span the page');
      assert.equal(atTop.glass, 0, 'the open bar must show no glass');
      await page.screenshot({
        path: path.join(artifactDirectory, `${name}-header-${reduced ? 'reduced-' : ''}open.png`),
        clip: { x: 0, y: 0, width: 1280, height: 96 },
      });

      for (const [top, condensed, width, glass] of [
        [600, true, HEADER_CAPSULE_WIDTH, 1],
        [0, false, HEADER_OPEN_WIDTH, 0],
      ]) {
        const { frames, ms, settled } = await move(top, condensed);
        const rest = await readRest();
        const label = condensed ? 'condensing' : 'opening';

        assert.ok(settled, `${label}, the header must finish its spring: ${JSON.stringify(rest)}`);
        assert.equal(rest.condensed, String(condensed), `${label}, the header must change state`);
        assert.equal(rest.width, width, `${label}, the header must rest at ${width}px`);
        assert.equal(rest.glass, glass, `${label}, the glass must rest at opacity ${glass}`);
        assert.equal(rest.inline, '', `${label}, the header must leave no inline styles`);

        const between = frames.filter(
          (frame) => frame.width > HEADER_CAPSULE_WIDTH + 1 && frame.width < HEADER_OPEN_WIDTH - 1,
        );

        stepped.push({ label, frames: frames.length, between: between.length, ms });

        if (reduced) {
          assert.equal(between.length, 0, `${label}, reduced motion must jump between shapes`);
        } else {
          assert.ok(between.length >= 4, `${label}, the header must morph (${between.length})`);
        }

        for (const frame of between) {
          assert.deepEqual(frame.cutOff, [], `${label}, the glass must keep its backdrop`);
          assert.notEqual(frame.frost, 'none', `${label}, the frost must keep blurring`);
          assert.equal(frame.lens, null, `${label}, the lens must wait for the shape to settle`);
          assert.equal(frame.map, false, `${label}, no lens map may be drawn mid-morph`);
        }

        if (condensed && name === 'chromium') {
          await page.waitForFunction(
            () => document.querySelector('header .lg-header-glass')?.dataset.lgLens === 'active',
          );
        }

        await page.screenshot({
          path: path.join(
            artifactDirectory,
            `${name}-header-${reduced ? 'reduced-' : ''}${condensed ? 'capsule' : 'reopened'}.png`,
          ),
          clip: { x: 0, y: 0, width: 1280, height: 96 },
        });
      }

      result[mode] = stepped;
      await context.close();
    });
  }

  return result;
}

async function checkProCard(browser, name) {
  // 16 to 18: the Pro card's art drifts only when motion is allowed and never fades the window.
  for (const [mode, options] of [
    ['motion', {}],
    ['reduced (system)', { reducedMotion: 'reduce' }],
    ['reduced (preference)', { preferences: { reduceMotion: true, theme: 'light' } }],
  ]) {
    await check(`${name} Pro card (${mode})`, async () => {
      const { context, page } = await open(browser, options);

      await page.goto(new URL('/components', baseUrl).href, { waitUntil: 'networkidle' });
      await page.locator('.pro-card').hover();

      if (mode === 'motion') {
        await page.waitForFunction(
          () => {
            const window = document.querySelector('.pro-card-window');

            return (
              getComputedStyle(window).transform === 'matrix(1, 0, 0, 1, 0, -6)' &&
              !window
                .getAnimations()
                .some(
                  (animation) =>
                    animation instanceof CSSTransition &&
                    animation.transitionProperty === 'transform' &&
                    animation.playState === 'running',
                )
            );
          },
          null,
          { timeout: 10_000 },
        );
      }

      const art = await page.evaluate(() => {
        const running = (selector) =>
          document
            .querySelector(selector)
            .getAnimations()
            .filter(
              (animation) => animation instanceof CSSAnimation && animation.playState === 'running',
            )
            .map((animation) => animation.animationName);

        const window = document.querySelector('.pro-card-window');
        const offenders = [];

        for (
          let node = window;
          node && node !== document.documentElement;
          node = node.parentElement
        ) {
          for (const animation of node.getAnimations()) {
            const frames = animation.effect?.getKeyframes?.() ?? [];
            const moved = frames.flatMap((frame) => Object.keys(frame));

            if (
              moved.some((key) =>
                ['opacity', 'filter', 'mask', 'clipPath', 'webkitMask'].includes(key),
              )
            ) {
              offenders.push(`${node.className || node.tagName}: ${animation.animationName}`);
            }
          }
        }

        return {
          lift: getComputedStyle(window).transform,
          offenders,
          ribbon: running('.pro-card-ribbon'),
          window: running('.pro-card-window'),
        };
      });

      assert.deepEqual(art.offenders, [], 'nothing may fade or filter the ribbon the window bends');

      if (mode === 'motion') {
        assert.deepEqual(art.ribbon, ['pro-card-drift'], 'the ribbon must drift');
        assert.deepEqual(art.window, ['pro-card-float'], 'the window must float');
        assert.equal(
          art.lift,
          'matrix(1, 0, 0, 1, 0, -6)',
          'pointing at the card raises the window',
        );
      } else {
        assert.deepEqual(art.ribbon, [], 'the ribbon must hold still under reduced motion');
        assert.deepEqual(art.window, [], 'the window must hold still under reduced motion');
        assert.equal(art.lift, 'none', 'pointing at the card must not move the window');
      }

      await context.close();
    });
  }
}

const PROMINENT = '.home-cta .lg-button--prominent';

// How high the prominent button's slab rests above the page, where its light comes from and how
// far its shadows sit to either side.
function readSlab(page) {
  return page.evaluate((selector) => {
    const style = getComputedStyle(document.querySelector(selector));

    return {
      angle: Number.parseFloat(style.getPropertyValue('--lg-button-light-angle')),
      rise: Number(style.getPropertyValue('--lg-button-rise')),
      shadowX: [...style.boxShadow.matchAll(/\)\s+(-?[\d.]+)px/g)].map((match) => Number(match[1])),
    };
  }, PROMINENT);
}

const overhead = (slab) => slab.rise === 1 && slab.angle === 0;

// The slab about every 30 ms for the given time.
async function sampleSlab(page, duration) {
  const samples = [];
  const start = Date.now();

  while (Date.now() - start < duration) {
    samples.push(await readSlab(page));
    await page.waitForTimeout(30);
  }

  return samples;
}

// Frames with the light part of the way between the top and the top left.
const swinging = (samples) => samples.filter(({ angle }) => angle < -3 && angle > -47).length;

async function checkButtonLight(browser, name) {
  // 21 to 23: a pointer settles the prominent button and swings its rim light over to the top
  // left while its shadow stays under it; reduced motion makes both changes at once.
  const results = {};

  for (const [mode, slug, options] of [
    ['motion', 'motion', {}],
    ['reduced (system)', 'reduced-system', { reducedMotion: 'reduce' }],
    [
      'reduced (preference)',
      'reduced-preference',
      { preferences: { reduceMotion: true, theme: 'light' } },
    ],
  ]) {
    await check(`${name} button light (${mode})`, async () => {
      const { context, page } = await open(browser, options);

      try {
        await page.goto(new URL('/#home-cta-title', baseUrl).href, { waitUntil: 'networkidle' });
        await landHome(page);

        const button = page.locator(PROMINENT);

        await button.evaluate((node) => node.scrollIntoView({ block: 'center' }));
        await page.mouse.move(2, 2);
        await page.waitForTimeout(400);

        const box = await button.boundingBox();
        const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

        const shot = (label) =>
          page.screenshot({
            clip: { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: box.height + 48 },
            path: path.join(artifactDirectory, `${name}-button-${slug}-${label}.png`),
          });

        const rest = await readSlab(page);

        assert.ok(
          overhead(rest),
          `at rest the slab must stand at full height under an overhead light (${JSON.stringify(rest)})`,
        );
        assert.ok(
          await button.evaluate(
            (node, { x, y }) => node.contains(document.elementFromPoint(x, y)),
            centre,
          ),
          'nothing may cover the button',
        );
        await shot('rest');
        await page.mouse.move(centre.x, centre.y);

        // The light takes 0.55 s to swing over. No screenshot is taken while anything moves: in
        // WebKit one leaves running transitions at their end values.
        const arriving = await sampleSlab(page, 1300);
        const settled = arriving.at(-1);

        assert.ok(
          settled.rise === 0.5,
          `the slab must settle halfway to the page (${settled.rise})`,
        );
        assert.ok(
          Math.abs(settled.angle + 50) < 0.01,
          `the light must come to rest 50deg over the top left (${settled.angle})`,
        );
        assert.ok(
          arriving.every(({ shadowX }) => shadowX.every((x) => x === 0)),
          'the shadow must stay under the slab',
        );
        await shot('hover');

        if (mode !== 'motion') {
          assert.ok(
            arriving.every(
              (sample) =>
                overhead(sample) ||
                (sample.rise === settled.rise && sample.angle === settled.angle),
            ),
            'under reduced motion the slab and its light must change at once',
          );
          results[mode] = { angle: settled.angle, rise: settled.rise };

          return;
        }

        assert.ok(
          arriving.some(({ rise }) => rise > settled.rise + 0.05 && rise < 0.95),
          'the slab must ease down, not jump',
        );
        assert.ok(swinging(arriving) >= 2, 'the light must swing over through frames in between');

        await page.mouse.move(2, 2);

        const leaving = await sampleSlab(page, 1000);

        assert.ok(swinging(leaving) >= 2, 'leaving, the light must ease back to the top');
        assert.ok(
          overhead(leaving.at(-1)),
          `left alone the slab must stand at full height under an overhead light (${JSON.stringify(leaving.at(-1))})`,
        );
        results[mode] = {
          angle: settled.angle,
          rise: settled.rise,
          swingingFrames: { arriving: swinging(arriving), leaving: swinging(leaving) },
        };
      } finally {
        await context.close();
      }
    });
  }

  return results;
}

async function checkTheme(browser, name) {
  // 9: the toggle switches at once with motion and without it.
  for (const [mode, options] of [
    ['motion', {}],
    ['reduced', { reducedMotion: 'reduce' }],
  ]) {
    await check(`${name} theme change (${mode})`, async () => {
      const { context, page } = await open(browser, options);

      await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
      await landHome(page);
      const started = Date.now();
      await page.getByRole('button', { name: 'Change appearance' }).first().click();
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-lg-theme') === 'dark',
        null,
        {
          timeout: 600,
        },
      );
      const elapsed = Date.now() - started;

      const transitions = await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) =>
              String(animation.effect?.pseudoElement ?? '').startsWith('::view-transition'),
            ).length,
      );

      if (mode === 'reduced')
        assert.equal(transitions, 0, 'reduced motion must not crossfade the theme');

      manifest.engines[name] = { ...manifest.engines[name], [`theme-${mode}-ms`]: elapsed };
      await context.close();
    });
  }
}

async function chooseDeskTheme(page, control, theme, keyboard = false) {
  const item = control.getByRole('radio', {
    name: theme === 'light' ? 'Light' : 'Dark',
    exact: true,
  });

  await item.scrollIntoViewIfNeeded();

  if (keyboard) await item.focus();

  await page.evaluate(() => {
    const before = getComputedStyle(document.body);
    const previousColors = { background: before.backgroundColor, foreground: before.color };

    performance.clearMarks('desk-click');
    performance.clearMarks('desk-theme');
    performance.clearMarks('desk-next-frame');
    document.addEventListener('click', () => performance.mark('desk-click'), {
      once: true,
      capture: true,
    });
    document.addEventListener(
      'click',
      () => {
        // React handles the click before it bubbles to document. Observe the actual
        // application here; a later animation frame measures scheduling, not paint.
        const root = document.documentElement;
        const after = getComputedStyle(document.body);

        const detail = {
          theme: root.getAttribute('data-lg-theme'),
          colorScheme: getComputedStyle(root).colorScheme,
          previousColors,
          colors: { background: after.backgroundColor, foreground: after.color },
        };

        performance.mark('desk-theme', { detail });
        requestAnimationFrame(() => performance.mark('desk-next-frame'));
      },
      { once: true },
    );
  });

  if (keyboard) await item.press('Space');
  else await item.click();

  await page.waitForFunction(() => performance.getEntriesByName('desk-next-frame').length > 0);

  const timing = await page.evaluate(() => {
    const clicked = performance.getEntriesByName('desk-click')[0].startTime;
    const applied = performance.getEntriesByName('desk-theme')[0];

    return {
      appliedMs: applied.startTime - clicked,
      nextFrameMs: performance.getEntriesByName('desk-next-frame')[0].startTime - clicked,
      ...applied.detail,
      transitions: document
        .getAnimations()
        .filter((animation) =>
          String(animation.effect?.pseudoElement ?? '').startsWith('::view-transition'),
        ).length,
    };
  });

  assert.equal(timing.theme, theme, `${theme} must apply during the click event`);
  assert.equal(timing.colorScheme, theme, 'the browser color scheme must match the choice');
  assert.notEqual(
    timing.colors.background,
    timing.previousColors.background,
    'the page background must change with the theme',
  );
  assert.notEqual(
    timing.colors.foreground,
    timing.previousColors.foreground,
    'the page foreground must change with the theme',
  );
  assert.equal(
    timing.transitions,
    0,
    'the desk must keep its bubble live instead of taking page snapshots',
  );
  assert.equal(await item.getAttribute('data-state'), 'checked');

  return timing;
}

async function checkDeskTheme(browser, name) {
  const results = {};

  for (const [mode, width, reducedMotion, reduceMotion] of [
    ['desktop', 1280, 'no-preference', false],
    ['mobile', 390, 'no-preference', false],
    ['system-reduced', 1280, 'reduce', false],
    ['preference-reduced', 1280, 'no-preference', true],
  ]) {
    await check(`${name} desk theme (${mode})`, async () => {
      const context = await browser.newContext({
        reducedMotion,
        viewport: { width, height: 1000 },
      });

      try {
        await context.addInitScript(
          ({ key, reduced }) => {
            if (!localStorage.getItem(key))
              localStorage.setItem(key, JSON.stringify({ theme: 'light', reduceMotion: reduced }));
          },
          { key: preferenceStorageKey, reduced: reduceMotion },
        );
        const page = await context.newPage();
        page.setDefaultTimeout(5000);

        await page.goto(new URL('/#home-title', baseUrl).href, { waitUntil: 'networkidle' });
        await page.waitForFunction(
          () => document.querySelector('.desk-screen')?.getAttribute('data-settling') === null,
        );

        if (width < 600) {
          await page
            .locator('.desk-menubar')
            .getByRole('button', { name: 'Glassy UI', exact: true })
            .click();
          await page.getByRole('menuitem', { name: 'Settings…', exact: true }).click();
        }

        const control =
          width < 600
            ? page
                .locator('.desk-settings')
                .getByRole('radiogroup', { name: 'Appearance', exact: true })
            : page
                .locator('.desk-control-center')
                .getByRole('radiogroup', { name: 'Appearance', exact: true });

        const timings = [];

        for (const theme of ['dark', 'light', 'dark', 'light'])
          timings.push({ theme, ...(await chooseDeskTheme(page, control, theme)) });

        timings.push({
          theme: 'dark',
          keyboard: true,
          ...(await chooseDeskTheme(page, control, 'dark', true)),
        });
        const screenshot = `${name}-desk-theme-${mode}.png`;

        await page.screenshot({ path: path.join(artifactDirectory, screenshot) });
        await control.getByRole('radio', { name: 'Light', exact: true }).click();
        await control.getByRole('radio', { name: 'Dark', exact: true }).click();
        await control.getByRole('radio', { name: 'Light', exact: true }).click();
        await control.getByRole('radio', { name: 'Dark', exact: true }).click();
        await page.waitForTimeout(600);
        assert.equal(
          await page.locator('html').getAttribute('data-lg-theme'),
          'dark',
          'the latest rapid choice must win',
        );
        assert.equal(
          await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)).theme,
            preferenceStorageKey,
          ),
          'dark',
        );
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(
          await page.locator('html').getAttribute('data-lg-theme'),
          'dark',
          'reload must preserve the choice',
        );
        assert.equal(
          await page
            .locator('.desk-control-center')
            .getByRole('radio', { name: 'Dark', exact: true, includeHidden: true })
            .getAttribute('data-state'),
          'checked',
        );
        results[mode] = { timings, screenshot };
      } finally {
        await context.close();
      }
    });
  }

  manifest.engines[name] = { ...manifest.engines[name], deskTheme: results };
}

const engines = { chromium, webkit, firefox };

for (const [name, launcher] of Object.entries(engines)) {
  if (firefoxFailuresOnly && name !== 'firefox') continue;
  const options = { headless: true };

  if (name === 'chromium') {
    options.channel = 'chrome';
    options.args = ['--disable-updater-scheduler'];
  }

  const browser = await launcher.launch(options);

  try {
    if (firefoxFailuresOnly) {
      const scrolling = await checkScrolling(browser, name);
      const header = await checkHeader(browser, name);

      manifest.engines[name] = { scrolling, header };
      await checkProCard(browser, name);
      await checkDeskTheme(browser, name);

      continue;
    }

    if (!themeOnly) {
      const entrance = await checkEntrance(browser, name);
      const scrolling = await checkScrolling(browser, name);
      const reveals = await checkReveals(browser, name);
      const header = await checkHeader(browser, name);
      manifest.engines[name] = {
        ...manifest.engines[name],
        ...entrance,
        scrolling,
        reveals,
        header,
      };

      await checkDeskReplay(browser, name);
      await checkProCard(browser, name);
      manifest.engines[name].buttonLight = await checkButtonLight(browser, name);

      if (name === 'chromium') {
        await checkFloatingOrigin(browser, name);
      }
    }

    await checkTheme(browser, name);
    await checkDeskTheme(browser, name);
  } finally {
    await browser.close();
  }
}

fs.writeFileSync(
  path.join(artifactDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

for (const [name, values] of Object.entries(manifest.engines)) {
  console.log(`${name.padEnd(8)} ${JSON.stringify(values)}`);
}

if (failures.length) {
  console.error(`Site motion check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Site motion check passed. Artifacts: ${artifactDirectory}`);
