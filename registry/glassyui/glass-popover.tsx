'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import clsx from 'clsx';
import { GlassPanel } from './glass-panel';

const radixSlotProps = { asChild: true };

export const GlassPopover = PopoverPrimitive.Root;

export const GlassPopoverTrigger = PopoverPrimitive.Trigger;

export const GlassPopoverAnchor = PopoverPrimitive.Anchor;

export type GlassPopoverContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> & {
  /** How thick the glass is, as a multiple of regular. See GlassSurface. */
  thickness?: number;
};

export function GlassPopoverContent(props: GlassPopoverContentProps) {
  const { className, sideOffset = 12, ...rest } = props;

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content sideOffset={sideOffset} {...rest} {...radixSlotProps}>
        <GlassPanel
          lens
          preset="prominent"
          variant="card"
          elevation="raised"
          refraction="none"
          className={clsx('lg-popover-content', className)}
        >
          {props.children}
        </GlassPanel>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
