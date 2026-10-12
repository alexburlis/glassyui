import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '@/components/site/legal-document';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Imprint',
  description: 'Who provides Glassy UI and Glassy UI Pro, and how to reach them.',
  alternates: { canonical: '/imprint' },
  robots: { index: false, follow: true },
};

export default function ImprintPage() {
  return (
    <>
      <SiteNav />
      <LegalDocument
        description="Provider information for glassyui.com and pro.glassyui.com."
        label="Imprint"
        title="Imprint / Impressum"
      >
        <div className="legal-columns">
          <div>
            <LegalSection title="Information according to Section 5 DDG">
              <p>
                {OPERATOR.provider}
                <br />
                {OPERATOR.addressLines.join(', ')}
              </p>
              <p>
                Managing director: {OPERATOR.representative}
                <br />
                Commercial register: {OPERATOR.commercialRegister}, {OPERATOR.registerCourt}
                <br />
                VAT ID: {OPERATOR.vatId}
              </p>
            </LegalSection>
            <LegalSection title="Contact">
              <p>
                Phone: {OPERATOR.phone}
                <br />
                Email: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
              </p>
            </LegalSection>
            <LegalSection title="Service">
              <p>
                Glassy UI is a free, MIT-licensed library of components for React. We sell website
                templates built with it as Glassy UI Pro.
              </p>
            </LegalSection>
          </div>
          <div lang="de">
            <LegalSection title="Angaben gemäß § 5 DDG">
              <p>
                {OPERATOR.provider}
                <br />
                {OPERATOR.addressLinesGerman.join(', ')}
              </p>
              <p>
                Geschäftsführer: {OPERATOR.representative}
                <br />
                Handelsregister: {OPERATOR.commercialRegister}, {OPERATOR.registerCourt}
                <br />
                USt-IdNr.: {OPERATOR.vatId}
              </p>
            </LegalSection>
            <LegalSection title="Kontakt">
              <p>
                Telefon: {OPERATOR.phone}
                <br />
                E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
              </p>
            </LegalSection>
          </div>
        </div>
      </LegalDocument>
      <SiteFooter />
    </>
  );
}
