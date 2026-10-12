import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { SCREEN, TURN_TITLE, turnFeatures } from './features';
import { TURN } from './frames';
import { PHONE_ASPECT, PHONE_CORNER, PHONE_DEPTH, PhoneFront, screenInset } from './phone';
import type { PhoneBody } from './phone';
import { BACK_ROUND, PhoneModel } from './phone-model';
import { PhoneScreen } from './phone-screen';
import { ScreenReflection } from './screen-reflection';
import { motionReduced } from './scrubber';
import { EASE_IN_OUT, EASE_OUT, tween } from './timeline';

const DISPLAY_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', Roboto, Inter, system-ui, sans-serif";

const TEXT_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', Roboto, Inter, system-ui, sans-serif";

/** The live desk's box in the stage before it lifts, in CSS pixels. */
export type DeskBox = { height: number; radius: number; width: number; x: number; y: number };

export type DeskFace = {
  frame: number;
  height: number;
  perspective: number;
  radius: number;
  scale: number;
  transform: string;
  visible: boolean;
  width: number;
};

export type TurnProps = {
  active: boolean;
  desk: DeskBox;
  /** The mounted desk face also carries its studio reflection. */
  deskFace: HTMLElement | null;
  /** Projects the mounted desk using the composition's own face geometry. */
  onDeskFrame: (face: DeskFace) => void;
  /** How many components the React Native registry has. */
  nativeCount: number;
  theme: 'dark' | 'light';
};

// The desk's glass edge in each appearance, as light as the screen it borders.
const DESK_EDGE: Record<'dark' | 'light', [number, number, number]> = {
  dark: [66 / 255, 66 / 255, 72 / 255],
  light: [244 / 255, 244 / 255, 246 / 255],
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

// A spring released from rest that overshoots the turn by about three per cent and settles
// within its frames. Closed form, so any fraction of a frame has its own exact angle.
function settle(progress: number) {
  const t = clamp(progress, 0, 1);
  const damping = 0.75;
  const frequency = 8;
  const damped = frequency * Math.sqrt(1 - damping * damping);
  const decay = Math.exp(-damping * frequency * t);

  return (
    1 - decay * (Math.cos(damped * t) + ((damping * frequency) / damped) * Math.sin(damped * t))
  );
}

/** How far the desk shrinks as it lifts. */
const liftedScale = (desk: DeskBox, width: number, height: number) =>
  Math.min(0.86, (height * 0.8) / desk.height, (width * 0.9) / desk.width);

function layout(width: number, height: number) {
  const wide = width >= 900;
  const titleSize = wide ? clamp(width * 0.032, 34, 54) : clamp(width * 0.085, 28, 40);
  const titleTop = clamp(height * 0.1, 84, 120);
  const titleBottom = titleTop + titleSize * 1.05 * 2;
  const featureSpace = wide ? 0 : clamp(height * 0.15, 96, 132);
  const phoneTop = titleBottom + (wide ? clamp(height * 0.04, 20, 40) : 22);
  const phoneHeight = clamp(height - phoneTop - featureSpace - (wide ? 44 : 28), 300, 780);
  const phoneWidth = phoneHeight * PHONE_ASPECT;

  return {
    phone: {
      height: phoneHeight,
      width: phoneWidth,
      x: (width - phoneWidth) / 2,
      y: phoneTop,
    },
    title: { size: titleSize, top: titleTop },
    wide,
  };
}

type Phone = ReturnType<typeof layout>['phone'];

/** Where the live screen sits in a phone of this size: it covers the glass, cropped evenly. */
function screenFit(width: number, height: number) {
  const inset = screenInset(width);
  const screenWidth = width - inset * 2;
  const screenHeight = height - inset * 2;
  const scale = Math.max(screenWidth / SCREEN.width, screenHeight / SCREEN.height);

  return {
    scale,
    x: (screenWidth - SCREEN.width * scale) / 2,
    y: (screenHeight - SCREEN.height * scale) / 2,
  };
}

/** A point on the live screen, in stage pixels. */
function screenPoint(phone: Phone, [x, y]: readonly [number, number]) {
  const inset = screenInset(phone.width);
  const fit = screenFit(phone.width, phone.height);

  return {
    x: phone.x + inset + fit.x + x * fit.scale,
    y: phone.y + inset + fit.y + y * fit.scale,
  };
}

// Once the phone has landed it leans a few degrees toward a mouse, so its band catches the light.
const TILT = { x: 4, y: 7 };

const TILT_RESPONSE = 0.12;

/**
 * The phone's lean toward the pointer while it rests, in degrees: x tips it and y turns it. Over the
 * phone it faces the pointer squarely, so its controls sit flat under a click; its resting box
 * decides that, so the lean never moves the edge under the pointer. Leaving rest, it eases upright.
 */
function usePointerTilt(active: boolean, phone: Phone) {
  const { height, width, x: left, y: top } = phone;
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const drawn = useRef(tilt);

  useEffect(() => {
    let current = drawn.current;
    let target = { x: 0, y: 0 };
    let request = 0;
    let last = 0;

    const tick = (now: number) => {
      const elapsed = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      const step = 1 - Math.exp(-elapsed / TILT_RESPONSE);

      const resting =
        Math.abs(target.x - current.x) < 0.01 && Math.abs(target.y - current.y) < 0.01;

      last = resting ? 0 : now;
      current = resting
        ? target
        : {
            x: current.x + (target.x - current.x) * step,
            y: current.y + (target.y - current.y) * step,
          };
      drawn.current = current;
      setTilt(current);
      request = resting ? 0 : requestAnimationFrame(tick);
    };

    const aim = (x: number, y: number) => {
      if (x === target.x && y === target.y && (request || current === target)) return;

      target = { x, y };

      if (!request) request = requestAnimationFrame(tick);
    };

    if (current.x !== 0 || current.y !== 0) aim(0, 0);

    if (!active || motionReduced() || !window.matchMedia('(hover: hover)').matches) {
      return () => cancelAnimationFrame(request);
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;

      const x = event.clientX - left;
      const y = event.clientY - top;

      if (x >= 0 && x <= width && y >= 0 && y <= height) {
        aim(0, 0);

        return;
      }

      const across = clamp((x - width / 2) / (window.innerWidth / 2), -1, 1);
      const down = clamp((y - height / 2) / (window.innerHeight / 2), -1, 1);

      aim(-down * TILT.x, across * TILT.y);
    };

    const onLeave = () => aim(0, 0);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(request);
    };
  }, [active, height, left, top, width]);

  return tilt;
}

/**
 * The second half of the home page's keynote: the desk lifts, turns over in one sweep and lands
 * as a phone running the same components, then features arrive from either side and point at the
 * parts of the screen they describe. Both screens stay live while their face is visible.
 */
export function Turn({ active, desk, deskFace, nativeCount, onDeskFrame, theme }: TurnProps) {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const { phone, title, wide } = layout(width, height);
  const lifted = liftedScale(desk, width, height);
  const ink = theme === 'light' ? '#222224' : '#f5f5f7';
  const quiet = theme === 'light' ? '#66666a' : '#a8a8af';
  const reflectionShown = tween(frame, TURN.glint, [0, 1], EASE_OUT);
  const tilt = usePointerTilt(active && frame >= TURN.title[0], phone);

  // The original desk stays mounted; the page projects it onto this face without changing
  // its layout. The composition supplies the band, reflection and opposite phone face.
  const handedOver = frame > 0;
  const liftScale = mix(1, lifted, tween(frame, TURN.lift, [0, 1], EASE_IN_OUT));
  const travel = tween(frame, [TURN.spin[0], TURN.spin[1] - 30], [0, 1], EASE_IN_OUT);
  const angle = 180 * settle((frame - TURN.spin[0]) / (TURN.spin[1] - TURN.spin[0]));
  // The slab takes the phone's shape while it is nearly edge-on, so neither face is seen
  // stretched or cropped by the change.
  const morph = tween(angle, [34, 116], [0, 1], EASE_IN_OUT);
  // At its sharpest angles the desk becomes the back of the phone it is turning into.
  const back = tween(angle, [56, 80], [0, 1], EASE_IN_OUT);
  const facing = angle >= 90;
  const arc = Math.sin(Math.PI * clamp(travel, 0, 1));

  // The lift is a scale on the compositor; only the morph, near edge-on, changes the slab's box.
  const startWidth = desk.width * lifted;
  const startHeight = desk.height * lifted;
  const lift = liftScale / lifted;
  const slabWidth = mix(startWidth, phone.width, morph);
  const slabHeight = mix(startHeight, phone.height, morph);
  const radius = mix(desk.radius * lifted, phone.width * PHONE_CORNER, morph);
  const centreX = mix(desk.x + desk.width / 2, phone.x + phone.width / 2, travel);
  const centreY = mix(desk.y + desk.height / 2, phone.y + phone.height / 2, travel);
  const depth = phone.width * PHONE_DEPTH * morph;
  const perspective = Math.max(width, height) * 2.2;

  const pose = useMemo(
    () => ({ x: arc * 9 + tilt.x, y: angle + tilt.y, z: arc * -5 }),
    [angle, arc, tilt.x, tilt.y],
  );

  // The desk lies on the flat of the back, inside the edge where the body rounds into its sides.
  const deskInset = depth * BACK_ROUND;
  const faceWidth = slabWidth - deskInset * 2;
  const faceHeight = slabHeight - deskInset * 2;
  const faceRadius = Math.max(radius - deskInset, 0);
  const deskScale = Math.max(faceWidth / desk.width, faceHeight / desk.height);
  const deskTransform = `translate3d(${centreX}px, ${centreY}px, ${arc * 160}px) rotateX(${pose.x}deg) rotateZ(${pose.z}deg) rotateY(${pose.y}deg) scale(${lift}) translate3d(${-faceWidth / 2}px, ${-faceHeight / 2}px, ${depth / 2}px)`;

  useLayoutEffect(() => {
    onDeskFrame({
      frame,
      perspective,
      height: faceHeight,
      radius: faceRadius,
      scale: deskScale,
      transform: deskTransform,
      visible: !facing,
      width: faceWidth,
    });
  }, [
    deskScale,
    deskTransform,
    faceHeight,
    faceRadius,
    faceWidth,
    facing,
    frame,
    onDeskFrame,
    perspective,
  ]);

  // Feature text keeps moving after the phone lands. Stable geometry lets the native shaders
  // keep their finished canvas rather than redraw the same body and reflections on every frame.
  const body = useMemo<PhoneBody>(
    () => ({
      depth,
      eye: [width / 2 - centreX, height / 2 - centreY, perspective - arc * 160],
      // The band has finished turning to metal by the time the desk has become the phone's back.
      glass: (1 - morph) ** 2 * (1 - back),
      height: slabHeight,
      pose,
      radius,
      scale: lift,
      // Black titanium on the light page and silver on the dark one, so the phone stands out.
      titanium: theme === 'light' ? 'dark' : 'light',
      width: slabWidth,
    }),
    [
      arc,
      back,
      centreX,
      centreY,
      depth,
      height,
      lift,
      morph,
      perspective,
      pose,
      radius,
      slabHeight,
      slabWidth,
      theme,
      width,
    ],
  );

  const reflectionBody = useMemo(
    () => ({ ...body, height: faceHeight, radius: faceRadius, width: faceWidth }),
    [body, faceHeight, faceRadius, faceWidth],
  );

  const modelStage = useMemo(() => ({ height, perspective, width }), [height, perspective, width]);

  const fit = screenFit(slabWidth, slabHeight);

  const face: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    overflow: 'hidden',
  };

  // The slab's shadow on the page tightens as it turns edge-on and settles with the phone.
  const footprint = Math.abs(Math.cos((angle * Math.PI) / 180)) * slabWidth + depth;
  const shadowOpacity = handedOver ? (theme === 'light' ? 0.22 : 0.5) * (0.6 + 0.4 * travel) : 0;

  const items = turnFeatures(nativeCount);
  const titleShown = tween(frame, TURN.title, [0, 1], EASE_OUT);

  return (
    <AbsoluteFill style={{ perspective }}>
      {deskFace
        ? createPortal(
            <ScreenReflection
              body={reflectionBody}
              face="desk"
              strength={active ? reflectionShown * (1 - back) : 0}
            />,
            deskFace,
          )
        : null}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: footprint * 1.1,
          height: 34,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgb(0 0 0 / ${shadowOpacity}), rgb(0 0 0 / 0))`,
          filter: 'blur(6px)',
          transform: `translate3d(${centreX - footprint * 0.55}px, ${centreY + (slabHeight * lift) / 2 - 6 + arc * 40}px, 0) scaleX(${1 - arc * 0.2})`,
        }}
      />
      <PhoneModel
        back={back}
        body={body}
        edge={DESK_EDGE[theme]}
        keys={tween(morph, [0.8, 1], [0, 1], (value) => value)}
        stage={modelStage}
        visible={active && handedOver}
      />
      <div
        data-slab=""
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: slabWidth,
          height: slabHeight,
          transformStyle: 'preserve-3d',
          transform: `translate3d(${centreX - slabWidth / 2}px, ${centreY - slabHeight / 2}px, ${arc * 160}px) rotateX(${pose.x}deg) rotateZ(${pose.z}deg) rotateY(${pose.y}deg) scale(${lift})`,
          visibility: handedOver ? 'visible' : 'hidden',
        }}
      >
        {/* Each face takes input while it is visible; its controls measure their local layout. */}
        <div
          style={{
            ...face,
            transform: `${facing ? 'rotateY(180deg) ' : ''}translateZ(${depth / 2}px)`,
            visibility: facing ? undefined : 'hidden',
          }}
        >
          <PhoneFront body={body}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transformOrigin: '0 0',
                transform: `translate(${fit.x.toFixed(2)}px, ${fit.y.toFixed(2)}px) scale(${fit.scale.toFixed(4)})`,
              }}
            >
              <PhoneScreen live={active && facing} theme={theme} />
            </div>
          </PhoneFront>
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: title.top,
          width,
          fontFamily: DISPLAY_FONT,
          fontSize: title.size,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          lineHeight: 1.05,
          opacity: titleShown,
          textAlign: 'center',
          transform: `translate3d(0, ${(1 - titleShown) * 18}px, 0)`,
          filter: titleShown < 0.995 ? `blur(${((1 - titleShown) * 10).toFixed(2)}px)` : undefined,
        }}
      >
        <div style={{ color: ink }}>{TURN_TITLE[0]}</div>
        <div style={{ color: quiet }}>{TURN_TITLE[1]}</div>
      </div>

      {items.map((item, index) => {
        const start = TURN.features[index];
        const shown = tween(frame, [start, start + TURN.featureLength], [0, 1], EASE_OUT);
        const line = tween(frame, [start + 8, start + TURN.featureLength + 10], [0, 1], EASE_OUT);

        // On a narrow screen one feature at a time sits under the phone.
        const next = TURN.features[index + 1];
        const gone = !wide && next ? tween(frame, [next, next + 24], [0, 1], EASE_OUT) : 0;

        if (shown <= 0 || gone >= 1) return null;

        const point = screenPoint(phone, item.target);
        const left = item.side === 'left';
        const gap = clamp(width * 0.045, 40, 72);
        const column = clamp(width * 0.22, 220, 300);
        const slide = (1 - shown) * 56 * (left ? -1 : 1);

        const textStyle: CSSProperties = wide
          ? {
              left: left ? phone.x - gap - column : phone.x + phone.width + gap,
              top: point.y - 26,
              width: column,
              textAlign: left ? 'right' : 'left',
            }
          : {
              left: 24,
              top: phone.y + phone.height + 22,
              width: width - 48,
              textAlign: 'center',
            };

        const lineFrom = left ? phone.x - gap + 12 : phone.x + phone.width + gap - 12;

        return (
          <div aria-hidden key={item.title}>
            {wide ? (
              <svg
                aria-hidden
                height={height}
                style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
                width={width}
              >
                <line
                  stroke={quiet}
                  strokeLinecap="round"
                  strokeOpacity={0.7}
                  strokeWidth={1}
                  x1={lineFrom}
                  x2={mix(lineFrom, point.x + (left ? -6 : 6), line)}
                  y1={point.y}
                  y2={point.y}
                />
              </svg>
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: point.x - 5,
                top: point.y - 5,
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: `1.5px solid ${ink}`,
                boxShadow: `0 0 0 2.5px ${theme === 'light' ? 'rgb(255 255 255 / 0.85)' : 'rgb(0 0 0 / 0.5)'}`,
                opacity: (wide ? line : shown) * (1 - gone),
                transform: `scale(${0.4 + 0.6 * (wide ? line : shown)})`,
              }}
            />
            <div
              data-feature={item.side}
              style={{
                position: 'absolute',
                ...textStyle,
                opacity: shown * (1 - gone),
                transform: `translate3d(${slide - gone * 40 * (left ? 1 : -1)}px, 0, 0)`,
                filter:
                  shown * (1 - gone) < 0.995
                    ? `blur(${((1 - shown * (1 - gone)) * 7).toFixed(2)}px)`
                    : undefined,
              }}
            >
              <div
                style={{
                  color: ink,
                  fontFamily: DISPLAY_FONT,
                  fontSize: wide ? 21 : 19,
                  fontWeight: 600,
                  letterSpacing: '-0.012em',
                  lineHeight: 1.2,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: quiet,
                  fontFamily: TEXT_FONT,
                  fontSize: 15,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.4,
                }}
              >
                {item.body}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
