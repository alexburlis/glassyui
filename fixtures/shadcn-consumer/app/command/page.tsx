'use client';

import { useCallback, useRef, useState } from 'react';
import {
  GlassCommand,
  GlassCommandEmpty,
  GlassCommandGroup,
  GlassCommandInput,
  GlassCommandItem,
  GlassCommandList,
} from '@/components/glassyui/glass-command';

const documents = Array.from(
  { length: 32 },
  (_, index) => `Document ${String(index + 1).padStart(2, '0')}`,
);

export default function InstalledCommandFixture() {
  const [mounted, setMounted] = useState(false);
  const [controlled, setControlled] = useState(false);
  const [manualFiltering, setManualFiltering] = useState(false);
  const [prefixFiltering, setPrefixFiltering] = useState(false);
  const [selected, setSelected] = useState('Document 16');
  const [activated, setActivated] = useState('None');
  const [refResult, setRefResult] = useState('Unread');
  const firstItemRef = useRef<HTMLDivElement>(null);

  const secondItemRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.dataset.consumerRef = 'attached';

      return () => {
        node.dataset.consumerRef = 'released';
      };
    }
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Installed command consumer</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button onClick={() => setMounted(!mounted)} type="button">
          {mounted ? 'Unmount command' : 'Mount command'}
        </button>
        <button onClick={() => setControlled(!controlled)} type="button">
          {controlled ? 'Use uncontrolled selection' : 'Use controlled selection'}
        </button>
        <button onClick={() => setManualFiltering(!manualFiltering)} type="button">
          {manualFiltering ? 'Use built-in filtering' : 'Disable built-in filtering'}
        </button>
        <button onClick={() => setPrefixFiltering(!prefixFiltering)} type="button">
          {prefixFiltering ? 'Use default filter' : 'Use prefix filter'}
        </button>
        <button onClick={() => setSelected('Document 24')} type="button">
          Select Document 24 externally
        </button>
        <button
          onClick={() => setRefResult(firstItemRef.current?.textContent ?? 'Missing')}
          type="button"
        >
          Read item ref
        </button>
      </div>
      <p>
        Activated: <output aria-label="Activated document">{activated}</output>
      </p>
      <p>
        Forwarded ref: <output aria-label="Item ref result">{refResult}</output>
      </p>
      <div aria-hidden style={{ height: 1800 }} />
      {mounted && (
        <section style={{ width: 380, maxWidth: '100%' }}>
          <GlassCommand
            defaultValue="Document 01"
            filter={
              prefixFiltering
                ? (value, search) => (value.toLowerCase().startsWith(search.toLowerCase()) ? 1 : 0)
                : undefined
            }
            label="Installed documents"
            loop
            onValueChange={setSelected}
            shouldFilter={!manualFiltering}
            value={controlled ? selected : undefined}
          >
            <GlassCommandInput placeholder="Find a document" />
            <GlassCommandList style={{ maxHeight: 160, overflow: 'auto' }}>
              <GlassCommandEmpty>No documents</GlassCommandEmpty>
              <GlassCommandGroup heading="Documents">
                {documents.map((document, index) => (
                  <GlassCommandItem
                    disabled={index === 2}
                    key={document}
                    onSelect={setActivated}
                    ref={
                      index === 0
                        ? firstItemRef
                        : index === 1 || index === 31
                          ? secondItemRef
                          : undefined
                    }
                    style={{ minHeight: 36 }}
                    value={document}
                  >
                    {document}
                  </GlassCommandItem>
                ))}
              </GlassCommandGroup>
            </GlassCommandList>
          </GlassCommand>
        </section>
      )}
      <div aria-hidden style={{ height: 800 }} />
    </main>
  );
}
