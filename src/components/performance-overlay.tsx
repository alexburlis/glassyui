'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Metrics = {
  fpsAvg: number;
  fpsMin: number;
  fpsP95: number;
  frameAvg: number;
  frameP95: number;
  over16: number;
  over33: number;
  jsCost: number;
  heapUsed: number | null;
  heapTotal: number | null;
  heapDelta: number | null;
};

type BenchmarkResult = {
  samples: number;
  fpsAvg: number;
  fpsP95: number;
  frameAvg: number;
  frameP95: number;
  over16: number;
  over33: number;
  jsCost: number;
  heapDelta: number | null;
  score: number;
};

const DEFAULT_METRICS: Metrics = {
  fpsAvg: 0,
  fpsMin: 0,
  fpsP95: 0,
  frameAvg: 0,
  frameP95: 0,
  over16: 0,
  over33: 0,
  jsCost: 0,
  heapUsed: null,
  heapTotal: null,
  heapDelta: null,
};

type Env = {
  dpr: number;
  cores: number | null;
  prefersReducedMotion: boolean;
};

const BENCH_DURATION = 8000;

type PerfMemory = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
};

type PerformanceWithMemory = Performance & { memory?: PerfMemory };

declare global {
  interface Window {
    __lastBenchmarkResult?: unknown;
    runGlassyBenchmark?: () => void;
  }
}

export function PerformanceOverlay() {
  // Keep mounted for quick access, but start closed so we don't burn a 60fps rAF at idle.
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS);
  const metricsRef = useRef<Metrics>(DEFAULT_METRICS);
  const [mounted, setMounted] = useState(false);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const benchmarkRunningRef = useRef(false);

  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);

  const benchmarkSamples = useRef<Metrics[]>([]);
  const rafId = useRef<number>(0);
  const lastFrame = useRef(0);
  const samples = useRef<number[]>([]);
  const jsSamples = useRef<number[]>([]);

  const [env, setEnv] = useState<Env>({
    dpr: 1,
    cores: null,
    prefersReducedMotion: false,
  });

  const heapBaseline = useRef<number | null>(null);

  const startBenchmark = useCallback(() => {
    if (benchmarkRunningRef.current) return;
    setBenchmarkRunning(true);
    benchmarkRunningRef.current = true;
    setBenchmarkResult(null);
    benchmarkSamples.current = [];

    // Glass answers to what moves behind it, so the run scrolls the page down
    // and back up again.
    window.scrollTo({ top: 0, behavior: 'instant' });
    const started = performance.now();

    const travel = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

    const scroll = (now: number) => {
      const progress = Math.min((now - started) / BENCH_DURATION, 1);

      window.scrollTo({
        top: travel * (0.5 - 0.5 * Math.cos(progress * 2 * Math.PI)),
        behavior: 'instant',
      });

      if (progress < 1) requestAnimationFrame(scroll);
    };

    requestAnimationFrame(scroll);
    window.setTimeout(() => {
      const samplesArr = benchmarkSamples.current;
      const result = aggregateBenchmark(samplesArr);
      setBenchmarkResult(result);
      window.__lastBenchmarkResult = result;
      setBenchmarkRunning(false);
      benchmarkRunningRef.current = false;
      console.info('[Glassy Benchmark]', result);
    }, BENCH_DURATION + 500);
  }, []);

  useEffect(() => {
    // first client paint should match SSR; we flip mounted after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const next: Env = {
      dpr: typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1,
      cores:
        typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? navigator.hardwareConcurrency
          : null,
      prefersReducedMotion:
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };

    setEnv(next);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const sampleEnabled = open || benchmarkRunning;

    if (!sampleEnabled) return;

    lastFrame.current = performance.now();

    const tick = () => {
      const start = performance.now();
      const now = start;
      const delta = now - lastFrame.current;
      lastFrame.current = now;
      samples.current.push(delta);

      if (samples.current.length > 120) samples.current.shift();
      const sorted = [...samples.current].sort((a, b) => a - b);

      const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;

      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? avg;
      const min = sorted[0] ?? avg;

      const over16 = samples.current.filter((d) => d > 16.7).length / samples.current.length;

      const over33 = samples.current.filter((d) => d > 33.3).length / samples.current.length;

      const jsCost = performance.now() - start;

      jsSamples.current.push(jsCost);

      if (jsSamples.current.length > 120) jsSamples.current.shift();

      // SAFETY: performance.memory is a non-standard Chromium field that other engines omit.
      const perfMemory = (performance as PerformanceWithMemory).memory;

      const used = perfMemory ? perfMemory.usedJSHeapSize / (1024 * 1024) : null;

      const total = perfMemory ? perfMemory.jsHeapSizeLimit / (1024 * 1024) : null;

      if (heapBaseline.current == null && used != null) heapBaseline.current = used;

      const heapDelta =
        used != null && heapBaseline.current != null ? used - heapBaseline.current : null;

      const next: Metrics = {
        ...metricsRef.current,
        fpsAvg: avg > 0 ? 1000 / avg : 0,
        fpsMin: min > 0 ? 1000 / min : 0,
        fpsP95: p95 > 0 ? 1000 / p95 : 0,
        frameAvg: avg,
        frameP95: p95,
        over16,
        over33,
        jsCost,
        heapUsed: used,
        heapTotal: total,
        heapDelta,
      };

      metricsRef.current = next;
      setMetrics(next);

      if (benchmarkRunningRef.current) {
        benchmarkSamples.current.push(next);
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [open, mounted, benchmarkRunning]);

  useEffect(() => {
    if (!mounted) return;
    const run = () => startBenchmark();
    window.runGlassyBenchmark = run;
    const handler = () => startBenchmark();
    window.addEventListener('lg-run-benchmark', handler);

    return () => {
      delete window.runGlassyBenchmark;
      window.removeEventListener('lg-run-benchmark', handler);
    };
  }, [mounted, startBenchmark]);

  const formatNumber = (n: number, digits = 1) => n.toFixed(digits);
  const percent = (n: number) => `${formatNumber(n * 100, 0)}%`;

  const copyBenchmark = async () => {
    if (!benchmarkResult) return;

    const lines = [
      `Glassy Benchmark`,
      `Score: ${formatNumber(benchmarkResult.score, 0)}`,
      `FPS: avg ${formatNumber(benchmarkResult.fpsAvg, 0)}, p95 ${formatNumber(
        benchmarkResult.fpsP95,
        0,
      )}`,
      `Frame: avg ${formatNumber(
        benchmarkResult.frameAvg,
        1,
      )}ms, p95 ${formatNumber(benchmarkResult.frameP95, 1)}ms`,
      `>16ms: ${percent(benchmarkResult.over16)} | >33ms: ${percent(benchmarkResult.over33)}`,
      `JS cost: ${formatNumber(benchmarkResult.jsCost, 2)}ms`,
      `Heap Δ: ${
        benchmarkResult.heapDelta != null
          ? `${benchmarkResult.heapDelta > 0 ? '+' : ''}${formatNumber(
              benchmarkResult.heapDelta,
              1,
            )} MB`
          : 'N/A'
      }`,
      `Samples: ${benchmarkResult.samples}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(lines);
    } catch (err) {
      console.warn('Clipboard copy failed', err);
    }
  };

  return (
    <div className="fixed left-4 top-20 z-[70] flex flex-col gap-2 text-xs text-white">
      <button
        className="rounded-md border border-white/20 bg-black/60 px-3 py-1.5 font-semibold uppercase tracking-wide backdrop-blur-md hover:border-white/40"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide Performance' : 'Show Performance'}
      </button>
      {open ? (
        <div className="min-w-[240px] space-y-2 rounded-lg border border-white/12 bg-black/75 p-3 backdrop-blur-lg">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-white/60">
            <span>Runtime</span>
            <span className="text-white/50">
              DPR {formatNumber(env.dpr, 1)} · Cores {env.cores ?? 'N/A'} · PRM{' '}
              {env.prefersReducedMotion ? 'On' : 'Off'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <Metric label="FPS avg" value={formatNumber(metrics.fpsAvg, 0)} />
            <Metric label="FPS p95" value={formatNumber(metrics.fpsP95, 0)} />
            <Metric label="Frame avg" value={`${formatNumber(metrics.frameAvg, 1)} ms`} />
            <Metric label="Frame p95" value={`${formatNumber(metrics.frameP95, 1)} ms`} />
            <Metric label=">16ms" value={percent(metrics.over16)} />
            <Metric label=">33ms" value={percent(metrics.over33)} />
            <Metric label="JS cost" value={`${formatNumber(metrics.jsCost, 2)} ms`} />
            <Metric
              label="Heap"
              value={
                metrics.heapUsed != null && metrics.heapTotal != null
                  ? `${formatNumber(metrics.heapUsed, 0)} / ${formatNumber(
                      metrics.heapTotal,
                      0,
                    )} MB`
                  : 'N/A'
              }
            />
            <Metric
              label="Heap Δ"
              value={
                metrics.heapDelta != null
                  ? `${metrics.heapDelta > 0 ? '+' : ''}${formatNumber(metrics.heapDelta, 1)} MB`
                  : 'N/A'
              }
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide hover:border-white/40"
              onClick={startBenchmark}
              disabled={benchmarkRunning}
            >
              {benchmarkRunning ? 'Benchmarking…' : 'Run Benchmark (8s)'}
            </button>
            {benchmarkResult ? (
              <div className="flex flex-col gap-1 text-[11px] text-white/80">
                <span>
                  Score {formatNumber(benchmarkResult.score, 0)} · FPS p95{' '}
                  {formatNumber(benchmarkResult.fpsP95, 0)} · Frame p95{' '}
                  {formatNumber(benchmarkResult.frameP95, 1)}ms
                </span>
                <button
                  className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide hover:border-white/40"
                  onClick={copyBenchmark}
                >
                  Copy Benchmark
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] text-white/70">
      <span>{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

function aggregateBenchmark(samples: Metrics[]): BenchmarkResult {
  if (!samples.length) {
    return {
      samples: 0,
      fpsAvg: 0,
      fpsP95: 0,
      frameAvg: 0,
      frameP95: 0,
      over16: 0,
      over33: 0,
      jsCost: 0,
      heapDelta: null,
      score: 0,
    };
  }

  const fpsP95 = percentile(
    samples.map((s) => s.fpsP95),
    0.95,
  );

  const fpsAvg = average(samples.map((s) => s.fpsAvg));
  const frameAvg = average(samples.map((s) => s.frameAvg));

  const frameP95 = percentile(
    samples.map((s) => s.frameP95),
    0.95,
  );

  const over16 = average(samples.map((s) => s.over16));
  const over33 = average(samples.map((s) => s.over33));
  const jsCost = average(samples.map((s) => s.jsCost));

  const heapDelta = (() => {
    const first = samples.find((s) => s.heapDelta != null)?.heapDelta;

    const last = samples
      .slice()
      .reverse()
      .find((s) => s.heapDelta != null)?.heapDelta;

    if (first == null || last == null) return null;

    return last - first;
  })();

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const normFps = clamp01(fpsP95 / 60);
  const normFrame = clamp01(16.7 / Math.max(frameP95, 0.1));
  const normOver16 = clamp01(1 - over16);
  const normOver33 = clamp01(1 - over33 * 2);
  const normJs = clamp01(1 - jsCost / 8);

  const score = normFps * 40 + normFrame * 25 + normOver16 * 10 + normOver33 * 5 + normJs * 20;

  return {
    samples: samples.length,
    fpsAvg,
    fpsP95,
    frameAvg,
    frameP95,
    over16,
    over33,
    jsCost,
    heapDelta,
    score,
  };
}

function average(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function percentile(arr: number[], p: number) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);

  return sorted[idx] ?? sorted[sorted.length - 1];
}
