import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  I18nManager,
  PanResponder,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type ViewProps,
} from 'react-native';
import { useGlassTheme } from './glass-provider';
import { GlassSurface } from './glass-surface';
import { GLASS_MOTION, GLASS_RADIUS } from './lib/tokens';
import { useControllableState } from './lib/use-controllable-state';

export type GlassSliderProps = Omit<ViewProps, 'children'> & {
  defaultValue?: number[];
  disabled?: boolean;
  max?: number;
  min?: number;
  onValueChange?: (value: number[]) => void;
  /** Hears the values once a drag ends, or after a screen reader moves a thumb. */
  onValueCommit?: (value: number[]) => void;
  step?: number;
  /** Names each thumb in value order. Defaults to the slider's accessibilityLabel. */
  thumbLabels?: string[];
  value?: number[];
};

const THUMB = { height: 24, width: 38 } as const;

// The 24-point slider and its thumbs answer a touch up to 10 points above or below: 44 in all.
const HIT_SLOP = { bottom: 10, top: 10 } as const;

const THUMB_HIT_SLOP = { bottom: 10, left: 3, right: 3, top: 10 } as const;

const KNOB_SHADOW = '0px 2px 6px rgba(28, 28, 30, 0.16), 0px 1px 2px rgba(28, 28, 30, 0.1)';

const ADJUST_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }];

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

// Rounds to the step's own decimals, so steps of 0.1 do not drift, as Radix does.
function snapToStep(value: number, min: number, step: number) {
  const decimals = (String(step).split('.')[1] ?? '').length;

  return Number((Math.round((value - min) / step) * step + min).toFixed(decimals));
}

// The thumb nearest a value; the first of several stacked on one value.
function nearestThumb(values: readonly number[], target: number) {
  let nearest = 0;

  values.forEach((value, index) => {
    if (Math.abs(value - target) < Math.abs(values[nearest] - target)) nearest = index;
  });

  return nearest;
}

// Moves one thumb, stopped by its neighbours so thumbs never cross.
function moveThumb(values: readonly number[], index: number, target: number) {
  const low = index > 0 ? values[index - 1] : Number.NEGATIVE_INFINITY;
  const high = index < values.length - 1 ? values[index + 1] : Number.POSITIVE_INFINITY;
  const next = [...values];

  next[index] = clamp(target, low, high);

  return next;
}

function thumbName(
  index: number,
  count: number,
  sliderLabel: string | undefined,
  thumbLabels: string[] | undefined,
) {
  const own = thumbLabels?.[index];

  if (own !== undefined || count === 1) return own ?? sliderLabel;

  const position = count === 2 ? (index === 0 ? 'minimum' : 'maximum') : `${index + 1} of ${count}`;

  return sliderLabel === undefined ? position : `${sliderLabel}, ${position}`;
}

/** How a touch drives the slider. Every method reads the slider's latest props. */
type SliderGesture = {
  /** Moves the grabbed thumb with the finger, `dx` points from where the touch began. */
  drag: (dx: number) => void;
  drop: () => void;
  enabled: () => boolean;
  /** A touch on a thumb takes it from where it is. */
  grabThumb: (index: number) => void;
  /** A touch on the track takes the nearest thumb and puts it under the finger. */
  grabTrack: (x: number) => void;
};

type Drag = {
  before: readonly number[];
  /** Whether the drag has picked its thumb from any stacked on one value. */
  decided: boolean;
  index: number;
  origin: number;
  values: readonly number[];
};

// How far a finger moves before the slider reads which way it is going.
const SLOP = 6;

/**
 * A responder that takes a touch only once it slides sideways, so a vertical swipe that starts
 * on the slider still scrolls the page. A touch that lifts without moving runs `onTap`.
 */
function createSlideResponder(
  gesture: SliderGesture,
  grab: (originX: number) => void,
  onTap?: (originX: number) => void,
) {
  let sliding = false;
  let originX = 0;

  return PanResponder.create({
    onPanResponderGrant: (event) => {
      sliding = false;
      originX = event.nativeEvent.locationX;
    },
    onPanResponderMove: (_event, state) => {
      if (!sliding) {
        if (Math.abs(state.dx) < SLOP || Math.abs(state.dx) < Math.abs(state.dy)) return;

        sliding = true;
        grab(originX);
      }

      gesture.drag(state.dx);
    },
    onPanResponderRelease: (_event, state) => {
      if (!sliding && Math.abs(state.dx) < SLOP && Math.abs(state.dy) < SLOP) onTap?.(originX);

      gesture.drop();
    },
    onPanResponderTerminate: gesture.drop,
    // Until the touch slides, a scroll view may take it.
    onPanResponderTerminationRequest: () => !sliding,
    // Otherwise Android keeps the touch from the scroll view around the slider.
    onShouldBlockNativeResponder: () => false,
    onStartShouldSetPanResponder: gesture.enabled,
  });
}

type SliderThumbProps = {
  active: boolean;
  disabled: boolean;
  gesture: SliderGesture;
  index: number;
  label: string | undefined;
  max: number;
  min: number;
  onAdjust: (index: number, direction: 1 | -1) => void;
  /** Where the thumb sits, from 0 at the track's start to 1 at its end. */
  position: number;
  value: number;
};

// A white knob that turns to clear glass while a finger drags it, as GlassSwitch's does.
function SliderThumb({
  active,
  disabled,
  gesture,
  index,
  label,
  max,
  min,
  onAdjust,
  position,
  value,
}: SliderThumbProps) {
  const { colors, preferences } = useGlassTheme();
  const [pressed] = useState(() => new Animated.Value(0));

  const [responder] = useState(() => createSlideResponder(gesture, () => gesture.grabThumb(index)));

  useEffect(() => {
    Animated.timing(pressed, {
      duration: active ? 120 : 260,
      toValue: active ? 1 : 0,
      useNativeDriver: GLASS_MOTION.nativeDriver,
    }).start();
  }, [active, pressed]);

  const handleAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'increment') onAdjust(index, 1);

      if (event.nativeEvent.actionName === 'decrement') onAdjust(index, -1);
    },
    [index, onAdjust],
  );

  return (
    <Animated.View
      accessible
      accessibilityActions={ADJUST_ACTIONS}
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      accessibilityState={{ disabled }}
      accessibilityValue={{ max, min, now: value }}
      hitSlop={THUMB_HIT_SLOP}
      onAccessibilityAction={handleAction}
      style={[
        styles.thumb,
        {
          // Inset by its own width along the way, so the thumb never leaves the track.
          marginStart: -position * THUMB.width,
          start: `${position * 100}%`,
          transform: [
            {
              scaleX: preferences.reduceMotion
                ? 1
                : pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }),
            },
            {
              scaleY: preferences.reduceMotion
                ? 1
                : pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }),
            },
          ],
        },
      ]}
      {...responder.panHandlers}
    >
      {disabled ? null : (
        <GlassSurface
          elevation="none"
          preset="subtle"
          style={[StyleSheet.absoluteFill, styles.round]}
        />
      )}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.round,
          {
            backgroundColor: colors.knob,
            boxShadow: KNOB_SHADOW,
            opacity: preferences.reduceTransparency
              ? 1
              : pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }),
          },
        ]}
      />
    </Animated.View>
  );
}

/**
 * A slider with one thumb or several. A tap or a sideways drag on the track takes the nearest
 * thumb; a vertical swipe scrolls past. Thumbs stop at each other and never cross, and each white
 * knob turns to clear glass while it is dragged.
 */
export const GlassSlider = forwardRef<View, GlassSliderProps>(
  (
    {
      accessibilityLabel,
      defaultValue,
      disabled = false,
      max = 100,
      min = 0,
      onLayout,
      onValueChange,
      onValueCommit,
      step = 1,
      style,
      thumbLabels,
      value,
      ...rest
    },
    ref,
  ) => {
    const { colors } = useGlassTheme();
    const [values, setValues] = useControllableState(value, defaultValue ?? [min], onValueChange);
    const [active, setActive] = useState<number | null>(null);
    const width = useRef(0);
    const drag = useRef<Drag | null>(null);
    const latest = useRef({ disabled, max, min, onValueCommit, setValues, step, values });

    // The gesture handlers live as long as the slider, so they read its props from here.
    useLayoutEffect(() => {
      latest.current = { disabled, max, min, onValueCommit, setValues, step, values };
    });

    const [gesture] = useState<SliderGesture>(() => {
      const travel = () => Math.max(width.current - THUMB.width, 0);

      // A thumb's centre, in points from the slider's left edge.
      const centreOf = (thumb: number) => {
        const { max: high, min: low } = latest.current;
        const along = high > low ? clamp((thumb - low) / (high - low), 0, 1) : 0;

        return THUMB.width / 2 + (I18nManager.isRTL ? 1 - along : along) * travel();
      };

      // The value whose thumb centre sits at `x`.
      const valueAt = (x: number) => {
        const { max: high, min: low, step: increment } = latest.current;
        const across = clamp((x - THUMB.width / 2) / Math.max(travel(), 1), 0, 1);
        const along = I18nManager.isRTL ? 1 - across : across;

        return clamp(snapToStep(low + along * (high - low), low, increment), low, high);
      };

      const begin = (index: number, origin: number) => {
        const current = latest.current.values;

        drag.current = { before: current, decided: false, index, origin, values: current };
        setActive(index);
      };

      const move = (dx: number) => {
        const current = drag.current;

        if (!current) return;

        const target = valueAt(current.origin + dx);
        const held = current.values[current.index];
        const decides = !current.decided && target !== held;
        let index = current.index;

        // Thumbs stacked on one value hand the drag, once, to whichever can follow the finger.
        // After that the thumb stops at its neighbour, so a drag never passes one thumb through
        // another.
        if (decides) {
          while (index > 0 && target < held && current.values[index - 1] === held) index -= 1;

          while (
            index < current.values.length - 1 &&
            target > held &&
            current.values[index + 1] === held
          ) {
            index += 1;
          }
        }

        const next = moveThumb(current.values, index, target);

        if (index !== current.index) setActive(index);

        drag.current = { ...current, decided: current.decided || decides, index, values: next };

        if (next[index] !== current.values[index]) latest.current.setValues(next);
      };

      return {
        drag: move,
        drop: () => {
          const current = drag.current;

          if (!current) return;

          drag.current = null;
          setActive(null);

          if (current.values.some((thumb, index) => thumb !== current.before[index])) {
            latest.current.onValueCommit?.([...current.values]);
          }
        },
        enabled: () => !latest.current.disabled,
        grabThumb: (index) => begin(index, centreOf(latest.current.values[index])),
        grabTrack: (x) => {
          begin(nearestThumb(latest.current.values, valueAt(x)), x);
          move(0);
        },
      };
    });

    // A tap on the track puts the nearest thumb under the finger; a slide drags it from there.
    const [responder] = useState(() =>
      createSlideResponder(gesture, gesture.grabTrack, gesture.grabTrack),
    );

    const handleLayout = useCallback(
      (event: LayoutChangeEvent) => {
        width.current = event.nativeEvent.layout.width;
        onLayout?.(event);
      },
      [onLayout],
    );

    const adjust = useCallback(
      (index: number, direction: 1 | -1) => {
        if (disabled) return;

        const target = clamp(snapToStep(values[index] + direction * step, min, step), min, max);
        const next = moveThumb(values, index, target);

        if (next[index] === values[index]) return;

        setValues(next);
        onValueCommit?.(next);
      },
      [disabled, max, min, onValueCommit, setValues, step, values],
    );

    const positionOf = (thumb: number) =>
      max > min ? clamp((thumb - min) / (max - min), 0, 1) : 0;

    const rangeStart = values.length > 1 ? positionOf(values[0]) : 0;
    const rangeEnd = positionOf(values[values.length - 1] ?? min);

    return (
      <View
        ref={ref}
        hitSlop={HIT_SLOP}
        onLayout={handleLayout}
        style={[styles.root, disabled && styles.disabled, style]}
        {...responder.panHandlers}
        {...rest}
      >
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View
            style={[
              styles.range,
              {
                backgroundColor: colors.accent,
                end: `${(1 - rangeEnd) * 100}%`,
                start: `${rangeStart * 100}%`,
              },
            ]}
          />
        </View>
        {values.map((thumb, index) => (
          <SliderThumb
            key={index}
            active={active === index}
            disabled={disabled}
            gesture={gesture}
            index={index}
            label={thumbName(index, values.length, accessibilityLabel, thumbLabels)}
            max={max}
            min={min}
            onAdjust={adjust}
            position={positionOf(thumb)}
            value={thumb}
          />
        ))}
      </View>
    );
  },
);

GlassSlider.displayName = 'GlassSlider';

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  range: { borderRadius: GLASS_RADIUS.capsule, bottom: 0, position: 'absolute', top: 0 },
  root: { alignSelf: 'stretch', height: THUMB.height, justifyContent: 'center' },
  round: { borderCurve: 'continuous', borderRadius: GLASS_RADIUS.capsule },
  thumb: {
    borderCurve: 'continuous',
    borderRadius: GLASS_RADIUS.capsule,
    height: THUMB.height,
    position: 'absolute',
    top: 0,
    width: THUMB.width,
  },
  track: {
    borderRadius: GLASS_RADIUS.capsule,
    height: 6,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
});
