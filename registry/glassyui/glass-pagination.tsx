'use client';

import clsx from 'clsx';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

export type GlassPaginationProps = Omit<HTMLAttributes<HTMLElement>, 'onChange'> & {
  /** Pages always shown at each end. Defaults to 1. */
  boundaryCount?: number;
  nextLabel?: string;
  onPageChange: (page: number) => void;
  /** The current page, counting from 1. */
  page: number;
  pageCount: number;
  previousLabel?: string;
  /** Pages shown either side of the current one. Defaults to 1. */
  siblingCount?: number;
};

type PageItem = { gap: 'start' | 'end'; page?: undefined } | { gap?: undefined; page: number };

function range(start: number, end: number) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

/** The numbers to show: both ends and the neighbourhood of the current page, with gaps folded. */
function pageItems(page: number, pageCount: number, boundaryCount: number, siblingCount: number) {
  const startPages = range(1, Math.min(boundaryCount, pageCount));
  const endPages = range(Math.max(pageCount - boundaryCount + 1, boundaryCount + 1), pageCount);

  const siblingsStart = Math.max(
    Math.min(page - siblingCount, pageCount - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  );

  const siblingsEnd = Math.min(
    Math.max(page + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : pageCount - 1,
  );

  // A gap of one page shows that page instead of an ellipsis.
  const beforeSiblings: PageItem[] =
    siblingsStart > boundaryCount + 2
      ? [{ gap: 'start' }]
      : boundaryCount + 1 < pageCount - boundaryCount
        ? [{ page: boundaryCount + 1 }]
        : [];

  const afterSiblings: PageItem[] =
    siblingsEnd < pageCount - boundaryCount - 1
      ? [{ gap: 'end' }]
      : pageCount - boundaryCount > boundaryCount
        ? [{ page: pageCount - boundaryCount }]
        : [];

  return [
    ...startPages.map((number): PageItem => ({ page: number })),
    ...beforeSiblings,
    ...range(siblingsStart, siblingsEnd).map((number): PageItem => ({ page: number })),
    ...afterSiblings,
    ...endPages.map((number): PageItem => ({ page: number })),
  ];
}

function Chevron({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20">
      <path
        d={direction === 'previous' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

/** Numbered pages with previous and next, folding long runs into an ellipsis. */
export const GlassPagination = forwardRef<HTMLElement, GlassPaginationProps>(
  (
    {
      boundaryCount = 1,
      className,
      nextLabel = 'Next page',
      onPageChange,
      page,
      pageCount,
      previousLabel = 'Previous page',
      siblingCount = 1,
      ...props
    },
    forwardedRef,
  ) => {
    const current = Math.min(Math.max(1, page), Math.max(1, pageCount));

    return (
      <nav
        aria-label="Pagination"
        {...props}
        ref={forwardedRef}
        className={clsx('lg-pagination', className)}
      >
        <ul className="lg-pagination-list">
          <li>
            <button
              aria-label={previousLabel}
              className="lg-page"
              disabled={current <= 1}
              onClick={() => onPageChange(current - 1)}
              type="button"
            >
              <Chevron direction="previous" />
            </button>
          </li>
          {pageItems(current, pageCount, boundaryCount, siblingCount).map((item) =>
            item.page === undefined ? (
              <li aria-hidden className="lg-page-gap" key={item.gap}>
                …
              </li>
            ) : (
              <li key={item.page}>
                <button
                  aria-current={item.page === current ? 'page' : undefined}
                  aria-label={`Page ${item.page}`}
                  className="lg-page"
                  data-current={item.page === current ? '' : undefined}
                  onClick={() => onPageChange(item.page)}
                  type="button"
                >
                  {item.page}
                </button>
              </li>
            ),
          )}
          <li>
            <button
              aria-label={nextLabel}
              className="lg-page"
              disabled={current >= pageCount}
              onClick={() => onPageChange(current + 1)}
              type="button"
            >
              <Chevron direction="next" />
            </button>
          </li>
        </ul>
      </nav>
    );
  },
);

GlassPagination.displayName = 'GlassPagination';
