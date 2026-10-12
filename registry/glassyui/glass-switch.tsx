'use client';

import './styles/liquid.css';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import clsx from 'clsx';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { motionReduced } from './lib/liquid-motion';
import { mergeRefs } from './lib/merge-refs';

export type GlassSwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'md';
};

// How long the knob stays glass after a flip, a little longer than its slide.
const TRAVEL_MS = 460;

// The knob turns to glass while pressed and stays glass, stretching like a
// drop, while it slides to its new side; see .lg-switch in liquid.css.
export const GlassSwitch = forwardRef<HTMLButtonElement, GlassSwitchProps>(
  ({ className, size = 'md', onCheckedChange, ...props }, forwardedRef) => {
    const rootRef = useRef<HTMLButtonElement | null>(null);
    const travel = useRef(0);
    const ref = useMemo(() => mergeRefs(rootRef, forwardedRef), [forwardedRef]);

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
        onCheckedChange={handleCheckedChange}
        {...props}
      >
        <SwitchPrimitive.Thumb className="lg-switch-thumb" />
      </SwitchPrimitive.Root>
    );
  },
);

GlassSwitch.displayName = 'GlassSwitch';
