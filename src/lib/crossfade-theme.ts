import { flushSync } from 'react-dom';

function motionReduced() {
  return (
    document.documentElement.getAttribute('data-lg-reduce-motion') === '1' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Changes the theme through a crossfade where the browser has view transitions, and at once under
 * reduced motion or without them. The preference provider still makes the change: it writes the
 * document attribute before React renders, so flushing the update inside the transition gives the
 * browser the finished new page to fade to.
 */
export function crossfadeTheme(apply: () => void) {
  if (motionReduced() || !('startViewTransition' in document)) {
    apply();

    return;
  }

  document.startViewTransition(() => flushSync(apply));
}
