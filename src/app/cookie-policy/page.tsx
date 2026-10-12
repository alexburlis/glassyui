import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '@/components/site/legal-document';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { OPERATOR } from '@/lib/legal';
import { PREFERENCE_STORAGE_KEY } from '@/lib/liquid/preferences';

export const metadata: Metadata = {
  title: 'Cookie policy',
  description: 'Cookies and browser storage on glassyui.com and pro.glassyui.com.',
  alternates: { canonical: '/cookie-policy' },
  robots: { index: false, follow: true },
};

export default function CookiePolicyPage() {
  return (
    <>
      <SiteNav />
      <LegalDocument
        description="Cookies and similar browser storage on glassyui.com and pro.glassyui.com."
        label="Cookies"
        title="Cookie policy"
      >
        <LegalSection title="Scope and current use">
          <p>
            {OPERATOR.provider} operates these sites. Cookies are small values stored by a browser
            and sent with relevant requests; local storage keeps values in the browser without
            automatically sending them with requests. Both can be subject to rules on storing or
            accessing information on your device.
          </p>
          <p>
            With a valid project configuration and trusted country information, optional PostHog
            analytics runs by default for United States visits, unless you have refused. The notice
            lets you turn analytics off immediately. Everywhere else, including unknown locations,
            it starts only after you choose Accept analytics. A regional default is not explicit
            consent. The analytics choice is separate from requested site preferences, security and
            payment processing. Technical server and network logs and analytics provider details are
            explained in our <a href="/privacy">privacy policy</a>.
          </p>
        </LegalSection>
        <LegalSection title="Appearance and accessibility preferences">
          <p>
            First-party local storage named <code>{PREFERENCE_STORAGE_KEY}</code> remembers your
            choices for theme, glass appearance, rendering quality, reduced motion and reduced
            transparency. It contains settings rather than an analytics identifier and is not sent
            to us for tracking. It has no automatic expiry in the application and remains until you
            clear site data or the browser removes it. Browser storage is separate for each site
            origin.
          </p>
          <p>
            Local storage named <code>glassy-ui-docs-platform</code> remembers whether you view
            React or React Native documentation. It contains that platform choice, has no automatic
            expiry and stays within the site origin. It is not an analytics identifier.
          </p>
          <p>
            We use preference storage to provide the settings you request, not to measure your
            behaviour. Storage strictly necessary for an explicitly requested service does not
            require consent under Section 25(2) TDDDG. You can change these preferences in the
            appearance controls or remove them in your browser's site-data settings; removing them
            resets the saved choices.
          </p>
          <p>
            Local storage named <code>glassy-ui-intro</code> remembers that the home page intro has
            started, so it runs once. It contains no analytics identifier, has no automatic expiry
            and stays within the site origin. Clear site data to remove it; Replay intro plays the
            animation again without changing your analytics choice.
          </p>
        </LegalSection>
        <LegalSection title="Remembering your analytics choice">
          <p>
            The first-party cookie <code>glassy-ui-analytics-consent</code> stores only an explicit
            accepted or rejected decision, the analytics purpose and notice version, and the
            decision and expiry timestamps. It contains no visitor identifier. Its maximum lifetime
            is 180 days. This is our preference lifetime, not a universal legal expiry rule. An
            expired or invalid acceptance no longer counts as consent; where prior consent is
            required, you must choose again. A material purpose change requires renewed permission.
            A remembered refusal is not changed into acceptance by a region or notice-version
            change.
          </p>
          <p>
            On HTTPS production sites, the cookie uses the <code>glassyui.com</code> domain,
            <code> Path=/</code>, <code>Secure</code> and <code>SameSite=Lax</code> to share your
            choice between glassyui.com and pro.glassyui.com. It is not shared with Stripe or
            unrelated domains. Local development uses a host-only cookie. Remembering the privacy
            choice is necessary to apply your request under Section 25(2) TDDDG. Optional analytics
            storage is separate; the US default does not create a consent exemption under German
            device-access law. See our <a href="/privacy">privacy policy</a> for the processing
            bases.
          </p>
        </LegalSection>
        <LegalSection title="Optional PostHog storage and withdrawal">
          <p>
            When analytics is allowed by your acceptance or the US default, PostHog uses a
            first-party cookie shared by the two sites named{' '}
            <code>glassyui_analytics_sdk_permission</code>, with a maximum lifetime of 180 days, to
            store its technical capture-enabled flag. It contains only a boolean permission marker,
            not a visitor identifier or proof that you clicked Accept. The Glassy UI choice cookie
            above is the recorded decision. The SDK cookie uses HTTPS/Secure,
            <code> Path=/</code> and <code>SameSite=Lax</code> on production sites.
          </p>
          <p>
            Analytics identifiers are kept in current-page memory rather than cookies, local storage
            or session storage. They end when the page document closes or analytics is withdrawn.
            There is no persistent analytics visitor identifier, session replay or tracking fallback
            after refusal. The SDK is first loaded only when analytics is allowed; analytics events
            are not queued during a period when collection is disallowed.
          </p>
          <p>
            Choose Turn off in the US notice, or open Privacy settings in either footer to reject
            analytics or withdraw. The sites discard unsent analytics and remove optional PostHog
            storage; your refusal and appearance/documentation settings stay. Global Privacy Control
            and Do Not Track also disable analytics. Rejecting analytics does not block browsing or
            checkout. Removing local cookies does not erase events already sent to PostHog. Provider
            retention is separate from cookie expiry, as described in our{' '}
            <a href="/privacy">privacy policy</a>.
          </p>
        </LegalSection>
        <LegalSection title="Security services and external checkout">
          <p>
            Cloudflare delivers and protects the sites. Where a security challenge is presented,
            Cloudflare may use strictly necessary storage to remember its result and distinguish
            legitimate requests from abuse. This is separate from optional marketing or analytics.
            Cloudflare documents its service-specific cookies in its{' '}
            <a href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/">
              cookie information
            </a>
            . Not every cookie described there is used by every Cloudflare website.
          </p>
          <p>
            Following a purchase link opens Stripe/Link's hosted checkout on a separate domain. Its
            payment, fraud-prevention and any optional technologies are described and controlled
            there, not by clearing Glassy UI preferences. See the{' '}
            <a href="https://stripe.com/legal/cookies-policy">Stripe cookie policy</a> and the
            controls shown in checkout.
          </p>
        </LegalSection>
        <LegalSection title="Browser controls and questions">
          <p>
            Your browser lets you inspect, block or delete cookies and local storage for each
            domain. Blocking necessary storage can prevent saved settings, security checks or
            checkout features from working. Contact{' '}
            <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> with questions. Further
            information about personal data, providers and your rights is in our{' '}
            <a href="/privacy">privacy policy</a>.
          </p>
        </LegalSection>
      </LegalDocument>
      <SiteFooter />
    </>
  );
}
