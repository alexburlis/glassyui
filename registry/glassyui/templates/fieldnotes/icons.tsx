import clsx from 'clsx';
import type { ReactNode } from 'react';

const PATHS = {
  down: <path d="M10 4v12M5 11l5 5 5-5" />,
  right: <path d="M4 10h12M11 5l5 5-5 5" />,
  up: <path d="M10 16V4M5 9l5-5 5 5" />,
  menu: <path d="M3.5 6.5h13M3.5 10h13M3.5 13.5h8" />,
  close: <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />,
  check: <path d="M4.5 10.5l3.6 3.6 7.4-8.2" />,
  chevron: <path d="M5.5 8l4.5 4.5L14.5 8" />,
  play: <path d="M7 4.8v10.4l8.2-5.2z" fill="currentColor" />,
  pause: <path d="M7.2 5v10M12.8 5v10" />,
  upload: <path d="M10 13V3.5M6.2 7.2L10 3.5l3.8 3.7M3.5 12.5v3a1 1 0 001 1h11a1 1 0 001-1v-3" />,
  speaker: (
    <>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M4 16.5c1-3 3.3-4.6 6-4.6s5 1.6 6 4.6" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="2" />
      <path d="M7 9V6.8a3 3 0 016 0V9" />
    </>
  ),
  keys: (
    <>
      <rect x="2.5" y="5" width="15" height="10" rx="2.2" />
      <path d="M5.8 8.3h.4M9.8 8.3h.4M13.8 8.3h.4M6.5 11.8h7" />
    </>
  ),
  list: <path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5M3.6 5.5h.8M3.6 10h.8M3.6 14.5h.8" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4.2l2.8 1.8" />
    </>
  ),
  search: (
    <>
      <circle cx="8.8" cy="8.8" r="5.3" />
      <path d="M13 13l3.8 3.8" />
    </>
  ),
  pattern: (
    <>
      <circle cx="5" cy="6" r="2" />
      <circle cx="15" cy="5" r="2" />
      <circle cx="10" cy="15" r="2" />
      <path d="M6.7 7.5l2.4 5.6M13.9 6.7l-2.8 6.5M7 5.8l6-.6" />
    </>
  ),
  growth: (
    <>
      <path d="M3.5 15.5L8 11l3 3 5.5-6.5" />
      <path d="M12.5 7.5h4v4" />
    </>
  ),
  page: (
    <>
      <path d="M5.5 3h6l3.5 3.5V16a1 1 0 01-1 1h-8.5a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M11.5 3v3.5H15M7.5 10.5h5M7.5 13.5h3.5" />
    </>
  ),
  wave: <path d="M3 10h1.5M6.5 7v6M10 4.5v11M13.5 7v6M16.5 10H17" />,
  users: (
    <>
      <circle cx="7.5" cy="7.5" r="2.8" />
      <path d="M2.8 16c.8-2.6 2.6-4 4.7-4s3.9 1.4 4.7 4" />
      <path d="M12.8 5a2.6 2.6 0 010 5.1M14.6 12.3c1.3.5 2.2 1.7 2.7 3.7" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ className, name }: { className?: string; name: IconName }) {
  return (
    <svg aria-hidden className={clsx('fieldnotes-icon', className)} viewBox="0 0 20 20">
      {PATHS[name]}
    </svg>
  );
}

/** A notebook with an oxblood ribbon. */
export function FieldnotesMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 28 28">
      <rect
        fill="none"
        height="21"
        rx="3.6"
        stroke="currentColor"
        strokeWidth="1.8"
        width="18"
        x="5"
        y="3.5"
      />
      <path
        d="M9.5 11h9M9.5 15h9M9.5 19h5.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path className="fieldnotes-mark-ribbon" d="M16.6 3.5h4.4v7.6l-2.2-1.6-2.2 1.6z" />
    </svg>
  );
}

/** A rubber stamp, roughened by the page's ink filter. */
export function Stamp({
  centre,
  className,
  id,
  ring,
}: {
  centre: string;
  className?: string;
  /** Names the circle the ring of words runs round; unique on the page. */
  id: string;
  ring: string;
}) {
  return (
    <svg aria-hidden className={clsx('fieldnotes-stamp', className)} viewBox="0 0 120 120">
      <path d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0" fill="none" id={id} />
      <circle cx="60" cy="60" fill="none" r="55" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="60" fill="none" r="30" stroke="currentColor" strokeWidth="1.4" />
      <text className="fieldnotes-stamp-ring" fill="currentColor">
        <textPath href={`#${id}`}>{ring}</textPath>
      </text>
      <text
        className="fieldnotes-stamp-centre"
        fill="currentColor"
        textAnchor="middle"
        x="60"
        y="66"
      >
        {centre}
      </text>
    </svg>
  );
}
