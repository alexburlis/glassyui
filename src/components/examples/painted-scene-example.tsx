'use client';

import { useState } from 'react';
import { GlassPanel } from '../liquid/panel';
import { GlassDrop, GlassScene, type GlassSceneBackdropPainter } from '../liquid/scene';

// A dawn whose sun rises as the scene moves up the window. The painter reads where the scene is
// on every call and returns false while nothing has moved, so the glass redraws only as the
// page scrolls.
function createSunrise(): GlassSceneBackdropPainter {
  let painted = '';

  return (context, { width, height, density }) => {
    const { top } = context.canvas.getBoundingClientRect();
    const rise = Math.min(Math.max(1 - top / window.innerHeight, 0), 1);
    const picture = `${width}x${height}@${density} ${rise.toFixed(3)}`;

    if (picture === painted) return false;

    painted = picture;

    const horizon = height * 0.68;
    const radius = Math.min(width, height) * 0.13;
    const sunX = width * 0.62;
    const sunY = horizon - rise * height * 0.42;

    const sky = context.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#141b36');
    sky.addColorStop(0.6, '#6b3f6e');
    sky.addColorStop(1, '#f0875f');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, horizon);

    const glow = context.createRadialGradient(sunX, sunY, radius, sunX, sunY, radius * 4);
    glow.addColorStop(0, 'rgb(255 196 140 / 0.7)');
    glow.addColorStop(1, 'rgb(255 160 110 / 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, horizon);
    context.fillStyle = '#ffe9c4';
    context.beginPath();
    context.arc(sunX, sunY, radius, 0, Math.PI * 2);
    context.fill();

    const sea = context.createLinearGradient(0, horizon, 0, height);
    sea.addColorStop(0, '#2b2340');
    sea.addColorStop(1, '#0b1022');
    context.fillStyle = sea;
    context.fillRect(0, horizon, width, height - horizon);

    // The sun's path on the water, in streaks that spread towards the viewer.
    context.fillStyle = `rgb(255 214 170 / ${0.35 + 0.5 * rise})`;

    for (let row = 0; row < 9; row += 1) {
      const half = radius * (0.7 + 0.12 * row);

      context.fillRect(
        sunX - half,
        horizon + 3 + 3 * row + 1.2 * row * row,
        half * 2,
        1.5 + row / 4,
      );
    }
  };
}

export function PaintedSceneExample() {
  const [paintSunrise] = useState(createSunrise);

  return (
    <>
      <style>{`
        .glassy-sunrise-example { width: 100%; height: 320px; overflow: hidden; border-radius: 22px; }
        .glassy-sunrise-example-card { position: absolute; top: 24px; left: 24px; width: min(240px, calc(100% - 48px)); padding: 18px; }
        .glassy-sunrise-example-drop { position: absolute; top: calc(68% - 56px); left: calc(62% - 56px); width: 112px; height: 112px; border-radius: 50%; }
      `}</style>
      <GlassScene backdrop={paintSunrise} backdropFps={30} className="glassy-sunrise-example">
        <GlassPanel className="glassy-sunrise-example-card" variant="card">
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Painted backdrop</p>
          <p style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
            The sun rises as you scroll.
          </p>
        </GlassPanel>
        <GlassDrop className="glassy-sunrise-example-drop" />
      </GlassScene>
    </>
  );
}
