import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden
      className={className ? `halcyon-icon ${className}` : 'halcyon-icon'}
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Halcyon's mark: a kingfisher in flight, filled with the dawn's aqua. */
export function HalcyonMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 32 32">
      <path
        fill="url(#halcyon-mark-fill)"
        d="M13 6.5c4.2 0 7.4 2.8 8.2 6.6L31 15.2l-9.9 1.7C20.5 22 16.4 25.5 11 25.5H3.5l3.2-3.4C5.6 20.4 5 18.4 5 16.2 5 10.8 8.4 6.5 13 6.5Z"
      />
      <path
        fill="#e3fcfe"
        fillOpacity=".92"
        d="M21.1 16.9C20.5 22 16.4 25.5 11 25.5c3.6-1.6 6.6-4.6 7.6-8.2Z"
      />
      <circle cx="15.8" cy="12.4" r="1.3" fill="#0e1424" />
    </svg>
  );
}

/** The mark's gradient, drawn once for every copy of the mark on the page. */
export function HalcyonMarkGradient() {
  return (
    <svg aria-hidden className="halcyon-defs" focusable="false" height="0" width="0">
      <defs>
        <linearGradient id="halcyon-mark-fill" x1="0.15" x2="0.85" y1="0" y2="1">
          <stop offset="0" stopColor="#c4f7fa" />
          <stop offset=".5" stopColor="#3ad1e0" />
          <stop offset="1" stopColor="#1798ab" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const CalendarPlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="15.5" rx="3" width="17" x="3.5" y="5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" />
  </Icon>
);

export const MovesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 8h12.5M14.5 5l3 3-3 3M19 16H6.5M9.5 13l-3 3 3 3" />
  </Icon>
);

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2L12 3.5Z" />
    <path d="m9 12 2.2 2.2L15.2 10" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12.5 4.2 4.2L19 7" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="11" rx="2.5" width="11" x="8.5" y="8.5" />
    <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Icon>
);

export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);

export const DownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" />
  </Icon>
);

export const EditIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.5 6.5l3 3M5 19l1-4.2L15.6 5.2a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L9.2 18 5 19Z" />
  </Icon>
);

export const ArrowIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />
  </Icon>
);

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="9.5" rx="2.5" width="13" x="5.5" y="10.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Icon>
);
