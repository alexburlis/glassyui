'use client';

import { useEffect, useRef, useState } from 'react';

type CopyChipProps = {
  command: string;
  label?: string;
};

type CopyState = 'idle' | 'copied' | 'failed';

/** A one-line command with a button that copies it. If the browser refuses, the text is selected instead. */
export function CopyChip({ command, label = 'Copy install command' }: CopyChipProps) {
  const [state, setState] = useState<CopyState>('idle');
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const settle = (next: CopyState) => {
    setState(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      settle('copied');
    } catch {
      // Say so, and leave the command selected so it can be copied by hand.
      const selection = window.getSelection();

      if (codeRef.current && selection) {
        selection.selectAllChildren(codeRef.current);
      }

      settle('failed');
    }
  };

  return (
    <div className="copy-chip" data-state={state}>
      <code className="copy-chip-command" ref={codeRef}>
        <span aria-hidden className="copy-chip-prompt">
          $
        </span>
        {command}
      </code>
      <button aria-label={label} className="copy-chip-button" onClick={copy} type="button">
        <svg aria-hidden className="copy-chip-icon copy-chip-icon--copy" viewBox="0 0 20 20">
          <rect
            fill="none"
            height="9.5"
            rx="2.2"
            stroke="currentColor"
            strokeWidth="1.6"
            width="9.5"
            x="7.75"
            y="7.75"
          />
          <path
            d="M12.25 5.4V5A2.2 2.2 0 0 0 10.05 2.8H5A2.2 2.2 0 0 0 2.8 5v5.05A2.2 2.2 0 0 0 5 12.25h.4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        </svg>
        <svg aria-hidden className="copy-chip-icon copy-chip-icon--done" viewBox="0 0 20 20">
          <path
            d="M4.6 10.4l3.6 3.6 7.2-8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
          />
        </svg>
      </button>
      <span className="lg-visually-hidden" role="status">
        {state === 'copied' ? 'Copied to the clipboard.' : null}
        {state === 'failed' ? 'Could not copy. The command is selected.' : null}
      </span>
    </div>
  );
}
