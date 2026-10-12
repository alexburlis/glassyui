import { notFound } from 'next/navigation';
import { ComponentGallery } from '@/components/component-gallery';
import { DebugPanel } from '@/components/debug-panel';
import { LiquidFilters } from '@/components/liquid';
import { PerformanceOverlay } from '@/components/performance-overlay';
import { PreferenceControls } from '@/components/preference-controls';

export default function DiagnosticsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[var(--lg-bg)] px-6 py-24 text-[var(--lg-foreground)]"
      id="main-content"
    >
      <LiquidFilters />
      <PerformanceOverlay />
      <DebugPanel />

      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="absolute left-[-8%] top-24 h-16 w-[48%] rotate-[-4deg] bg-cyan-400/20 blur-xl" />
        <div className="absolute right-[-10%] top-[42%] h-14 w-[52%] rotate-[5deg] bg-fuchsia-400/18 blur-xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <section className="relative z-10 mx-auto max-w-6xl space-y-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--lg-foreground)]/50">
            Diagnostics
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Glass material runtime</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--lg-foreground)]/65">
            Debug controls, benchmark overlay, and component gallery live here so the default
            homepage stays free of diagnostics runtime work.
          </p>
        </div>

        <PreferenceControls />
        <ComponentGallery />
      </section>
    </main>
  );
}
