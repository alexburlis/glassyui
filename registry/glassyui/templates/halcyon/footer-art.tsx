'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { GlassSceneBackdropPainter } from '../../glass-scene';
import { motionReduced } from '../../lib/liquid-motion';
import {
  decodeLayers,
  paintNight,
  rasterCache,
  svgAttribute,
  svgLayer,
  topWithin,
} from './hero-art';

type FooterArt = { width: number; height: number; horizon: number; sun: number; accent: string };

/**
 * Rests the footer's horizon on the countdown, two thirds of the way down its slab, and measures
 * the sunrise behind it.
 */
export function useFooterArt(sceneRef: RefObject<HTMLElement | null>) {
  const [art, setArt] = useState<FooterArt | null>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const countdown = scene?.querySelector<HTMLElement>('.halcyon-countdown');

    if (!scene || !countdown) return;

    let frame = 0;

    const layout = () => {
      const width = scene.clientWidth;
      const height = scene.clientHeight;
      const horizon = Math.round(topWithin(countdown, scene) + countdown.offsetHeight * 0.64);
      const style = getComputedStyle(scene);
      const sun = parseFloat(style.getPropertyValue('--halcyon-sun')) || 420;
      const accent = style.getPropertyValue('--hc-accent').trim();

      setArt((drawn) =>
        drawn &&
        drawn.width === width &&
        drawn.height === height &&
        drawn.horizon === horizon &&
        drawn.sun === sun &&
        drawn.accent === accent
          ? drawn
          : { width, height, horizon, sun, accent },
      );
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    });

    observer.observe(scene);
    layout();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [sceneRef]);

  return art;
}

// The horizon's line and glow, in a strip this far above and below it.
const STRIP = 40;

/** The footer's dawn in layers; the sun between the sky and the sea is drawn as it rises. */
function footerLayers(art: FooterArt) {
  const { width, height, horizon } = art;
  const accent = svgAttribute(art.accent);
  const sea = height - horizon;

  return {
    sky: svgLayer(
      width,
      horizon,
      `<linearGradient id="sky" x2="0" y2="1"><stop stop-color="#0e1424"/><stop offset=".56" stop-color="#131a33"/><stop offset="1" stop-color="#2a2a49"/></linearGradient><radialGradient id="sky-aqua" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.7} ${horizon * 0.6})"><stop stop-color="${accent}" stop-opacity=".12"/><stop offset=".74" stop-color="${accent}" stop-opacity="0"/></radialGradient><radialGradient id="sky-peach" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.44} ${horizon * 0.64})"><stop stop-color="#ffb38a" stop-opacity=".34"/><stop offset=".46" stop-color="#ffb38a" stop-opacity=".1"/><stop offset=".76" stop-color="#ffb38a" stop-opacity="0"/></radialGradient>`,
      `<rect width="${width}" height="${horizon}" fill="url(#sky)"/><rect width="${width}" height="${horizon}" fill="url(#sky-aqua)"/><rect width="${width}" height="${horizon}" fill="url(#sky-peach)"/>`,
    ),
    sea: svgLayer(
      width,
      sea,
      `<linearGradient id="sea" x2="0" y2="1"><stop stop-color="#1e2342"/><stop offset=".44" stop-color="#10172b"/><stop offset="1" stop-color="#0b1120"/></linearGradient><radialGradient id="sea-peach" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} 0) scale(${width * 0.3} ${sea * 0.34})"><stop stop-color="#ffb38a" stop-opacity=".24"/><stop offset=".72" stop-color="#ffb38a" stop-opacity="0"/></radialGradient><radialGradient id="sea-fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} 0) scale(${width * 0.44} ${sea * 0.6})"><stop offset=".1" stop-color="white"/><stop offset=".8" stop-color="white" stop-opacity="0"/></radialGradient><pattern id="sea-lines" width="${width}" height="7" patternUnits="userSpaceOnUse"><rect width="${width}" height="1" fill="#ffe2d2" fill-opacity=".08"/></pattern><mask id="sea-mask" maskUnits="userSpaceOnUse"><rect width="${width}" height="${sea}" fill="url(#sea-fade)"/></mask>`,
      `<rect width="${width}" height="${sea}" fill="url(#sea)"/><rect width="${width}" height="${sea}" fill="url(#sea-peach)"/><rect width="${width}" height="${sea}" fill="url(#sea-lines)" mask="url(#sea-mask)"/>`,
    ),
    horizon: svgLayer(
      width,
      STRIP * 2,
      `<linearGradient id="horizon"><stop stop-color="#ffcdb4" stop-opacity="0"/><stop offset=".24" stop-color="#ffcdb4" stop-opacity=".55"/><stop offset=".5" stop-color="#fff2ea" stop-opacity=".95"/><stop offset=".76" stop-color="#ffcdb4" stop-opacity=".55"/><stop offset="1" stop-color="#ffcdb4" stop-opacity="0"/></linearGradient><filter id="horizon-glow" x="-10%" y="-1000%" width="120%" height="2100%"><feGaussianBlur stdDeviation="10"/></filter>`,
      `<rect y="${STRIP - 3}" width="${width}" height="7" fill="#ffb38a" fill-opacity=".28" filter="url(#horizon-glow)"/><rect y="${STRIP}" width="${width}" height="1" fill="url(#horizon)"/>`,
    ),
  };
}

type Layers = Record<keyof ReturnType<typeof footerLayers>, HTMLImageElement>;

/**
 * Paints the footer's sunrise for the countdown's GlassScene. The sun climbs behind the glass as
 * the page reaches the footer, and stands risen under reduced motion. Returns false while the
 * page holds still, so the glass does not redraw.
 */
export function useFooterPainter(art: FooterArt | null): GlassSceneBackdropPainter {
  const [layers, setLayers] = useState<{ art: FooterArt; images: Layers } | null>(null);

  useEffect(() => {
    if (!art) return;

    let cancelled = false;

    void decodeLayers(footerLayers(art)).then((images) => {
      if (!cancelled) setLayers({ art, images });
    });

    return () => {
      cancelled = true;
    };
  }, [art]);

  return useMemo(() => {
    if (!layers) return paintNight();

    const { art: drawnArt, images } = layers;
    const raster = rasterCache(images);
    let painted = '';

    return (context, { width, height, density }) => {
      const box = context.canvas.getBoundingClientRect();

      const risen = motionReduced()
        ? 1
        : Math.min(Math.max((window.innerHeight - box.top) / (0.75 * box.height), 0), 1);

      const picture = `${width}x${height}@${density} ${risen.toFixed(3)}`;

      if (picture === painted) return false;

      painted = picture;

      const { horizon, sun } = drawnArt;
      const radius = sun / 2;
      const centre = drawnArt.width / 2;
      const rise = horizon + (1 - risen) * 0.34 * sun;

      const draw = (name: keyof Layers, top: number) =>
        context.drawImage(
          raster(name, density),
          0,
          top,
          images[name].naturalWidth,
          images[name].naturalHeight,
        );

      context.clearRect(0, 0, width, height);
      context.scale(width / drawnArt.width, height / drawnArt.height);
      draw('sky', 0);

      // A circle gradient reaches the corners of the sun's square box, as in CSS.
      const light = context.createRadialGradient(
        centre,
        rise,
        0,
        centre,
        rise,
        radius * Math.SQRT2,
      );

      light.addColorStop(0, 'rgba(255, 220, 200, 0.92)');
      light.addColorStop(0.26, 'rgba(255, 196, 163, 0.62)');
      light.addColorStop(0.44, 'rgba(255, 179, 138, 0.26)');
      light.addColorStop(0.58, 'rgba(255, 179, 138, 0.08)');
      light.addColorStop(0.7, 'rgba(255, 179, 138, 0)');
      context.fillStyle = light;
      context.beginPath();
      context.arc(centre, rise, radius, 0, Math.PI * 2);
      context.fill();
      draw('sea', horizon);
      draw('horizon', horizon - STRIP);
    };
  }, [layers]);
}
