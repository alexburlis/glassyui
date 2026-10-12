'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import {
  GlassButton,
  GlassLaptop,
  GlassSegmentedControl,
  GlassSegmentedControlItem,
} from '@/components/liquid';
import type { GlassLaptopFinish } from '@/components/liquid';
import '@/styles/laptop-showcase.css';
import { Desk } from './desk';

const FINISHES: Array<{ label: string; value: GlassLaptopFinish }> = [
  { label: 'Black', value: 'black' },
  { label: 'Silver', value: 'silver' },
];

/**
 * The Glass Laptop running the homepage desk on its docs page. It arrives shut
 * and opens once the page has drawn it. Quiet leaves out the finish switch and the lid
 * button, for a gallery tile.
 */
export function LaptopShowcase({
  className,
  quiet = false,
}: {
  className?: string;
  quiet?: boolean;
}) {
  const [finish, setFinish] = useState<GlassLaptopFinish>('black');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={clsx('laptop-showcase', className)}>
      <GlassLaptop
        aria-label="A laptop showing the Glassy UI desk"
        className="laptop-showcase-device"
        finish={finish}
        open={open}
      >
        {/* A picture of the desk, not a working one: its menus and settings sheet open on the
            page at full size, outside the scaled-down screen. */}
        <div className="laptop-showcase-desk" inert>
          <Desk />
        </div>
      </GlassLaptop>
      {quiet ? null : (
        <div className="laptop-showcase-controls">
          <GlassSegmentedControl
            aria-label="Finish"
            className="laptop-showcase-finish"
            onValueChange={(value) => {
              const next = FINISHES.find((item) => item.value === value);

              if (next) setFinish(next.value);
            }}
            value={finish}
          >
            {FINISHES.map((item) => (
              <GlassSegmentedControlItem key={item.value} value={item.value}>
                {item.label}
              </GlassSegmentedControlItem>
            ))}
          </GlassSegmentedControl>
          <GlassButton
            className="laptop-showcase-lid"
            onClick={() => setOpen(!open)}
            variant="soft"
          >
            {open ? 'Close lid' : 'Open lid'}
          </GlassButton>
        </div>
      )}
    </div>
  );
}
