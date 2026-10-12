import type { ReactNode } from 'react';

export function Glyph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden className={className ?? 'site-glyph'} fill="currentColor" viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

export const SunGlyph = ({ className }: { className?: string }) => (
  <Glyph className={className}>
    <circle cx="12" cy="12" r="4.2" />
    <path
      d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.9"
    />
  </Glyph>
);

export const SpeakerGlyph = ({ className, loud }: { className?: string; loud: boolean }) => (
  <Glyph className={className}>
    <path d="M3.5 9.2h3.3L11.4 5a.8.8 0 0 1 1.3.6v12.8a.8.8 0 0 1-1.3.6l-4.6-4.2H3.5a1 1 0 0 1-1-1V10.2a1 1 0 0 1 1-1Z" />
    <path
      d={
        loud
          ? 'M15.6 8.6a4.8 4.8 0 0 1 0 6.8M18.6 5.6a9 9 0 0 1 0 12.8'
          : 'M15.6 8.6a4.8 4.8 0 0 1 0 6.8'
      }
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.9"
    />
  </Glyph>
);
