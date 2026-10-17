'use client';

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Code longer than this many lines rests at the collapsed height in globals.css (360px, about 15
 * lines), so a long example never pushes the rest of the page away. Code does not wrap, so the
 * line count alone decides it on the server and nothing shifts when the page hydrates. The margin
 * over 15 lines keeps the toggle from hiding only a line or two.
 */
const COLLAPSE_AFTER_LINES = 20;

type CodeLanguage = 'json' | 'shell' | 'tsx' | 'plain';

type CopyCodeBlockProps = {
  code: string;
  label: string;
  language?: CodeLanguage;
  header?: ReactNode;
  command?: boolean;
  expanded?: boolean;
  onReveal?: () => void;
  disabled?: boolean;
  emptyMessage?: string;
  viewerId?: string;
  file?: boolean;
  target?: string;
  copyLabel?: string;
};

type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

type CopyResult = {
  code: string;
  label: string;
  state: CopyState;
  request: symbol | null;
};

type TokenKind = 'attr' | 'comment' | 'keyword' | 'number' | 'string' | 'tag';

// Earlier rules win where two could match at the same place.
const GRAMMARS = {
  plain: [],
  json: [
    ['attr', /"(?:[^"\\\n]|\\.)*"(?=\s*:)/],
    ['string', /"(?:[^"\\\n]|\\.)*"/],
    ['keyword', /\b(?:true|false|null)\b/],
    ['number', /-?\b\d+(?:\.\d+)?\b/],
  ],
  shell: [
    ['keyword', /^[\w.-]+/],
    ['attr', /(?<=\s)--?[\w-]+/],
    ['string', /@[\w-]+\/[\w.-]+|"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/],
  ],
  tsx: [
    ['comment', /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
    ['string', /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/],
    ['tag', /(?<=<\/?)[A-Za-z][\w.]*/],
    ['attr', /\b[A-Za-z_][\w-]*(?==[{"'])/],
    [
      'keyword',
      /\b(?:as|async|await|const|default|else|export|extends|false|from|function|if|import|interface|let|new|null|return|true|type|undefined)\b/,
    ],
    ['number', /\b\d+(?:\.\d+)?\b/],
  ],
} satisfies Record<CodeLanguage, Array<[TokenKind, RegExp]>>;

function highlight(code: string, language: CodeLanguage) {
  const grammar = GRAMMARS[language];

  if (!grammar.length) return code;
  const pattern = new RegExp(grammar.map(([, rule]) => `(${rule.source})`).join('|'), 'gm');
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of code.matchAll(pattern)) {
    const rule = grammar[match.slice(1).findIndex((group) => group !== undefined)];

    if (match.index > cursor) nodes.push(code.slice(cursor, match.index));
    nodes.push(
      <span className={`tok-${rule[0]}`} key={match.index}>
        {match[0]}
      </span>,
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < code.length) nodes.push(code.slice(cursor));

  return nodes;
}

function wrappedCommand(code: string) {
  return code.split(/(\s+)/).map((word, index) => {
    if (/^\s+$/.test(word)) return word;

    return (
      <Fragment key={index}>
        {word.startsWith('https://') ? (
          word.split('/').map((segment, part, segments) => (
            <Fragment key={part}>
              <span className="docs-command-word">
                {segment}
                {part < segments.length - 1 ? '/' : ''}
              </span>
              {part < segments.length - 1 ? <wbr /> : null}
            </Fragment>
          ))
        ) : (
          <span className="docs-command-word">{word}</span>
        )}
      </Fragment>
    );
  });
}

export function CopyCodeBlock({
  code,
  label,
  language = 'tsx',
  header,
  command = false,
  expanded = true,
  onReveal,
  disabled = false,
  emptyMessage,
  viewerId,
  file = false,
  target,
  copyLabel = label,
}: CopyCodeBlockProps) {
  const [result, setResult] = useState<CopyResult>({ code, label, state: 'idle', request: null });
  const changed = result.code !== code || result.label !== label;
  const copyState = changed ? 'idle' : result.state;

  // Reset in this render while retaining the header controls and their keyboard focus.
  if (changed) setResult({ code, label, state: 'idle', request: null });
  const codeRef = useRef<HTMLElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const toggleTop = useRef<number | null>(null);
  const generatedId = useId();
  const codeId = `${generatedId}-code`;
  const preId = `${generatedId}-pre`;
  const collapsible = !command && !file && code.split('\n').length > COLLAPSE_AFTER_LINES;
  const [open, setOpen] = useState(false);
  const collapsed = collapsible && !open;

  // Collapsing shortens the page above the toggle, so keep the toggle where it was on screen
  // rather than leaving the reader far below the code they just closed.
  useLayoutEffect(() => {
    const before = toggleTop.current;
    toggleTop.current = null;

    if (before === null || !toggleRef.current) return;
    const drift = toggleRef.current.getBoundingClientRect().top - before;

    if (Math.abs(drift) > 1) window.scrollBy({ top: drift, behavior: 'instant' });
  }, [open]);

  function toggleOpen() {
    const pre = preRef.current;

    if (!open && pre) {
      // Expanding grows from the resting height to the code's full height.
      pre.style.setProperty('--docs-code-full', `${pre.scrollHeight}px`);
    }

    if (open && toggleRef.current)
      toggleTop.current = toggleRef.current.getBoundingClientRect().top;
    setOpen(!open);
  }

  const highlighted = useMemo(
    () => (expanded ? (command ? wrappedCommand(code) : highlight(code, language)) : null),
    [code, command, expanded, language],
  );

  useEffect(() => {
    if (copyState !== 'failed' || !codeRef.current) return;

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(codeRef.current);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [copyState, expanded]);

  async function copyCode() {
    onReveal?.();
    const request = Symbol('copy');
    setResult({ code, label, state: 'copying', request });

    function finish(state: CopyState) {
      setResult((current) => (current.request === request ? { ...current, state } : current));
    }

    try {
      await navigator.clipboard.writeText(code);
      finish('copied');
    } catch {
      finish('failed');
    }
  }

  const buttonLabel =
    copyState === 'copying'
      ? 'Copying…'
      : copyState === 'copied'
        ? 'Copy again'
        : copyState === 'failed'
          ? 'Try again'
          : 'Copy';

  const feedback =
    copyState === 'copying'
      ? `Copying ${copyLabel}.`
      : copyState === 'copied'
        ? `Copied ${copyLabel} to the clipboard.`
        : copyState === 'failed'
          ? `Couldn't copy. The ${file ? 'file' : command ? 'command' : 'code'} is selected, so you can copy it yourself.`
          : '';

  return (
    <div
      className={`docs-code-block${command ? ' docs-command-block' : ''}${file ? ' docs-install-file' : ''}`}
      data-collapsible={collapsible || undefined}
      data-collapsed={collapsed || undefined}
      data-language={language}
      data-target={target}
      role="region"
      aria-label={label}
    >
      <div className="docs-code-header">
        {header ?? <span>{label}</span>}
        <button
          type="button"
          className="docs-copy-button"
          data-state={copyState}
          aria-describedby={codeId}
          onClick={copyCode}
          disabled={disabled || copyState === 'copying'}
        >
          {buttonLabel}
        </button>
      </div>
      <p
        className="docs-copy-status"
        data-failed={copyState === 'failed' || undefined}
        role="status"
        aria-live="polite"
        aria-label="Copy feedback"
      >
        {feedback}
      </p>
      <div
        className="docs-code-body"
        id={viewerId}
        hidden={!expanded}
        role={file ? 'region' : undefined}
        aria-label={file ? `${label} source` : undefined}
      >
        {emptyMessage ? (
          <p className="docs-file-state">{emptyMessage}</p>
        ) : (
          <pre
            id={collapsible ? preId : undefined}
            ref={preRef}
            tabIndex={0}
            onTransitionEnd={(event) => {
              // Once grown, let the code size itself, so a later resize never clips it.
              if (open && event.propertyName === 'max-height') {
                event.currentTarget.style.removeProperty('--docs-code-full');
              }
            }}
          >
            {command ? (
              <span className="docs-command-prompt" aria-hidden="true">
                ${' '}
              </span>
            ) : null}
            <code id={codeId} ref={codeRef}>
              {highlighted}
            </code>
          </pre>
        )}
        {collapsible && !emptyMessage ? (
          <div className="docs-code-fold">
            <button
              type="button"
              className="docs-code-toggle"
              ref={toggleRef}
              aria-controls={preId}
              aria-expanded={open}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
              onClick={toggleOpen}
            >
              {open ? 'Collapse' : 'Expand'}
              <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12">
                <path
                  d="M3 4.5 6 7.5l3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
