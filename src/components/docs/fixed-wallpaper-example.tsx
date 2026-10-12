import { GlassSurface } from '@/components/liquid';

// Both copies fill the viewport, so the pane's copy lines up with the fixed one behind it.
function Wallpaper() {
  return <div className="glass-window-wallpaper" />;
}

// GlassSurface over a fixed wallpaper. The band clips the wallpaper, which holds still while the
// page scrolls, and the pane bends a viewport-aligned copy of it with an SVG filter.
export function FixedWallpaperExample() {
  return (
    <div className="glass-window glass-window--example">
      <div aria-hidden className="glass-window-backdrop">
        <Wallpaper />
      </div>
      <GlassSurface
        className="glass-window-pane"
        preset="showcase"
        refraction="strong"
        refractionBackground={<Wallpaper />}
        refractionBackgroundSpace="viewport"
        thickness={3}
      >
        <p className="glass-window-title">
          Bends light.
          <span className="glass-window-title-accent">Scroll to watch.</span>
        </p>
        <p className="glass-window-lead">
          The wallpaper holds still, and the pane bends a copy of it that stays lined up as the page
          scrolls.
        </p>
      </GlassSurface>
    </div>
  );
}
