'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { GlassButton } from '@/components/liquid/button';
import { GlassPanel } from '@/components/liquid/panel';
import { parseAnalyticsConfig, type AnalyticsConfig } from '@/lib/analytics/config';
import {
  capturePage,
  preferenceSignal,
  readConsent,
  startAnalytics,
  stopAnalytics,
  trackingAllowed,
  writeConsent,
} from '@/lib/analytics/browser';
import type { ConsentPreference } from '@/lib/analytics/consent';
import {
  chooseErrorReports,
  errorReportsAllowed,
  syncErrorReports,
} from '@/lib/diagnostics/browser';

const AnalyticsContext = createContext({ openSettings: () => {} });

export function PrivacySettingsButton() {
  const { openSettings } = useContext(AnalyticsContext);

  return (
    <button className="privacy-settings-link" type="button" onClick={openSettings}>
      Privacy settings
    </button>
  );
}

export function AnalyticsConsent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<AnalyticsConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [signal, setSignal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [errorsAllowed, setErrorsAllowed] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const manuallyOpened = useRef(false);
  const lastPreference = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setErrorsAllowed(errorReportsAllowed());
      void syncErrorReports();
    };

    sync();
    const timer = window.setInterval(sync, 1000);
    window.addEventListener('glassy-ui-error-reports-changed', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('glassy-ui-error-reports-changed', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/api/analytics-config', {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Analytics configuration unavailable');
        const value = parseAnalyticsConfig(await response.text());

        if (!value) throw new Error('Analytics configuration invalid');

        if (controller.signal.aborted) return;
        const refused = value.signal || preferenceSignal();

        if (refused) {
          stopAnalytics();
          writeConsent('rejected');
        }

        setSignal(refused);
        setConfig(value);
        setOpen(!refused && readConsent() === null);
        setReady(true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        stopAnalytics();
        setOpen(readConsent() === null);
        setReady(true);
      });

    return () => {
      controller.abort();
      stopAnalytics();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (!trackingAllowed(config)) {
      stopAnalytics();

      return;
    }

    if (config) {
      void startAnalytics(config).catch(() => {
        stopAnalytics();
        setError('Analytics could not start. It remains off.');
      });
      capturePage(config, pathname);
    }
  }, [config, pathname, ready, revision]);

  useEffect(() => {
    if (!ready) return;

    lastPreference.current = JSON.stringify(readConsent());

    const check = () => {
      const preference = readConsent();
      const serialized = JSON.stringify(preference);

      if (serialized !== lastPreference.current) {
        lastPreference.current = serialized;
        setRevision((value) => value + 1);

        if (!manuallyOpened.current) setOpen(preference === null);
      }

      if (preferenceSignal() || config?.signal) {
        stopAnalytics();

        if (readConsent()?.decision !== 'rejected') writeConsent('rejected');
        setSignal(true);

        return;
      }

      if (trackingAllowed(config)) return;
      stopAnalytics();

      if (readConsent() === null && !config?.signal && !preferenceSignal()) setOpen(true);
    };

    const channel = new BroadcastChannel('glassy-ui-analytics-consent');
    const timer = window.setInterval(check, 1000);

    // BroadcastChannel is same-origin. The shared cookie is re-read at every capture/send,
    // on focus and periodically, also protecting open tabs on the other production host.
    channel.addEventListener('message', check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);

    return () => {
      window.clearInterval(timer);
      channel.close();
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [config, ready]);

  const close = useCallback(() => {
    manuallyOpened.current = false;
    setOpen(false);
    returnFocus.current?.focus();
  }, []);

  const openSettings = useCallback(() => {
    manuallyOpened.current = true;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('button')?.focus());
  }, []);

  const choose = (decision: ConsentPreference['decision']) => {
    // Close the capture/transport gate before storage or UI work, including an in-flight import.
    stopAnalytics();
    const rejectedBySignal = signal || preferenceSignal() || config?.signal;
    const next = rejectedBySignal ? 'rejected' : decision;

    if (!writeConsent(next)) {
      setError('Your choice could not be saved. Analytics remains off.');

      return;
    }

    const channel = new BroadcastChannel('glassy-ui-analytics-consent');

    channel.postMessage('changed');
    channel.close();
    setError(null);
    setRevision((value) => value + 1);
    close();
  };

  const defaultOn = config?.mode === 'opt-out' && readConsent() === null;

  return (
    <AnalyticsContext.Provider value={{ openSettings }}>
      {children}
      {open && (
        <GlassPanel
          ref={panel}
          aria-label="Analytics privacy settings"
          className="analytics-consent"
          elevation="raised"
          lens
          role="region"
          variant="card"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && readConsent() !== null) close();
          }}
        >
          {/* The content scrolls inside the glass, so the frost stays in place on a short screen. */}
          <div className="analytics-consent-content">
            <h2 className="analytics-consent-title">Help improve Glassy UI</h2>
            <p className="analytics-consent-ask">
              {defaultOn
                ? 'Burlis Management GmbH measures page visits, site interactions and performance in your region.'
                : 'May Burlis Management GmbH measure page visits, site interactions and performance?'}{' '}
              <a href="https://glassyui.com/privacy">Privacy</a>
            </p>
            {(signal || config?.signal) && (
              <p className="analytics-consent-note">
                Your browser asks not to be tracked, so analytics stays off.
              </p>
            )}
            {ready && !config?.token && (
              <p className="analytics-consent-note">Analytics is unavailable and stays off.</p>
            )}
            {error && (
              <p className="analytics-consent-note" role="alert">
                {error}
              </p>
            )}
            <div className="analytics-consent-actions">
              <GlassButton
                aria-label={defaultOn ? 'Turn off analytics' : 'Reject analytics'}
                className="analytics-consent-choice"
                onClick={() => choose('rejected')}
              >
                {defaultOn ? 'Turn off' : 'Reject'}
              </GlassButton>
              <GlassButton
                aria-label="Accept analytics"
                className="analytics-consent-choice"
                onClick={() => choose('accepted')}
                disabled={signal || config?.signal}
              >
                Accept
              </GlassButton>
            </div>
            <div className="analytics-consent-errors">
              <p>
                Error reports
                <span>Help fix site failures.</span>
              </p>
              <GlassButton
                aria-label={errorsAllowed ? 'Turn off error reports' : 'Allow error reports'}
                className="analytics-consent-error-choice"
                disabled={!process.env.NEXT_PUBLIC_SENTRY_DSN || (!errorsAllowed && signal)}
                size="sm"
                variant="soft"
                onClick={() => {
                  if (!chooseErrorReports(!errorsAllowed)) {
                    setError('Your choice could not be saved. Error reports remain off.');

                    return;
                  }

                  setError(null);
                }}
              >
                {errorsAllowed ? 'Turn off' : 'Allow'}
              </GlassButton>
            </div>
            {/* Last in order, so opening the settings focuses the first choice; drawn top right. */}
            {readConsent() !== null && (
              <button
                aria-label="Close settings"
                className="analytics-consent-close"
                type="button"
                onClick={close}
              >
                <svg aria-hidden fill="none" height="10" viewBox="0 0 10 10" width="10">
                  <path
                    d="M1 1l8 8M9 1L1 9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            )}
          </div>
        </GlassPanel>
      )}
    </AnalyticsContext.Provider>
  );
}
