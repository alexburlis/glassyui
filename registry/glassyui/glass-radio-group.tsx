'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import clsx from 'clsx';
import { forwardRef, useId } from 'react';
import type { ReactNode } from 'react';

export type GlassRadioGroupProps = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;

/** A group of options where exactly one is chosen. Arrow keys move the choice, as Radix does. */
export const GlassRadioGroup = forwardRef<HTMLDivElement, GlassRadioGroupProps>(
  ({ className, ...props }, forwardedRef) => (
    <RadioGroupPrimitive.Root
      {...props}
      ref={forwardedRef}
      className={clsx('lg-radio-group', className)}
    />
  ),
);

GlassRadioGroup.displayName = 'GlassRadioGroup';

export type GlassRadioGroupItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
  'children'
> & {
  /** A line of muted text under the label. */
  description?: ReactNode;
  /** Text beside the button. Clicking it chooses the option. Without one, name the option with `aria-label`. */
  label?: ReactNode;
};

export const GlassRadioGroupItem = forwardRef<HTMLButtonElement, GlassRadioGroupItemProps>(
  (
    { className, description, id, label, 'aria-describedby': describedBy, ...props },
    forwardedRef,
  ) => {
    const generatedId = useId();
    const radioId = id ?? `lg-radio-${generatedId}`;
    const descriptionId = `${radioId}-description`;
    const described = [describedBy, description ? descriptionId : null].filter(Boolean).join(' ');

    const button = (
      <RadioGroupPrimitive.Item
        {...props}
        ref={forwardedRef}
        id={radioId}
        aria-describedby={described || undefined}
        className={clsx('lg-radio', label === undefined && className)}
      >
        <RadioGroupPrimitive.Indicator forceMount className="lg-radio-indicator">
          <span aria-hidden className="lg-radio-dot" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
    );

    if (label === undefined) return button;

    return (
      <div
        className={clsx('lg-check-field', className)}
        data-disabled={props.disabled ? '' : undefined}
      >
        {button}
        <div className="lg-check-text">
          <label htmlFor={radioId}>{label}</label>
          {description ? <span id={descriptionId}>{description}</span> : null}
        </div>
      </div>
    );
  },
);

GlassRadioGroupItem.displayName = 'GlassRadioGroupItem';
