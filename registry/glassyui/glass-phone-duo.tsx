'use client';

/* eslint-disable @next/next/no-img-element -- The registry also installs outside Next.js. */
import clsx from 'clsx';
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { createPhoneDuoRenderer } from './lib/phone-duo-renderer';
import './styles/phone-duo.css';

export type GlassPhoneDuoFinish = 'night-sky' | 'star-white';

export type GlassPhoneDuoPose = 'upright' | 'book' | 'tent' | 'laptop' | 'side';

const poseKeys = ['pitch', 'roll', 'orbit', 'azimuth', 'balance', 'zoom'] as const;

type Orientation = Record<(typeof poseKeys)[number], number>;

const orientations: Record<GlassPhoneDuoPose, Orientation> = {
  upright: { pitch: 0, roll: 0, orbit: 0, azimuth: 0, balance: 0, zoom: 1 },
  book: { pitch: 0, roll: 0, orbit: 0, azimuth: 0, balance: 1, zoom: 1 },
  tent: { pitch: -90, roll: 90, orbit: 0, azimuth: -18, balance: 1, zoom: 1.25 },
  laptop: { pitch: 30, roll: 90, orbit: 0, azimuth: -12, balance: 1, zoom: 1.15 },
  side: { pitch: -90, roll: 0, orbit: 180, azimuth: 0, balance: 0, zoom: 1 },
};

export type GlassPhoneDuoProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** A same-origin or CORS-enabled landscape screenshot of the inner display (2670:1878). */
  screenSrc: string;
  /** A same-origin or CORS-enabled portrait screenshot of the outer display (1398:2034). */
  coverSrc: string;
  screenAlt?: string;
  coverAlt?: string;
  finish?: GlassPhoneDuoFinish;
  glare?: boolean;
  /** Animates between the flat inner display and the closed cover. */
  open?: boolean;
  /** Hinge angle: 0 closed, 180 flat. Overrides open with a short smoothed settle. */
  angle?: number;
  view?: 'front' | 'back';
  /** Device orientation. Use angle to set the opening for book, tent or laptop poses. */
  pose?: GlassPhoneDuoPose;
};

/** A polished metal frame and folding glass above a continuous, flat screenshot. */
export const GlassPhoneDuo = forwardRef<HTMLElement, GlassPhoneDuoProps>(
  (
    {
      angle,
      className,
      coverAlt = 'App on the outer phone display',
      coverSrc,
      finish = 'night-sky',
      glare = true,
      open = true,
      pose = 'upright',
      screenAlt = 'App on the unfolded phone display',
      screenSrc,
      style,
      view = 'front',
      ...rest
    },
    forwardedRef,
  ) => {
    const figureRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const screenRef = useRef<HTMLImageElement>(null);
    const coverRef = useRef<HTMLImageElement>(null);
    const [error, setError] = useState<string>();
    const fold = angle === undefined ? Number(open) : Math.min(180, Math.max(0, angle)) / 180;

    // The intro lifts its pane with t^1.25. Encode the inverse so manual angles
    // and interrupted animations meet at exactly the same physical hinge angle.
    const figureStyle: CSSProperties &
      Record<`--lg-phone-duo-${(typeof poseKeys)[number] | 'fold'}`, number | string> = {
      ...style,
      '--lg-phone-duo-fold': 1 - (1 - fold) ** (1 / 1.25),
      '--lg-phone-duo-pitch': `${orientations[pose].pitch}deg`,
      '--lg-phone-duo-roll': `${orientations[pose].roll}deg`,
      '--lg-phone-duo-orbit': `${orientations[pose].orbit}deg`,
      '--lg-phone-duo-azimuth': `${orientations[pose].azimuth}deg`,
      '--lg-phone-duo-balance': orientations[pose].balance,
      '--lg-phone-duo-zoom': orientations[pose].zoom,
    };

    useImperativeHandle(forwardedRef, () => figureRef.current!, []);
    useLayoutEffect(() => {
      const figure = figureRef.current!;
      const canvas = canvasRef.current!;
      const images = [screenRef.current!, coverRef.current!];
      let renderer: ReturnType<typeof createPhoneDuoRenderer>;

      try {
        renderer = createPhoneDuoRenderer(canvas);
      } catch {
        setError('This phone mockup needs WebGL 2.');

        return;
      }

      let frame = 0;
      let alive = true;
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      const transparency = matchMedia('(prefers-reduced-transparency: reduce)');

      function paint() {
        frame = 0;
        const computed = getComputedStyle(figure);
        const currentFold = Number(computed.getPropertyValue('--lg-phone-duo-fold'));
        const turn = Number.parseFloat(computed.getPropertyValue('--lg-phone-duo-turn'));
        const targetFold = Number(figure.style.getPropertyValue('--lg-phone-duo-fold'));
        const targetTurn = figure.dataset.view === 'back' ? 180 : 0;

        // SAFETY: These keys are the numeric orientation properties above.
        const orientation = Object.fromEntries(
          poseKeys.map((key) => [
            key,
            Number.parseFloat(computed.getPropertyValue(`--lg-phone-duo-${key}`)),
          ]),
        ) as Orientation;

        renderer.draw({
          fold: currentFold,
          turn,
          ...orientation,
          attached: figure.dataset.pose !== 'upright',
          white: figure.dataset.finish === 'star-white',
          glare:
            figure.dataset.glare !== 'off' &&
            !transparency.matches &&
            document.documentElement.dataset.lgReduceTransparency !== '1',
        });

        if (
          Math.abs(currentFold - targetFold) > 0.00001 ||
          Math.abs(turn - targetTurn) > 0.001 ||
          poseKeys.some(
            (key) =>
              Math.abs(
                orientation[key] -
                  Number.parseFloat(figure.style.getPropertyValue(`--lg-phone-duo-${key}`)),
              ) > 0.00001,
          )
        ) {
          schedule();
        }
      }

      function schedule() {
        if (alive && !frame) frame = requestAnimationFrame(paint);
      }

      function load(image: HTMLImageElement, index: number) {
        if (!image.complete || !image.naturalWidth) return;

        try {
          renderer.setImage(index, image);
          schedule();
        } catch {
          setError('The mockup screenshot needs permission to load across origins.');
        }
      }

      const onLoad = images.map((image, index) => () => load(image, index));
      const onError = () => setError('The mockup screenshot could not load.');

      images.forEach((image, index) => {
        image.addEventListener('load', onLoad[index]);
        image.addEventListener('error', onError);
        load(image, index);
      });

      const resize = new ResizeObserver(schedule);
      resize.observe(canvas);
      const attributes = new MutationObserver(schedule);
      attributes.observe(figure, {
        attributes: true,
        attributeFilter: [
          'style',
          'data-view',
          'data-pose',
          'data-finish',
          'data-glare',
          'data-manual',
        ],
      });
      attributes.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-lg-reduce-motion', 'data-lg-reduce-transparency'],
      });
      motion.addEventListener('change', schedule);
      transparency.addEventListener('change', schedule);
      schedule();

      return () => {
        alive = false;
        cancelAnimationFrame(frame);
        resize.disconnect();
        attributes.disconnect();
        motion.removeEventListener('change', schedule);
        transparency.removeEventListener('change', schedule);
        images.forEach((image, index) => {
          image.removeEventListener('load', onLoad[index]);
          image.removeEventListener('error', onError);
        });
        renderer.dispose();
      };
    }, []);

    return (
      <figure
        ref={figureRef}
        aria-label={
          view === 'back'
            ? `Rear cameras. ${fold >= 0.5 ? coverAlt : 'Phone closed'}`
            : fold < 0.5
              ? coverAlt
              : screenAlt
        }
        className={clsx('lg-phone-duo', className)}
        data-finish={finish}
        data-fold={fold === 1 ? 'open' : fold === 0 ? 'closed' : 'partial'}
        data-glare={glare ? 'on' : 'off'}
        data-manual={angle === undefined ? undefined : ''}
        data-pose={pose}
        data-view={view}
        role="img"
        style={figureStyle}
        {...rest}
      >
        <div aria-hidden className="lg-phone-duo-body">
          <span className="lg-phone-duo-shadow" />
          <canvas ref={canvasRef} className="lg-phone-duo-canvas" />
          <img
            ref={screenRef}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            hidden
            src={screenSrc}
          />
          <img
            ref={coverRef}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            hidden
            src={coverSrc}
          />
        </div>
        {error ? <figcaption className="lg-phone-duo-error">{error}</figcaption> : null}
      </figure>
    );
  },
);

GlassPhoneDuo.displayName = 'GlassPhoneDuo';
