'use client';

import { GlassLens } from '../liquid/lens';

export function LensExample() {
  return (
    <GlassLens
      defaultPosition={{ x: 0.62, y: 0.5 }}
      size={116}
      style={{ width: '100%', maxWidth: 440, height: 240, borderRadius: 22 }}
      zoom={1.7}
    >
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          boxSizing: 'border-box',
          width: '100%',
          height: '100%',
          padding: 24,
          background:
            'linear-gradient(rgb(142 142 147 / .14) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(90deg, rgb(142 142 147 / .14) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(135deg, transparent 62%, rgb(255 117 76 / .2) 64%, rgb(240 74 40 / .2) 70%, transparent 72%), linear-gradient(135deg, var(--lg-bg), var(--lg-opaque-surface))',
          color: 'var(--lg-foreground)',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            maxWidth: '12ch',
            margin: 0,
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: '-0.025em',
          }}
        >
          A closer look at the details.
        </p>
      </div>
    </GlassLens>
  );
}
