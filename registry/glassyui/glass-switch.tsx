'use client';

import './styles/liquid.css';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import clsx from 'clsx';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { motionReduced } from './lib/liquid-motion';
import { mergeRefs } from './lib/merge-refs';
import { useLensFilter } from './lib/use-refraction-filter';
import { useOptionalPreferences } from './glass-provider';

export type GlassSwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'md';
};

// How long the knob stays glass after a flip, a little longer than its slide.
const TRAVEL_MS = 460;

// The knob turns to thick glass while pressed and stays glass, stretching like
// a drop, while it slides to its new side; see .lg-switch in liquid.css. In
// Chromium the glass is a lens that bends the track under its rim.
export const GlassSwitch = forwardRef<HTMLButtonElement, GlassSwitchProps>(
  ({ className, disabled, size = 'md', onCheckedChange, ...props }, forwardedRef) => {
    const { preferences } = useOptionalPreferences();
    const rootRef = useRef<HTMLButtonElement | null>(null);
    const thumbRef = useRef<HTMLSpanElement | null>(null);
    const travel = useRef(0);
    const ref = useMemo(() => mergeRefs(rootRef, forwardedRef), [forwardedRef]);

    const lensFilter = useLensFilter(thumbRef, {
      enabled: !disabled && !preferences.reduceTransparency,
      signature: `${preferences.theme}:${preferences.mode}:${preferences.quality}:${preferences.thickness}`,
    });

    useEffect(() => () => window.clearTimeout(travel.current), []);

    const handleCheckedChange = (checked: boolean) => {
      onCheckedChange?.(checked);

      const root = rootRef.current;

      if (!root || motionReduced()) return;

      window.clearTimeout(travel.current);
      root.setAttribute('data-lg-moving', '');
      travel.current = window.setTimeout(() => root.removeAttribute('data-lg-moving'), TRAVEL_MS);
    };

    return (
      <SwitchPrimitive.Root
        ref={ref}
        data-size={size}
        className={clsx('lg-switch', className)}
        disabled={disabled}
        onCheckedChange={handleCheckedChange}
        {...props}
      >
        {lensFilter.filterElement}
        <SwitchPrimitive.Thumb
          ref={thumbRef}
          className="lg-switch-thumb"
          data-lg-lens={lensFilter.active ? 'active' : undefined}
          style={
            // SAFETY: CSSProperties has no custom-property index; this adds one string-valued property.
            lensFilter.filterStyle
              ? ({ '--lg-lens-filter': lensFilter.filterStyle } as CSSProperties)
              : undefined
          }
        />
      </SwitchPrimitive.Root>
    );
  },
);

GlassSwitch.displayName = 'GlassSwitch';
