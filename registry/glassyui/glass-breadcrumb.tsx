import { Slot } from '@radix-ui/react-slot';
import clsx from 'clsx';
import { forwardRef } from 'react';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  LiHTMLAttributes,
} from 'react';

/** The trail's `nav` landmark and its list. Put a `GlassBreadcrumbItem` inside for each step. */
export const GlassBreadcrumb = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ children, className, ...props }, forwardedRef) => (
    <nav
      aria-label="Breadcrumb"
      {...props}
      ref={forwardedRef}
      className={clsx('lg-breadcrumb', className)}
    >
      <ol className="lg-breadcrumb-list">{children}</ol>
    </nav>
  ),
);

GlassBreadcrumb.displayName = 'GlassBreadcrumb';

/** One step. It draws the chevron after itself, except on the last. */
export const GlassBreadcrumbItem = forwardRef<HTMLLIElement, LiHTMLAttributes<HTMLLIElement>>(
  ({ children, className, ...props }, forwardedRef) => (
    <li {...props} ref={forwardedRef} className={clsx('lg-breadcrumb-item', className)}>
      {children}
      <span aria-hidden className="lg-breadcrumb-separator">
        <svg viewBox="0 0 20 20">
          <path
            d="M7.5 4.5l5.5 5.5-5.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      </span>
    </li>
  ),
);

GlassBreadcrumbItem.displayName = 'GlassBreadcrumbItem';

export type GlassBreadcrumbLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** Renders your own link, such as a router's, with these styles. */
  asChild?: boolean;
};

export const GlassBreadcrumbLink = forwardRef<HTMLAnchorElement, GlassBreadcrumbLinkProps>(
  ({ asChild = false, className, ...props }, forwardedRef) => {
    const Component = asChild ? Slot : 'a';

    return (
      <Component {...props} ref={forwardedRef} className={clsx('lg-breadcrumb-link', className)} />
    );
  },
);

GlassBreadcrumbLink.displayName = 'GlassBreadcrumbLink';

/** The page you are on. It is text, not a link. */
export const GlassBreadcrumbPage = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, forwardedRef) => (
    <span
      aria-current="page"
      {...props}
      ref={forwardedRef}
      className={clsx('lg-breadcrumb-page', className)}
    />
  ),
);

GlassBreadcrumbPage.displayName = 'GlassBreadcrumbPage';

/** Stands in for steps you have folded away. It is a button, so it can open a menu of them. */
export const GlassBreadcrumbEllipsis = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, forwardedRef) => (
  <button
    aria-label="Show hidden pages"
    type="button"
    {...props}
    ref={forwardedRef}
    className={clsx('lg-breadcrumb-ellipsis', className)}
  >
    <svg aria-hidden viewBox="0 0 20 20">
      <path
        d="M4.5 10h.01M10 10h.01M15.5 10h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  </button>
));

GlassBreadcrumbEllipsis.displayName = 'GlassBreadcrumbEllipsis';
