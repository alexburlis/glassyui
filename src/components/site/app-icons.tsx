import { useId } from 'react';
import type { ReactNode } from 'react';

type IconFrameProps = {
  children: ReactNode;
  from: string;
  to: string;
};

// Every icon shares the squircle, the top sheen and the bright upper-left rim of a glass tile.
function IconFrame({ children, from, to }: IconFrameProps) {
  const id = useId();
  const base = `${id}base`;
  const sheen = `${id}sheen`;
  const rim = `${id}rim`;

  return (
    <svg aria-hidden className="app-icon" viewBox="0 0 64 64">
      <defs>
        <linearGradient id={base} x1="0" x2="0.35" y1="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={sheen} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.48" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={rim} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.38" />
        </linearGradient>
      </defs>
      <rect fill={`url(#${base})`} height="64" rx="14.4" width="64" />
      {children}
      <rect fill={`url(#${sheen})`} height="64" rx="14.4" width="64" />
      <rect fill="none" height="63" rx="13.9" stroke={`url(#${rim})`} width="63" x="0.5" y="0.5" />
    </svg>
  );
}

// Teeth take 60% of each pitch and alternate between two radii around the centre.
function gearPath(teeth: number, outer: number, inner: number) {
  const step = (Math.PI * 2) / teeth;

  const profile = [
    [-0.3, inner],
    [-0.16, outer],
    [0.16, outer],
    [0.3, inner],
  ];

  const points = Array.from({ length: teeth }, (_, index) =>
    profile.map(([offset, radius]) => {
      const angle = (index + offset) * step;

      return `${(32 + radius * Math.cos(angle)).toFixed(2)} ${(32 + radius * Math.sin(angle)).toFixed(2)}`;
    }),
  ).flat();

  return `M${points.join('L')}Z M39 32a7 7 0 1 0-14 0a7 7 0 1 0 14 0Z`;
}

const GEAR_PATH = gearPath(12, 21.5, 17);

export function FilesIcon() {
  return (
    <IconFrame from="#6fd3ff" to="#0a64ff">
      <path
        d="M13 22a4 4 0 0 1 4-4h9.2a3 3 0 0 1 2.1.9l3 3.1H47a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4Z"
        fill="#fff"
        fillOpacity="0.5"
      />
      <path
        d="M13 29a4 4 0 0 1 4-4h30a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4Z"
        fill="#fff"
      />
    </IconFrame>
  );
}

export function MailIcon() {
  return (
    <IconFrame from="#7cc8ff" to="#1463ff">
      <rect fill="#fff" height="28" rx="5.5" width="40" x="12" y="18" />
      <path
        d="M14.5 21.5 32 34.5l17.5-13"
        fill="none"
        stroke="#1463ff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.45"
        strokeWidth="2.6"
      />
    </IconFrame>
  );
}

export function MessagesIcon() {
  return (
    <IconFrame from="#6af58a" to="#0bb13c">
      <path
        d="M32 14.5c-11.3 0-20.5 7.4-20.5 16.6 0 5.3 3 10 7.7 13-.4 2.6-1.8 5-3.9 6.8 4 .1 7.5-1.2 10.2-3.5 2.1.5 4.2.8 6.5.8 11.3 0 20.5-7.4 20.5-16.6S43.3 14.5 32 14.5Z"
        fill="#fff"
      />
    </IconFrame>
  );
}

export function MusicIcon() {
  return (
    <IconFrame from="#ff7a93" to="#f5184a">
      <path d="M25 20.2 42 16v6.2l-17 4.2Z" fill="#fff" />
      <rect fill="#fff" height="24" rx="1.5" width="3" x="23.5" y="20" />
      <rect fill="#fff" height="24" rx="1.5" width="3" x="40" y="16" />
      <ellipse cx="20" cy="44" fill="#fff" rx="6.2" ry="4.9" transform="rotate(-18 20 44)" />
      <ellipse cx="36.5" cy="40" fill="#fff" rx="6.2" ry="4.9" transform="rotate(-18 36.5 40)" />
    </IconFrame>
  );
}

export function GalleryIcon() {
  return (
    <IconFrame from="#ffc15e" to="#ff5a36">
      <circle cx="42.5" cy="22.5" fill="#fff" fillOpacity="0.75" r="5.5" />
      <path
        d="M12 45.5 24.4 30.2a2 2 0 0 1 3.1 0l8.6 10.6 5.6-6.4a2 2 0 0 1 3 0L52 43.2v2.3a2.5 2.5 0 0 1-2.5 2.5h-35A2.5 2.5 0 0 1 12 45.5Z"
        fill="#fff"
      />
    </IconFrame>
  );
}

export function NotesIcon() {
  return (
    <IconFrame from="#ffdd55" to="#ff9d0a">
      <path d="M17 47h30" stroke="#fff" strokeLinecap="round" strokeOpacity="0.6" strokeWidth="3" />
      <path
        d="M40.3 15.6a4 4 0 0 1 5.7 0l2.4 2.4a4 4 0 0 1 0 5.7L28.2 43.9 18 46.5l2.6-10.2Z"
        fill="#fff"
      />
    </IconFrame>
  );
}

export function CalendarIcon() {
  return (
    <IconFrame from="#ff8a70" to="#f2352b">
      <rect fill="#fff" height="32" rx="6" width="38" x="13" y="16" />
      <path d="M13 22a6 6 0 0 1 6-6h26a6 6 0 0 1 6 6v3H13Z" fill="#f2352b" fillOpacity="0.28" />
      {[21, 32, 43].map((x) =>
        [31, 40].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} fill="#f2352b" fillOpacity="0.55" r="2.4" />
        )),
      )}
    </IconFrame>
  );
}

export function MapsIcon() {
  return (
    <IconFrame from="#58e3b4" to="#079a78">
      <path d="M13 20.5 25 16l14 5 12-4.5v27L39 48l-14-5-12 4.5Z" fill="#fff" />
      <path d="M25 16v27M39 21v27" stroke="#079a78" strokeOpacity="0.3" strokeWidth="2" />
      <circle cx="32" cy="29" fill="#ff453a" r="4" stroke="#fff" strokeWidth="1.6" />
    </IconFrame>
  );
}

export function WeatherIcon() {
  return (
    <IconFrame from="#6cc2ff" to="#1b62f0">
      <circle cx="25" cy="25" fill="#ffd60a" r="8.5" />
      <path d="M24 46.5a8 8 0 0 1-.8-16A11 11 0 0 1 44.2 31a7.75 7.75 0 0 1-.7 15.5Z" fill="#fff" />
    </IconFrame>
  );
}

export function SettingsIcon() {
  return (
    <IconFrame from="#a5abb4" to="#4f555e">
      <path d={GEAR_PATH} fill="#fff" fillRule="evenodd" />
      <circle
        cx="32"
        cy="32"
        fill="none"
        r="11.5"
        stroke="#4f555e"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
    </IconFrame>
  );
}

const RIBBON_FACE =
  'M13.21 13.21C13.21 13.19 13.21 13.16 13.22 13.08C13.23 13 13.24 12.87 13.27 12.7C13.3 12.53 13.34 12.31 13.41 12.06C13.48 11.8 13.56 11.5 13.69 11.17C13.83 10.84 14 10.46 14.23 10.07C14.46 9.68 14.74 9.25 15.09 8.84C15.44 8.43 15.85 8 16.32 7.62C16.78 7.24 17.31 6.86 17.86 6.55C18.42 6.23 19.03 5.95 19.64 5.72C20.25 5.5 20.9 5.33 21.54 5.19C22.18 5.06 22.84 4.99 23.49 4.92C24.14 4.86 24.79 4.85 25.44 4.83C26.09 4.81 26.73 4.81 27.38 4.81C28.03 4.8 28.68 4.8 29.33 4.8C29.99 4.8 30.65 4.8 31.32 4.8C32 4.8 32.68 4.8 33.38 4.8C34.09 4.8 34.8 4.8 35.55 4.8C36.3 4.8 37.07 4.8 37.89 4.81C38.71 4.83 39.56 4.83 40.49 4.87C41.41 4.91 42.38 4.94 43.44 5.06C44.5 5.18 45.64 5.28 46.86 5.58C48.07 5.89 49.44 6.23 50.71 6.89C51.97 7.54 53.4 8.46 54.47 9.53C55.54 10.6 56.46 12.03 57.11 13.29C57.77 14.56 58.11 15.93 58.42 17.14C58.72 18.36 58.82 19.5 58.94 20.56C59.06 21.62 59.09 22.59 59.13 23.51C59.17 24.44 59.17 25.29 59.19 26.11C59.2 26.93 59.2 27.7 59.2 28.45C59.2 29.2 59.2 29.91 59.2 30.62C59.2 31.32 59.2 32 59.2 32.68C59.2 33.35 59.2 34.01 59.2 34.67C59.2 35.32 59.2 35.97 59.19 36.62C59.19 37.27 59.19 37.91 59.17 38.56C59.15 39.21 59.14 39.86 59.08 40.51C59.01 41.16 58.94 41.82 58.81 42.46C58.67 43.1 58.5 43.75 58.28 44.36C58.05 44.97 57.77 45.58 57.45 46.14C57.14 46.69 56.76 47.22 56.38 47.68C56 48.15 55.57 48.56 55.16 48.91C54.75 49.26 54.32 49.54 53.93 49.77C53.54 50 53.16 50.17 52.83 50.31C52.5 50.44 52.2 50.52 51.94 50.59C51.69 50.66 51.47 50.7 51.3 50.73C51.13 50.76 51 50.77 50.92 50.78C50.84 50.79 50.81 50.79 50.79 50.79L50.79 50.79C50.8 50.68 50.85 50.55 50.82 50.14C50.79 49.73 50.78 49.04 50.61 48.33C50.45 47.62 50.1 46.76 49.83 45.86C49.57 44.96 49.19 44.02 49.02 42.92C48.84 41.82 48.81 40.59 48.78 39.28C48.74 37.97 48.8 36.52 48.8 35.05C48.8 33.57 48.8 32.03 48.8 30.41C48.8 28.78 48.84 27.03 48.77 25.3C48.7 23.57 48.66 21.42 48.38 20.01C48.11 18.61 47.85 17.62 47.12 16.88C46.38 16.15 45.39 15.89 43.99 15.62C42.58 15.34 40.43 15.3 38.7 15.23C36.97 15.16 35.22 15.2 33.59 15.2C31.97 15.2 30.43 15.2 28.95 15.2C27.48 15.2 26.03 15.26 24.72 15.22C23.41 15.19 22.18 15.16 21.08 14.98C19.98 14.81 19.04 14.43 18.14 14.17C17.24 13.9 16.38 13.55 15.67 13.39C14.96 13.22 14.27 13.21 13.86 13.18C13.45 13.15 13.32 13.2 13.21 13.21Z';

const RIBBON_ACCENT =
  'M13.21 13.21C13.22 13.12 13.19 13.02 13.27 12.68C13.36 12.33 13.41 11.77 13.71 11.14C14 10.51 14.42 9.63 15.04 8.91C15.66 8.19 16.55 7.38 17.43 6.81C18.31 6.24 19.38 5.81 20.31 5.5C21.25 5.19 22.2 5.08 23.03 4.97C23.86 4.86 24.63 4.86 25.28 4.83C25.93 4.8 26.49 4.81 26.94 4.81C27.39 4.8 27.74 4.8 27.97 4.8C28.2 4.8 28.26 4.8 28.32 4.8L28.34 15.2C28.25 15.2 28.15 15.2 27.81 15.2C27.47 15.21 26.93 15.21 26.3 15.21C25.66 15.22 24.84 15.25 24 15.22C23.17 15.19 22.21 15.17 21.31 15.02C20.41 14.87 19.49 14.59 18.61 14.33C17.74 14.08 16.84 13.68 16.07 13.48C15.3 13.29 14.48 13.22 14.01 13.18C13.53 13.13 13.34 13.2 13.21 13.21Z';

// The flat compact ribbon from public/brand/glassyui-logo-compact.svg; keep the two in step.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="currentColor" viewBox="0 0 64 64">
      <path d={RIBBON_FACE} transform="rotate(180 32 32)" />
      <path d={RIBBON_FACE} />
      <path d={RIBBON_ACCENT} fill="#f04a28" transform="rotate(180 32 32)" />
    </svg>
  );
}
