'use client';

import clsx from 'clsx';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { mergeRefs } from './lib/merge-refs';
import { useMagnifierFilter } from './lib/use-refraction-filter';
import { useOptionalPreferences } from './glass-provider';

type LensPoint = { x: number; y: number };

type LensStageSize = { height: number; width: number };

type LensStyle = CSSProperties & Record<`--lg-lens-${string}`, string>;

export type GlassLensProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * The content to magnify. It renders a second time inside the lens, so give it its own
   * background and avoid ids.
   */
  children: ReactNode;
  /** Starting centre of the lens, as fractions of the stage. */
  defaultPosition?: LensPoint;
  /** Accessible name of the draggable lens. */
  label?: string;
  /** Diameter in pixels. */
  size?: number;
  zoom?: number;
};

const ARROW_DIRECTIONS = new Map<string, LensPoint>([
  ['ArrowUp', { x: 0, y: -1 }],
  ['ArrowDown', { x: 0, y: 1 }],
  ['ArrowLeft', { x: -1, y: 0 }],
  ['ArrowRight', { x: 1, y: 0 }],
]);

const KEY_STEP = 10;

const KEY_STEP_LARGE = 50;

const EDGE_MARGIN = 4;

function clampToStage(value: number, extent: number) {
  return Math.min(Math.max(value, EDGE_MARGIN), Math.max(EDGE_MARGIN, extent - EDGE_MARGIN));
}

/**
 * A draggable magnifier over any content. The zoomed copy bends into the rim through a
 * generated SVG filter, which works in every engine that supports SVG filters on HTML;
 * reduced motion and reduced transparency keep a plain magnifier.
 */
export const GlassLens = forwardRef<HTMLDivElement, GlassLensProps>(
  (
    { children, className, defaultPosition, label = 'Magnifier', size = 160, zoom = 1.6, ...props },
    forwardedRef,
  ) => {
    const { preferences } = useOptionalPreferences();
    const stageRef = useRef<HTMLDivElement | null>(null);
    const lensRef = useRef<HTMLDivElement | null>(null);
    const ref = useMemo(() => mergeRefs(stageRef, forwardedRef), [forwardedRef]);
    const [stage, setStage] = useState<LensStageSize | null>(null);

    const centreRef = useRef<LensPoint>({
      x: defaultPosition?.x ?? 0.5,
      y: defaultPosition?.y ?? 0.5,
    });

    const grabRef = useRef<LensPoint | null>(null);

    const { filterElement, filterStyle, margin } = useMagnifierFilter(lensRef, {
      enabled: stage !== null && !preferences.reduceMotion && !preferences.reduceTransparency,
      signature: `${preferences.theme}:${preferences.mode}:${preferences.quality}:${preferences.thickness}`,
      size,
    });

    // The centre is kept as stage fractions so the lens stays over the same spot on resize.
    // Only a move rewrites them; placing reads the live stage, so a resize that lands
    // between observer callbacks cannot shift the lens.
    const place = () => {
      const stageElement = stageRef.current;
      const lens = lensRef.current;

      if (!stageElement || !lens || !stageElement.clientWidth || !stageElement.clientHeight) {
        return;
      }

      const width = stageElement.clientWidth;
      const height = stageElement.clientHeight;

      lens.style.setProperty(
        '--lg-lens-x',
        `${clampToStage(centreRef.current.x * width, width)}px`,
      );
      lens.style.setProperty(
        '--lg-lens-y',
        `${clampToStage(centreRef.current.y * height, height)}px`,
      );
    };

    const moveTo = (x: number, y: number) => {
      const stageElement = stageRef.current;

      if (!stageElement || !stageElement.clientWidth || !stageElement.clientHeight) return;

      const width = stageElement.clientWidth;
      const height = stageElement.clientHeight;

      centreRef.current = {
        x: clampToStage(x, width) / width,
        y: clampToStage(y, height) / height,
      };
      place();
    };

    useEffect(() => {
      const stageElement = stageRef.current;

      if (!stageElement) return;

      const observer = new ResizeObserver(() => {
        setStage({ height: stageElement.clientHeight, width: stageElement.clientWidth });
      });

      observer.observe(stageElement);

      return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
      if (stage) place();
    });

    const stagePoint = (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = stageRef.current?.getBoundingClientRect();

      return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
    };

    const currentCentre = () => ({
      x: centreRef.current.x * (stageRef.current?.clientWidth ?? 0),
      y: centreRef.current.y * (stageRef.current?.clientHeight ?? 0),
    });

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      const point = stagePoint(event);
      const centre = currentCentre();

      event.currentTarget.setPointerCapture(event.pointerId);
      grabRef.current = { x: point.x - centre.x, y: point.y - centre.y };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const grab = grabRef.current;

      if (!grab) return;

      const point = stagePoint(event);

      moveTo(point.x - grab.x, point.y - grab.y);
    };

    const handlePointerEnd = () => {
      grabRef.current = null;
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      const direction = ARROW_DIRECTIONS.get(event.key);

      if (!direction) return;

      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
      const centre = currentCentre();

      event.preventDefault();
      moveTo(centre.x + direction.x * step, centre.y + direction.y * step);
    };

    const lensStyle: LensStyle = {
      '--lg-lens-margin': `${margin}px`,
      '--lg-lens-size': `${size}px`,
      '--lg-lens-stage-height': `${stage?.height ?? 0}px`,
      '--lg-lens-stage-width': `${stage?.width ?? 0}px`,
      '--lg-lens-zoom': `${zoom}`,
    };

    return (
      <div ref={ref} className={clsx('lg-lens-stage', className)} {...props}>
        {children}
        {stage ? (
          <div
            ref={lensRef}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            aria-label={label}
            aria-roledescription="magnifier"
            className="lg-lens"
            role="group"
            style={lensStyle}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onLostPointerCapture={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
          >
            {filterElement}
            <div aria-hidden className="lg-lens-view" inert style={{ filter: filterStyle }}>
              <div className="lg-lens-scene">{children}</div>
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);

GlassLens.displayName = 'GlassLens';
