'use client';

import { useEffect, useState, type RefObject } from 'react';
import { topWithin } from './hero-art';

type FooterArt = { width: number; height: number; horizon: number; sun: number; accent: string };

/**
 * Rests the footer's horizon on the countdown, two thirds of the way down its slab, and measures
 * the sunrise behind it. The scene carries --halcyon-footer-horizon.
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

      scene.style.setProperty('--halcyon-footer-horizon', `${horizon}px`);
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

/**
 * The sunrise the countdown's glass refracts: the footer's CSS dawn with its sun fully risen,
 * drawn at the scene's real size.
 */
export function footerBackdrop(art: FooterArt | null) {
  if (!art) return undefined;

  const { width, height, horizon, sun } = art;

  const accent = art.accent
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');

  const sea = height - horizon;
  const radius = sun / 2;
  // A circle gradient reaches the corners of the sun's square box, as in CSS.
  const reach = radius * Math.SQRT2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#0e1424"/><stop offset=".56" stop-color="#131a33"/><stop offset="1" stop-color="#2a2a49"/></linearGradient>
      <radialGradient id="sky-aqua" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.7} ${horizon * 0.6})"><stop stop-color="${accent}" stop-opacity=".12"/><stop offset=".74" stop-color="${accent}" stop-opacity="0"/></radialGradient>
      <radialGradient id="sky-peach" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.44} ${horizon * 0.64})"><stop stop-color="#ffb38a" stop-opacity=".34"/><stop offset=".46" stop-color="#ffb38a" stop-opacity=".1"/><stop offset=".76" stop-color="#ffb38a" stop-opacity="0"/></radialGradient>
      <radialGradient id="sun" gradientUnits="userSpaceOnUse" cx="${width / 2}" cy="${horizon}" r="${reach.toFixed(1)}"><stop stop-color="#ffdcc8" stop-opacity=".92"/><stop offset=".26" stop-color="#ffc4a3" stop-opacity=".62"/><stop offset=".44" stop-color="#ffb38a" stop-opacity=".26"/><stop offset=".58" stop-color="#ffb38a" stop-opacity=".08"/><stop offset=".7" stop-color="#ffb38a" stop-opacity="0"/></radialGradient>
      <linearGradient id="sea" x2="0" y2="1"><stop stop-color="#1e2342"/><stop offset=".44" stop-color="#10172b"/><stop offset="1" stop-color="#0b1120"/></linearGradient>
      <radialGradient id="sea-peach" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.3} ${sea * 0.34})"><stop stop-color="#ffb38a" stop-opacity=".24"/><stop offset=".72" stop-color="#ffb38a" stop-opacity="0"/></radialGradient>
      <radialGradient id="sea-fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${width / 2} ${horizon}) scale(${width * 0.44} ${sea * 0.6})"><stop offset=".1" stop-color="white"/><stop offset=".8" stop-color="white" stop-opacity="0"/></radialGradient>
      <pattern id="sea-lines" width="${width}" height="7" y="${horizon}" patternUnits="userSpaceOnUse"><rect width="${width}" height="1" fill="#ffe2d2" fill-opacity=".08"/></pattern>
      <mask id="sea-mask" maskUnits="userSpaceOnUse"><rect width="${width}" height="${height}" fill="url(#sea-fade)"/></mask>
      <linearGradient id="horizon"><stop stop-color="#ffcdb4" stop-opacity="0"/><stop offset=".24" stop-color="#ffcdb4" stop-opacity=".55"/><stop offset=".5" stop-color="#fff2ea" stop-opacity=".95"/><stop offset=".76" stop-color="#ffcdb4" stop-opacity=".55"/><stop offset="1" stop-color="#ffcdb4" stop-opacity="0"/></linearGradient>
      <filter id="horizon-glow" x="-10%" y="-1000%" width="120%" height="2100%"><feGaussianBlur stdDeviation="10"/></filter>
    </defs>
    <rect width="${width}" height="${horizon}" fill="url(#sky)"/>
    <rect width="${width}" height="${horizon}" fill="url(#sky-aqua)"/>
    <rect width="${width}" height="${horizon}" fill="url(#sky-peach)"/>
    <circle cx="${width / 2}" cy="${horizon}" r="${radius}" fill="url(#sun)"/>
    <rect y="${horizon}" width="${width}" height="${sea}" fill="url(#sea)"/>
    <rect y="${horizon}" width="${width}" height="${sea}" fill="url(#sea-peach)"/>
    <rect y="${horizon}" width="${width}" height="${sea}" fill="url(#sea-lines)" mask="url(#sea-mask)"/>
    <rect y="${horizon - 3}" width="${width}" height="7" fill="#ffb38a" fill-opacity=".28" filter="url(#horizon-glow)"/>
    <rect y="${horizon}" width="${width}" height="1" fill="url(#horizon)"/>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The same sunrise in CSS, shown until the scene's glass draws and wherever it cannot. */
export function FooterArt() {
  return (
    <div aria-hidden className="halcyon-footer-art">
      <div className="halcyon-footer-sky" />
      <div className="halcyon-footer-sea" />
      <div className="halcyon-footer-horizon" />
    </div>
  );
}
