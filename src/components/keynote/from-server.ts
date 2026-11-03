import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * Whether this render belongs to the page's own HTML: true on the server and while the browser
 * hydrates it, false when the page renders in the browser after a navigation within the site.
 * An inline script runs only in the first case; React adds one rendered later without running it
 * and warns, so the keynote leaves its scripts out then and sets itself up from its effects.
 */
export function useFromServer() {
  return useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
}
