'use client';

import './halcyon.css';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  GlassAccordion,
  GlassAccordionContent,
  GlassAccordionItem,
  GlassAccordionTrigger,
} from '../../glass-accordion';
import { GlassAvatar } from '../../glass-avatar';
import { GlassBadge } from '../../glass-badge';
import { GlassButton } from '../../glass-button';
import { GlassHeader } from '../../glass-header';
import { GlassPanel } from '../../glass-panel';
import { GlassScene } from '../../glass-scene';
import { GlassScrollArea } from '../../glass-scroll-area';
import { GlassSheet, GlassSheetContent, GlassSheetTitle } from '../../glass-sheet';
import {
  GlassToast,
  GlassToastDescription,
  GlassToastProvider,
  GlassToastViewport,
} from '../../glass-toast';
import { Countdown } from './countdown';
import { FeatureTiles } from './feature-tiles';
import { useFooterArt, useFooterPainter } from './footer-art';
import { useHeroArt, useHeroPainter } from './hero-art';
import {
  ArrowIcon,
  CheckIcon,
  CopyIcon,
  DownIcon,
  HalcyonMark,
  HalcyonMarkGradient,
} from './icons';
import { StatCounter } from './stat-counter';
import { WaitlistForm, type JoinWaitlist, type WaitlistHandle } from './waitlist-form';

export type { JoinWaitlist, WaitlistPlace } from './waitlist-form';

/*
  Halcyon: a waitlist page for an assistant that books, moves and protects your meetings.

  It is a dark page: set data-lg-theme="dark" on <html>. Set --halcyon-accent (with
  --halcyon-accent-rotate, about the accent's hue minus 40deg, for the prominent buttons) and the
  --halcyon-serif and --halcyon-sans font stacks on any ancestor to make it yours.
*/

// Invites begin at 9:00 on 12 January 2027, in the visitor's own time.
const LAUNCH = new Date(2027, 0, 12, 9);

const FAQ = [
  {
    question: 'When do invites go out?',
    answer:
      'From 12 January 2027, in the order people joined. We will send about 400 a week so we can help everyone set up properly. Each friend who joins with your link moves you up 100 places.',
  },
  {
    question: 'Which calendars does it work with?',
    answer:
      'Your work and personal calendars at launch, on the web and in apps for macOS and iPhone. Shared team calendars follow in the spring. Halcyon only changes events it booked or that you hand to it.',
  },
  {
    question: 'Does it act without asking?',
    answer:
      'Not until you let it. At first Halcyon drafts every booking, move and decline for you to approve with one tap. When a rule has earned your trust, switch it to automatic.',
  },
  {
    question: 'What will it cost?',
    answer:
      'Nothing during the beta. After that it is $12 a month for one person, and everyone from the waitlist keeps half price for their first year.',
  },
];

type Doc = 'note' | 'privacy';

type Notice = { count: number; message: string; tone: 'ok' | 'info' };

const narrowQuery = '(max-width: 640px)';

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(narrowQuery);

  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return onScreen;
}

function Brand({ small }: { small?: boolean }) {
  return (
    <>
      <HalcyonMark className="halcyon-brand-mark" />
      <span className={small ? 'halcyon-brand-name halcyon-brand-small' : 'halcyon-brand-name'}>
        Halcyon
      </span>
    </>
  );
}

function NoteDoc() {
  return (
    <article className="halcyon-doc">
      <p className="halcyon-eyebrow">From Noor and Felix</p>
      <GlassSheetTitle className="halcyon-doc-title">
        Why we are building <em>Halcyon</em>
      </GlassSheetTitle>
      <p>
        Last spring we counted. Between the two of us, 31 emails a week were about when to meet, and
        another dozen were about moving a meeting we had already agreed.
      </p>
      <p>
        Booking links helped other people find a slot in our week. Nothing helped us keep the week
        in shape: mornings for real work, afternoons for people, Fridays for thinking.
      </p>
      <p>
        Halcyon holds that shape for you. It books from your rules, moves what a change breaks, and
        tells everyone affected in a short note you have approved.
      </p>
      <p>
        It asks before it acts until you tell it otherwise. It reads only the threads you hand it.
        And it should cost less each month than one hour of your time.
      </p>
      <p>
        We open to the waitlist on 12 January, about 400 people a week, so we can answer every
        message ourselves. We would love you to be one of them.
      </p>
      <p className="halcyon-doc-sign">
        Noor and Felix<span>Lisbon, October 2026</span>
      </p>
    </article>
  );
}

function PrivacyDoc() {
  return (
    <article className="halcyon-doc">
      <p className="halcyon-eyebrow">Privacy</p>
      <GlassSheetTitle className="halcyon-doc-title">
        Your email, and <em>nothing else</em>
      </GlassSheetTitle>
      <p>
        We keep the address you give us to send one invite and, if you join, to run your account.
      </p>
      <p>Your invite link counts sign-ups. It does not track where you share it or who opens it.</p>
      <p>We never sell or share the waitlist, with partners or with anyone else.</p>
      <p>Reply to any email from us with the word “delete” and we remove you within a day.</p>
      <p className="halcyon-doc-sign">
        Halcyon Labs<span>Last updated 30 October 2026</span>
      </p>
    </article>
  );
}

/**
 * The Halcyon waitlist page. Pass `onJoin` to send each email to your own waitlist; without it
 * the form is a demo that shows success and sends nothing.
 */
export function Halcyon({ onJoin }: { onJoin?: JoinWaitlist }) {
  const heroRef = useRef<HTMLElement>(null);
  const waitlistSlotRef = useRef<HTMLDivElement>(null);
  const waitlistRef = useRef<WaitlistHandle>(null);
  const footerActionRef = useRef<HTMLButtonElement>(null);
  const footerSceneRef = useRef<HTMLDivElement>(null);
  const art = useHeroArt(heroRef, waitlistSlotRef);
  const heroPainter = useHeroPainter(art);
  const footerArt = useFooterArt(footerSceneRef);
  const footerPainter = useFooterPainter(footerArt);
  // The aurora rises in at full pace, then only its slow sway moves, which needs few frames.
  const [dawnDone, setDawnDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDawnDone(true), 2400);

    return () => window.clearTimeout(timer);
  }, []);
  const waitlistOnScreen = useOnScreen(waitlistSlotRef);
  const footerActionOnScreen = useOnScreen(footerActionRef);
  const [joined, setJoined] = useState(false);
  const [doc, setDoc] = useState<Doc>('note');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>({ count: 0, message: '', tone: 'ok' });

  const narrow = useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(narrowQuery).matches,
    () => false,
  );

  // The sheet opens from several buttons, so it remembers which one, to hand focus back to.
  const sheetOpenerRef = useRef<HTMLElement | null>(null);

  const openDoc = (next: Doc, opener: HTMLElement) => {
    sheetOpenerRef.current = opener;
    setDoc(next);
    setSheetOpen(true);
  };

  const goToField = useCallback(() => {
    if (sheetOpen) {
      sheetOpenerRef.current = null;
      setSheetOpen(false);
      // Once the sheet has closed and let go of the page's scroll, go to the field.
      window.setTimeout(() => waitlistRef.current?.focus(), 320);

      return;
    }

    waitlistRef.current?.focus();
  }, [sheetOpen]);

  const notify = useCallback((message: string, tone: 'ok' | 'info') => {
    setNotice((current) => ({ count: current.count + 1, message, tone }));
  }, []);

  const joinLabel = joined ? 'See my place' : 'Join the waitlist';

  return (
    <GlassToastProvider duration={3800} label="Notification">
      <div className="halcyon halcyon-page" data-lg-theme="dark">
        <HalcyonMarkGradient />
        <a className="halcyon-skip" href="#halcyon-email">
          Skip to the waitlist
        </a>

        <GlassHeader
          actions={
            <>
              <GlassButton
                className="halcyon-header-join"
                size="sm"
                variant="prominent"
                onClick={goToField}
              >
                {joinLabel}
              </GlassButton>
              <GlassButton
                aria-expanded={sheetOpen && doc === 'note'}
                aria-haspopup="dialog"
                className="halcyon-header-note"
                size="sm"
                onClick={(event) => openDoc('note', event.currentTarget)}
              >
                Read the note
              </GlassButton>
            </>
          }
          brand={
            <a className="halcyon-brand" href="#top">
              <Brand />
            </a>
          }
          className="halcyon-header"
          condenseOnScroll
          data-join={waitlistOnScreen || footerActionOnScreen ? undefined : ''}
        />

        <main>
          <section
            ref={heroRef}
            aria-labelledby="halcyon-hero-title"
            className="halcyon-hero"
            id="top"
          >
            <GlassScene
              backdrop={heroPainter}
              backdropFps={dawnDone ? 12 : 60}
              className="halcyon-hero-scene"
              optics={{
                bevel: 34,
                thickness: 72,
                ior: 1.5,
                dispersion: 0.25,
                frost: 0.5,
                specular: 1,
                merge: 0,
              }}
            >
              <div className="halcyon-wrap halcyon-hero-inner">
                <GlassBadge className="halcyon-hero-chip" dot>
                  Private beta · Invites from 12 January
                </GlassBadge>
                <h1 className="halcyon-hero-title" id="halcyon-hero-title">
                  <span className="halcyon-line">Let your week</span>
                  <span className="halcyon-line">
                    arrange <em>itself</em>.
                  </span>
                </h1>
                <p className="halcyon-hero-sub">
                  Halcyon books, moves and protects your meetings, so your best hours stay yours.
                </p>
                <div ref={waitlistSlotRef} className="halcyon-waitlist-slot">
                  <WaitlistForm
                    ref={waitlistRef}
                    onJoin={onJoin}
                    onJoinedChange={setJoined}
                    onNotice={notify}
                  />
                </div>
              </div>
              <a className="halcyon-hero-more" href="#what">
                What it will do
                <DownIcon />
              </a>
            </GlassScene>
          </section>

          <FeatureTiles />

          <section aria-labelledby="halcyon-note-title" className="halcyon-note" id="note">
            <div aria-hidden className="halcyon-note-art" />
            <div className="halcyon-wrap halcyon-note-grid">
              <h2 className="halcyon-eyebrow halcyon-note-title" id="halcyon-note-title">
                A note from the founders
              </h2>
              <figure className="halcyon-note-body">
                <blockquote className="halcyon-note-quote halcyon-reveal-text">
                  <p>
                    “Our calendars had become everyone’s to-do list but ours. Halcyon is the
                    assistant we wanted: it says yes to the right meetings, moves the rest and{' '}
                    <em>guards the morning</em>.”
                  </p>
                </blockquote>
                <figcaption className="halcyon-note-sign">
                  <span aria-hidden className="halcyon-note-avatars">
                    <GlassAvatar className="halcyon-avatar-violet" fallback="NH" />
                    <GlassAvatar className="halcyon-avatar-teal" fallback="FB" />
                  </span>
                  <span className="halcyon-note-names">
                    <strong>Noor Haddad and Felix Brandt</strong>
                    <span>Founders, Lisbon</span>
                  </span>
                  <GlassButton
                    aria-expanded={sheetOpen && doc === 'note'}
                    aria-haspopup="dialog"
                    className="halcyon-note-button"
                    onClick={(event) => openDoc('note', event.currentTarget)}
                  >
                    Read the whole note
                    <ArrowIcon />
                  </GlassButton>
                </figcaption>
              </figure>
              <dl className="halcyon-stats">
                <StatCounter
                  count={212}
                  from={120}
                  label="People in the private beta since June"
                  spoken="212"
                />
                <StatCounter
                  count={230}
                  from={110}
                  hoursAndMinutes
                  label="Median time each person got back a week"
                  spoken="3 hours 50 minutes"
                />
              </dl>
            </div>
          </section>

          <section aria-labelledby="halcyon-faq-title" className="halcyon-faq" id="faq">
            <div aria-hidden className="halcyon-faq-art" />
            <div className="halcyon-wrap halcyon-faq-grid">
              <div className="halcyon-faq-intro">
                <p className="halcyon-eyebrow">Before you join</p>
                <h2 className="halcyon-section-title halcyon-reveal-text" id="halcyon-faq-title">
                  Questions, <em>answered</em>.
                </h2>
                <p className="halcyon-section-lede">
                  Anything else, write to{' '}
                  <a href="mailto:hello@halcyon.example">hello@halcyon.example</a>. One of us
                  replies.
                </p>
              </div>
              <GlassPanel className="halcyon-pane halcyon-faq-list" lens variant="card">
                <GlassAccordion collapsible type="single">
                  {FAQ.map((item) => (
                    <GlassAccordionItem
                      key={item.question}
                      className="halcyon-faq-item"
                      value={item.question}
                    >
                      <GlassAccordionTrigger>{item.question}</GlassAccordionTrigger>
                      <GlassAccordionContent>
                        <p>{item.answer}</p>
                      </GlassAccordionContent>
                    </GlassAccordionItem>
                  ))}
                </GlassAccordion>
              </GlassPanel>
            </div>
          </section>
        </main>

        <footer aria-labelledby="halcyon-launch-title" className="halcyon-footer" id="launch">
          <GlassScene
            ref={footerSceneRef}
            backdrop={footerPainter}
            backdropFps={30}
            className="halcyon-footer-scene"
            optics={{
              bevel: 32,
              thickness: 68,
              ior: 1.5,
              dispersion: 0.25,
              frost: 1,
              specular: 1,
              merge: 0,
            }}
          >
            <div className="halcyon-wrap halcyon-footer-inner">
              <h2 className="halcyon-footer-title" id="halcyon-launch-title">
                Invites <em>begin</em> in
              </h2>
              <Countdown labelledBy="halcyon-launch-title" target={LAUNCH} />
              <p className="halcyon-footer-date">
                <span>12 January 2027 at 9:00, your time.</span>{' '}
                <span>First come, first invited.</span>
              </p>
              <GlassButton
                ref={footerActionRef}
                className="halcyon-button-xl halcyon-footer-action"
                variant="prominent"
                onClick={goToField}
              >
                {joined ? 'See my place' : 'Save my place'}
              </GlassButton>
              <div className="halcyon-footer-base">
                <a className="halcyon-brand" href="#top">
                  <Brand small />
                </a>
                <nav aria-label="Footer">
                  <ul className="halcyon-footer-links">
                    <li>
                      <button
                        aria-expanded={sheetOpen && doc === 'note'}
                        aria-haspopup="dialog"
                        className="halcyon-footer-link"
                        type="button"
                        onClick={(event) => openDoc('note', event.currentTarget)}
                      >
                        The note
                      </button>
                    </li>
                    <li>
                      <button
                        aria-expanded={sheetOpen && doc === 'privacy'}
                        aria-haspopup="dialog"
                        className="halcyon-footer-link"
                        type="button"
                        onClick={(event) => openDoc('privacy', event.currentTarget)}
                      >
                        Privacy
                      </button>
                    </li>
                    <li>
                      <a className="halcyon-footer-link" href="#faq">
                        Questions
                      </a>
                    </li>
                    <li>
                      <a className="halcyon-footer-link" href="mailto:hello@halcyon.example">
                        hello@halcyon.example
                      </a>
                    </li>
                  </ul>
                </nav>
                <p className="halcyon-footer-legal">© 2026 Halcyon Labs, Lisbon</p>
              </div>
            </div>
          </GlassScene>
        </footer>

        <GlassSheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <GlassSheetContent
            aria-describedby={undefined}
            className="halcyon halcyon-sheet"
            closeLabel="Close"
            data-lg-theme="dark"
            side={narrow ? 'bottom' : 'right'}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              // Without scrolling, as the dialog itself returns focus: a plain focus() would also
              // scroll a page that shows this one in a frame.
              sheetOpenerRef.current?.focus({ preventScroll: true });
            }}
          >
            <div className="halcyon-sheet-head">
              <span aria-hidden className="halcyon-brand">
                <Brand small />
              </span>
            </div>
            <GlassScrollArea className="halcyon-sheet-body">
              {doc === 'note' ? <NoteDoc /> : <PrivacyDoc />}
            </GlassScrollArea>
            <div className="halcyon-sheet-foot">
              <p>Invites from 12 January</p>
              <GlassButton className="halcyon-button-lg" variant="prominent" onClick={goToField}>
                {joinLabel}
              </GlassButton>
            </div>
          </GlassSheetContent>
        </GlassSheet>

        {notice.count > 0 ? (
          <GlassToast key={notice.count} className="halcyon halcyon-toast" data-tone={notice.tone}>
            <span aria-hidden className="halcyon-toast-icon">
              {notice.tone === 'ok' ? <CheckIcon /> : <CopyIcon />}
            </span>
            <GlassToastDescription className="halcyon-toast-text">
              {notice.message}
            </GlassToastDescription>
          </GlassToast>
        ) : null}
        <GlassToastViewport className="halcyon halcyon-toasts" />
      </div>
    </GlassToastProvider>
  );
}
