'use client';

import { GlassButton } from '../../glass-button';
import { GlassMenu, GlassMenuContent, GlassMenuItem, GlassMenuTrigger } from '../../glass-menu';
import { DownIcon, HandsetIcon, PhoneIcon } from './icons';

export type StorePlatform = 'iphone' | 'android';

/** Your app's store pages. A platform without one shows a demo note instead of leaving the page. */
export type StoreLinks = Partial<Record<StorePlatform, string>>;

// Spread rather than written as an attribute, as the library does: the shadcn CLI rewrites a
// literal asChild into a render prop for some styles, which these Radix parts do not take.
export const slotProps = { asChild: true };

const STORES = [
  { platform: 'iphone', name: 'For iPhone', detail: 'iOS 17 and later', Glyph: PhoneIcon },
  { platform: 'android', name: 'For Android', detail: 'Android 10 and later', Glyph: HandsetIcon },
] as const;

/**
 * The download button: one prominent button that opens a menu of the two stores, drawn with
 * Still's own glyphs rather than any store's badge.
 */
export function StoreMenu({
  label = 'Start your free week',
  links,
  onDemo,
}: {
  label?: string;
  links?: StoreLinks;
  onDemo: (platform: StorePlatform) => void;
}) {
  return (
    <GlassMenu>
      <GlassMenuTrigger {...slotProps}>
        <GlassButton className="still-button-xl still-store-trigger" variant="prominent">
          {label}
          <DownIcon />
        </GlassButton>
      </GlassMenuTrigger>
      <GlassMenuContent
        aria-label="Choose your phone"
        className="still still-store-menu"
        data-lg-theme="dark"
      >
        {STORES.map(({ platform, name, detail, Glyph }) => {
          const href = links?.[platform];

          const body = (
            <>
              <Glyph />
              <span>
                <b>{name}</b>
                <small>{detail}</small>
              </span>
            </>
          );

          return href ? (
            <GlassMenuItem key={platform} {...slotProps} className="still-store-item">
              <a href={href}>{body}</a>
            </GlassMenuItem>
          ) : (
            <GlassMenuItem
              key={platform}
              className="still-store-item"
              onSelect={() => onDemo(platform)}
            >
              {body}
            </GlassMenuItem>
          );
        })}
      </GlassMenuContent>
    </GlassMenu>
  );
}
