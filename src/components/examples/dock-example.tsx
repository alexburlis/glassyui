'use client';

import { useId, useState, type CSSProperties } from 'react';
import { GlassDock, GlassDockItem } from '../liquid/dock';

const apps = [
  { label: 'Inbox', from: '#407fe7', to: '#205ac4', path: 'M14 18h36v28H14z M14 19l18 14 18-14' },
  {
    label: 'Chat',
    from: '#318e68',
    to: '#1d654c',
    path: 'M14 16h36v26H30l-11 8v-8h-5z M23 26h18 M23 33h12',
  },
  {
    label: 'Gallery',
    from: '#c9892f',
    to: '#a76518',
    path: 'M15 15h34v34H15z M15 40l10-10 9 9 6-6 9 10 M38 23h.1',
  },
  { label: 'Player', from: '#ed603b', to: '#c9361a', path: 'M25 18v28l23-14z' },
  {
    label: 'Docs',
    from: '#8e8e97',
    to: '#686870',
    path: 'M17 13h30v38H17z M24 23h16 M24 31h16 M24 39h11',
  },
];

const dockStyle: CSSProperties & {
  '--lg-dock-size': string;
  '--lg-dock-gap': string;
  '--lg-dock-pad': string;
} = {
  '--lg-dock-size': 'clamp(32px, calc((100cqi - 32px) / 5), 52px)',
  '--lg-dock-gap': 'clamp(4px, 1.4cqi, 8px)',
  '--lg-dock-pad': 'clamp(6px, 1.4cqi, 10px)',
};

function DockAppIcon({ app }: { app: (typeof apps)[number] }) {
  const id = useId();

  return (
    <svg aria-hidden="true" viewBox="0 0 64 64">
      <defs>
        <linearGradient id={id} x2=".35" y2="1">
          <stop stopColor={app.from} />
          <stop offset="1" stopColor={app.to} />
        </linearGradient>
      </defs>
      <rect fill={`url(#${id})`} height="64" rx="14" width="64" />
      <rect
        x=".5"
        y=".5"
        width="63"
        height="63"
        rx="13.5"
        fill="none"
        stroke="#fff"
        strokeOpacity=".2"
      />
      <path
        d={app.path}
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}

type DockExampleProps = { onAction?: (message: string) => void };

export function DockExample({ onAction }: DockExampleProps) {
  const [running, setRunning] = useState(['Chat']);
  const [message, setMessage] = useState('');

  return (
    <div
      style={{
        containerType: 'inline-size',
        display: 'grid',
        alignContent: 'end',
        justifyItems: 'center',
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 220,
        paddingBlock: 24,
      }}
    >
      <GlassDock aria-label="Dock" role="group" style={dockStyle}>
        {apps.map((app) => (
          <GlassDockItem
            active={running.includes(app.label)}
            key={app.label}
            label={app.label}
            onClick={() => {
              setRunning((current) =>
                current.includes(app.label) ? current : [...current, app.label],
              );
              const next = `${app.label} opened.`;
              setMessage(next);
              onAction?.(next);
            }}
          >
            <DockAppIcon app={app} />
          </GlassDockItem>
        ))}
      </GlassDock>
      {!onAction ? (
        <span
          role="status"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clipPath: 'inset(50%)',
          }}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
