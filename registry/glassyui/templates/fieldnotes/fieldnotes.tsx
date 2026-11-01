'use client';

import './fieldnotes.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GlassButton } from '../../glass-button';
import { GlassHeader } from '../../glass-header';
import { GlassSheet, GlassSheetContent, GlassSheetTitle } from '../../glass-sheet';
import {
  GlassToast,
  GlassToastClose,
  GlassToastDescription,
  GlassToastProvider,
  GlassToastViewport,
} from '../../glass-toast';
import { motionReduced } from '../../lib/liquid-motion';
import { Chapters } from './chapters';
import { CONTENTS, Cover, Proof } from './cover';
import { Field } from './field';
import { FieldnotesMark, Icon } from './icons';
import { Letter } from './letter';
import { Letters } from './letters';
import { slotted } from './parts';
import { Rates } from './rates';
import { SignOff, type StartTrial } from './sign-off';
import { TagAMoment } from './tag-a-moment';
import { useReveals } from './use-reveals';

export type { StartTrial } from './sign-off';

/*
  Fieldnotes: a founder's letter for a research repository, set like a printed issue.

  It is a light page: set data-lg-theme="light" on <html>. Set --fieldnotes-accent (with
  --fieldnotes-accent-rotate, about the accent's hue minus 40deg, for the prominent buttons) and
  the --fieldnotes-serif and --fieldnotes-sans font stacks on any ancestor to make it yours;
  --fieldnotes-display gives the headlines a face of their own.
*/

const MASTHEAD = [
  { id: 'letter', title: 'The letter' },
  { id: 'try', title: 'Try it' },
  { id: 'chapters', title: 'Chapters' },
  { id: 'rates', title: 'Rates' },
  { id: 'letters', title: 'Letters' },
];

// The sections the masthead follows as the page scrolls; those without a link clear it.
const SECTIONS = ['cover', 'letter', 'try', 'chapters', 'field', 'rates', 'letters', 'start'];

const FOOTER = [
  {
    title: 'Product',
    links: [
      { label: 'The tool', href: '#chapters' },
      { label: 'Try it', href: '#try' },
      { label: 'Rates', href: '#rates' },
      { label: 'Questions', href: '#letters' },
    ],
  },
  {
    title: 'The letter',
    links: [
      { label: 'The letter', href: '#letter' },
      { label: 'From the field', href: '#field' },
      { label: 'Letters to the editor', href: '#letters' },
      { label: 'Sign-off', href: '#start' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: 'mailto:hello@fieldnotes.example' },
      { label: 'Book a walkthrough', href: 'mailto:maren@fieldnotes.example' },
      { label: 'Careers', href: 'mailto:jobs@fieldnotes.example' },
      { label: 'Press', href: 'mailto:press@fieldnotes.example' },
    ],
  },
];

const wideQuery = '(min-width: 900px)';

/** The section in the middle band of the screen, for the masthead to mark. */
function useCurrentSection() {
  const [current, setCurrent] = useState('');

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );

    for (const id of SECTIONS) {
      const section = document.getElementById(id);

      if (section) observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

  return current;
}

function Brand() {
  return (
    <a className="fieldnotes-brand" href="#cover">
      <FieldnotesMark className="fieldnotes-brand-mark" />
      <span>Fieldnotes</span>
    </a>
  );
}

/**
 * The Fieldnotes founder letter. Pass `onStart` to send each sign-up's work email a sign-in link;
 * without it the form is a demo that confirms on screen and sends nothing.
 */
export function Fieldnotes({ onStart }: { onStart?: StartTrial }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const startTimer = useRef(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuReturn = useRef(true);
  const [intro, setIntro] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState({ count: 0, message: '' });
  const current = useCurrentSection();

  useReveals(rootRef);

  // The cover plays once, as the page loads; after that nothing can replay it.
  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), motionReduced() ? 0 : 2600);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const query = window.matchMedia(wideQuery);

    const onChange = () => {
      if (query.matches) setMenuOpen(false);
    };

    query.addEventListener('change', onChange);

    return () => {
      query.removeEventListener('change', onChange);
      window.clearTimeout(startTimer.current);
    };
  }, []);

  // Every "Start free" leads to the sign-off's field, once the page has scrolled there.
  const startFree = useCallback(() => {
    window.clearTimeout(startTimer.current);
    startTimer.current = window.setTimeout(
      () => emailRef.current?.focus({ preventScroll: true }),
      motionReduced() ? 0 : 650,
    );
  }, []);

  // A link in the menu takes the visitor to its section, so focus stays there, not on the button.
  const leaveMenu = () => {
    menuReturn.current = false;
    setMenuOpen(false);
  };

  const notify = useCallback((message: string) => {
    setNotice((previous) => ({ count: previous.count + 1, message }));
  }, []);

  return (
    <GlassToastProvider duration={6000} label="Notification">
      <div
        ref={rootRef}
        className="fieldnotes fieldnotes-page"
        data-intro={intro ? '' : undefined}
        data-lg-theme="light"
      >
        <svg aria-hidden className="fieldnotes-defs" focusable="false" height="0" width="0">
          <filter height="120%" id="fieldnotes-ink" width="120%" x="-10%" y="-10%">
            <feTurbulence
              baseFrequency="0.9"
              numOctaves={2}
              result="grain"
              seed={7}
              type="fractalNoise"
            />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.4" />
          </filter>
        </svg>
        <a className="fieldnotes-skip" href="#letter">
          Skip to the letter
        </a>

        <GlassHeader
          actions={
            <>
              <nav aria-label="Sections" className="fieldnotes-mast-nav">
                {MASTHEAD.map((link) => (
                  <a
                    key={link.id}
                    aria-current={current === link.id ? 'true' : undefined}
                    href={`#${link.id}`}
                  >
                    {link.title}
                  </a>
                ))}
              </nav>
              <a className="fieldnotes-mast-signin" href="#start" onClick={startFree}>
                Sign in
              </a>
              <GlassButton
                {...slotted}
                className="fieldnotes-button-sm fieldnotes-mast-start"
                size="sm"
              >
                <a href="#start" onClick={startFree}>
                  Start free
                </a>
              </GlassButton>
              <GlassButton
                ref={menuButtonRef}
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className="fieldnotes-button-sm fieldnotes-mast-menu"
                size="sm"
                onClick={() => {
                  menuReturn.current = true;
                  setMenuOpen((open) => !open);
                }}
              >
                <Icon name="menu" />
              </GlassButton>
              <span aria-hidden className="fieldnotes-mast-progress" />
            </>
          }
          brand={
            <span className="fieldnotes-mast-brand">
              <Brand />
              <span className="fieldnotes-mast-issue">
                <b>No. 14</b>
                <span>30 October 2026</span>
              </span>
            </span>
          }
          className="fieldnotes-mast"
        />

        <main>
          <Cover onStartFree={startFree} />
          <Proof />
          <Letter />
          <TagAMoment />
          <Chapters />
          <Field />
          <Rates onStartFree={startFree} />
          <Letters />
          <SignOff emailRef={emailRef} onNotice={notify} onStart={onStart} />
        </main>

        <footer className="fieldnotes-colophon">
          <div className="fieldnotes-wrap">
            <div className="fieldnotes-colophon-top">
              <div className="fieldnotes-colophon-brand">
                <Brand />
                <p>A research repository for people who listen for a living.</p>
              </div>
              <nav aria-label="Footer" className="fieldnotes-colophon-nav">
                {FOOTER.map((column) => (
                  <div key={column.title}>
                    <h2>{column.title}</h2>
                    <ul>
                      {column.links.map((link) => (
                        <li key={link.label}>
                          <a href={link.href}>{link.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
              <div className="fieldnotes-colophon-note">
                <h2>Colophon</h2>
                <p>
                  This issue was set in Fraunces and Literata, printed on warm paper with oxblood
                  ink, and bound with Glassy UI. Issue No. 14, 30 October 2026.
                </p>
              </div>
            </div>
            <div className="fieldnotes-colophon-base">
              <p>© 2026 Fieldnotes Ltd. Made in Bristol.</p>
              <a className="fieldnotes-to-top" href="#cover">
                Back to the cover
                <Icon className="fieldnotes-lean fieldnotes-lean-up" name="up" />
              </a>
            </div>
          </div>
        </footer>

        <GlassSheet open={menuOpen} onOpenChange={setMenuOpen}>
          <GlassSheetContent
            aria-describedby={undefined}
            className="fieldnotes fieldnotes-sheet"
            closeLabel="Close menu"
            data-lg-theme="light"
            side="top"
            onCloseAutoFocus={(event) => {
              // Closed by Escape or its close button, focus goes back to the menu button.
              event.preventDefault();

              if (menuReturn.current) menuButtonRef.current?.focus();
            }}
          >
            <GlassSheetTitle className="fieldnotes-sr-only">Sections</GlassSheetTitle>
            <p aria-hidden className="fieldnotes-eyebrow fieldnotes-sheet-issue">
              No. 14 · 30 October 2026
            </p>
            <nav aria-label="Sections in this issue" className="fieldnotes-sheet-nav">
              {CONTENTS.map((entry) => (
                <a key={entry.id} href={`#${entry.id}`} onClick={leaveMenu}>
                  <span>{entry.numeral}</span>
                  {entry.menuTitle}
                </a>
              ))}
            </nav>
            <GlassButton
              {...slotted}
              className="fieldnotes-button-lg fieldnotes-sheet-start"
              variant="prominent"
            >
              <a
                href="#start"
                onClick={() => {
                  leaveMenu();
                  startFree();
                }}
              >
                Start free
              </a>
            </GlassButton>
            <a
              className="fieldnotes-sheet-signin"
              href="#start"
              onClick={() => {
                leaveMenu();
                startFree();
              }}
            >
              Sign in
            </a>
          </GlassSheetContent>
        </GlassSheet>

        {notice.count > 0 ? (
          <GlassToast key={notice.count} className="fieldnotes fieldnotes-toast">
            <Icon className="fieldnotes-toast-icon" name="check" />
            <GlassToastDescription className="fieldnotes-toast-text">
              {notice.message}
            </GlassToastDescription>
            <GlassToastClose className="fieldnotes-toast-close" />
          </GlassToast>
        ) : null}
        <GlassToastViewport className="fieldnotes fieldnotes-toasts" data-lg-theme="light" />
      </div>
    </GlassToastProvider>
  );
}
