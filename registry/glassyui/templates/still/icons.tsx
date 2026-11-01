import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden
      className={className ? `still-icon ${className}` : 'still-icon'}
      focusable="false"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Still's mark: the moon resting on the horizon. */
export function MarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.68 15.5a7 7 0 1 1 12.64 0M2.75 15.5h18.5M9.25 19h5.5" />
    </Icon>
  );
}

export function BreathIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.4 6.4a7.9 7.9 0 1 0 11.2 0" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="10" rx="2.6" width="10" x="7" y="7" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 6.6v10.8a.9.9 0 0 0 1.37.77l8.6-5.4a.9.9 0 0 0 0-1.54l-8.6-5.4a.9.9 0 0 0-1.37.77Z" />
    </Icon>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6.5v11M15 6.5v11" />
    </Icon>
  );
}

export function LeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 6.5 9 12l5.5 5.5" />
    </Icon>
  );
}

export function RightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 6.5 15 12l-5.5 5.5" />
    </Icon>
  );
}

export function DownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6v12M6 12h12" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5.5 12.5 4 4 9-9" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18.8 14.6A7.4 7.4 0 0 1 9.4 5.2a7.4 7.4 0 1 0 9.4 9.4Z" />
    </Icon>
  );
}

/** A plain handset, for the iPhone store: no platform's own mark. */
export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="18" rx="2.8" width="10" x="7" y="3" />
      <path d="M10.5 18h3" />
    </Icon>
  );
}

/** A second handset with a top speaker, for the Android store. */
export function HandsetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="18" rx="2.2" width="11" x="6.5" y="3" />
      <path d="M10 5.6h4" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 16V11a5 5 0 0 1 10 0v5l1.5 1.5h-13Z" />
      <path d="M10.5 20.2h3" />
    </Icon>
  );
}

export function FadeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h1M7.5 8.5v7M11 6.5v11M14.5 9v6M18 11v2" />
    </Icon>
  );
}

export function SunriseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 17.5h16M7.5 17.5a4.5 4.5 0 0 1 9 0M12 6v3M6.4 9.4 7.8 10.8M17.6 9.4l-1.4 1.4" />
    </Icon>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 5.5H9a3 3 0 0 1 3 3V19a2 2 0 0 0-2-2H4.5Z" />
      <path d="M19.5 5.5H15a3 3 0 0 0-3 3V19a2 2 0 0 1 2-2h5.5Z" />
    </Icon>
  );
}

export function RainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 13.5a4 4 0 0 1-.3-8 5 5 0 0 1 9.4 1.3 3.4 3.4 0 0 1 .3 6.7Z" />
      <path d="m8 16.5-1 2.5M12 16.5l-1 2.5M16 16.5l-1 2.5" />
    </Icon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 10.8 12 5l7 5.8V18a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18Z" />
    </Icon>
  );
}

/** A filled star for the rating, the one icon without a stroke. */
export function StarIcon() {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 24 24">
      <path d="M12 3.5l2.3 5.6 6 .5-4.6 3.9 1.4 5.9L12 16.3l-5.1 3.1 1.4-5.9-4.6-3.9 6-.5Z" />
    </svg>
  );
}
