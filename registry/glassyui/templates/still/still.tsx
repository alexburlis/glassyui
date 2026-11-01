'use client';

import './still.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GlassAccordion,
  GlassAccordionContent,
  GlassAccordionItem,
  GlassAccordionTrigger,
} from '../../glass-accordion';
import { GlassAvatar } from '../../glass-avatar';
import { GlassButton } from '../../glass-button';
import { GlassHeader } from '../../glass-header';
import {
  GlassToast,
  GlassToastDescription,
  GlassToastProvider,
  GlassToastViewport,
} from '../../glass-toast';
import { BreathGuide } from './breath-guide';
import { EveningPhone } from './evening-phone';
import { BellIcon, FadeIcon, MarkIcon, PlusIcon, StarIcon, SunriseIcon } from './icons';
import { PricingPlan } from './pricing-plan';
import { HeroSky } from './sky';
import { SoundScenes } from './sound-scenes';
import { slotProps, StoreMenu, type StoreLinks } from './store-menu';
import { StoryCarousel } from './story-carousel';

export type { StoreLinks, StorePlatform } from './store-menu';

/*
  Still: a landing page for a meditation and sleep app for iPhone and Android.

  It is a dark page: set data-lg-theme="dark" on <html>. Set --still-accent (with
  --still-accent-rotate, about the accent's hue minus 40deg, for the prominent buttons, and
  --still-accent-ink for their label) and the --still-serif and --still-sans font stacks on any
  ancestor to make it yours.
*/

const NAV = [
  { href: '#sounds', label: 'Sounds' },
  { href: '#stories', label: 'Stories' },
  { href: '#evenings', label: 'Evenings' },
  { href: '#pricing', label: 'Pricing' },
];

const FACTS = [
  {
    title: '3 min',
    body: 'A full session. Long enough to settle, short enough to do every night.',
  },
  {
    title: 'Offline',
    body: 'Every scene and story downloads, so the phone can stay in flight mode.',
  },
  {
    title: 'No streaks',
    body: 'Miss a night and nothing happens. Still never counts, scores or nags.',
  },
];

const POINTS = [
  {
    Icon: BellIcon,
    title: 'One gentle nudge',
    body: 'A single reminder at the time you choose. Never a streak, never a second ping.',
  },
  {
    Icon: FadeIcon,
    title: 'Sounds that let go',
    body: 'Scenes fade out over ten minutes once you’ve stopped touching the phone.',
  },
  {
    Icon: SunriseIcon,
    title: 'A wake window',
    body: 'Instead of one alarm, birdsong rises slowly across a half hour you choose.',
  },
];

const VOICES = [
  {
    quote:
      'I used to scroll until one in the morning. Now it’s three minutes of breathing, the night train, and I’m gone before the second stop.',
    initials: 'PN',
    name: 'Priya N.',
    role: 'Nurse on night shifts',
    tone: 'lilac',
  },
  {
    quote:
      'It’s the only app on my phone that has never asked me for anything. No streaks, no badges, no little red dots.',
    initials: 'TW',
    name: 'Tom W.',
    role: 'Secondary school teacher',
    tone: 'rose',
  },
  {
    quote:
      'The stories are so gently uneventful. I have never once heard the end of one, and I mean that as a compliment.',
    initials: 'LM',
    name: 'Lena M.',
    role: 'New parent, light sleeper',
    tone: 'blue',
  },
];

const FAQ = [
  {
    question: 'Is the free week really free?',
    answer:
      'Yes. Nothing is charged during the first seven nights, and Still reminds you two days before the week ends. Cancel from your phone’s subscription settings in a couple of taps.',
  },
  {
    question: 'Do I need headphones?',
    answer:
      'No. Every scene is mixed to sound right from a phone on a bedside table, and from headphones if you prefer them.',
  },
  {
    question: 'Does it work offline?',
    answer:
      'Download a scene or story once and it plays without a connection, including in flight mode. The breathing guide never needs one.',
  },
  {
    question: 'Will it wake me in the night?',
    answer:
      'No. Sounds fade out on a timer you choose, and nothing plays again until your wake window, if you set one.',
  },
  {
    question: 'What does Still know about me?',
    answer:
      'Very little. Your sessions stay on your phone. The free basics need no account, and there are no ads and nothing to sell.',
  },
  {
    question: 'Is Still a medical app?',
    answer:
      'No. It helps you relax and fall asleep. If poor sleep goes on for weeks, a doctor is the right person to talk to.',
  },
];

const FOOTER = [
  {
    id: 'app',
    title: 'The app',
    links: [
      { href: '#practice', label: 'Breathing' },
      { href: '#sounds', label: 'Sound scenes' },
      { href: '#stories', label: 'Sleep stories' },
      { href: '#evenings', label: 'Evenings' },
    ],
  },
  {
    id: 'still',
    title: 'Still',
    links: [
      { href: '#voices', label: 'Reviews' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#download', label: 'Download' },
    ],
  },
  {
    id: 'help',
    title: 'Help',
    links: [
      { href: '#faq', label: 'Questions' },
      { href: 'mailto:hello@still.example', label: 'Write to us' },
    ],
  },
];

function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return onScreen;
}

function Brand() {
  return (
    <>
      <MarkIcon className="still-brand-mark" />
      Still
    </>
  );
}

/**
 * The Still landing page. Pass `storeLinks` with your app's store pages; a store without a link
 * shows a demo note and opens nothing.
 */
export function Still({ storeLinks }: { storeLinks?: StoreLinks }) {
  const heroRef = useRef<HTMLElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const heroOnScreen = useOnScreen(heroRef);
  const [breathing, setBreathing] = useState(false);
  const [notice, setNotice] = useState(0);

  const showDemo = useCallback(() => setNotice((count) => count + 1), []);

  return (
    <GlassToastProvider duration={3800} label="Notification">
      <div
        className="still still-page"
        data-breathing={breathing || undefined}
        data-lg-theme="dark"
      >
        <a className="still-skip" href="#still-main">
          Skip to content
        </a>

        <GlassHeader
          actions={
            <GlassButton {...slotProps} className="still-header-cta still-button-sm" size="sm">
              <a href="#download">Get Still</a>
            </GlassButton>
          }
          brand={
            <a className="still-brand" href="#top">
              <Brand />
            </a>
          }
          className="still-header"
        >
          {NAV.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <a className="still-menu-cta" href="#download">
            Get Still
          </a>
        </GlassHeader>

        <main id="still-main" tabIndex={-1}>
          <section
            ref={heroRef}
            aria-labelledby="still-hero-title"
            className="still-hero"
            data-away={heroOnScreen ? undefined : ''}
            id="top"
          >
            <HeroSky glowRef={glowRef} />
            <BreathGuide glowRef={glowRef} onBreathingChange={setBreathing}>
              <h1 className="still-hero-title" id="still-hero-title">
                <span className="still-hero-line">Breathe out.</span>
                <span className="still-hero-line still-hero-line--soft">The day can wait.</span>
              </h1>
              <p className="still-hero-lede">
                Guided breathing, sleep sounds and stories read slowly. For iPhone and Android.
              </p>
            </BreathGuide>
          </section>

          <section
            aria-labelledby="still-practice-title"
            className="still-section still-practice"
            id="practice"
          >
            <div className="still-wrap still-practice-grid">
              <header className="still-practice-head still-rise">
                <p className="still-eyebrow">The practice</p>
                <h2 className="still-h2" id="still-practice-title">
                  Three minutes is enough.
                </h2>
              </header>
              <p className="still-practice-body still-rise">
                No mountain, no hour on a cushion. Breathe in for four, hold for two, out for six.
                Fifteen of those take three minutes, about as long as a cup of tea takes to steep.
              </p>
              <figure className="still-curve still-rise">
                <svg
                  aria-hidden
                  className="still-curve-art"
                  focusable="false"
                  viewBox="0 0 1200 280"
                >
                  <defs>
                    <linearGradient id="still-curve-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#e6dcff" stopOpacity="0.16" />
                      <stop offset="1" stopColor="#e6dcff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="still-curve-base" d="M0 250H1200" />
                  <path className="still-curve-guide" d="M400 20V250M600 20V250" />
                  <path
                    className="still-curve-area"
                    d="M0 250C200 250 200 40 400 40H600C900 40 900 250 1200 250Z"
                  />
                  <path
                    className="still-curve-line"
                    d="M0 250C200 250 200 40 400 40H600C900 40 900 250 1200 250"
                    pathLength={1}
                  />
                  <circle className="still-curve-dot" cx="0" cy="250" r="7" />
                  <circle className="still-curve-dot" cx="400" cy="40" r="7" />
                  <circle className="still-curve-dot" cx="600" cy="40" r="7" />
                  <circle className="still-curve-dot" cx="1200" cy="250" r="7" />
                </svg>
                <div className="still-curve-labels">
                  <p>
                    <b>In</b>
                    <span>4 s</span>
                  </p>
                  <p>
                    <b>Hold</b>
                    <span>2 s</span>
                  </p>
                  <p>
                    <b>Out</b>
                    <span>6 s</span>
                  </p>
                </div>
                <figcaption>
                  One breath takes twelve seconds. A long, slow out-breath is the part that settles
                  you.
                </figcaption>
              </figure>
              <div className="still-facts">
                {FACTS.map((fact) => (
                  <div key={fact.title} className="still-fact still-rise">
                    <h3>{fact.title}</h3>
                    <p>{fact.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <SoundScenes />

          <StoryCarousel />

          <section
            aria-labelledby="still-evenings-title"
            className="still-section still-evenings"
            id="evenings"
          >
            <div className="still-wrap still-evenings-grid">
              <div className="still-evenings-copy still-rise">
                <p className="still-eyebrow">Evenings</p>
                <h2 className="still-h2" id="still-evenings-title">
                  Your evening, set before you get there.
                </h2>
                <p className="still-lede">
                  Tell Still when you’d like to be asleep. An hour before, it nudges you once, warms
                  the screen and lines up tonight’s breath, sound and story.
                </p>
                <ul className="still-points">
                  {POINTS.map(({ Icon, title, body }) => (
                    <li key={title} className="still-point">
                      <span className="still-point-icon">
                        <Icon />
                      </span>
                      <div>
                        <h3>{title}</h3>
                        <p>{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="still-evenings-phone">
                <EveningPhone />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="still-voices-title"
            className="still-section still-voices"
            id="voices"
          >
            <div className="still-wrap">
              <header className="still-rise">
                <p className="still-eyebrow">From the people who use it</p>
                <h2 className="still-h2" id="still-voices-title">
                  Said quietly.
                </h2>
                <p className="still-rating">
                  <span aria-hidden className="still-rating-marks">
                    <StarIcon />
                    <StarIcon />
                    <StarIcon />
                    <StarIcon />
                    <StarIcon />
                  </span>
                  Rated 4.8 by 21,400 people on iPhone and Android
                </p>
              </header>
              <div className="still-voices-grid">
                {VOICES.map((voice) => (
                  <figure key={voice.name} className="still-voice still-rise">
                    <blockquote>“{voice.quote}”</blockquote>
                    <figcaption>
                      <GlassAvatar
                        aria-hidden
                        className={`still-avatar still-avatar--${voice.tone}`}
                        fallback={voice.initials}
                      />
                      <span>
                        <b>{voice.name}</b>
                        {voice.role}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="still-pricing-title"
            className="still-section still-pricing"
            id="pricing"
          >
            <div className="still-wrap">
              <header className="still-rise">
                <p className="still-eyebrow">Pricing</p>
                <h2 className="still-h2" id="still-pricing-title">
                  Seven nights on us.
                </h2>
                <p className="still-lede">
                  Try the whole library for a week. If Still isn’t helping, cancel before the eighth
                  night and you pay nothing.
                </p>
              </header>
              <div className="still-pricing-stage">
                <div aria-hidden className="still-pricing-art">
                  <div className="still-pricing-orbit" />
                  <div className="still-pricing-moon" />
                  <svg focusable="false" height="100%" width="100%">
                    <circle cx="12%" cy="18%" opacity=".6" r="1.1" />
                    <circle cx="24%" cy="40%" opacity=".5" r=".8" />
                    <circle cx="8%" cy="62%" opacity=".55" r="1.2" />
                    <circle cx="30%" cy="78%" opacity=".4" r=".8" />
                    <circle cx="76%" cy="64%" opacity=".5" r="1" />
                    <circle cx="90%" cy="82%" opacity=".55" r="1.2" />
                    <circle cx="84%" cy="10%" opacity=".5" r=".8" />
                    <circle cx="40%" cy="8%" opacity=".5" r="1" />
                  </svg>
                </div>
                <PricingPlan storeLinks={storeLinks} onDemo={showDemo} />
                <p className="still-pricing-free">
                  Prefer to keep it simple? The breathing guide and three sound scenes stay free,
                  with no account.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="still-faq-title" className="still-section still-faq" id="faq">
            <div className="still-wrap still-faq-grid">
              <header className="still-rise">
                <p className="still-eyebrow">Questions</p>
                <h2 className="still-h2" id="still-faq-title">
                  Questions before bed.
                </h2>
                <p className="still-lede">
                  Anything else, write to us at{' '}
                  <a href="mailto:hello@still.example">hello@still.example</a> and a person will
                  reply within a day.
                </p>
              </header>
              <GlassAccordion
                className="still-faq-list still-rise"
                defaultValue={[FAQ[0].question]}
                type="multiple"
              >
                {FAQ.map((item) => (
                  <GlassAccordionItem
                    key={item.question}
                    className="still-faq-item"
                    value={item.question}
                  >
                    <GlassAccordionTrigger>
                      <span className="still-faq-question">{item.question}</span>
                      <span aria-hidden className="still-faq-icon">
                        <PlusIcon />
                      </span>
                    </GlassAccordionTrigger>
                    <GlassAccordionContent>
                      <p>{item.answer}</p>
                    </GlassAccordionContent>
                  </GlassAccordionItem>
                ))}
              </GlassAccordion>
            </div>
          </section>

          <section aria-labelledby="still-download-title" className="still-download" id="download">
            <div aria-hidden className="still-download-art">
              <svg className="still-download-stars" focusable="false" height="70%" width="100%">
                <circle cx="8%" cy="20%" opacity=".6" r="1.1" />
                <circle cx="18%" cy="46%" opacity=".5" r=".8" />
                <circle cx="28%" cy="14%" opacity=".55" r="1.2" />
                <circle cx="36%" cy="62%" opacity=".4" r=".7" />
                <circle cx="64%" cy="70%" opacity=".5" r=".9" />
                <circle cx="72%" cy="40%" opacity=".6" r="1.2" />
                <circle cx="86%" cy="18%" opacity=".5" r=".8" />
                <circle cx="94%" cy="54%" opacity=".5" r="1" />
                <circle cx="48%" cy="8%" opacity=".45" r=".8" />
              </svg>
              <svg className="still-download-moon" focusable="false" viewBox="0 0 100 100">
                <defs>
                  <mask id="still-crescent">
                    <rect fill="#fff" height="100" width="100" />
                    <circle cx="66" cy="40" fill="#000" r="38" />
                  </mask>
                  <radialGradient cx=".3" cy=".35" id="still-moon-fill" r=".8">
                    <stop offset="0" stopColor="#fdfaff" />
                    <stop offset="1" stopColor="#d8caf6" />
                  </radialGradient>
                  {/* The glow is drawn inside the SVG: WebKit can paint a CSS filter on a masked
                      SVG as a stray square at the top of the page. */}
                  <filter height="400%" id="still-moon-glow" width="400%" x="-150%" y="-150%">
                    <feDropShadow
                      dx="0"
                      dy="0"
                      floodColor="rgb(220 200 255)"
                      floodOpacity=".45"
                      stdDeviation="28"
                    />
                  </filter>
                </defs>
                <g filter="url(#still-moon-glow)">
                  <circle
                    cx="50"
                    cy="50"
                    fill="url(#still-moon-fill)"
                    mask="url(#still-crescent)"
                    r="40"
                  />
                </g>
              </svg>
            </div>
            <div className="still-wrap">
              <h2 id="still-download-title">
                Tonight, <em>try one breath.</em>
              </h2>
              <p className="still-lede">
                Seven nights free, then $39.99 a year. For iPhone and Android.
              </p>
              <div className="still-download-actions">
                <StoreMenu links={storeLinks} onDemo={showDemo} />
              </div>
              <p className="still-download-note">
                The breathing guide stays free, with no account.
              </p>
            </div>
          </section>
        </main>

        <footer className="still-footer">
          <div className="still-wrap">
            <div className="still-footer-grid">
              <div className="still-footer-brand">
                <a className="still-brand" href="#top">
                  <Brand />
                </a>
                <p>A quiet place for the end of the day. For iPhone and Android.</p>
              </div>
              {FOOTER.map((column) => (
                <nav key={column.title} aria-labelledby={`still-footer-${column.id}`}>
                  <h2 id={`still-footer-${column.id}`}>{column.title}</h2>
                  <ul>
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <a href={link.href}>{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
            <div className="still-footer-base">
              <span>© 2026 Still Labs</span>
              <span>Made slowly, in a small studio by the sea</span>
            </div>
          </div>
        </footer>

        {notice > 0 ? (
          <GlassToast key={notice} className="still still-toast">
            <span aria-hidden className="still-toast-icon">
              <MarkIcon />
            </span>
            <GlassToastDescription className="still-toast-text">
              Demo. No store was opened.
            </GlassToastDescription>
          </GlassToast>
        ) : null}
        <GlassToastViewport className="still still-toasts" />
      </div>
    </GlassToastProvider>
  );
}
