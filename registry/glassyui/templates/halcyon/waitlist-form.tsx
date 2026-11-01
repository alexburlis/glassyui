'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { GlassButton } from '../../glass-button';
import { GlassInput } from '../../glass-input';
import { GlassPanel } from '../../glass-panel';
import { GlassProgress } from '../../glass-progress';
import { GlassSpinner } from '../../glass-spinner';
import { motionReduced } from '../../lib/liquid-motion';
import { CheckIcon, CopyIcon, EditIcon, LinkIcon } from './icons';
import { useCountTo } from './use-count-to';

/** Where a new signup stands, as your waitlist service reports it. */
export type WaitlistPlace = {
  /** The signup's place in line. */
  place: number;
  /** The signup's own referral address, such as https://halcyon.day/r/maya-3f2a. */
  inviteLink: string;
};

/** Sends an email to your waitlist. Reject to show the visitor that it did not go through. */
export type JoinWaitlist = (email: string) => Promise<WaitlistPlace>;

/** What the rest of the page can ask of the form: a place to bring the visitor back to. */
export type WaitlistHandle = { focus: () => void };

type WaitlistFormProps = {
  /** Without it the form shows the success state locally and sends nothing. */
  onJoin?: JoinWaitlist;
  onJoinedChange: (joined: boolean) => void;
  onNotice: (message: string, tone: 'ok' | 'info') => void;
  ref?: Ref<WaitlistHandle>;
};

const REFERRAL_GOAL = 5;

const AVATARS = [
  { initials: 'MO', gradient: 'linear-gradient(140deg, #1b7f8a, #24427e)' },
  { initials: 'JL', gradient: 'linear-gradient(140deg, #5a4bb0, #2b2f6e)' },
  { initials: 'RK', gradient: 'linear-gradient(140deg, #2a6aa8, #1c2c5a)' },
  { initials: 'AS', gradient: 'linear-gradient(140deg, #3c7d64, #1d3a4a)' },
];

const formatNumber = (value: number) => value.toLocaleString('en-GB');

function emailLooksComplete(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value);
}

/** A stable referral slug for the demo: the address's first name and a short hash. */
function demoSlug(email: string) {
  const name =
    (email.split('@')[0].split(/[._+-]/)[0] || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 12) || 'friend';

  let hash = 7;

  for (const character of email.toLowerCase()) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  }

  return `${name}-${hash.toString(36).slice(-4)}`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Centres an element in the room below the page's scroll padding by scrolling this window alone.
 * scrollIntoView, and focus without preventScroll, would also scroll a page that shows this one
 * in a frame.
 */
function centreInWindow(element: HTMLElement, onlyIfHidden = false) {
  const padding =
    Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;

  const box = element.getBoundingClientRect();

  if (onlyIfHidden && box.top >= padding && box.bottom <= window.innerHeight) return;

  window.scrollTo({
    top: window.scrollY + box.top - padding - (window.innerHeight - padding - box.height) / 2,
    behavior: motionReduced() ? 'auto' : 'smooth',
  });
}

/** Four sample faces and this week's count. Initials stand in for photos. */
function AvatarStack() {
  return (
    <div className="halcyon-avatars">
      <span aria-hidden className="halcyon-avatars-list">
        {AVATARS.map((avatar) => (
          <span
            key={avatar.initials}
            className="halcyon-avatars-item"
            style={{ background: avatar.gradient }}
          >
            {avatar.initials}
          </span>
        ))}
      </span>
      <span className="halcyon-avatars-text">
        <strong>1,204</strong> joined this week
      </span>
    </div>
  );
}

/**
 * The waitlist: one field and one button. After joining, the same pane rolls round to the
 * visitor's place in line and their invite link. Without `onJoin` it is a demo and says so.
 */
export function WaitlistForm({ onJoin, onJoinedChange, onNotice, ref }: WaitlistFormProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const placeRef = useRef<HTMLParagraphElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef(0);
  const demoJoins = useRef(0);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState<WaitlistPlace | null>(null);
  const [copied, setCopied] = useState(false);
  const shownPlace = useCountTo(joined?.place ?? 0, 1100, joined ? joined.place - 140 : 0, 240);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        (joined ? copyRef.current : emailRef.current)?.focus({ preventScroll: true });

        if (cardRef.current) centreInWindow(cardRef.current);
      },
    }),
    [joined],
  );

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  // The rows travel the height of the pane, measured as the state changes.
  const measureTravel = () => {
    if (cardRef.current && clipRef.current) {
      cardRef.current.style.setProperty(
        '--halcyon-travel',
        `${clipRef.current.offsetHeight + 8}px`,
      );
    }
  };

  const showError = (message: string) => {
    setError(message);
    emailRef.current?.focus({ preventScroll: true });

    // A join that failed late may find the visitor elsewhere on the page.
    if (cardRef.current) centreInWindow(cardRef.current, true);

    if (!motionReduced()) {
      cardRef.current?.animate(
        [
          { transform: 'none' },
          { transform: 'translateX(-8px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(2px)' },
          { transform: 'none' },
        ],
        { duration: 440, easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)' },
      );
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pending) return;
    const value = email.trim();

    if (!value) return showError('Add your email to join the waitlist.');

    if (!emailLooksComplete(value)) {
      return showError('That email looks incomplete. Try name@company.com.');
    }

    setError('');
    setPending(true);

    let result: WaitlistPlace;

    try {
      if (onJoin) {
        result = await onJoin(value);
      } else {
        // The demo pauses as a real request would, then makes up a place and a link.
        await wait(motionReduced() ? 200 : 760);
        result = {
          place: 2481 + demoJoins.current++,
          inviteLink: `https://halcyon.day/r/${demoSlug(value)}`,
        };
      }
    } catch {
      setPending(false);
      showError('That did not go through. Try again in a moment.');

      return;
    }

    setPending(false);
    measureTravel();
    setJoined(result);
    onJoinedChange(true);

    if (!motionReduced()) {
      const card = cardRef.current;

      card?.animate([{ transform: 'translateY(4px)' }, { transform: 'none' }], {
        duration: 680,
        // Web Animations take a timing function, not a custom property.
        easing: getComputedStyle(card).getPropertyValue('--lg-spring').trim() || 'ease-out',
      });
    }

    window.setTimeout(
      () => placeRef.current?.focus({ preventScroll: true }),
      motionReduced() ? 0 : 440,
    );
  };

  const reset = () => {
    measureTravel();
    setJoined(null);
    setEmail('');
    setCopied(false);
    onJoinedChange(false);
    window.setTimeout(
      () => emailRef.current?.focus({ preventScroll: true }),
      motionReduced() ? 0 : 420,
    );
  };

  const selectLink = () => linkRef.current?.setSelectionRange(0, linkRef.current.value.length);

  const copy = async () => {
    if (!joined) return;

    try {
      await navigator.clipboard.writeText(joined.inviteLink);
    } catch {
      // The field sits beside the button just pressed.
      linkRef.current?.focus({ preventScroll: true });
      selectLink();
      const mac = /Mac|iPhone|iPad/.test(navigator.platform);

      onNotice(`Your link is selected. Press ${mac ? '⌘' : 'Ctrl'} C to copy it.`, 'info');

      return;
    }

    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2400);
    onNotice('Link copied. Each friend who joins moves you up 100 places.', 'ok');
  };

  const shownLink = joined?.inviteLink.replace(/^https?:\/\//, '') ?? '';

  return (
    <>
      <GlassPanel
        ref={cardRef}
        className="halcyon-pane halcyon-waitlist"
        data-invalid={error ? '' : undefined}
        data-pending={pending ? '' : undefined}
        data-state={joined ? 'done' : 'form'}
        id="waitlist"
        lens
        variant="card"
      >
        <div ref={clipRef} className="halcyon-waitlist-clip">
          {/* method="dialog" keeps a form submitted before the page hydrates from sending
              the address anywhere; once it has, submit() handles every submission. */}
          <form
            className="halcyon-waitlist-state halcyon-waitlist-form"
            inert={Boolean(joined)}
            method="dialog"
            noValidate
            onSubmit={submit}
          >
            <div className="halcyon-waitlist-row halcyon-waitlist-top" data-row="0">
              <label className="halcyon-waitlist-label" htmlFor="halcyon-email">
                Your work email
              </label>
              <span className="halcyon-waitlist-meta">Invites go out in order</span>
            </div>
            <div className="halcyon-waitlist-row halcyon-waitlist-entry" data-row="1">
              <GlassInput
                ref={emailRef}
                aria-describedby={error ? 'halcyon-email-error' : 'halcyon-email-hint'}
                aria-invalid={error ? true : undefined}
                autoCapitalize="off"
                autoComplete="email"
                className="halcyon-waitlist-input"
                id="halcyon-email"
                inputMode="email"
                name="email"
                placeholder="you@company.com"
                required
                spellCheck={false}
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);

                  if (error) setError('');
                }}
              />
              <GlassButton
                aria-busy={pending || undefined}
                className="halcyon-button-xl halcyon-waitlist-submit"
                type="submit"
                variant="prominent"
              >
                {pending ? <GlassSpinner className="halcyon-waitlist-spinner" size="sm" /> : null}
                {pending ? 'Joining' : 'Join the waitlist'}
              </GlassButton>
            </div>
            <div
              className="halcyon-waitlist-row halcyon-waitlist-foot halcyon-waitlist-foot-form"
              data-row="2"
            >
              <div className="halcyon-waitlist-proof">
                <AvatarStack />
                <p className="halcyon-waitlist-hint" id="halcyon-email-hint">
                  One email when it is your turn.
                </p>
              </div>
              <p aria-live="assertive" className="halcyon-waitlist-error" id="halcyon-email-error">
                {error}
              </p>
            </div>
          </form>

          <div className="halcyon-waitlist-state halcyon-waitlist-done" inert={!joined}>
            <div className="halcyon-waitlist-row halcyon-waitlist-top" data-row="0">
              <span aria-hidden className="halcyon-waitlist-check">
                <svg viewBox="0 0 24 24">
                  <path d="m6 12.5 4 4L18 8" />
                </svg>
              </span>
              <p ref={placeRef} className="halcyon-waitlist-place" tabIndex={-1}>
                <span aria-hidden>
                  You are <strong>#{formatNumber(shownPlace)}</strong> in line
                </span>
                <span className="halcyon-sr-only">
                  {joined ? `You are number ${formatNumber(joined.place)} in line.` : ''}
                </span>
              </p>
              <button className="halcyon-waitlist-reset" type="button" onClick={reset}>
                <EditIcon />
                <span className="halcyon-waitlist-reset-text">Use another email</span>
              </button>
            </div>
            <div className="halcyon-waitlist-row halcyon-copy" data-row="1">
              <label className="halcyon-sr-only" htmlFor="halcyon-invite-link">
                Your invite link
              </label>
              <span className="halcyon-copy-box">
                <LinkIcon className="halcyon-copy-icon" />
                <GlassInput
                  ref={linkRef}
                  className="halcyon-copy-input"
                  id="halcyon-invite-link"
                  readOnly
                  value={shownLink}
                  onClick={selectLink}
                  onFocus={selectLink}
                />
              </span>
              <GlassButton
                ref={copyRef}
                className="halcyon-button-xl halcyon-copy-button"
                data-copied={copied ? '' : undefined}
                variant="prominent"
                onClick={copy}
              >
                <span aria-hidden className="halcyon-copy-glyphs">
                  <CopyIcon className="halcyon-copy-glyph" />
                  <CheckIcon className="halcyon-copy-glyph-done" />
                </span>
                <span className="halcyon-copy-labels">
                  <span className="halcyon-copy-label">Copy link</span>
                  <span className="halcyon-copy-label-done">Copied</span>
                </span>
              </GlassButton>
            </div>
            <div
              className="halcyon-waitlist-row halcyon-waitlist-foot halcyon-waitlist-foot-done"
              data-row="2"
            >
              <GlassProgress
                aria-label="Friends who joined with your link"
                className="halcyon-waitlist-progress"
                max={REFERRAL_GOAL}
                size="sm"
                value={0}
              />
              <p className="halcyon-waitlist-move">Move up 100 places for each friend who joins</p>
              <span aria-hidden className="halcyon-waitlist-count">
                0 of {REFERRAL_GOAL}
              </span>
            </div>
          </div>
        </div>
      </GlassPanel>
      {joined && !onJoin ? (
        <p className="halcyon-waitlist-demo" role="status">
          Demo. Nothing was sent.
        </p>
      ) : null}
    </>
  );
}
