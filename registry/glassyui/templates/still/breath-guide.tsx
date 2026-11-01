'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { motionReduced } from '../../lib/liquid-motion';
import { GlassButton } from '../../glass-button';
import { GlassKbd } from '../../glass-kbd';
import { GlassSurface } from '../../glass-surface';
import { BreathIcon, StopIcon } from './icons';

type GuideState = 'idle' | 'running' | 'done';

type BreathGuideProps = {
  /** Seconds to breathe in, hold and breathe out. */
  pattern?: readonly [number, number, number];
  breaths?: number;
  /** The hero's title and lede, set between the orb and its controls. */
  children: ReactNode;
  /** The sky's glow, which swells with the orb. */
  glowRef?: RefObject<HTMLElement | null>;
  onBreathingChange?: (breathing: boolean) => void;
};

const PHASES = ['Breathe in', 'Hold', 'Breathe out'] as const;

const FOUR_TWO_SIX = [4, 2, 6] as const;

const SWELL = 0.12;

const NUMBERS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const easeInOut = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

const finishedStatus = 'In the app, sessions run up to twenty minutes.';

/**
 * A guided breath: the orb swells as you breathe in, holds, and settles as you breathe out, while
 * the ring traces each breath. With motion reduced the orb stays still and the ring steps once a
 * second, so the count and the words carry the rhythm.
 */
export function BreathGuide({
  pattern = FOUR_TWO_SIX,
  breaths = 5,
  children,
  glowRef,
  onBreathingChange,
}: BreathGuideProps) {
  const [state, setState] = useState<GuideState>('idle');
  const [phase, setPhase] = useState<number | null>(null);
  const [breath, setBreath] = useState(0);
  const [words, setWords] = useState('');
  const guideRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<SVGCircleElement>(null);
  const beadRef = useRef<SVGCircleElement>(null);
  const wordsRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  // Odd breaths draw the ring and even ones let it go, so the trace never snaps back; a session
  // that starts with the ring full lets go first.
  const parityRef = useRef(0);
  const ringFullRef = useRef(false);
  const focusRef = useRef<'start' | 'stop' | null>(null);
  // Kept in a ref, so the session's clock never restarts when the owner re-renders.
  const onBreathingChangeRef = useRef(onBreathingChange);
  const cycle = pattern[0] + pattern[1] + pattern[2];
  const count = NUMBERS[breaths - 1] ?? String(breaths);
  const minutes = Math.round((cycle * breaths) / 60);

  useLayoutEffect(() => {
    onBreathingChangeRef.current = onBreathingChange;
  });

  const finish = useCallback(
    (done: boolean) => {
      const orb = orbRef.current;
      const trace = traceRef.current;

      if (orb) orb.style.transform = '';

      if (glowRef?.current) glowRef.current.style.transform = '';
      beadRef.current?.removeAttribute('transform');

      if (countRef.current) countRef.current.textContent = '';

      if (done && trace) {
        ringFullRef.current = (breaths - 1 + parityRef.current) % 2 === 0;
        trace.style.strokeDasharray = ringFullRef.current ? '1 1' : '0 1';
        trace.style.strokeDashoffset = ringFullRef.current ? '0' : '-1';
      }

      focusRef.current = document.activeElement === stopRef.current ? 'start' : null;
      setPhase(null);
      setWords(done ? `That was ${minutes === 1 ? 'a minute' : `${minutes} minutes`}.` : '');
      setState(done ? 'done' : 'idle');
      onBreathingChangeRef.current?.(false);
    },
    [breaths, glowRef, minutes],
  );

  const begin = () => {
    const trace = traceRef.current;

    parityRef.current = state === 'done' && ringFullRef.current ? 1 : 0;

    if (!parityRef.current && trace) {
      trace.style.strokeDasharray = '0 1';
      trace.style.strokeDashoffset = '0';
    }

    focusRef.current = 'stop';
    setBreath(1);
    setState('running');
    onBreathingChangeRef.current?.(true);
  };

  // The session's clock: the orb, glow, ring and count follow every frame without re-rendering;
  // the words and the breath number change a few times a breath.
  useEffect(() => {
    if (state !== 'running') return;

    const start = performance.now();
    let frame = requestAnimationFrame(tick);
    let shownPhase = -1;
    let shownBreath = -1;
    let shownCount = -1;

    function tick(now: number) {
      const elapsed = Math.max(0, now - start) / 1000;

      if (elapsed >= cycle * breaths) {
        finish(true);

        return;
      }

      const reduced = motionReduced();
      const current = Math.floor(elapsed / cycle);
      const within = elapsed - current * cycle;
      const step = within < pattern[0] ? 0 : within < pattern[0] + pattern[1] ? 1 : 2;
      const from = step === 0 ? 0 : step === 1 ? pattern[0] : pattern[0] + pattern[1];
      const progress = (within - from) / pattern[step];

      if (current !== shownBreath) {
        shownBreath = current;
        setBreath(current + 1);
      }

      if (step !== shownPhase) {
        shownPhase = step;
        setPhase(step);
        setWords(PHASES[step]);
      }

      const seconds = Math.max(1, Math.ceil(pattern[step] * (1 - progress) - 0.0001));

      if (seconds !== shownCount && countRef.current) {
        shownCount = seconds;
        countRef.current.textContent = String(seconds);
      }

      const lap = reduced ? Math.floor(within) / cycle : within / cycle;

      if (!reduced) {
        const scale =
          step === 0
            ? 1 + SWELL * easeInOut(progress)
            : step === 1
              ? 1 + SWELL
              : 1 + SWELL * (1 - easeInOut(progress));

        if (orbRef.current) orbRef.current.style.transform = `scale(${scale.toFixed(4)})`;

        if (glowRef?.current) {
          glowRef.current.style.transform = `scale(${(1 + (scale - 1) * 1.8).toFixed(4)})`;
        }
      }

      const filling = (current + parityRef.current) % 2 === 0;
      const trace = traceRef.current;

      if (trace) {
        trace.style.strokeDasharray = `${(filling ? lap : 1 - lap).toFixed(4)} 1`;
        trace.style.strokeDashoffset = filling ? '0' : (-lap).toFixed(4);
      }

      beadRef.current?.setAttribute('transform', `rotate(${(lap * 360).toFixed(2)} 100 100)`);
      frame = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frame);
  }, [breaths, cycle, finish, glowRef, pattern, state]);

  // Escape, a hidden tab or the guide leaving the screen ends a session where it stands.
  useEffect(() => {
    const guide = guideRef.current;

    if (state !== 'running' || !guide) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false);
    };

    const onVisibility = () => {
      if (document.hidden) finish(false);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) finish(false);
    });

    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    observer.observe(guide);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, [finish, state]);

  // The button that replaces the one in use takes its focus where it stands, so nothing scrolls.
  useLayoutEffect(() => {
    const target = focusRef.current;

    focusRef.current = null;

    if (target === 'stop') stopRef.current?.focus({ preventScroll: true });

    if (target === 'start') startRef.current?.focus({ preventScroll: true });
  }, [state]);

  // Each new instruction comes into focus.
  useEffect(() => {
    const element = wordsRef.current;

    if (!element || !words || motionReduced() || !element.animate) return;

    element.animate(
      [
        { filter: 'blur(8px)', opacity: 0, transform: 'translateY(6px)' },
        { filter: 'blur(0)', opacity: 1, transform: 'none' },
      ],
      { duration: 700, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    );
  }, [words]);

  return (
    <div ref={guideRef} className="still-breath" data-phase={phase ?? undefined} data-state={state}>
      <div className="still-breath-stage">
        <svg aria-hidden className="still-breath-ring" focusable="false" viewBox="0 0 200 200">
          <circle className="still-breath-track" cx="100" cy="100" r="98.5" />
          <circle
            ref={traceRef}
            className="still-breath-trace"
            cx="100"
            cy="100"
            pathLength={1}
            r="98.5"
            transform="rotate(-90 100 100)"
          />
          <circle className="still-breath-tick still-breath-tick--in" cx="100" cy="1.5" r="1.5" />
          <circle
            className="still-breath-tick still-breath-tick--hold"
            cx="185.3"
            cy="149.25"
            r="1.5"
          />
          <circle
            className="still-breath-tick still-breath-tick--out"
            cx="100"
            cy="198.5"
            r="1.5"
          />
          <circle ref={beadRef} className="still-breath-bead" cx="100" cy="1.5" r="2.4" />
        </svg>
        <div className="still-breath-rise">
          <GlassSurface ref={orbRef} className="still-breath-orb" lens>
            <span aria-hidden className="still-breath-shine" />
            <span ref={wordsRef} aria-live="polite" className="still-breath-words">
              {words}
            </span>
            <span ref={countRef} aria-hidden className="still-breath-count" />
          </GlassSurface>
        </div>
      </div>
      {children}
      <div className="still-breath-controls">
        {state === 'running' ? (
          <GlassButton ref={stopRef} className="still-button-xl" onClick={() => finish(false)}>
            <StopIcon />
            Stop
          </GlassButton>
        ) : (
          <GlassButton
            ref={startRef}
            className="still-button-xl"
            variant="prominent"
            onClick={begin}
          >
            <BreathIcon />
            {state === 'done' ? 'Breathe again' : 'Breathe with me'}
          </GlassButton>
        )}
      </div>
      <p className="still-breath-status">
        {state === 'running' ? (
          <>
            Breath {breath} of {breaths}
            <span className="still-breath-escape">
              <span aria-hidden>·</span>
              <GlassKbd>Esc</GlassKbd>to stop
            </span>
          </>
        ) : state === 'done' ? (
          `${count} slow breaths. ${finishedStatus}`
        ) : (
          `${count} breaths, about ${minutes === 1 ? 'a minute' : `${minutes} minutes`}`
        )}
      </p>
    </div>
  );
}
