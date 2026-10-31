import localFont from 'next/font/local';
import type { FreeTemplateSlug } from './templates';

/*
  The free templates' own faces, served from this site rather than a font service. Each fills the
  CSS variable its template reads; an installed template falls back to system fonts until its
  owner sets the variable. Instrument Sans and Instrument Serif are under the SIL Open Font
  License (src/fonts/OFL.txt).
*/

const instrumentSerif = localFont({
  src: [
    { path: '../fonts/instrument-serif.woff2', style: 'normal', weight: '400' },
    { path: '../fonts/instrument-serif-italic.woff2', style: 'italic', weight: '400' },
  ],
  variable: '--halcyon-serif',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

const instrumentSans = localFont({
  src: '../fonts/instrument-sans.woff2',
  weight: '400 700',
  variable: '--halcyon-sans',
  display: 'swap',
});

/**
 * A template's font variables, by template, as declarations for the document root: its sheets
 * and toasts render outside the template, at the end of the body, and read them there too.
 */
export const TEMPLATE_FONTS: Partial<Record<FreeTemplateSlug, string>> = {
  halcyon: `--halcyon-serif: ${instrumentSerif.style.fontFamily}; --halcyon-sans: ${instrumentSans.style.fontFamily};`,
};
