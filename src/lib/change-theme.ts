import { flushSync } from 'react-dom';

/** Commits the document and React theme together, without per-surface colour transitions. */
export function changeTheme(apply: () => void) {
  const root = document.documentElement;

  root.setAttribute('data-site-theme-changing', '');

  try {
    flushSync(apply);
    // Resolve the new colours while transitions are disabled, before restoring hover motion.
    getComputedStyle(root).getPropertyValue('color');
  } finally {
    root.removeAttribute('data-site-theme-changing');
  }
}
