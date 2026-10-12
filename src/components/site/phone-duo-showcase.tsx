'use client';

import { useEffect, useState } from 'react';
import {
  GlassButton,
  GlassPhoneDuo,
  GlassSegmentedControl,
  GlassSegmentedControlItem,
  GlassSlider,
  usePreferences,
} from '@/components/liquid';
import type { GlassPhoneDuoFinish, GlassPhoneDuoPose } from '@/components/liquid';
import '@/styles/phone-duo-showcase.css';

const presets: { label: string; angle: number; pose: GlassPhoneDuoPose; view: 'front' | 'back' }[] =
  [
    { label: 'Front', angle: 180, pose: 'upright', view: 'front' },
    { label: 'Rear', angle: 180, pose: 'upright', view: 'back' },
    { label: 'Cover', angle: 0, pose: 'upright', view: 'front' },
    { label: 'Book', angle: 120, pose: 'book', view: 'front' },
    { label: 'Tent', angle: 60, pose: 'tent', view: 'front' },
    { label: 'Laptop', angle: 90, pose: 'laptop', view: 'front' },
    { label: 'Side', angle: 180, pose: 'side', view: 'front' },
  ];

/** Dimensioned hardware showing the same Glassy UI desk at two screen sizes. */
export function PhoneDuoShowcase({ quiet = false }: { quiet?: boolean }) {
  const { preferences } = usePreferences();
  const [open, setOpen] = useState(quiet);
  const [angle, setAngle] = useState<number>();
  const [finish, setFinish] = useState<GlassPhoneDuoFinish>('star-white');
  const [view, setView] = useState<'front' | 'back'>('front');
  const [pose, setPose] = useState<GlassPhoneDuoPose>('upright');
  const currentAngle = angle ?? (open ? 180 : 0);
  const unfolded = (angle ?? (open ? 180 : 0)) > 90;
  const screenTheme = preferences.theme === 'dark' ? '-dark' : '';

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="phone-duo-showcase">
      <GlassPhoneDuo
        angle={angle}
        coverAlt="The Glassy UI desk on the outer phone display"
        coverSrc={`/previews/phone-duo-cover${screenTheme}.webp`}
        finish={finish}
        open={open}
        pose={pose}
        screenAlt="The Glassy UI desk across the unfolded phone display"
        screenSrc={`/previews/phone-duo-inner${screenTheme}.webp`}
        view={view}
      />
      {quiet ? null : (
        <>
          <div aria-label="Phone pose" className="phone-duo-showcase-poses" role="group">
            {presets.map((preset) => {
              const selected =
                preset.pose === pose && preset.view === view && preset.angle === currentAngle;

              return (
                <GlassButton
                  key={preset.label}
                  aria-pressed={selected}
                  onClick={() => {
                    setPose(preset.pose);
                    setView(preset.view);
                    setAngle(preset.angle);
                  }}
                  size="sm"
                  variant={selected ? 'soft' : 'ghost'}
                >
                  {preset.label}
                </GlassButton>
              );
            })}
          </div>
          <div className="phone-duo-showcase-controls">
            <GlassSegmentedControl
              aria-label="Phone finish"
              onValueChange={(value) => {
                if (value === 'night-sky' || value === 'star-white') setFinish(value);
              }}
              value={finish}
            >
              <GlassSegmentedControlItem value="night-sky">Night Sky</GlassSegmentedControlItem>
              <GlassSegmentedControlItem value="star-white">Star White</GlassSegmentedControlItem>
            </GlassSegmentedControl>
            <GlassButton
              onClick={() => {
                setOpen(!unfolded);
                setAngle(undefined);
              }}
              variant="soft"
            >
              {unfolded ? 'Close phone' : 'Open phone'}
            </GlassButton>
            <GlassButton
              onClick={() => setView(view === 'front' ? 'back' : 'front')}
              variant="soft"
            >
              {view === 'front' ? 'View back' : 'View front'}
            </GlassButton>
          </div>
          <div className="phone-duo-showcase-fold">
            <span>Closed</span>
            <GlassSlider
              aria-label="Hinge angle"
              max={180}
              min={0}
              onValueChange={([value]) => setAngle(value)}
              step={1}
              value={[currentAngle]}
            />
            <span>Open</span>
          </div>
        </>
      )}
    </div>
  );
}
