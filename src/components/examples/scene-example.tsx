'use client';

import { useState, type CSSProperties } from 'react';
import { GlassButton } from '../liquid/button';
import { GlassPanel } from '../liquid/panel';
import { GlassDrop, GlassScene } from '../liquid/scene';

const backdropDark =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 900 520" preserveAspectRatio="xMidYMid slice">\n  <defs>\n    <linearGradient id="vermilion-base" x2="0" y2="1"><stop stop-color="#333337"/><stop offset="1" stop-color="#1d1d20"/></linearGradient>\n    <linearGradient id="vermilion-fold" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#ffbd91"/><stop offset=".36" stop-color="#ff754c"/><stop offset=".7" stop-color="#f04a28"/><stop offset="1" stop-color="#c9361a"/></linearGradient>\n    <linearGradient id="vermilion-lip" x2="1" y2=".7"><stop stop-color="#fff5eb"/><stop offset=".4" stop-color="#ffc9a9"/><stop offset="1" stop-color="#ff936b"/></linearGradient>\n    <linearGradient id="vermilion-silver" x2="1" y2=".7"><stop stop-color="#45454c"/><stop offset=".55" stop-color="#696970"/><stop offset="1" stop-color="#45454c"/></linearGradient>\n  </defs>\n  <rect width="900" height="520" fill="url(#vermilion-base)"/>\n  <path d="M-120 515C210 520 255 450 440 362S670 445 1010 302" fill="none" stroke="url(#vermilion-silver)" stroke-width="48"/>\n  <g>\n    <path d="M-150 365C90 225 190 535 420 340C650 145 610 35 1030 125L1030 183C610 93 650 203 420 398C190 593 90 283-150 423Z" fill="#000000" opacity=".22" transform="translate(0 8)"/>\n    <path d="M-150 365C90 225 190 535 420 340C650 145 610 35 1030 125L1030 183C610 93 650 203 420 398C190 593 90 283-150 423Z" fill="url(#vermilion-fold)"/>\n    <path d="M-150 365C90 225 190 535 420 340C650 145 610 35 1030 125" fill="none" stroke="url(#vermilion-lip)" stroke-width="3"/>\n  </g>\n</svg>\n',
  );

const backdropLight =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 900 520" preserveAspectRatio="xMidYMid slice">\n  <defs>\n    <linearGradient id="vermilion-base" x2="0" y2="1"><stop stop-color="#fbfbfc"/><stop offset="1" stop-color="#e2e4e8"/></linearGradient>\n    <linearGradient id="vermilion-fold" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#ffbd91"/><stop offset=".36" stop-color="#ff754c"/><stop offset=".7" stop-color="#f04a28"/><stop offset="1" stop-color="#c9361a"/></linearGradient>\n    <linearGradient id="vermilion-lip" x2="1" y2=".7"><stop stop-color="#fff5eb"/><stop offset=".4" stop-color="#ffc9a9"/><stop offset="1" stop-color="#ff936b"/></linearGradient>\n    <linearGradient id="vermilion-silver" x2="1" y2=".7"><stop stop-color="#d2d5da"/><stop offset=".55" stop-color="#ffffff"/><stop offset="1" stop-color="#d2d5da"/></linearGradient>\n  </defs>\n  <rect width="900" height="520" fill="url(#vermilion-base)"/>\n  <path d="M-120 515C210 520 255 450 440 362S670 445 1010 302" fill="none" stroke="url(#vermilion-silver)" stroke-width="48"/>\n  <g>\n    <path d="M-150 365C90 225 190 535 420 340C650 145 610 35 1030 125L1030 183C610 93 650 203 420 398C190 593 90 283-150 423Z" fill="#000000" opacity=".10" transform="translate(0 8)"/>\n    <path d="M-150 365C90 225 190 535 420 340C650 145 610 35 1030 125L1030 183C610 93 650 203 420 398C190 593 90 283-150 423Z" fill="url(#vermilion-fold)"/>\n    <path d="M-150 365C90 225 190 535 420 340C650 145 610 35 1030 125" fill="none" stroke="url(#vermilion-lip)" stroke-width="3"/>\n  </g>\n</svg>\n',
  );

const backdropStyle: CSSProperties & {
  '--example-backdrop-dark': string;
  '--example-backdrop-light': string;
} = {
  '--example-backdrop-dark': 'url("' + backdropDark + '")',
  '--example-backdrop-light': 'url("' + backdropLight + '")',
};

type SceneExampleProps = { onAction?: (message: string) => void };

export function SceneExample({ onAction }: SceneExampleProps) {
  const [merged, setMerged] = useState(false);
  const [flowing, setFlowing] = useState(false);
  const [message, setMessage] = useState('');

  function announce(next: string) {
    setMessage(next);
    onAction?.(next);
  }

  return (
    <>
      <style>{`
        .glassy-scene-example { --example-backdrop: var(--example-backdrop-dark); container-type: inline-size; width: 100%; height: 340px; overflow: hidden; border-radius: 22px; }
        [data-lg-theme="light"] .glassy-scene-example { --example-backdrop: var(--example-backdrop-light); }
        .glassy-scene-example-card { position: absolute; top: 24px; left: 24px; width: min(260px, calc(100% - 48px)); padding: 18px; }
        .glassy-scene-example-drop { position: absolute; border-radius: 50%; transition: right 700ms var(--lg-spring), bottom 700ms var(--lg-spring); }
        .glassy-scene-example-large { right: 24px; bottom: 78px; width: clamp(84px, 25cqi, 144px); height: clamp(84px, 25cqi, 144px); }
        .glassy-scene-example-small { right: calc(24px + clamp(84px, 25cqi, 144px) + 34px); bottom: 92px; width: clamp(58px, 17cqi, 98px); height: clamp(58px, 17cqi, 98px); }
        .glassy-scene-example[data-merged="true"] .glassy-scene-example-small { right: calc(24px + clamp(84px, 25cqi, 144px) - 18px); bottom: 106px; }
        .glassy-scene-example-actions { --lg-scene-merge: 0px; position: absolute; bottom: 22px; left: 24px; display: flex; gap: 8px; }
        [data-lg-reduce-motion="1"] .glassy-scene-example-drop { transition: none; }
        @media (prefers-reduced-motion: reduce) { .glassy-scene-example-drop { transition: none; } }
      `}</style>
      <GlassScene
        backdrop="var(--example-backdrop)"
        style={backdropStyle}
        className="glassy-scene-example"
        data-merged={merged}
        flow={flowing}
        optics={{ merge: 24 }}
      >
        <GlassDrop className="glassy-scene-example-drop glassy-scene-example-large" />
        <GlassDrop className="glassy-scene-example-drop glassy-scene-example-small" />
        <GlassPanel className="glassy-scene-example-card" variant="card">
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Glassy UI</p>
          <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>
            Light bends at every edge.
          </p>
        </GlassPanel>
        <div className="glassy-scene-example-actions">
          <GlassButton
            aria-pressed={merged}
            onClick={() => {
              setMerged(!merged);
              announce(`Drops ${merged ? 'apart' : 'merged'}.`);
            }}
            size="sm"
            variant="prominent"
          >
            Merge
          </GlassButton>
          <GlassButton
            aria-pressed={flowing}
            onClick={() => {
              setFlowing(!flowing);
              announce(`Flow ${flowing ? 'off' : 'on'}.`);
            }}
            size="sm"
          >
            Flow
          </GlassButton>
        </div>
      </GlassScene>
      {!onAction ? (
        <span
          role="status"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clipPath: 'inset(50%)',
          }}
        >
          {message}
        </span>
      ) : null}
    </>
  );
}
