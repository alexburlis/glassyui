'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

const CARDS = '.template-card, .template-pro-tile';

/**
 * The gallery under a mouse or pen: the template it points at turns a little toward it and its
 * glass catches the light there, like a pane held up and tilted in the hand. The pointer's place
 * over the card's window, from 0 to 1 each way, goes to the CSS as --pointer-x and --pointer-y,
 * which owns the look and holds still under reduced motion.
 */
export function TemplatePointer({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const gallery = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = gallery.current;

    if (!root) return;

    let card: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    const release = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      card?.removeAttribute('data-pointer');
      card?.style.removeProperty('--pointer-x');
      card?.style.removeProperty('--pointer-y');
      card = null;
    };

    const draw = () => {
      frame = 0;

      if (!card) return;

      const target = card.querySelector('.template-window, .template-pro-fan') ?? card;
      const box = target.getBoundingClientRect();

      card.style.setProperty('--pointer-x', ((x - box.left) / box.width).toFixed(3));
      card.style.setProperty('--pointer-y', ((y - box.top) / box.height).toFixed(3));
      card.setAttribute('data-pointer', '');
    };

    const move = (event: PointerEvent) => {
      // A finger has no hover to answer, and its tap opens the template anyway.
      if (event.pointerType === 'touch') return;

      const next =
        event.target instanceof Element ? event.target.closest<HTMLElement>(CARDS) : null;

      if (next !== card) release();

      card = next;
      x = event.clientX;
      y = event.clientY;

      if (card && !frame) frame = requestAnimationFrame(draw);
    };

    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', release);

    return () => {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', release);
      release();
    };
  }, []);

  return (
    <div className={className} ref={gallery}>
      {children}
    </div>
  );
}
