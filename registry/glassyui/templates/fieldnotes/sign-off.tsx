'use client';

import { useState, type Ref } from 'react';
import { GlassButton } from '../../glass-button';
import { GlassInput } from '../../glass-input';
import { Folio } from './parts';

/** Sends a sign-in link to start a trial. Reject to tell the visitor it did not go through. */
export type StartTrial = (email: string) => Promise<void>;

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

/** Without `onStart` the form is a demo: it confirms on screen and sends nothing. */
export function SignOff({
  emailRef,
  onNotice,
  onStart,
}: {
  emailRef: Ref<HTMLInputElement>;
  onNotice: (message: string) => void;
  onStart?: StartTrial;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pending) return;
    const field = event.currentTarget.elements.namedItem('email');
    const value = email.trim();

    if (!looksLikeEmail(value)) {
      setError('Enter a work email, like dana@company.com.');

      if (field instanceof HTMLInputElement) field.focus();

      return;
    }

    setError('');
    setPending(true);

    try {
      await onStart?.(value);
    } catch {
      setPending(false);
      setError('That did not go through. Try again in a moment.');

      return;
    }

    setPending(false);
    setEmail('');
    setSent(true);
    onNotice(`Check ${value} for your sign-in link.`);
  };

  return (
    <section
      aria-labelledby="fieldnotes-signoff-title"
      className="fieldnotes-section fieldnotes-signoff"
      id="start"
    >
      <div className="fieldnotes-wrap">
        <Folio name="Sign-off" page="14" />
        <div className="fieldnotes-signoff-sheet">
          <h2 className="fieldnotes-h2" id="fieldnotes-signoff-title">
            Thank you for reading this far.
          </h2>
          <div className="fieldnotes-signoff-body">
            <p>
              If any of this sounded like your last quarter, try Fieldnotes on the interviews you
              already have. Bring twenty and they’re on us. Tag a few, and see which of them already
              agree with each other.
            </p>
          </div>
          <div className="fieldnotes-signature" data-reveal="signature">
            <p className="fieldnotes-signature-close">Yours in the field,</p>
            <p aria-hidden className="fieldnotes-signature-name">
              Maren
              <svg
                className="fieldnotes-signature-swash"
                preserveAspectRatio="none"
                viewBox="0 0 300 36"
              >
                <path d="M4 22C40 30 86 30 128 22S214 6 262 12c14 2 24 6 34 10" pathLength={1} />
              </svg>
            </p>
            <p className="fieldnotes-signature-who">Maren Ashdown, founder of Fieldnotes</p>
          </div>
          {/* method="dialog" keeps a form submitted before the page hydrates from sending the
              address anywhere; once it has, submit() handles every submission. */}
          <form className="fieldnotes-start" method="dialog" noValidate onSubmit={submit}>
            <svg aria-hidden className="fieldnotes-start-art" viewBox="0 0 440 120">
              <circle cx="386" cy="60" fill="none" r="46" stroke="currentColor" strokeWidth="2.4" />
              <circle cx="386" cy="60" fill="none" r="36" stroke="currentColor" strokeWidth="1" />
              <text fill="currentColor" textAnchor="middle" x="386" y="56">
                FIELDNOTES
              </text>
              <text fill="currentColor" textAnchor="middle" x="386" y="72">
                30 OCT 2026
              </text>
              <path
                d="M0 38c14-8 28 8 42 0s28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0M0 60c14-8 28 8 42 0s28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0M0 82c14-8 28 8 42 0s28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0 28 8 42 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <label className="fieldnotes-start-label" htmlFor="fieldnotes-email">
              Your work email
            </label>
            <div className="fieldnotes-start-row">
              <GlassInput
                ref={emailRef}
                aria-describedby={
                  error ? 'fieldnotes-email-error fieldnotes-email-help' : 'fieldnotes-email-help'
                }
                aria-invalid={error ? true : undefined}
                autoCapitalize="off"
                autoComplete="email"
                className="fieldnotes-start-input"
                id="fieldnotes-email"
                inputMode="email"
                name="email"
                placeholder="dana@company.com"
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
                className="fieldnotes-button-xl"
                type="submit"
                variant="prominent"
              >
                {pending ? 'Sending' : 'Start free'}
              </GlassButton>
            </div>
            <p aria-live="assertive" className="fieldnotes-start-error" id="fieldnotes-email-error">
              {error}
            </p>
            <p className="fieldnotes-start-help" id="fieldnotes-email-help">
              We’ll send a sign-in link. Your first 20 interviews are free, no card needed.
            </p>
            {sent && !onStart ? (
              <p className="fieldnotes-start-demo" role="status">
                Demo. Nothing was sent.
              </p>
            ) : null}
          </form>
          <p className="fieldnotes-postscript">
            <b>P.S.</b> Prefer to talk first?{' '}
            <a href="mailto:maren@fieldnotes.example">Book a 20 minute walkthrough</a> with me. I
            still take most of them myself.
          </p>
        </div>
      </div>
    </section>
  );
}
