'use client';

import './styles/liquid.css';

import clsx from 'clsx';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { mergeRefs } from './lib/merge-refs';
import {
  GlassSceneContext,
  createGlassSceneRegistry,
  useGlassScenePane,
} from './lib/scene-context';
import { createSceneRenderer } from './lib/scene-renderer';
import { useOptionalPreferences } from './glass-provider';
import type { SceneOptics, SceneRenderer, SceneSettings } from './lib/scene-renderer';

export type GlassSceneOptics = SceneOptics & {
  /** Distance in CSS pixels within which neighbouring glass melts together. */
  merge: number;
};

export type GlassSceneProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * The image the glass refracts, painted as the scene's background: a URL,
   * or a CSS url() or var() value. Serve it from this origin or with CORS.
   */
  backdrop?: string;
  /**
   * Where the backdrop sits. 'viewport' pins it to the viewport, as
   * background-attachment: fixed does, so scrolling carries the glass across
   * a still image; the scene clips it to its own box. Defaults to 'local'.
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
    const backdropRef = useRef<HTMLSpanElement | null>(null);
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
    }, [registry]);

    return (
      <GlassSceneContext.Provider value={registry}>
        <div
          ref={ref}
          className={clsx('lg-scene', className)}
          data-lg-backdrop-space={backdropSpace}
          data-lg-scene-renderer="css"
          style={
            // SAFETY: CSSProperties has no custom-property index; these add string-valued properties.
            {
              ...(backdrop ? { '--lg-scene-image': toCssUrl(backdrop) } : null),
              '--lg-scene-merge': `${merge}px`,
              ...style,
            } as CSSProperties
          }
          {...rest}
        >
          <span ref={backdropRef} className="lg-scene-backdrop" aria-hidden="true" />
          <canvas ref={canvasRef} className="lg-scene-canvas" aria-hidden="true" />
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
