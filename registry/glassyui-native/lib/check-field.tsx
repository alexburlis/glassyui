import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import { useGlassTheme } from '../glass-provider';
import { GLASS_MOTION } from './tokens';

export type CheckSize = 'sm' | 'md';

// The edge of an empty box is what says it can be ticked, so it holds 3:1 over the glass it
// sits on, which a text field's hairline does not.
const EDGE = { dark: 'rgba(244, 245, 249, 0.78)', light: 'rgba(27, 29, 36, 0.6)' } as const;

const EDGE_WIDTH = 1.5;

// The recessed well a field sits in, from --lg-input-shadow.
const WELL_SHADOW = {
  dark: 'inset 0px 1px 2px rgba(0, 0, 0, 0.24), inset 0px -1px 0px rgba(255, 255, 255, 0.06)',
  light: 'inset 0px 1px 2px rgba(0, 0, 0, 0.08), inset 0px -1px 0px rgba(255, 255, 255, 0.8)',
} as const;

// A chosen box is a bead of the accent, lit along its top.
const CHOSEN_SHADOW =
  'inset 0px 1px 0px rgba(255, 255, 255, 0.4), inset 0px -1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px rgba(0, 0, 0, 0.28)';

/**
 * Runs from 0 to 1 as `on` turns true, springing in, and back to 0, quicker and without the
 * spring, as it turns false. Reduce Motion jumps to the end.
 */
export function useDrawIn(on: boolean, reduceMotion: boolean) {
  const [progress] = useState(() => new Animated.Value(on ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(on ? 1 : 0);

      return;
    }

    if (on) {
      Animated.spring(progress, {
        ...GLASS_MOTION.spring,
        toValue: 1,
        useNativeDriver: GLASS_MOTION.nativeDriver,
      }).start();

      return;
    }

    Animated.timing(progress, {
      duration: 140,
      easing: Easing.in(Easing.quad),
      toValue: 0,
      useNativeDriver: GLASS_MOTION.nativeDriver,
    }).start();
  }, [on, progress, reduceMotion]);

  return progress;
}

/** A press that sets a box down and springs it back. Reduce Motion leaves the box still. */
export function usePressDown(
  reduceMotion: boolean,
  onPressIn: PressableProps['onPressIn'],
  onPressOut: PressableProps['onPressOut'],
) {
  const [press] = useState(() => new Animated.Value(0));

  const settle = useCallback(
    (toValue: number) => {
      if (reduceMotion) return;

      Animated.spring(press, {
        ...GLASS_MOTION.spring,
        toValue,
        useNativeDriver: GLASS_MOTION.nativeDriver,
      }).start();
    },
    [press, reduceMotion],
  );

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      onPressIn?.(event);
      settle(1);
    },
    [onPressIn, settle],
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      onPressOut?.(event);
      settle(0);
    },
    [onPressOut, settle],
  );

  return { handlePressIn, handlePressOut, press };
}

type CheckWellProps = {
  /** The mark, centred over the box. */
  children: ReactNode;
  /** Filled with the accent: a checked or indeterminate box, or the chosen radio. */
  chosen: boolean;
  invalid: boolean;
  /** The press progress from usePressDown. */
  press: Animated.Value;
  radius: number;
  size: number;
};

/**
 * The small recessed well a checkbox or radio draws. It fills with the accent when chosen and
 * sets down to 90% under a press.
 */
export function CheckWell({ children, chosen, invalid, press, radius, size }: CheckWellProps) {
  const { colors, preferences } = useGlassTheme();
  const fill = useDrawIn(chosen, preferences.reduceMotion);
  const corners = { borderCurve: 'continuous', borderRadius: radius } as const;

  return (
    <Animated.View
      style={[
        corners,
        {
          backgroundColor: colors.controlSurface,
          borderColor: invalid ? colors.invalid : EDGE[preferences.theme],
          borderWidth: EDGE_WIDTH,
          boxShadow: WELL_SHADOW[preferences.theme],
          height: size,
          width: size,
          transform: [
            {
              scale: preferences.reduceMotion
                ? 1
                : press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.cover,
          corners,
          {
            backgroundColor: colors.accent,
            boxShadow: CHOSEN_SHADOW,
            opacity: fill.interpolate({
              extrapolate: 'clamp',
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          },
        ]}
      />
      <View style={[styles.cover, styles.centre]}>{children}</View>
    </Animated.View>
  );
}

type CheckTextProps = {
  description?: string;
  label: string;
  size: CheckSize;
};

/** The label beside a checkbox or radio, with an optional muted line under it. */
export function CheckText({ description, label, size }: CheckTextProps) {
  const { colors } = useGlassTheme();

  return (
    <View style={styles.text}>
      <Text
        style={[size === 'sm' ? styles.labelSmall : styles.label, { color: colors.foreground }]}
      >
        {label}
      </Text>
      {description ? (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
      ) : null}
    </View>
  );
}

export const checkFieldStyles = StyleSheet.create({
  alone: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.45 },
  // A labelled row is one touch target, at least 44 points tall.
  field: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    minHeight: 44,
    paddingVertical: 11,
  },
  fieldSmall: { gap: 10 },
});

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  // Covers the edge as well, so a chosen box shows no rim.
  cover: {
    bottom: -EDGE_WIDTH,
    left: -EDGE_WIDTH,
    position: 'absolute',
    right: -EDGE_WIDTH,
    top: -EDGE_WIDTH,
  },
  description: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 15, lineHeight: 21 },
  labelSmall: { fontSize: 14, lineHeight: 20 },
  text: { flex: 1, minWidth: 0, paddingTop: 1 },
});
