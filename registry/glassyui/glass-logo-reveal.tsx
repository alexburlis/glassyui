'use client';

/* eslint-disable @next/next/no-img-element -- The registry also installs outside Next.js. */
import clsx from 'clsx';
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import {
  createLogoRevealRenderer,
  LOGO_REVEAL_LENGTH,
  paintMark,
  readColour,
} from './lib/logo-reveal-renderer';
import type { LogoRevealRenderer } from './lib/logo-reveal-renderer';
import './styles/logo-reveal.css';

export type GlassLogoRevealPlay = 'visible' | 'mount';

type RevealState = 'waiting' | 'playing' | 'held' | 'ended';

export type GlassLogoRevealProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** The mark, from your origin or served with CORS. An SVG stays sharp under the glass. */
  markSrc: string;
  /** The mark's accessible name, such as your product's name. */
  label: string;
  /** Plays once: when the figure is mostly on screen, or as soon as it mounts. */
  play?: GlassLogoRevealPlay;
  /** Holds one moment, from 0 (the dark stage) to 1 (the mark at rest). Clearing it plays on. */
  progress?: number;
  /** Milliseconds from the dark stage to the mark at rest. */
  duration?: number;
  /** Called once the mark has landed. */
  onComplete?: () => void;
};

const QUALITY = {
  // Every wavelength traces the glass, so quality trades colour samples and resolution.
  low: { ratio: 1, taps: 3 },
  medium: { ratio: 1.5, taps: 3 },
  high: { ratio: 2, taps: 5 },
} as const;

/** Reduced motion or transparency, from the system or the provider's preferences. */
function stillness() {
  const root = document.documentElement.dataset;

  return (
    root.lgReduceMotion === '1' ||
    root.lgReduceTransparency === '1' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    matchMedia('(prefers-reduced-transparency: reduce)').matches
  );
}

function luminance([r, g, b, a]: readonly number[]) {
  return a ? (0.2126 * r + 0.7152 * g + 0.0722 * b) / a : 0;
}

/**
 * A logo sting: a ball of thick glass swells out of the dark in front of the mark, squares into a
 * rounded tile and clears, leaving the real mark, which stays in the page. The glass is
 * ray-traced, so it bends the mark as real glass would.
 */
export const GlassLogoReveal = forwardRef<HTMLElement, GlassLogoRevealProps>(
  (
    { className, duration = 2600, label, markSrc, onComplete, play = 'visible', progress, ...rest },
    forwardedRef,
  ) => {
    const figureRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const markRef = useRef<HTMLImageElement>(null);
    const [state, setState] = useState<RevealState>('waiting');
    const [error, setError] = useState<string>();
    const latest = useRef({ duration, onComplete, play, progress });
    const controls = useRef<{ paint: () => void; update: () => void } | null>(null);

    useImperativeHandle(forwardedRef, () => figureRef.current!, []);

    // The running reveal reads the latest props without starting over.
    useLayoutEffect(() => {
      latest.current = { duration, onComplete, play, progress };
      controls.current?.update();
    });

    useLayoutEffect(() => {
      controls.current?.paint();
    }, [markSrc]);

    useLayoutEffect(() => {
      const figure = figureRef.current!;
      const canvas = canvasRef.current!;
      const mark = markRef.current!;
      let renderer: LogoRevealRenderer;

      try {
        renderer = createLogoRevealRenderer(canvas);
      } catch {
        // Without WebGL2 the mark simply shows.
        figure.dataset.renderer = 'none';
        setState('ended');

        return;
      }

      figure.dataset.renderer = 'webgl';

      let alive = true;
      let ready = false;
      let visible = false;
      let begun = false;
      let completed = false;
      // How far through the reveal it is, from 0 to 1.
      let moment = 0;
      let frame = 0;
      let painting = 0;
      let last = 0;

      const draw = () => {
        if (ready) renderer.draw(moment * LOGO_REVEAL_LENGTH);
      };

      const stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
      };

      const finish = () => {
        stop();
        moment = 1;
        setState('ended');

        if (!completed) {
          completed = true;
          latest.current.onComplete?.();
        }
      };

      const tick = (now: number) => {
        frame = 0;

        if (!alive) return;

        // A background tab pauses the reveal rather than skipping it.
        const step = last ? Math.min(now - last, 50) : 0;

        last = now;
        moment = Math.min(moment + step / Math.max(latest.current.duration, 1), 1);
        draw();

        if (moment >= 1) finish();
        else frame = requestAnimationFrame(tick);
      };

      const update = () => {
        if (!alive) return;

        const { play: when, progress: held } = latest.current;

        // Reduced motion keeps the end state, even for a held moment.
        if (stillness()) {
          finish();

          return;
        }

        if (held !== undefined) {
          stop();
          moment = Math.min(Math.max(held, 0), 1);
          // Clearing the hold plays on from this moment.
          begun = true;
          setState(moment >= 1 ? 'ended' : 'held');
          draw();

          return;
        }

        if (moment >= 1) {
          finish();

          return;
        }

        if (!ready) return;

        if (begun || when === 'mount' || visible) {
          begun = true;
          setState('playing');

          if (!frame) {
            last = 0;
            frame = requestAnimationFrame(tick);
          }

          return;
        }

        setState('waiting');
        draw();
      };

      // Draws the mark as the page lays it out, in the figure's colours, at the device's
      // resolution within the quality preference.
      const paint = () => {
        painting = 0;

        if (!alive || !mark.complete || !mark.naturalWidth) return;

        const width = figure.clientWidth;
        const height = figure.clientHeight;

        if (!width || !height) return;

        const level = document.documentElement.dataset.lgQuality;
        const quality = level === 'low' || level === 'medium' ? QUALITY[level] : QUALITY.high;

        const ratio = Math.min(
          window.devicePixelRatio || 1,
          quality.ratio,
          renderer.limit / Math.max(width, height),
        );

        const style = getComputedStyle(figure);
        const backdrop = readColour(style.backgroundColor);

        renderer.resize(width, height, ratio);
        renderer.setTaps(quality.taps);
        renderer.setStage({
          backdrop,
          // A clear stage takes its light from the ink: pale ink means a dark page.
          dark:
            backdrop[3] > 0.5
              ? luminance(backdrop) < 0.5
              : luminance(readColour(style.color)) >= 0.5,
          thickness: Number.parseFloat(style.getPropertyValue('--lg-glass-thickness')) || 1,
        });

        try {
          const pictures = paintMark(
            figure,
            mark,
            canvas.width,
            canvas.height,
            2.5,
            renderer.limit,
          );

          renderer.setMark(pictures.sharp);
          renderer.setStill(pictures.still, pictures.layout);
        } catch {
          setError('The mark needs permission to load across origins.');
          finish();

          return;
        }

        ready = true;
        update();
        draw();
      };

      const schedule = () => {
        if (alive && !painting) painting = requestAnimationFrame(paint);
      };

      const onError = () => {
        setError('The mark could not load.');
        finish();
      };

      const onLost = () => {
        ready = false;
        finish();
      };

      const sight = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          update();
        },
        { threshold: 0.5 },
      );

      const resize = new ResizeObserver(schedule);

      const preferences = new MutationObserver(() => {
        schedule();
        update();
      });

      const queries = [
        '(prefers-reduced-motion: reduce)',
        '(prefers-reduced-transparency: reduce)',
        '(prefers-color-scheme: dark)',
      ].map((query) => matchMedia(query));

      const fonts = document.fonts;

      controls.current = { paint: schedule, update };
      sight.observe(figure);
      resize.observe(figure);
      preferences.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [
          'class',
          'style',
          'data-lg-theme',
          'data-lg-quality',
          'data-lg-reduce-motion',
          'data-lg-reduce-transparency',
        ],
      });
      queries.forEach((query) => query.addEventListener('change', schedule));
      queries.forEach((query) => query.addEventListener('change', update));
      mark.addEventListener('load', schedule);
      mark.addEventListener('error', onError);
      canvas.addEventListener('webglcontextlost', onLost);
      fonts.addEventListener('loadingdone', schedule);

      if (mark.complete && !mark.naturalWidth && mark.currentSrc) onError();

      // Fonts that are still loading would change the name's shape.
      void fonts.ready.then(schedule);
      schedule();
      update();

      return () => {
        alive = false;
        controls.current = null;
        stop();
        cancelAnimationFrame(painting);
        sight.disconnect();
        resize.disconnect();
        preferences.disconnect();
        queries.forEach((query) => {
          query.removeEventListener('change', schedule);
          query.removeEventListener('change', update);
        });
        mark.removeEventListener('load', schedule);
        mark.removeEventListener('error', onError);
        canvas.removeEventListener('webglcontextlost', onLost);
        fonts.removeEventListener('loadingdone', schedule);
        renderer.dispose();
      };
    }, []);

    return (
      <figure
        ref={figureRef}
        aria-label={label}
        className={clsx('lg-logo-reveal', className)}
        data-state={state}
        role="img"
        {...rest}
      >
        <canvas ref={canvasRef} aria-hidden className="lg-logo-reveal-canvas" />
        <img
          ref={markRef}
          alt=""
          aria-hidden
          className="lg-logo-reveal-mark"
          crossOrigin="anonymous"
          draggable={false}
          src={markSrc}
        />
        {error ? <figcaption className="lg-logo-reveal-error">{error}</figcaption> : null}
      </figure>
    );
  },
);

GlassLogoReveal.displayName = 'GlassLogoReveal';
