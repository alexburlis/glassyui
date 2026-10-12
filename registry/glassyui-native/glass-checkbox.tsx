import { forwardRef, useCallback } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import { useGlassTheme } from './glass-provider';
import {
  CheckText,
  CheckWell,
  checkFieldStyles,
  useDrawIn,
  usePressDown,
  type CheckSize,
} from './lib/check-field';
import { GlassIcon, type GlassIconName } from './lib/icons';
import { useControllableState } from './lib/use-controllable-state';

export type GlassCheckboxSize = CheckSize;

export type GlassCheckedState = boolean | 'indeterminate';

export type GlassCheckboxProps = Omit<PressableProps, 'children' | 'onPress' | 'style'> & {
  checked?: GlassCheckedState;
  defaultChecked?: GlassCheckedState;
  /** A line of muted text under the label. */
  description?: string;
  /** Marks the choice as wrong: the box's edge turns the invalid colour. */
  invalid?: boolean;
  /** Text beside the box; the whole row then toggles it. Without one, set accessibilityLabel. */
  label?: string;
  /** Hears the new state. Pressing an indeterminate box checks it. */
  onCheckedChange?: (checked: boolean) => void;
  size?: GlassCheckboxSize;
  style?: StyleProp<ViewStyle>;
};

const BOX = {
  sm: { radius: 5, size: 16 },
  md: { radius: 7, size: 20 },
} as const;

// The web's 2.1 stroke on a 16-point grid, redrawn on GlassIcon's 20-point grid.
const MARK_STROKE = 2.1 * (20 / 16);

type MarkProps = {
  name: GlassIconName;
  progress: Animated.Value;
  size: number;
};

// A mark grows in from half size as it fades in, and shrinks back as it fades out.
function Mark({ name, progress, size }: MarkProps) {
  const { colors } = useGlassTheme();

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.centre,
        {
          opacity: progress.interpolate({
            extrapolate: 'clamp',
            inputRange: [0, 1],
            outputRange: [0, 1],
          }),
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
          ],
        },
      ]}
    >
      <GlassIcon
        color={colors.accentForeground}
        name={name}
        size={size * 0.84}
        strokeWidth={MARK_STROKE}
      />
    </Animated.View>
  );
}

/**
 * A checkbox for one choice or, with `checked="indeterminate"`, for a parent of several. The box
 * fills with the accent and its mark draws in; unchecking runs the same way back.
 */
export const GlassCheckbox = forwardRef<View, GlassCheckboxProps>(
  (
    {
      checked,
      defaultChecked = false,
      description,
      disabled,
      invalid = false,
      label,
      onCheckedChange,
      onPressIn,
      onPressOut,
      size = 'md',
      style,
      ...rest
    },
    ref,
  ) => {
    const { preferences } = useGlassTheme();
    const [state, setState] = useControllableState<GlassCheckedState>(checked, defaultChecked);
    const tick = useDrawIn(state === true, preferences.reduceMotion);
    const dash = useDrawIn(state === 'indeterminate', preferences.reduceMotion);
    const press = usePressDown(preferences.reduceMotion, onPressIn, onPressOut);
    const box = BOX[size];

    // A lone box still answers a 44-point touch.
    const hitSlop = label === undefined ? (44 - box.size) / 2 : undefined;

    // An indeterminate box becomes checked, as on the web.
    const toggle = useCallback(() => {
      const next = state !== true;

      setState(next);
      onCheckedChange?.(next);
    }, [onCheckedChange, setState, state]);

    return (
      <Pressable
        ref={ref}
        accessibilityHint={description}
        accessibilityLabel={label}
        accessibilityRole="checkbox"
        accessibilityState={{
          checked: state === 'indeterminate' ? 'mixed' : state,
          disabled: Boolean(disabled),
        }}
        disabled={disabled}
        hitSlop={hitSlop}
        onPress={toggle}
        onPressIn={press.handlePressIn}
        onPressOut={press.handlePressOut}
        style={[
          label === undefined ? checkFieldStyles.alone : checkFieldStyles.field,
          label !== undefined && size === 'sm' && checkFieldStyles.fieldSmall,
          disabled && checkFieldStyles.disabled,
          style,
        ]}
        {...rest}
      >
        <CheckWell
          chosen={state !== false}
          invalid={invalid}
          press={press.press}
          radius={box.radius}
          size={box.size}
        >
          <Mark name="check" progress={tick} size={box.size} />
          <Mark name="dash" progress={dash} size={box.size} />
        </CheckWell>
        {label === undefined ? null : (
          <CheckText description={description} label={label} size={size} />
        )}
      </Pressable>
    );
  },
);

GlassCheckbox.displayName = 'GlassCheckbox';

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
