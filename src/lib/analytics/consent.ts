export const CONSENT_COOKIE = 'glassy-ui-analytics-consent';

export const CONSENT_VERSION = 'analytics-v1';

export const CONSENT_MAX_AGE_SECONDS = 180 * 86400;

export type ConsentPreference = {
  decision: 'accepted' | 'rejected';
  version: string;
  purpose: 'analytics';
  updatedAt: number;
  expiresAt: number;
};

type ConsentDecision = {
  allowed: boolean;
  basis: 'consent' | 'legitimate_interest' | null;
  mode: 'opt-in' | 'opt-out';
  decision: 'undecided' | 'accepted' | 'rejected';
};

type ConsentInput = {
  preference: ConsentPreference | null;
  country: string | null;
  trustedCountry: boolean;
  reviewedOptOutCountries: readonly string[];
  signal: boolean;
  configured: boolean;
  now: number;
};

const PRIOR_CONSENT_COUNTRIES = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH CA AX GF GP MQ RE YT MF GG JE IM GI'.split(
    ' ',
  ),
);

// ISO 3166-1 alpha-2 country/territory codes; reserved or unassigned signals stay unknown.
const COUNTRY_CODES = new Set(
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  ),
);

// The US-only regional choice and trusted-proxy requirements are documented in
// docs/analytics-consent.md. This product owns its country list.
export const REVIEWED_OPT_OUT_COUNTRIES: readonly string[] = ['US'];

export function parseCountry(country: string | null): string | null {
  return country !== null && COUNTRY_CODES.has(country) ? country : null;
}

export function parseConsent(raw: string | null, now = Date.now()): ConsentPreference | null {
  if (!raw) return null;

  try {
    const value: ConsentPreference | null = JSON.parse(raw);

    if (
      !value ||
      (value.decision !== 'accepted' && value.decision !== 'rejected') ||
      value.purpose !== 'analytics' ||
      !/^analytics-v\d+$/.test(value.version) ||
      !Number.isSafeInteger(value.updatedAt) ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.updatedAt < 0 ||
      value.updatedAt > now ||
      value.expiresAt <= now ||
      value.expiresAt <= value.updatedAt ||
      value.expiresAt - value.updatedAt > CONSENT_MAX_AGE_SECONDS * 1000 ||
      (value.decision === 'accepted' && value.version !== CONSENT_VERSION)
    )
      return null;

    return {
      decision: value.decision,
      version: value.version,
      purpose: value.purpose,
      updatedAt: value.updatedAt,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

export function decideConsent(input: ConsentInput): ConsentDecision {
  const country = parseCountry(input.country);

  const mode =
    input.trustedCountry &&
    country !== null &&
    !PRIOR_CONSENT_COUNTRIES.has(country) &&
    input.reviewedOptOutCountries.includes(country)
      ? 'opt-out'
      : 'opt-in';

  const preference = parseConsent(JSON.stringify(input.preference), input.now);
  const decision = input.signal ? 'rejected' : (preference?.decision ?? 'undecided');

  const allowed =
    input.configured && decision !== 'rejected' && (decision === 'accepted' || mode === 'opt-out');

  return {
    allowed,
    basis: allowed ? (decision === 'accepted' ? 'consent' : 'legitimate_interest') : null,
    mode,
    decision,
  };
}
