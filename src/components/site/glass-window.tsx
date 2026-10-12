'use client';

import { GlassScene, GlassSurface, usePreferences } from '@/components/liquid';

// Three times regular glass, scaled the way GlassScene scales its default slab with the
// thickness preference: a wider rim that bends the wallpaper further and splits more colour.
const THICKNESS = 3;

const THICK_GLASS = {
  bevel: 28 * (0.6 + 0.4 * THICKNESS),
  dispersion: 0.15 * THICKNESS,
  thickness: 40 * THICKNESS,
};

// WebGL draws the pane as a slab of thick glass over the wallpaper, which holds still while the
// page scrolls the pane across it, so every browser bends it the same way on the GPU. Under
// reduced motion the wallpaper scrolls with the band and nothing shifts behind the glass.
export function GlassWindow() {
  const { preferences } = usePreferences();

  return (
    <section aria-labelledby="home-window-title" className="home-window">
      <GlassScene
        backdrop="var(--site-wallpaper)"
        backdropSpace={preferences.reduceMotion ? 'local' : 'viewport'}
        className="glass-window"
        optics={THICK_GLASS}
      >
        <GlassSurface className="glass-window-pane" lens={false} preset="showcase">
          <h2 className="glass-window-title" id="home-window-title">
            Bends light.
            <span className="glass-window-title-accent">In any browser.</span>
          </h2>
          <p className="glass-window-lead">
            Give the glass its backdrop and Safari, Chrome and Firefox all bend it the same way.
            Scroll to watch.
          </p>
        </GlassSurface>
      </GlassScene>
    </section>
  );
}
