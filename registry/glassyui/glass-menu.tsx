'use client';

import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import { forwardRef, useMemo, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import { mergeRefs } from './lib/merge-refs';
import { GlassPanel } from './glass-panel';

const radixSlotProps = { asChild: true };

/**
 * Menus are non-modal by default, like the WAI-ARIA menu button: the page stays in the
 * accessibility tree and keeps its scroll, while Radix still blocks Tab inside the open
 * menu and closes it when focus leaves. Pass `modal` to lock the page instead.
 */
export function GlassMenu({
  modal = false,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root modal={modal} {...props} />;
}

export const GlassMenuTrigger = MenuPrimitive.Trigger;

export const GlassMenuGroup = MenuPrimitive.Group;

export const GlassMenuRadioGroup = MenuPrimitive.RadioGroup;

export const GlassMenuSub = MenuPrimitive.Sub;

export type GlassMenuContentProps = React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content> & {
  /** How thick the glass is, as a multiple of regular. See GlassSurface. */
  thickness?: number;
};

export const GlassMenuContent = forwardRef<HTMLDivElement, GlassMenuContentProps>(
  ({ children, className, onInteractOutside, sideOffset = 8, ...props }, forwardedRef) => {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const ref = useMemo(() => mergeRefs(contentRef, forwardedRef), [forwardedRef]);

    return (
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          {...props}
          onInteractOutside={(event) => {
            onInteractOutside?.(event);

            const content = contentRef.current;
            const triggerId = content?.getAttribute('aria-labelledby');

            if (!content || !triggerId) return;

            const trigger = content.ownerDocument.getElementById(triggerId);

            // The trigger already toggles the menu. Its closing layer stays mounted for the
            // exit animation and must not dismiss the same pointer click that reopens it.
            if (event.target instanceof Node && trigger?.contains(event.target)) {
              event.preventDefault();
            }
          }}
          {...radixSlotProps}
        >
          <GlassPanel
            elevation="raised"
            lens
            preset="prominent"
            refraction="none"
            variant="card"
            className={clsx('lg-menu-content', className)}
          >
            {children}
          </GlassPanel>
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    );
  },
);

GlassMenuContent.displayName = 'GlassMenuContent';

export type GlassMenuItemProps = React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & {
  /** Leaves room for a check or radio indicator so labels line up. */
  inset?: boolean;
  tone?: 'default' | 'destructive';
};

export const GlassMenuItem = forwardRef<HTMLDivElement, GlassMenuItemProps>(
  ({ className, inset = false, tone = 'default', ...props }, forwardedRef) => (
    <MenuPrimitive.Item
      ref={forwardedRef}
      data-tone={tone}
      className={clsx('lg-menu-item', inset && 'lg-menu-item--inset', className)}
      {...props}
    />
  ),
);

GlassMenuItem.displayName = 'GlassMenuItem';

export const GlassMenuCheckboxItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.CheckboxItem>
>(({ children, className, ...props }, forwardedRef) => (
  <MenuPrimitive.CheckboxItem
    ref={forwardedRef}
    className={clsx('lg-menu-item lg-menu-item--inset', className)}
    {...props}
  >
    <MenuPrimitive.ItemIndicator className="lg-menu-indicator">
      <svg viewBox="0 0 16 16" aria-hidden>
        <path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </MenuPrimitive.ItemIndicator>
    {children}
  </MenuPrimitive.CheckboxItem>
));

GlassMenuCheckboxItem.displayName = 'GlassMenuCheckboxItem';

export const GlassMenuRadioItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>
>(({ children, className, ...props }, forwardedRef) => (
  <MenuPrimitive.RadioItem
    ref={forwardedRef}
    className={clsx('lg-menu-item lg-menu-item--inset', className)}
    {...props}
  >
    <MenuPrimitive.ItemIndicator className="lg-menu-indicator">
      <svg viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="3.25" fill="currentColor" />
      </svg>
    </MenuPrimitive.ItemIndicator>
    {children}
  </MenuPrimitive.RadioItem>
));

GlassMenuRadioItem.displayName = 'GlassMenuRadioItem';

export const GlassMenuLabel = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Label>
>(({ className, ...props }, forwardedRef) => (
  <MenuPrimitive.Label ref={forwardedRef} className={clsx('lg-menu-label', className)} {...props} />
));

GlassMenuLabel.displayName = 'GlassMenuLabel';

export const GlassMenuSeparator = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(({ className, ...props }, forwardedRef) => (
  <MenuPrimitive.Separator
    ref={forwardedRef}
    className={clsx('lg-menu-separator', className)}
    {...props}
  />
));

GlassMenuSeparator.displayName = 'GlassMenuSeparator';

export function GlassMenuShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={clsx('lg-menu-shortcut', className)} {...props} />;
}

export const GlassMenuSubTrigger = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ children, className, inset = false, ...props }, forwardedRef) => (
  <MenuPrimitive.SubTrigger
    ref={forwardedRef}
    className={clsx('lg-menu-item', inset && 'lg-menu-item--inset', className)}
    {...props}
  >
    {children}
    <svg viewBox="0 0 16 16" aria-hidden className="lg-menu-chevron">
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  </MenuPrimitive.SubTrigger>
));

GlassMenuSubTrigger.displayName = 'GlassMenuSubTrigger';

export const GlassMenuSubContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.SubContent>
>(({ alignOffset = -6, children, className, sideOffset = 6, ...props }, forwardedRef) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.SubContent
      ref={forwardedRef}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      {...props}
      {...radixSlotProps}
    >
      <GlassPanel
        elevation="raised"
        preset="prominent"
        refraction="none"
        variant="card"
        className={clsx('lg-menu-content', className)}
      >
        {children}
      </GlassPanel>
    </MenuPrimitive.SubContent>
  </MenuPrimitive.Portal>
));

GlassMenuSubContent.displayName = 'GlassMenuSubContent';
