'use client';

import { useState } from 'react';
import { GlassButton, GlassLogoReveal, GlassSlider, usePreferences } from '@/components/liquid';
import '@/styles/logo-reveal-showcase.css';

/** The Glassy UI lockup revealed on a stage of its own, with Replay and a timeline to scrub. */
export function LogoRevealShowcase({ quiet = false }: { quiet?: boolean }) {
  const { preferences } = usePreferences();
  const [run, setRun] = useState(0);
  const [moment, setMoment] = useState<number>();
  const [landed, setLanded] = useState(false);
  const scrubbed = moment === undefined ? (landed ? 100 : 0) : Math.round(moment * 100);

  return (
    <div className="logo-reveal-showcase">
      <GlassLogoReveal
        key={run}
        className="logo-reveal-showcase-stage"
        markSrc={
          preferences.theme === 'light'
            ? '/brand/glassyui-logo.svg'
            : '/brand/glassyui-logo-white.svg'
        }
        name="Glassy UI"
        onComplete={() => setLanded(true)}
        progress={moment}
      />
      {quiet ? null : (
        <div className="logo-reveal-showcase-controls">
          <GlassButton
            onClick={() => {
              setMoment(undefined);
              setLanded(false);
              setRun(run + 1);
            }}
            variant="soft"
          >
            Replay
          </GlassButton>
          <div className="logo-reveal-showcase-timeline">
            <span>Start</span>
            <GlassSlider
              aria-label="Moment"
              max={100}
              min={0}
              onValueChange={([value]) => setMoment(value / 100)}
              step={1}
              value={[scrubbed]}
            />
            <span>Lockup</span>
          </div>
        </div>
      )}
    </div>
  );
}
