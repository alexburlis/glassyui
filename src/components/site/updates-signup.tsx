'use client';

import { actionOutcome, captureAction } from '@/lib/analytics/browser';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { GlassButton } from '@/components/liquid/button';
import { GlassInput } from '@/components/liquid/input';
import { UPDATES_LABELS, UPDATES_NOTICE_TEXT } from '@/lib/updates-notice';
import '@/styles/updates-signup.css';

type SignupState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'accepted' }
  | { kind: 'error'; message: string; invalid: boolean };

// The request gives up after 12 seconds and is never retried for the visitor.
const REQUEST_TIMEOUT_MS = 12_000;

function failureMessage(status: number) {
  if (status === 400) return UPDATES_LABELS.invalid;

  if (status === 429) return UPDATES_LABELS.rateLimited;

  return UPDATES_LABELS.failed;
}

/**
 * The footer's one signup form. The Subscribe button with the notice beside it is the signup
 * action; the confirmation email is what subscribes. The service answers an accepted request the
 * same way whether or not it sent a new link, so the confirmation claims no more than that.
 */
export function UpdatesSignup() {
  const [state, setState] = useState<SignupState>({ kind: 'idle' });
  const [email, setEmail] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptedRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const id = useId();
  const headingId = `${id}-heading`;
  const noticeId = `${id}-notice`;
  const errorId = `${id}-error`;

  // The form and the confirmation replace each other, so focus moves with them.
  useEffect(() => {
    if (state.kind === 'accepted') acceptedRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      inputRef.current?.focus();
    }
  }, [state.kind]);

  async function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.kind === 'sending') return;
    const input = inputRef.current;
    const address = email.trim();

    if (!input || !address || !input.checkValidity()) {
      setState({ kind: 'error', message: UPDATES_LABELS.invalid, invalid: true });
      input?.focus();

      return;
    }

    const recordOutcome = actionOutcome({ source: 'footer', action: 'signup' });
    captureAction({ source: 'footer', action: 'signup', outcome: 'requested' });
    setState({ kind: 'sending' });

    try {
      const response = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address, consent: true }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // The route answers 200 only for an accepted request.
      if (response.status === 200) {
        recordOutcome('accepted');
        setState({ kind: 'accepted' });

        return;
      }

      recordOutcome('failed');
      setState({
        kind: 'error',
        message: failureMessage(response.status),
        invalid: response.status === 400,
      });

      if (response.status === 400) input.focus();
    } catch {
      recordOutcome('failed');
      setState({ kind: 'error', message: UPDATES_LABELS.failed, invalid: false });
    }
  }

  const sending = state.kind === 'sending';
  const error = state.kind === 'error' ? state : null;

  return (
    <section aria-labelledby={headingId} className="updates-signup">
      <div className="updates-signup-copy">
        <h2 className="updates-signup-heading" id={headingId}>
          {UPDATES_LABELS.heading}
        </h2>
        <p className="updates-signup-notice" id={noticeId}>
          {UPDATES_NOTICE_TEXT}{' '}
          <Link className="updates-signup-privacy" href="/privacy">
            {UPDATES_LABELS.privacy}
          </Link>
        </p>
      </div>
      {state.kind === 'accepted' ? (
        <div className="updates-signup-accepted" ref={acceptedRef} role="status" tabIndex={-1}>
          <p className="updates-signup-accepted-title">{UPDATES_LABELS.success}</p>
          <p className="updates-signup-accepted-detail">
            <span className="updates-signup-email">{email.trim()}</span>{' '}
            <button
              className="updates-signup-change"
              onClick={() => {
                restoreFocus.current = true;
                setState({ kind: 'idle' });
              }}
              type="button"
            >
              {UPDATES_LABELS.change}
            </button>
          </p>
        </div>
      ) : (
        <form
          aria-busy={sending || undefined}
          aria-labelledby={headingId}
          className="updates-signup-form"
          noValidate
          onSubmit={subscribe}
        >
          <div className="updates-signup-row">
            <GlassInput
              aria-describedby={[error ? errorId : null, noticeId].filter(Boolean).join(' ')}
              aria-invalid={error?.invalid || undefined}
              aria-label={UPDATES_LABELS.email}
              autoCapitalize="off"
              autoComplete="email"
              enterKeyHint="send"
              inputMode="email"
              name="email"
              onChange={(event) => {
                setEmail(event.currentTarget.value);

                if (error) setState({ kind: 'idle' });
              }}
              placeholder={UPDATES_LABELS.email}
              readOnly={sending}
              ref={inputRef}
              required
              spellCheck={false}
              type="email"
              value={email}
            />
            <GlassButton
              aria-disabled={sending || undefined}
              className="updates-signup-submit"
              type="submit"
              variant="prominent"
            >
              {sending ? UPDATES_LABELS.submitting : UPDATES_LABELS.submit}
            </GlassButton>
          </div>
          <p aria-live="polite" className="updates-signup-error" id={errorId}>
            {error?.message}
          </p>
        </form>
      )}
    </section>
  );
}
