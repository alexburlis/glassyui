import type { CSSProperties } from 'react';
import { RIBBON_BAND, RIBBON_FOLD, VERMILION } from './ribbon';

/** The ribbon in the current ink, with its Vermilion fold. */
export function RibbonMark({ style }: { style?: CSSProperties }) {
  return (
    <svg aria-hidden style={style} viewBox="0 0 64 64">
      <path d={RIBBON_BAND} fill="currentColor" />
      <path d={RIBBON_FOLD} fill={VERMILION} />
    </svg>
  );
}
