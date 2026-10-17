'use client';

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import clsx from 'clsx';
import { forwardRef } from 'react';

export type GlassScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> & {
  /** Which scrollbars to draw. */
  scrollbars?: 'vertical' | 'horizontal' | 'both';
  /** Props for the element that scrolls, such as its ref, id or aria-label. */
  viewportProps?: React.ComponentPropsWithRef<typeof ScrollAreaPrimitive.Viewport>;
};

// Native scrolling in a viewport, with a thin glass scrollbar over its edge in place of the
// system's. By default the bar shows only while the pointer is over the area or it scrolls, so a
// resting page shows none; see .lg-scroll-area in liquid.css.
export const GlassScrollArea = forwardRef<HTMLDivElement, GlassScrollAreaProps>(
  (
    { children, className, scrollbars = 'vertical', type = 'hover', viewportProps, ...props },
    forwardedRef,
  ) => (
    <ScrollAreaPrimitive.Root
      ref={forwardedRef}
      type={type}
      className={clsx('lg-scroll-area', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        {...viewportProps}
        className={clsx('lg-scroll-area-viewport', viewportProps?.className)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {scrollbars === 'horizontal' ? null : <GlassScrollBar orientation="vertical" />}
      {scrollbars === 'vertical' ? null : <GlassScrollBar orientation="horizontal" />}
      {scrollbars === 'both' ? (
        <ScrollAreaPrimitive.Corner className="lg-scroll-area-corner" />
      ) : null}
    </ScrollAreaPrimitive.Root>
  ),
);

GlassScrollArea.displayName = 'GlassScrollArea';

function GlassScrollBar({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  return (
    <ScrollAreaPrimitive.Scrollbar className="lg-scrollbar" orientation={orientation}>
      <ScrollAreaPrimitive.Thumb className="lg-scrollbar-thumb" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}
