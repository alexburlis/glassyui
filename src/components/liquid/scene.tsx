'use client';

import clsx from 'clsx';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, RefObject } from 'react';
import { motionReduced } from './internal/liquid-motion';
import { mergeRefs } from './internal/merge-refs';
import {
  GlassSceneContext,
  createGlassSceneRegistry,
  useGlassScenePane,
} from './internal/scene-context';
import { MAX_TEXTURE, createSceneRenderer } from './internal/scene-renderer';
import { useOptionalPreferences } from './provider';
import type { SceneOptics, SceneRenderer, SceneSettings } from './internal/scene-renderer';

export type GlassSceneOptics = SceneOptics & {
  /** Distance in CSS pixels within which neighbouring glass melts together. */
  merge: number;
};

/**
 * Paints a scene's backdrop, in CSS pixels across the backdrop's box. `time` counts milliseconds
 * since the first paint; `density` is the canvas's device pixels per CSS pixel. Return false when
 * nothing changed since the last call: the canvas keeps its picture and the glass does not redraw.
 */
export type GlassSceneBackdropPainter = (
  context: CanvasRenderingContext2D,
  frame: { width: number; height: number; density: number; time: number },
) => boolean | void;

export type GlassSceneProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * What the glass refracts, painted as the scene's background: an image URL,
   * or a CSS url() or var() value, served from this origin or with CORS. Or a
   * painter that draws it on a canvas, which the CSS glass shows as well.
   */
  backdrop?: string | GlassSceneBackdropPainter;
  /**
   * Repaints a painted backdrop this many times a second while the scene is
   * on screen and motion is allowed. 0 paints it only when it mounts or
   * resizes and when the painter changes.
   */
  backdropFps?: number;
  /**
   * Where the backdrop sits. 'viewport' pins it to the viewport, as
   * background-attachment: fixed does, so scrolling carries the glass across
   * a still image; the scene clips it to its own box. Defaults to 'local'. A
   * painted backdrop always covers the scene.
   */
  backdropSpace?: 'local' | 'viewport';
  /** Lets glass that sets --lg-scene-flow ripple like liquid. Reduced motion holds it still. */
  flow?: boolean;
  optics?: Partial<GlassSceneOptics>;
};

const DEFAULT_OPTICS: GlassSceneOptics = {
  ior: 1.5,
  thickness: 40,
  bevel: 28,
  dispersion: 0.15,
  frost: 1,
  merge: 12,
  specular: 1,
};

const toCssUrl = (value: string) =>
  /^\s*(url|var)\(/i.test(value)
    ? value
    : `url("${value.replace(/["\\\n]/g, (character) => (character === '\n' ? '\\a ' : `\\${character}`))}")`;

/** The backdrop prop is an image or a painter, never both. */
function readBackdrop(backdrop: GlassSceneProps['backdrop']): {
  image?: string;
  painter?: GlassSceneBackdropPainter;
} {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- The prop's two shapes are its contract.
  return typeof backdrop === 'function' ? { painter: backdrop } : { image: backdrop };
}

/**
 * Paints a painted backdrop's canvas at device density, on a paced loop while it moves, and
 * hands each new picture to the renderer. Off screen, in a hidden page and under reduced motion
 * the loop stops; reduced motion paints once, at time 0.
 */
function usePaintedBackdrop(
  layerRef: RefObject<HTMLElement | null>,
  rendererRef: RefObject<SceneRenderer | null>,
  painter: GlassSceneBackdropPainter | undefined,
  fps: number,
) {
  const painterRef = useRef(painter);
  const paintRef = useRef<(() => void) | null>(null);
  // The painter's clock outlives a change of pace, so a scene that slows down after an opening
  // does not start it again.
  const startRef = useRef<number | undefined>(undefined);
  const painted = painter !== undefined;

  useEffect(() => {
    const layer = layerRef.current;
    const context = layer instanceof HTMLCanvasElement ? layer.getContext('2d') : null;

    if (!painted || !(layer instanceof HTMLCanvasElement) || !context) return;

    const interval = fps > 0 ? 1000 / fps : 0;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let last = -Infinity;
    let previous = 0;
    let frame = 0;
    let onscreen = false;
    let shown: SceneRenderer | null = null;

    const paint = (now: number) => {
      const width = layer.clientWidth;
      const height = layer.clientHeight;

      if (!width || !height || !painterRef.current) return;

      const density = Math.min(
        window.devicePixelRatio || 1,
        2,
        MAX_TEXTURE / width,
        MAX_TEXTURE / height,
      );

      const pixelWidth = Math.max(1, Math.round(width * density));
      const pixelHeight = Math.max(1, Math.round(height * density));
      // Resizing clears the canvas, so that paint always counts as a change.
      const resized = layer.width !== pixelWidth || layer.height !== pixelHeight;

      if (resized) {
        layer.width = pixelWidth;
        layer.height = pixelHeight;
      }

      startRef.current ??= now;
      context.setTransform(density, 0, 0, density, 0, 0);

      const changed = painterRef.current(context, {
        width,
        height,
        density,
        time: motionReduced() ? 0 : now - startRef.current,
      });

      // A renderer that has not seen this canvas yet takes its picture as it is, so one made
      // after the last real change still gets it.
      const renderer = rendererRef.current;

      if (renderer && (changed !== false || resized || renderer !== shown)) {
        renderer.backdropChanged();
        shown = renderer;
      }
    };

    const halt = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = (now: number) => {
      // Frames land on the display's refresh, so a paint may come up to half a frame early. A
      // display near the painter's rate then paints every frame instead of every other one.
      const step = previous ? now - previous : 0;

      frame = 0;
      previous = now;

      if (now - last >= interval - step / 2) {
        last = now;
        paint(now);
      }

      resume();
    };

    const resume = () => {
      if (!interval || !onscreen || document.hidden || motionReduced()) {
        halt();
        previous = 0;
      } else if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMotion = () => {
      paint(performance.now());
      resume();
    };

    const visibility = new IntersectionObserver((entries) => {
      const visible = entries[entries.length - 1]?.isIntersecting ?? false;

      if (visible && !onscreen) paint(performance.now());

      onscreen = visible;
      resume();
    });

    const resize = new ResizeObserver(() => paint(performance.now()));
    const preference = new MutationObserver(onMotion);

    visibility.observe(layer);
    resize.observe(layer);
    preference.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-lg-reduce-motion'],
    });
    motionQuery.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', resume);
    paintRef.current = () => paint(performance.now());

    return () => {
      halt();
      paintRef.current = null;
      visibility.disconnect();
      resize.disconnect();
      preference.disconnect();
      motionQuery.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [fps, layerRef, painted, rendererRef]);

  // A new painter paints at once.
  useEffect(() => {
    painterRef.current = painter;
    paintRef.current?.();
  }, [painter]);
}

/**
 * Draws its glass children as one body of thick glass over a backdrop image:
 * rims bend the image and split its colours, nearby pieces melt together and
 * a fixed light catches the rims. Needs WebGL2; without it, and under reduced
 * transparency or increased contrast, every child keeps its CSS glass.
 */
export const GlassScene = forwardRef<HTMLDivElement, GlassSceneProps>(
  (
    {
      backdrop,
      backdropFps = 0,
      backdropSpace = 'local',
      flow = false,
      optics,
      className,
      style,
      children,
      ...rest
    },
    forwardedRef,
  ) => {
    const [registry] = useState(createGlassSceneRegistry);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const backdropRef = useRef<HTMLElement | null>(null);
    const { image, painter } = readBackdrop(backdrop);
    const painted = painter !== undefined;
    const rendererRef = useRef<SceneRenderer | null>(null);
    const ref = useMemo(() => mergeRefs(rootRef, forwardedRef), [forwardedRef]);
    const { preferences } = useOptionalPreferences();
    const scale = preferences.thickness;

    // The site's thickness preference scales the default slab. Optics a scene sets itself stay as set.
    const { ior, thickness, bevel, dispersion, frost, specular, merge } = {
      ...DEFAULT_OPTICS,
      thickness: DEFAULT_OPTICS.thickness * scale,
      bevel: DEFAULT_OPTICS.bevel * (0.6 + 0.4 * scale),
      dispersion: DEFAULT_OPTICS.dispersion * scale,
      ...optics,
    };

    const settings = useMemo<SceneSettings>(
      () => ({ flow, optics: { ior, thickness, bevel, dispersion, frost, specular } }),
      [flow, ior, thickness, bevel, dispersion, frost, specular],
    );

    const settingsRef = useRef(settings);

    useEffect(() => {
      settingsRef.current = settings;
      rendererRef.current?.update(settings);
    }, [settings]);

    useEffect(() => {
      const root = rootRef.current;
      const canvas = canvasRef.current;
      const layer = backdropRef.current;

      if (!root || !canvas || !layer) return;

      const renderer = createSceneRenderer({
        root,
        canvas,
        backdrop: layer,
        registry,
        settings: settingsRef.current,
      });

      rendererRef.current = renderer;

      return () => {
        rendererRef.current = null;
        renderer.destroy();
      };
      // A painter turns the backdrop layer into a canvas, which needs a renderer of its own.
    }, [painted, registry]);

    usePaintedBackdrop(backdropRef, rendererRef, painter, backdropFps);

    useEffect(() => {
      if (painted && backdropSpace === 'viewport') {
        console.warn(
          'Glassy UI GlassScene: a painted backdrop always covers the scene, so backdropSpace="viewport" paints it locally.',
        );
      }
    }, [backdropSpace, painted]);

    const setBackdrop = useCallback((node: HTMLElement | null) => {
      backdropRef.current = node;
    }, []);

    return (
      <GlassSceneContext.Provider value={registry}>
        <div
          ref={ref}
          className={clsx('lg-scene', className)}
          data-lg-backdrop-space={painted ? 'local' : backdropSpace}
          data-lg-scene-renderer="css"
          style={
            // SAFETY: CSSProperties has no custom-property index; these add string-valued properties.
            {
              ...(image ? { '--lg-scene-image': toCssUrl(image) } : null),
              '--lg-scene-merge': `${merge}px`,
              ...style,
            } as CSSProperties
          }
          {...rest}
        >
          {/* In viewport space the layers stack below the children together, so the fixed
              backdrop keeps a z-index of auto: iOS Safari paints the status bar solid over a
              fixed backdrop with a negative z-index. */}
          <span className="lg-scene-layers" aria-hidden="true">
            {painted ? (
              <canvas ref={setBackdrop} className="lg-scene-backdrop" aria-hidden="true" />
            ) : (
              <span ref={setBackdrop} className="lg-scene-backdrop" aria-hidden="true" />
            )}
            <canvas ref={canvasRef} className="lg-scene-canvas" aria-hidden="true" />
          </span>
          {children}
        </div>
      </GlassSceneContext.Provider>
    );
  },
);

GlassScene.displayName = 'GlassScene';

export type GlassDropProps = HTMLAttributes<HTMLDivElement> & {
  /** Merge distance for this drop in CSS pixels. Defaults to the scene's. */
  merge?: number;
};

/**
 * A drop of glass inside a GlassScene. Size, round and place it with
 * CSS; drops closer than their merge distance melt into one.
 */
export const GlassDrop = forwardRef<HTMLDivElement, GlassDropProps>(
  ({ merge, className, style, ...rest }, forwardedRef) => {
    const dropRef = useRef<HTMLDivElement | null>(null);
    const ref = useMemo(() => mergeRefs(dropRef, forwardedRef), [forwardedRef]);
    // SAFETY: CSSProperties has no custom-property index; this adds one string-valued property.
    const mergeStyle = { '--lg-scene-merge': `${merge}px`, ...style } as CSSProperties;

    useGlassScenePane(dropRef);

    return (
      <div
        ref={ref}
        className={clsx('lg-scene-drop', className)}
        style={merge === undefined ? style : mergeStyle}
        {...rest}
      />
    );
  },
);

GlassDrop.displayName = 'GlassDrop';
