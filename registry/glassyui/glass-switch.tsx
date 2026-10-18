'use client';

import './styles/liquid.css';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import clsx from 'clsx';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { motionReduced } from './lib/liquid-motion';
import { mergeRefs } from './lib/merge-refs';
import { useCapsuleMagnifierFilter } from './lib/use-refraction-filter';
import { useOptionalPreferences } from './glass-provider';

export type GlassSwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'md';
};

// How long the knob stays glass after a flip, a little longer than its slide.
const TRAVEL_MS = 460;

// The colour split at the knob's rim. A lens this small, drawn only while the knob is
// touched or sliding, costs little, so it splits colour at every quality but low.
const KNOB_DISPERSION = 0.45;

// The lens's copy is laid out at three times the knob's size and scaled back down, so
// engines that filter at layout resolution still bend it smoothly.
const LENS_SUPERSAMPLE = 3;

// The knob turns to thick glass while pressed and stays glass, stretching like
// a drop, while it slides to its new side; see .lg-switch in liquid.css. The glass
// is a magnifier over a copy of the track, which bends into the rim and splits into
// colour there in every engine.
export const GlassSwitch = forwardRef<HTMLButtonElement, GlassSwitchProps>(
  ({ className, disabled, size = 'md', onCheckedChange, ...props }, forwardedRef) => {
    const { preferences } = useOptionalPreferences();
    const rootRef = useRef<HTMLButtonElement | null>(null);
    const thumbRef = useRef<HTMLSpanElement | null>(null);
    const travel = useRef(0);
    const ref = useMemo(() => mergeRefs(rootRef, forwardedRef), [forwardedRef]);

    const lens = useCapsuleMagnifierFilter(thumbRef, {
      dispersion: KNOB_DISPERSION,
      enabled: !disabled && !preferences.reduceTransparency && preferences.quality !== 'low',
      signature: `${preferences.theme}:${preferences.quality}:${preferences.thickness}`,
      supersample: LENS_SUPERSAMPLE,
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
        {lens.filterElement}
        <SwitchPrimitive.Thumb
          ref={thumbRef}
          className="lg-switch-thumb"
          style={
            // SAFETY: CSSProperties has no custom-property index; this adds two custom properties.
            lens.active
              ? ({
                  '--lg-switch-lens-margin': `${lens.margin}px`,
                  '--lg-switch-lens-scale': lens.supersample,
                } as CSSProperties)
              : undefined
          }
        >
          {lens.active ? (
            <span aria-hidden className="lg-switch-lens">
              <span className="lg-switch-lens-view" style={{ filter: lens.filterStyle }}>
                <span className="lg-switch-lens-track" />
              </span>
            </span>
          ) : null}
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
    );
  },
);

GlassSwitch.displayName = 'GlassSwitch';
