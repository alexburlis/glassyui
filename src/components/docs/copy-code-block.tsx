'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type CodeLanguage = 'json' | 'shell' | 'tsx';

type CopyCodeBlockProps = {
  code: string;
  label: string;
  language?: CodeLanguage;
};

type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

type TokenKind = 'attr' | 'comment' | 'keyword' | 'number' | 'string' | 'tag';

// Earlier rules win where two could match at the same place.
const GRAMMARS = {
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

export function CopyCodeBlock({ code, label, language = 'tsx' }: CopyCodeBlockProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const highlighted = useMemo(() => highlight(code, language), [code, language]);

  async function copyCode() {
    setCopyState('copying');

    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
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
      ? `Copying ${label}.`
      : copyState === 'copied'
        ? `Copied ${label} to the clipboard.`
        : copyState === 'failed'
          ? `Could not copy ${label}. Select the code and copy it manually.`
          : '';

  return (
    <div className="docs-code-block" data-language={language}>
      <div className="docs-code-header">
        <span>{label}</span>
        <button
          type="button"
          data-state={copyState}
          onClick={copyCode}
          disabled={copyState === 'copying'}
        >
          {buttonLabel}
        </button>
      </div>
      <p className="docs-copy-status" role="status" aria-live="polite" aria-label="Copy feedback">
        {feedback}
      </p>
      {/* Long lines scroll sideways on phones, so keyboard users need a way in. */}
      <pre tabIndex={0}>
        <code>{highlighted}</code>
      </pre>
    </div>
  );
}
