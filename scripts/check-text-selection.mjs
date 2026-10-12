import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

// People click toggles twice in quick succession, and a control's text must not light up as a
// selection when they do. Text a component shows as content stays selectable. Every way it can
// fail:
//
// 1. A label that toggles or focuses its control selects on a double click: checkbox and radio
//    labels, input and textarea labels, and the labels the site writes beside its switches.
// 2. A triple click on a checkbox label or on the header's Menu toggle selects the line, or runs
//    on into the links the toggle opens.
// 3. A control's own text selects on a double click: toast text (Radix turns selection off
//    inline, unprefixed, which WebKit ignores) and the labels and group headings inside menus,
//    selects and the command menu.
// 4. A double click on the select trigger selects a word anywhere: its second press lands
//    outside the list the first one opened, where Chromium picks the nearest word on the page.
// 5. A dock icon's hover label selects. It floats above the icon and ignores the pointer, so a
//    double click there may select the page's nearest word, as on any empty space, but never
//    the label.
// 6. A button-based control starts selecting after a change of element: a button, tab, segment
//    or page number.
// 7. Content stops being selectable: a description, hint, badge, keycap, breadcrumb page,
//    alert, progress label or dialog text.
// 8. A text field stops selecting its own text, as Safari does when an ancestor turns selection
//    off.

const baseUrl = process.argv[2];

if (!baseUrl || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  console.error(
    'Usage: node scripts/check-text-selection.mjs http://127.0.0.1:3100 [artifact-directory]',
  );
  process.exit(1);
}

const artifactDirectory =
  process.argv[3] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'glassyui-text-selection-'));

fs.mkdirSync(artifactDirectory, { recursive: true });

// What a double or triple click may select: nothing at all, nothing of the target's own, or a
// word of the target's own.
const NOTHING = 'nothing';

const NOT_OWN = 'not-own';

const WORD = 'word';

// `demo` scopes the target to a component page's preview; `open` names the button, or the
// control of `openRole`, that shows it.
const CASES = [
  {
    name: 'checkbox label',
    demo: 'glass-checkbox',
    target: '.lg-check-text > label',
    clicks: [2, 3],
  },
  { name: 'radio label', demo: 'glass-radio-group', target: '.lg-check-text > label' },
  { name: 'input label', demo: 'glass-input', target: 'label' },
  { name: 'textarea label', demo: 'glass-textarea', target: 'label' },
  { name: 'switch demo label', demo: 'glass-switch', target: '.cpreview-list-row label' },
  { name: 'home switch label', page: '/', target: '.bento-switch label' },
  { name: 'desk toggle label', page: '/', target: '.desk-toggle-text label' },
  {
    name: 'header menu toggle',
    demo: 'glass-header',
    target: '.lg-header-menu summary',
    clicks: [2, 3],
    width: 390,
  },
  { name: 'select trigger', demo: 'glass-select', target: '.lg-select-trigger' },
  {
    name: 'select group label',
    demo: 'glass-select',
    open: 'Framework',
    openRole: 'combobox',
    target: '.lg-menu-label',
  },
  { name: 'menu label', demo: 'glass-menu', open: 'Options', target: '.lg-menu-label' },
  {
    name: 'command group heading',
    demo: 'glass-command',
    open: 'Open command menu',
    target: '[cmdk-group-heading]',
  },
  { name: 'toast text', demo: 'glass-toast', open: 'Show toast', target: '.lg-toast-title' },
  { name: 'dock hover label', demo: 'glass-dock', target: '.lg-dock-item', expect: NOT_OWN },
  { name: 'button', demo: 'glass-button', target: '.lg-button' },
  { name: 'tab', demo: 'glass-tabs', target: '[role="tab"]' },
  { name: 'segment', demo: 'glass-segmented-control', target: '.lg-segmented-item' },
  { name: 'page number', demo: 'glass-pagination', target: '.lg-page[aria-label="Page 1"]' },
  {
    name: 'radio description',
    demo: 'glass-radio-group',
    target: '.lg-check-text > span',
    expect: WORD,
  },
  { name: 'textarea hint', demo: 'glass-textarea', target: '[id$="-hint"]', expect: WORD },
  { name: 'badge', demo: 'glass-badge', target: '.lg-badge', expect: WORD },
  { name: 'keycap', demo: 'glass-kbd', target: '.lg-kbd >> text=esc', expect: WORD },
  {
    name: 'breadcrumb page',
    demo: 'glass-breadcrumb',
    target: '.lg-breadcrumb-page',
    expect: WORD,
  },
  { name: 'alert text', demo: 'glass-alert', target: '.lg-alert-description', expect: WORD },
  {
    name: 'progress label',
    demo: 'glass-progress',
    target: '.lg-progress-header span',
    expect: WORD,
  },
  {
    name: 'dialog text',
    demo: 'glass-dialog',
    open: 'Open dialog',
    target: '[role="dialog"] p',
    expect: WORD,
  },
  { name: 'input value', demo: 'glass-input', target: 'input', expect: WORD, type: 'Ada Lovelace' },
];

const failures = [];

const manifest = { baseUrl, failures, engines: {} };

// The middle of the first word the target shows, where a person aims, rather than the middle of
// its box, which can be empty space.
function firstWord(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });

  const node = walker.nextNode();

  if (!node) {
    const box = element.getBoundingClientRect();

    return { x: box.left + Math.min(24, box.width / 2), y: box.top + box.height / 2 };
  }

  const start = node.data.search(/\S/);
  const range = document.createRange();

  range.setStart(node, start);
  range.setEnd(node, start + node.data.slice(start).match(/^\S+/)[0].length);

  const box = range.getBoundingClientRect();

  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

// What the clicks selected, and whether any of it is the target's own. A text field keeps its
// selection to itself.
function readSelection(element) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const text = element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0);

    return { own: Boolean(text.trim()), text: text.trim() };
  }

  const selection = getSelection();
  const text = selection?.toString().trim() ?? '';
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

  return { own: Boolean(text && range?.intersectsNode(element)), text };
}

async function runCase(browser, item, count) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: item.width ?? 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    await page.goto(new URL(item.page ?? `/components/${item.demo}`, baseUrl).href, {
      waitUntil: 'networkidle',
    });

    const scope = item.demo ? page.locator(`[data-release-demo="${item.demo}"]`).first() : page;

    if (item.demo) await scope.scrollIntoViewIfNeeded();

    // Overlays render in a portal outside the preview.
    if (item.open) {
      await scope
        .getByRole(item.openRole ?? 'button', { name: item.open })
        .first()
        .click();
    }

    const target = (item.open ? page : scope).locator(item.target).first();

    await target.waitFor({ state: 'visible' });
    await target.scrollIntoViewIfNeeded();

    if (item.type) await target.fill(item.type);

    await page.evaluate(() => getSelection()?.removeAllRanges());

    const point = await target.evaluate(firstWord);

    await page.mouse.click(point.x, point.y, { clickCount: count, delay: 20 });

    return await target.evaluate(readSelection);
  } finally {
    await context.close();
  }
}

const engines = { chromium, webkit, firefox };

for (const [engine, launcher] of Object.entries(engines)) {
  const browser = await launcher.launch({ headless: true });
  const results = {};

  try {
    for (const item of CASES) {
      const expect = item.expect ?? NOTHING;

      for (const count of item.clicks ?? [2]) {
        const label = `${item.name} ×${count}`;

        try {
          const { own, text } = await runCase(browser, item, count);

          results[label] = text;

          if ((expect === NOTHING && text) || (expect === NOT_OWN && own)) {
            failures.push(`${engine} ${label}: selected ${JSON.stringify(text)}`);
          }

          if (expect === WORD && !own) {
            failures.push(
              `${engine} ${label}: selected none of its text; content must stay selectable`,
            );
          }
        } catch (error) {
          results[label] = null;
          failures.push(`${engine} ${label}: ${error.message.split('\n')[0]}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  manifest.engines[engine] = results;
}

fs.writeFileSync(
  path.join(artifactDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

for (const [engine, results] of Object.entries(manifest.engines)) {
  console.log(`${engine.padEnd(8)} ${JSON.stringify(results)}`);
}

if (failures.length) {
  console.error(`Text selection check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Text selection check passed. Artifacts: ${artifactDirectory}`);
