// Coalesce scroll input into one update per display frame. Follow the latest position directly:
// easing toward it makes a fast scroll leave the composition behind and keeps drawing afterward.
// Fractional frames still let a trackpad move the composition continuously.

type Scrubber = {
  /** Draws the latest frame on the next display frame, or immediately when jumping. */
  set: (frame: number, jump?: boolean) => void;
  stop: () => void;
};

export function createScrubber(onFrame: (frame: number) => void): Scrubber {
  let current = Number.NaN;
  let target = 0;
  let request = 0;

  const emit = () => onFrame(current);

  const tick = () => {
    request = 0;

    if (current === target) return;
    current = target;
    emit();
  };

  return {
    set(frame, jump = false) {
      target = frame;

      if (jump || Number.isNaN(current)) {
        cancelAnimationFrame(request);
        request = 0;
        current = frame;
        emit();

        return;
      }

      if (!request && current !== target) request = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(request);
      request = 0;
    },
  };
}

/** Whether the visitor or their system asked for less motion. */
export function motionReduced() {
  return (
    document.documentElement.getAttribute('data-lg-reduce-motion') === '1' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
