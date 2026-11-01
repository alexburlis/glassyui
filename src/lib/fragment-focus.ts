// A client-side navigation lands once its page has loaded. A link that never leads there, such as
// one a demo stops, is given up after this long.
const LANDING_TIMEOUT = 10_000;

let latest = 0;

/**
 * Moves the keyboard's place to an in-page target, as the browser does when it follows a fragment
 * link itself, so the next Tab goes on from there. A target that cannot take focus, such as a
 * section, takes it without a ring until it loses it again.
 */
export function focusFragmentTarget(target: HTMLElement) {
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.setAttribute('data-fragment-target', '');
    target.addEventListener(
      'blur',
      () => {
        target.removeAttribute('tabindex');
        target.removeAttribute('data-fragment-target');
      },
      { once: true },
    );
  }

  target.focus({ preventScroll: true });
}

/**
 * The router scrolls to a fragment once a client-side navigation lands, but leaves focus where it
 * was: on the link, on a menu that took it back, or nowhere on a new page. Focus waits for the
 * landing, by when a menu or dialog that closed as the navigation began has handed it back.
 */
export function focusFragmentAfterNavigation(href: string) {
  const url = new URL(href, window.location.href);
  const id = decodeURIComponent(url.hash.slice(1));

  if (!id || url.origin !== window.location.origin) return;

  const navigation = ++latest;
  const deadline = performance.now() + LANDING_TIMEOUT;

  const land = () => {
    if (navigation !== latest) return;

    const target = window.location.href === url.href ? document.getElementById(id) : null;

    if (target) focusFragmentTarget(target);
    else if (performance.now() < deadline) requestAnimationFrame(land);
  };

  requestAnimationFrame(land);
}
