import * as AvatarPrimitive from '@radix-ui/react-avatar';
import clsx from 'clsx';
import { Children, forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export type GlassAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type GlassAvatarStatus = 'online' | 'away' | 'busy' | 'offline';

export type GlassAvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** Describes the image. Defaults to `name`. */
  alt?: string;
  /** Shown when there is no image or it fails to load. Defaults to the initials of `name`. */
  fallback?: ReactNode;
  /** Names the person. Its initials fill in for a missing image and pick the colour. */
  name?: string;
  size?: GlassAvatarSize;
  src?: string;
  /** A presence dot on the corner. */
  status?: GlassAvatarStatus;
};

// The number of colours the stylesheet defines for initials.
const TONES = 8;

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return '';

  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';

  return `${first}${last}`.toUpperCase();
}

// The same name always gets the same colour.
function toneOf(name: string) {
  let hash = 0;

  for (const character of name) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;

  return hash % TONES;
}

/** A round photo that falls back to coloured initials. */
export const GlassAvatar = forwardRef<HTMLSpanElement, GlassAvatarProps>(
  ({ alt, className, fallback, name, size = 'md', src, status, ...props }, forwardedRef) => {
    const described = [alt ?? name, status].filter(Boolean).join(', ');

    return (
      <span
        aria-label={described || undefined}
        role={described ? 'img' : undefined}
        {...props}
        ref={forwardedRef}
        className={clsx('lg-avatar', className)}
        data-size={size}
        data-status={status}
      >
        <AvatarPrimitive.Root className="lg-avatar-face">
          {src ? <AvatarPrimitive.Image alt="" className="lg-avatar-image" src={src} /> : null}
          <AvatarPrimitive.Fallback
            aria-hidden
            className="lg-avatar-fallback"
            data-tone={name ? toneOf(name) : undefined}
          >
            {fallback ?? (name ? initialsOf(name) : null)}
          </AvatarPrimitive.Fallback>
        </AvatarPrimitive.Root>
        {status ? <span aria-hidden className="lg-avatar-status" /> : null}
      </span>
    );
  },
);

GlassAvatar.displayName = 'GlassAvatar';

export type GlassAvatarGroupProps = HTMLAttributes<HTMLDivElement> & {
  /** Shows this many avatars, then a "+N" for the rest. */
  max?: number;
  /** Sizes every avatar in the group. */
  size?: GlassAvatarSize;
};

/** Avatars stacked edge to edge, each cut away where the next one overlaps it. */
export const GlassAvatarGroup = forwardRef<HTMLDivElement, GlassAvatarGroupProps>(
  ({ children, className, max, size = 'md', ...props }, forwardedRef) => {
    const items = Children.toArray(children);
    const shown = max === undefined ? items : items.slice(0, Math.max(0, max));
    const hidden = items.length - shown.length;

    return (
      <div
        role="group"
        {...props}
        ref={forwardedRef}
        className={clsx('lg-avatar-group', className)}
        data-size={size}
      >
        {shown}
        {hidden > 0 ? (
          <span aria-label={`${hidden} more`} className="lg-avatar" data-size={size} role="img">
            <span aria-hidden className="lg-avatar-face lg-avatar-more">
              +{hidden}
            </span>
          </span>
        ) : null}
      </div>
    );
  },
);

GlassAvatarGroup.displayName = 'GlassAvatarGroup';
