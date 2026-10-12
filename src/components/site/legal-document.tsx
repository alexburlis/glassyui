import type { ReactNode } from 'react';
import { LEGAL_EFFECTIVE_DATE } from '@/lib/legal';

type LegalDocumentProps = {
  children: ReactNode;
  description: string;
  label: string;
  title: string;
};

/** A legal page's body: what it is, when it took effect, then its sections. */
export function LegalDocument({ children, description, label, title }: LegalDocumentProps) {
  return (
    <main className="legal-page" id="main-content">
      <header className="docs-page-header">
        <p className="docs-eyebrow">{label}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <p className="legal-date">Effective {LEGAL_EFFECTIVE_DATE}</p>
      </header>
      {children}
    </main>
  );
}

export function LegalSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="docs-section legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
