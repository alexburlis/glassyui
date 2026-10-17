import type { ReactNode } from 'react';
import { ScreenReflection } from './screen-reflection';

// The phone at the end of the keynote's turn, drawn to a 6.3-inch model's proportions in
// millimetres. Its solid body is the WebGL model in phone-model.tsx; this is its front as the page
// draws it over that body: the thin black border under the glass and the live screen.
const BODY = { depth: 8.25, height: 149.6, width: 71.5 } as const;

export const PHONE_ASPECT = BODY.width / BODY.height;

export const PHONE_DEPTH = BODY.depth / BODY.width;

/** The body's corner radius, as a share of its width. */
export const PHONE_CORNER = 0.165;

// The front, as shares of the body's width: the rim of the body seen around the glass, then the
// black border under the glass.
const EDGE = 0.011;

const BORDER = 0.023;

/** How far in from the body's edge the screen starts. */
export const screenInset = (width: number) => width * (EDGE + BORDER);

type Vector = readonly [number, number, number];

/** The slab's turn, in degrees, as its transform composes them: rotateX, rotateZ, then rotateY. */
type Pose = { x: number; y: number; z: number };

type Finish = 'dark' | 'light';

export type PhoneBody = {
  /** Thickness, in the slab's pixels. */
  depth: number;
  /** Where the viewer's eye is, from the slab's centre, in stage pixels. */
  eye: Vector;
  /**
   * How much the band is still the desk's glass edge rather than metal, 0 to 1: while the slab
   * is the desk its edge catches the light as the screen's glass does, and turns to metal as the
   * slab takes the phone's shape.
   */
  glass: number;
  height: number;
  pose: Pose;
  radius: number;
  /** The slab's scale, which carries its points toward or away from the eye. */
  scale: number;
  /** The phone's metal: black (`dark`) or silver (`light`). */
  titanium: Finish;
  width: number;
};

type PhoneFrontProps = {
  body: PhoneBody;
  children: ReactNode;
  visible: boolean;
};

/** The phone's front at any size: the black border and the screen, inside the body's rim. */
export function PhoneFront({ body, children, visible }: PhoneFrontProps) {
  const edge = body.width * EDGE;
  const inset = screenInset(body.width);

  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: body.radius }}>
      <div
        style={{
          position: 'absolute',
          inset: edge,
          borderRadius: body.radius - edge,
          background: '#020203',
          boxShadow: `inset 0 0 0 ${Math.max(0.5, edge * 0.18).toFixed(2)}px rgb(0 0 0 / 0.9), inset 0 0 ${(edge * 1.6).toFixed(2)}px rgb(255 255 255 / 0.05)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset,
          overflow: 'hidden',
          borderRadius: Math.max(body.radius - inset, 0),
          background: '#000',
        }}
      >
        {children}
      </div>
      <ScreenReflection body={body} face="phone" inset={edge} visible={visible} />
    </div>
  );
}
