'use client';

/*
 * The shadcn/ui components distributed with this engine use the following license:
 *
 * MIT License
 *
 * Copyright (c) 2023 shadcn
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';
import { buildLensMapDataUrl, clamp, MAX_LENS_SURFACE_AREA } from './lib/refraction-map';
import type { LensMapMetrics, LensRadii } from './lib/refraction-map';
import { useGlassScenePane } from './lib/scene-context';

// A pane's or slab's glass is its ::after, the padding box. A float's and the tabs track's is
// the element itself, so a float keeps its glass while it fades, and its lens covers the
// border box.
export type GlassyEngineKind = 'pane' | 'slab' | 'float' | 'track';

type Lens = {
  blur: number;
  bodyBrightness: number;
  dispersion: number;
  host: HTMLElement;
  href: string;
  metrics: LensMapMetrics;
  rimBrightness: number;
  saturation: number;
};

// The components' lens rules (useLensFilter in lib/use-refraction-filter.tsx): a rim as wide as
// the corners are round, up to 36 px, glass 1.4 times as thick as its rim, and at least half a
// pixel of frost, so bent edges never stair-step.
const LENS_BEVEL = 36;

const LENS_THICKNESS_RATIO = 1.4;

const MIN_FROST = 0.5;

// Only Chromium draws an SVG filter in backdrop-filter, and only Chromium has userAgentData.
function supportsLens() {
  return (
    typeof navigator !== 'undefined' &&
    'userAgentData' in navigator &&
    typeof ResizeObserver !== 'undefined'
  );
}

function readNumber(style: CSSStyleDeclaration, name: string, fallback = 0) {
  const value = Number.parseFloat(style.getPropertyValue(name));

  return Number.isFinite(value) ? value : fallback;
}

function readRadius(value: string, width: number, height: number) {
  const [first] = value.trim().split(/\s+/);
  const largest = Math.min(width, height) / 2;
  const parsed = Number.parseFloat(first);

  if (first.endsWith('%')) return clamp((parsed / 100) * Math.min(width, height), 0, largest);

  return clamp(Number.isFinite(parsed) ? parsed : largest, 0, largest);
}

// Measures the box the glass fills and reads the --lg-lens-* tokens the theme sets on the
// element, as the components do. Layout sizes, so a float's zoom-in never shrinks its map.
function measureLens(host: HTMLElement, borderBox: boolean): Lens | null {
  const width = borderBox ? host.offsetWidth : host.clientWidth;
  const height = borderBox ? host.offsetHeight : host.clientHeight;
  const style = getComputedStyle(host);
  const depth = readNumber(style, '--lg-lens-depth');

  if (depth <= 0 || !width || !height || width * height > MAX_LENS_SURFACE_AREA) return null;

  const radii: LensRadii = [
    readRadius(style.borderTopLeftRadius, width, height),
    readRadius(style.borderTopRightRadius, width, height),
    readRadius(style.borderBottomRightRadius, width, height),
    readRadius(style.borderBottomLeftRadius, width, height),
  ];

  const multiplier = clamp(readNumber(style, '--lg-glass-thickness', 1), 0.1, 4);
  const bevelToken = readNumber(style, '--lg-lens-bevel');
  const thicknessToken = readNumber(style, '--lg-lens-thickness');
  const baseBevel = bevelToken > 0 ? bevelToken : clamp(Math.max(...radii), 6, LENS_BEVEL);

  const { href, metrics } = buildLensMapDataUrl({
    bevel: clamp(baseBevel * (0.6 + 0.4 * multiplier), 4, Math.min(width, height) / 2),
    depth,
    devicePixelRatio: window.devicePixelRatio || 1,
    height,
    ior: Math.max(1, readNumber(style, '--lg-lens-ior', 1.5)),
    radii,
    thickness:
      (thicknessToken > 0 ? thicknessToken : baseBevel * LENS_THICKNESS_RATIO) * multiplier,
    width,
  });

  return {
    blur: Math.max(0, readNumber(style, '--lg-lens-blur')),
    bodyBrightness: clamp(readNumber(style, '--lg-lens-body-brightness', 1), 0, 1),
    dispersion: clamp(readNumber(style, '--lg-lens-dispersion') * multiplier, 0, 1),
    host,
    href,
    metrics,
    rimBrightness: clamp(readNumber(style, '--lg-lens-rim-brightness', 1), 0, 1),
    saturation: readNumber(style, '--lg-lens-saturation') || 1,
  };
}

function sameLens(previous: Lens | null, next: Lens | null) {
  return (
    previous === next ||
    (previous !== null &&
      next !== null &&
      previous.host === next.host &&
      previous.href === next.href &&
      previous.blur === next.blur &&
      previous.bodyBrightness === next.bodyBrightness &&
      previous.dispersion === next.dispersion &&
      previous.rimBrightness === next.rimBrightness &&
      previous.saturation === next.saturation)
  );
}

// Measures the host when it mounts, resizes or the signature changes.
function useMeasuredLens(host: HTMLElement | null, signature: string, borderBox: boolean) {
  const [lens, setLens] = useState<Lens | null>(null);

  useEffect(() => {
    if (!host || !supportsLens()) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const next = measureLens(host, borderBox);
      setLens((previous) => (sameLens(previous, next) ? previous : next));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(host, { box: borderBox ? 'border-box' : 'content-box' });
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [borderBox, host, signature]);

  return lens?.host === host ? lens : null;
}

/**
 * The components' lens for one measured element: the page frosted, then read through a map of
 * the rim drawn for the element's own size and corners (buildLensMapDataUrl). Where the theme
 * splits the page into colour, red and cyan bend apart and screen back together, as the
 * components blend their three colours; a third colour made scrolling a dashboard of ten
 * cards in Chrome miss more than a third of its frames, and so did restoring the page's alpha
 * after an opaque sum.
 */
function LensFilter({ id, lens }: { id: string; lens: Lens }) {
  const frost = Math.max(lens.blur, MIN_FROST);
  const padding = Math.ceil(frost * 3) + 2;
  // The map holds a unit offset; the scale turns it into CSS pixels.
  const scale = Math.round(2 * lens.metrics.reach * 100) / 100;

  const bend = (input: string, factor: number, result: string) => (
    <feDisplacementMap
      in={input}
      in2="lens"
      scale={Math.round(scale * factor * 100) / 100}
      xChannelSelector="R"
      yChannelSelector="G"
      result={result}
    />
  );

  const channel = (name: string, matrix: string, factor: number) => (
    <>
      <feColorMatrix in="frost" type="matrix" values={matrix} result={`${name}-only`} />
      {bend(`${name}-only`, factor, `${name}-bent`)}
    </>
  );

  // Dark slabs dim the page, less at their rim, as the components' do. A primitive is added
  // only where it changes something: each one is another pass on the GPU.
  const dim = (brightness: number, result: string) =>
    brightness < 1 ? (
      <feComponentTransfer in="bent" result={result}>
        <feFuncR type="linear" slope={brightness} />
        <feFuncG type="linear" slope={brightness} />
        <feFuncB type="linear" slope={brightness} />
      </feComponentTransfer>
    ) : null;

  const shaded = lens.rimBrightness !== lens.bodyBrightness;
  const rimSource = lens.rimBrightness < 1 ? 'rim-lit' : 'bent';
  const topSource = lens.bodyBrightness < 1 ? 'top-lit' : 'bent';

  return (
    <svg aria-hidden="true" className="lg-refraction-filter" focusable="false" viewBox="0 0 0 0">
      <defs>
        <filter
          id={id}
          x={-padding}
          y={-padding}
          width={lens.metrics.width + padding * 2}
          height={lens.metrics.height + padding * 2}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={frost} result="frost" />
          <feImage
            href={lens.href}
            x={0}
            y={0}
            width={lens.metrics.width}
            height={lens.metrics.height}
            preserveAspectRatio="none"
            result="lens"
          />
          {lens.dispersion > 0.005 ? (
            <>
              {channel('red', '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', 1 - lens.dispersion / 2)}
              {channel('cyan', '0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0', 1 + lens.dispersion / 4)}
              <feBlend in="red-bent" in2="cyan-bent" mode="screen" result="bent" />
            </>
          ) : (
            bend('frost', 1, 'bent')
          )}
          {shaded ? (
            <>
              {/* The map's blue channel is the rim, which weights its light over the top's. */}
              <feColorMatrix
                in="lens"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0"
                result="rim"
              />
              {dim(lens.rimBrightness, 'rim-lit')}
              {dim(lens.bodyBrightness, 'top-lit')}
              <feComposite in={rimSource} in2="rim" operator="in" result="rim-glass" />
              <feComposite in="rim-glass" in2={topSource} operator="over" result="glass" />
            </>
          ) : (
            dim(lens.bodyBrightness, 'top-lit')
          )}
          {lens.saturation === 1 ? null : (
            <feColorMatrix
              in={shaded ? 'glass' : topSource}
              type="saturate"
              values={String(lens.saturation)}
            />
          )}
        </filter>
      </defs>
    </svg>
  );
}

// shadcn/ui apps switch between light and dark with a class, data-theme or color-scheme on
// <html>, which changes the tokens the lens reads, so the engine measures again then.
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style'],
  });

  return () => observer.disconnect();
}

function readTheme() {
  const root = document.documentElement;

  return `${root.className}|${root.dataset.theme ?? ''}|${root.style.colorScheme}`;
}

const serverTheme = () => '';

/**
 * Runs Glassy UI's engine on one element of a shadcn/ui component. In Chromium it measures
 * the element and gives its glass the components' own lens: a map drawn for its exact size
 * and corners, which the theme's CSS can only approximate, measured again whenever the
 * element resizes or the page changes theme. The engine marks the element
 * data-glassy-engine and names the filter in --glassy-measured-lens; the filter itself
 * lives in document.body, so the component's own markup stays exactly as shadcn/ui wrote
 * it. Inside a GlassScene the element is handed to the scene, which draws it as thick
 * glass. Elsewhere nothing changes and the theme's CSS glass stays in charge.
 *
 * Returns the portal to render beside the element.
 */
export function useGlassyEngine(host: HTMLElement | null, kind: GlassyEngineKind): ReactNode {
  const id = `lg-lens-${useId().replaceAll(':', '')}`;
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, serverTheme);
  const lens = useMeasuredLens(host, `${kind}|${theme}`, kind === 'float' || kind === 'track');
  const hostRef = useRef<HTMLElement | null>(null);
  const active = lens !== null;

  useLayoutEffect(() => {
    hostRef.current = host;
  }, [host]);

  useGlassScenePane(hostRef, host !== null);

  useLayoutEffect(() => {
    const element = hostRef.current;

    if (!element || !active) return;

    element.dataset.glassyEngine = kind;
    element.style.setProperty('--glassy-measured-lens', `url(#${id})`);

    return () => {
      delete element.dataset.glassyEngine;
      element.style.removeProperty('--glassy-measured-lens');
    };
  }, [active, host, id, kind]);

  return lens ? createPortal(<LensFilter id={id} lens={lens} />, document.body) : null;
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (ref instanceof Function) ref(node);
  else if (ref) ref.current = node;
}

// One stable callback ref that keeps the engine's element and the caller's ref in step.
export function useHostRef<T extends HTMLElement>(ref: Ref<T> | undefined) {
  const [host, setHost] = useState<T | null>(null);

  const attach = useCallback(
    (node: T | null) => {
      setHost(node);
      assignRef(ref, node);
    },
    [ref],
  );

  return [host, attach] as const;
}

/**
 * The engine for an element a drop-in renders itself: the ref to give the element, which also
 * reaches the caller's ref, and the filter to render anywhere inside the component.
 */
export function useGlassy<T extends HTMLElement>(ref: Ref<T> | undefined, kind: GlassyEngineKind) {
  const [host, attach] = useHostRef(ref);
  const glass = useGlassyEngine(host, kind);

  return [attach, glass] as const;
}

/** The root of a card or an alert: shadcn/ui's div, with the engine. */
export function GlassyPane({ ref, ...props }: ComponentProps<'div'>) {
  const [attach, glass] = useGlassy(ref, 'pane');

  return (
    <>
      <div ref={attach} {...props} />
      {glass}
    </>
  );
}
