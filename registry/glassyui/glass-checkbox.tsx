'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import clsx from 'clsx';
import { forwardRef, useId } from 'react';
import type { ReactNode } from 'react';

export type GlassCheckboxSize = 'sm' | 'md';

export type GlassCheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  'children'
> & {
  /** A line of muted text under the label. */
  description?: ReactNode;
  /** Text beside the box. Clicking it toggles the box. Without one, name the box with `aria-label`. */
  label?: ReactNode;
  size?: GlassCheckboxSize;
};

/**
 * A checkbox for one choice or, with `checked="indeterminate"`, for a parent of several. The
 * mark draws itself in and out, so unchecking is as smooth as checking.
 */
export const GlassCheckbox = forwardRef<HTMLButtonElement, GlassCheckboxProps>(
  (
    { className, description, id, label, size = 'md', 'aria-describedby': describedBy, ...props },
    forwardedRef,
  ) => {
    const generatedId = useId();
    const checkboxId = id ?? `lg-checkbox-${generatedId}`;
    const descriptionId = `${checkboxId}-description`;
    const described = [describedBy, description ? descriptionId : null].filter(Boolean).join(' ');

    const box = (
      <CheckboxPrimitive.Root
        {...props}
        ref={forwardedRef}
        id={checkboxId}
        aria-describedby={described || undefined}
        className={clsx('lg-checkbox', label === undefined && className)}
        data-size={size}
      >
        <CheckboxPrimitive.Indicator forceMount className="lg-check-indicator">
          <svg aria-hidden className="lg-check-mark" viewBox="0 0 16 16">
            <path className="lg-check-tick" d="M3.6 8.4 6.6 11.4 12.4 5" pathLength="1" />
            <path className="lg-check-dash" d="M4 8h8" pathLength="1" />
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );

    if (label === undefined) return box;

    return (
      <div
        className={clsx('lg-check-field', className)}
        data-disabled={props.disabled ? '' : undefined}
        data-size={size}
      >
        {box}
        <div className="lg-check-text">
          <label htmlFor={checkboxId}>{label}</label>
          {description ? <span id={descriptionId}>{description}</span> : null}
        </div>
      </div>
    );
  },
);

GlassCheckbox.displayName = 'GlassCheckbox';
