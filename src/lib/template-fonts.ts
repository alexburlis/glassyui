import localFont from 'next/font/local';
import type { FreeTemplateSlug } from './templates';

/*
  The free templates' own faces, served from this site rather than a font service. Each fills the
  CSS variable its template reads; an installed template falls back to system fonts until its
  owner sets the variable. Instrument Sans and Instrument Serif (src/fonts/OFL.txt), Fraunces and
  Literata (src/fonts/OFL-fraunces-literata.txt), Cormorant Garamond
  (src/fonts/OFL-cormorant-garamond.txt) and Karla (src/fonts/OFL-karla.txt) are under the SIL
  Open Font License.

  None is preloaded: one preview route serves every template, so a preload would make each
  preview fetch every template's faces. A page fetches only the faces its styles draw.
*/

const instrumentSerif = localFont({
  src: [
    { path: '../fonts/instrument-serif.woff2', style: 'normal', weight: '400' },
    { path: '../fonts/instrument-serif-italic.woff2', style: 'italic', weight: '400' },
  ],
  variable: '--halcyon-serif',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

const instrumentSans = localFont({
  src: '../fonts/instrument-sans.woff2',
  weight: '400 700',
  variable: '--halcyon-sans',
  display: 'swap',
  preload: false,
});

const fraunces = localFont({
  src: [
    { path: '../fonts/fraunces.woff2', style: 'normal', weight: '100 900' },
    { path: '../fonts/fraunces-italic.woff2', style: 'italic', weight: '100 900' },
  ],
  variable: '--fieldnotes-display',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

const literata = localFont({
  src: [
    { path: '../fonts/literata.woff2', style: 'normal', weight: '400 900' },
    { path: '../fonts/literata-italic.woff2', style: 'italic', weight: '400 900' },
  ],
  variable: '--fieldnotes-serif',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

const cormorantGaramond = localFont({
  src: [
    { path: '../fonts/cormorant-garamond.woff2', style: 'normal', weight: '300 700' },
    { path: '../fonts/cormorant-garamond-italic.woff2', style: 'italic', weight: '300 700' },
  ],
  variable: '--still-serif',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

const karla = localFont({
  src: '../fonts/karla.woff2',
  weight: '400 700',
  variable: '--still-sans',
  display: 'swap',
  preload: false,
});

/**
 * A template's font variables, by template, as declarations for the document root: its sheets
 * and toasts render outside the template, at the end of the body, and read them there too.
 */
export const TEMPLATE_FONTS: Partial<Record<FreeTemplateSlug, string>> = {
  halcyon: `--halcyon-serif: ${instrumentSerif.style.fontFamily}; --halcyon-sans: ${instrumentSans.style.fontFamily};`,
  fieldnotes: `--fieldnotes-display: ${fraunces.style.fontFamily}; --fieldnotes-serif: ${literata.style.fontFamily};`,
  still: `--still-serif: ${cormorantGaramond.style.fontFamily}; --still-sans: ${karla.style.fontFamily};`,
};
