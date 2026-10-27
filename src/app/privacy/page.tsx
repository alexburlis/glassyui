import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '@/components/site/legal-document';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'How glassyui.com and pro.glassyui.com handle visits, purchases, email updates and support.',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <LegalDocument
        description="How glassyui.com and pro.glassyui.com handle visits, purchases, email updates and support messages."
        effectiveDate="October 20, 2026"
        label="Privacy"
        title="Privacy policy"
      >
        <LegalSection title="Controller and scope">
          <p>
            The controller for these websites, template delivery and our support is{' '}
            {OPERATOR.provider}, {OPERATOR.address}. Contact:{' '}
            <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Company details are in our{' '}
            <a href="/imprint">imprint</a>. This notice covers both Glassy UI websites, not separate
            websites built by others using our components or templates.
          </p>
        </LegalSection>
        <LegalSection title="Website delivery and security">
          <p>
            Hetzner Online GmbH hosts our server in Germany. Cloudflare, Inc. provides DNS, content
            delivery and network security. These services process technical request data such as
            your IP address, requested URL, time, browser and operating-system information,
            referring page where supplied, and response or error data to serve pages, diagnose
            faults and prevent abuse. This is based on our legitimate interests in operating a
            reliable, secure website (Article 6(1)(f) GDPR).
          </p>
          <p>
            Appearance, accessibility, documentation-platform and intro preferences are stored
            locally in your browser, independently of analytics permission. See our{' '}
            <a href="/cookie-policy">cookie policy</a> for browser storage and the separate
            checkout.
          </p>
          <p>
            Provider information:{' '}
            <a href="https://www.hetzner.com/legal/privacy-policy/">Hetzner</a> and{' '}
            <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a>.
          </p>
        </LegalSection>
        <LegalSection title="Error reports">
          <p>
            Browser error reports start only after you choose Allow error reports in Privacy
            settings. This choice is separate from analytics. Sentry receives an error category,
            minimized stack coordinates and the exact website build to help us repair failures.
            Messages, page content, query strings, cookies, account details and IP enrichment are
            excluded. We do not enable sessions, replay, tracing, profiling or log collection.
          </p>
          <p>
            Browser reporting relies on consent under Article 6(1)(a) GDPR and Section 25(1) TDDDG.
            Turn error reports off in Privacy settings to stop new reports and discard unsent
            events. Global Privacy Control and Do Not Track also prevent browser reporting. Your
            separate choice is remembered for up to 180 days. Withdrawal cannot recall reports
            already transmitted.
          </p>
          <p>
            Minimized server error reports do not access your device and rely on our legitimate
            interest in operating a reliable website under Article 6(1)(f) GDPR. Sentry&apos;s EU
            region receives reports; network requests necessarily expose connection information to
            the receiving infrastructure. Payloads prevent IP enrichment, without claiming to
            eliminate that infrastructure processing. See the{' '}
            <a href="https://sentry.io/privacy/">Sentry privacy policy</a>.
          </p>
        </LegalSection>
        <LegalSection title="Optional analytics and your choice">
          <p>
            We use PostHog, Inc. to understand how visitors use public pages, navigation, search,
            install-copy controls, appearance and platform choices, signup forms and Glassy UI Pro
            links. When a valid project configuration and trusted country information identify a
            United States visit, this minimal analytics runs by default unless you have refused. The
            notice lets you turn analytics off immediately. Everywhere else, including the EU/EEA,
            United Kingdom, Switzerland and unknown locations, analytics starts only after you
            choose Accept analytics. Analytics is optional; the free library, purchases and
            appearance settings remain available when you refuse.
          </p>
          <p>
            We send page views (<code>$pageview</code>), page exits (<code>$pageleave</code>),
            loading and interaction measurements (<code>$web_vitals</code>), and explicit Pro
            checkout-button clicks (<code>pro_checkout_click</code>), promotion and navigation
            clicks, visible Pro banner impressions, and control actions. Interaction events contain
            fixed control categories, placement, destination categories and outcomes. Signup
            outcomes mean a request was accepted or failed, not a confirmed subscription. Search
            text, copied content and email addresses are excluded. An event contains a known public
            route or route category, the Glassy UI site, event time, processing basis, scroll depth,
            time on a page, browser and device categories, screen dimensions, a broad referral
            category and fixed source labels such as X, GitHub or Google. Known campaign tags and
            the landing-page category connect permitted visits to later control actions. Raw
            campaign strings and full referrers are excluded. Random PostHog browser and session
            identifiers use a first-party cookie shared between the two sites, with an expiry of 30
            minutes after refresh. Page-view identifiers and technical session state support
            navigation measurement. We do not link these identifiers to an account or purchase. A
            visit to a thank-you page is a page view, not proof of payment.
          </p>
          <p>
            Event properties exclude query strings, fragments, full referring URLs, email addresses,
            checkout or session tokens and free-form content. Autocapture, session replay, heatmaps,
            console recording, surveys, feature flags, experiments and automatic exception
            collection are disabled. We do not use advertising pixels or a cookieless tracking
            fallback. The analytics request necessarily exposes connection information, including
            your IP address and browser user agent, to the receiving service. Our event payload
            suppresses IP enrichment and geolocation; this does not eliminate the provider&apos;s
            processing of connection data.
          </p>
          <p>
            After explicit acceptance, personal-data processing relies on your consent under Article
            6(1)(a) GDPR, and optional storage or device access relies on consent under Section
            25(1) TDDDG. For the United States default, we rely on our legitimate interest in
            understanding public-page use, source-to-action journeys and checkout-link interest
            under Article 6(1)(f) GDPR. We limit this to the events above, without advertising,
            person profiles or recording sessions, and provide an unconditional way to object. The
            German controller&apos;s GDPR obligations apply beyond Europe. The US default does not
            constitute consent or establish an exemption from German device-access requirements. We
            honour Global Privacy Control and Do Not Track as refusals, including when an earlier
            choice allowed analytics. Closing the notice or continuing to browse does not give
            consent.
          </p>
          <p>
            Open Privacy settings in either site&apos;s footer to accept, reject, turn analytics off
            or withdraw. An objection or withdrawal stops new analytics and discards unsent events;
            it removes optional PostHog browser storage while keeping your refusal and requested
            site preferences. Events from a period when analytics is disallowed are not saved for
            later delivery. Turning analytics off does not recall events already transmitted or
            affect earlier lawful processing. The preference cookie remembers your choice for up to
            180 days; this is our chosen preference lifetime, not a statutory retention period for
            analytics events.
          </p>
        </LegalSection>
        <LegalSection title="PostHog hosting and international processing">
          <p>
            This integration is configured for PostHog EU Cloud and sends events through a
            first-party endpoint to <code>https://eu.i.posthog.com</code>. PostHog&apos;s published{' '}
            <a href="https://posthog.com/subprocessors">subprocessor information</a> describes EU
            Cloud data storage in Germany and international infrastructure processing. Our PostHog
            processor agreement and transfer arrangements are in place. Its{' '}
            <a href="https://posthog.com/dpa">data-processing agreement</a> describes the selected
            data centre, international transfers, the Data Privacy Framework and Standard
            Contractual Clauses. An EU endpoint alone does not establish that every processing
            operation stays in the EU.
          </p>
          <p>
            Without a valid project configuration, analytics remains disabled. PostHog&apos;s own
            information is available in its <a href="https://posthog.com/privacy">privacy policy</a>
            .
          </p>
        </LegalSection>
        <LegalSection title="Orders, payments and delivery">
          <p>
            We sell Glassy UI Pro. Stripe Managed Payments and Sold through Link, LLC facilitate
            checkout, payments, tax, receipts, fraud prevention and transaction support. Payment and
            billing details are supplied to the hosted checkout; we do not receive your full card
            number or card security code.
          </p>
          <p>
            We receive order information needed to fulfil and administer your purchase, including
            your name, email, billing or tax information where provided, purchased product,
            transaction reference, amount, currency and payment or refund status. We use this to
            deliver templates, recognise your license entitlement, handle requests and refunds, and
            maintain required business records. Necessary purchase and contact information is
            required to process and deliver an order; visiting the free library does not require
            making a purchase or opening an account with us.
          </p>
          <p>
            Fulfilment and purchase-related support rely on Article 6(1)(b) GDPR; statutory record
            keeping on Article 6(1)(c); and proportionate fraud prevention and the establishment or
            defence of legal claims on Article 6(1)(f). Stripe and Link also process information for
            their own payment, security and legal purposes as described in the{' '}
            <a href="https://stripe.com/privacy">Stripe privacy policy</a> and the privacy
            information shown in checkout.
          </p>
        </LegalSection>
        <LegalSection title="Email and support">
          <p>
            Cloudflare Email Routing forwards mail sent to our support address to our Proton Mail
            inbox, provided by Proton AG in Switzerland. Your sender and recipient addresses,
            message content, attachments and delivery metadata pass through the relevant email
            services. Please do not send payment-card details or other sensitive information that is
            unnecessary for your request.
          </p>
          <p>
            We use this information to answer you and follow up. Purchase enquiries and support
            necessary for a contract rely on Article 6(1)(b) GDPR; other correspondence relies on
            our legitimate interest in responding to requests, Article 6(1)(f). Delivery and
            essential product communications do not subscribe you to marketing updates. See the{' '}
            <a href="https://proton.me/mail/privacy-policy">Proton Mail privacy policy</a>.
          </p>
        </LegalSection>
        <LegalSection title="Optional email updates">
          <p>
            If you subscribe, we email you about new Glassy UI components and tutorials, and Glassy
            UI Pro launches, templates and offers. We use your email address and record the signup
            notice, its version, source, request and confirmation times, and a stable pseudonymous
            identifier derived from your address. Only confirming the link in our email subscribes
            you. This relies on your consent under Article 6(1)(a) GDPR. You can withdraw it at any
            time through the unsubscribe link in each marketing email, without signing in or
            affecting your use of Glassy UI.
          </p>
          <p>
            Our Mailwerk service manages subscriptions, consent and withdrawal. Amazon Web Services
            provides delivery through Amazon SES in the Stockholm region (<code>eu-north-1</code>).
            AWS is a US-parented processor; its data processing agreement governs relevant
            international transfers. Your chosen mailbox provider also processes delivered mail. We
            record delivery, bounces, complaints and unsubscribe events to operate the service. We
            do not track email opens or link clicks.
          </p>
          <p>
            We keep active subscriptions until you withdraw consent or request deletion. Contacts
            without confirmed consent or an active email sequence are erased after 30 days of
            inactivity, normally within 31 days. We retain minimal consent evidence where needed to
            demonstrate permission, and keyed suppression records to prevent unwanted sends;
            suppression survives deletion of the contact. To request access or deletion, contact{' '}
            <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. See the{' '}
            <a href="https://aws.amazon.com/privacy/">AWS privacy notice</a>.
          </p>
        </LegalSection>
        <LegalSection title="Retention">
          <p>
            We determine retention by the purpose and type of record. Technical logs are needed for
            diagnosing faults and identifying or investigating abuse; incident-related evidence may
            be retained while an investigation or related claim remains unresolved. Data no longer
            needed for those purposes is deleted or anonymised.
          </p>
          <p>
            We keep the minimum order and contact information needed to deliver your purchase and
            maintain your continuing license entitlement. Support correspondence is retained while
            the request, necessary follow-up or related warranty or legal claims remain relevant.
            Accounting and tax records are retained for the applicable statutory period for that
            record type. Legal preservation duties may require longer retention; information
            retained only for those duties is not used for unrelated purposes.
          </p>
          <p>
            Appearance and documentation preferences remain until you clear the relevant site data
            or your browser removes it. The analytics-choice cookie and the SDK&apos;s technical
            permission cookie expire after at most 180 days. The analytics identifier is held only
            in page memory. Cookie expiry and withdrawal do not delete events already received by
            PostHog.
          </p>
          <p>
            Our current PostHog plan makes events queryable for seven years. This limits which
            events appear in queries; it does not automatically delete older data. The
            provider&apos;s exact raw-event and backup deletion periods have not been verified. You
            can request information about retention or erasure of your data using the contact
            address above.
          </p>
        </LegalSection>
        <LegalSection title="Recipients and international processing">
          <p>
            The providers named above receive information necessary for their respective services.
            Where they process information on our instructions, they act as processors; payment
            providers also have their own independent responsibilities. Necessary records may
            additionally be disclosed to professional advisers, competent authorities or parties
            involved in a specific legal claim where a lawful basis exists.
          </p>
          <p>
            Hosting the origin server in Germany does not mean all processing stays in Germany.
            Cloudflare and Stripe operate internationally, including in the United States; Proton is
            based in Switzerland. For transfers covered by an EU adequacy decision we rely on that
            decision. For other relevant transfers, safeguards include the European Commission's
            Standard Contractual Clauses in the applicable provider arrangements. You may request
            information about the safeguards applying to your data and how to obtain a copy from us.
            Provider details are available in{' '}
            <a href="https://www.cloudflare.com/cloudflare-customer-dpa/">Cloudflare's DPA</a> and{' '}
            <a href="https://stripe.com/legal/dpa">Stripe's DPA</a>.
          </p>
        </LegalSection>
        <LegalSection title="Your rights">
          <p>
            Subject to the applicable legal conditions, you may request access, correction, erasure,
            restriction of processing and data portability. You may object to processing based on
            legitimate interests on grounds relating to your situation. Where processing relies on
            consent, you may withdraw it at any time without affecting earlier lawful processing. We
            do not make solely automated decisions with legal or similarly significant effects about
            you.
          </p>
          <p>
            Contact <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> to exercise your
            rights. We may need proportionate information to verify a request. You may complain to a
            competent supervisory authority, including the{' '}
            <a href="https://www.ldi.nrw.de/">
              State Commissioner for Data Protection and Freedom of Information North
              Rhine-Westphalia
            </a>
            , or the authority where you live or work in the EU.
          </p>
        </LegalSection>
      </LegalDocument>
      <SiteFooter />
    </>
  );
}
