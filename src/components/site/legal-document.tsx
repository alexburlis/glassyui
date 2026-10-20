import type { ReactNode } from 'react';
import { LEGAL_EFFECTIVE_DATE } from '@/lib/legal';

type LegalDocumentProps = {
  children: ReactNode;
  description: string;
  effectiveDate?: string;
  label: string;
  title: string;
};

/** A legal page's body: what it is, when it took effect, then its sections. */
export function LegalDocument({
  children,
  description,
  effectiveDate = LEGAL_EFFECTIVE_DATE,
  label,
  title,
}: LegalDocumentProps) {
  return (
    <main className="legal-page" id="main-content">
      <header className="docs-page-header">
        <p className="docs-eyebrow">{label}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <p className="legal-date">Effective {effectiveDate}</p>
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
