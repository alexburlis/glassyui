import { Easing, interpolate } from 'remotion';
import type { EasingFunction } from 'remotion';
import { OPENER, TURN } from './frames';

// The keynote's curves, and the page's own moves on the compositions' frames: the real hero and
// desk follow the same frame numbers as the stage drawn over them.
/** --lg-ease-out: arrivals. */
export const EASE_OUT = Easing.bezier(0.32, 0.72, 0, 1);

/** Departures. */
export const EASE_IN = Easing.bezier(0.55, 0, 0.75, 0.25);

/** A complete move, from rest to rest. */
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Interpolates between keyframes, held at both ends. */
export function tween(
  frame: number,
  frames: readonly number[],
  values: readonly number[],
  easing: EasingFunction = EASE_IN_OUT,
) {
  return interpolate(frame, frames, values, {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** How far the header has slid back in: 0 to 1. */
export const openerHeader = (frame: number) => tween(frame, OPENER.header, [0, 1], EASE_OUT);

/** The caption under the live desk, fading as the desk lifts. */
export const turnCaption = (frame: number) => tween(frame, TURN.caption, [1, 0], EASE_OUT);
