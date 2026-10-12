// Usage: node scripts/run-benchmark.js http://127.0.0.1:3000/diagnostics
// Requires: playwright installed (pnpm add -D playwright)

async function main() {
  const input = process.argv[2];

  if (!input) {
    throw new Error(
      'Pass an explicit loopback diagnostics URL, for example http://127.0.0.1:3000/diagnostics.',
    );
  }

  const url = new URL(input);
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !loopbackHosts.has(url.hostname) ||
    url.pathname !== '/diagnostics' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Benchmark URL must be an explicit loopback /diagnostics URL with no query or fragment.',
    );
  }

  const { chromium } = await import('playwright');

  const browser = await chromium.launch({
    args: ['--disable-updater-scheduler'],
    channel: 'chrome',
    headless: true,
  });

  const page = await browser.newPage();

  const result = { found: false, payload: null };

  // Listen to console as primary channel.
  page.on('console', async (msg) => {
    const text = msg.text();

    if (text.includes('[Glassy Benchmark]')) {
      result.found = true;
      result.payload = text;
    }
  });

  console.log(`Opening ${url.href}`);
  await page.goto(url.href, { waitUntil: 'networkidle' });

  // Ensure overlay is open; it defaults to open but this keeps it consistent.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Hide Performance'),
    );

    if (!btn) {
      const openBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Show Performance'),
      );

      openBtn?.click();
    }
  });

  // Try to run benchmark via global hook; fallback to clicking the button.
  console.log('Starting benchmark (8s)...');

  const started = await page.evaluate(() => {
    if (typeof window !== 'undefined' && window.runGlassyBenchmark) {
      window.runGlassyBenchmark();

      return true;
    }

    const ev = new Event('lg-run-benchmark');
    window.dispatchEvent(ev);

    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Run Benchmark'),
    );

    btn?.click();

    return !!btn;
  });

  if (!started) console.warn('Benchmark trigger fallback used.');

  // Wait for console output or fallback timeout after 12s.
  // Wait for up to 12s, then fall back to reading window.__lastBenchmark if present.
  await page.waitForTimeout(14000);

  if (!result.found) {
    const fallback = await page
      .evaluate(() => {
        const w = window;
        const val = w.__lastBenchmarkResult || null;

        return val;
      })
      .catch(() => null);

    if (fallback) {
      result.found = true;
      result.payload = `[Glassy Benchmark] ${JSON.stringify(fallback)}`;
    }
  }

  console.log('Benchmark result:');

  if (result.found && result.payload) {
    console.log(result.payload);
  } else {
    console.error('Not captured. Ensure the app is running and overlay loaded.');
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
