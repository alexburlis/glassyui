import { createContext, forwardRef, useCallback, useContext, useMemo } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useGlassTheme } from './glass-provider';
import { CheckText, CheckWell, checkFieldStyles, useDrawIn, usePressDown } from './lib/check-field';
import { GLASS_RADIUS } from './lib/tokens';
import { useControllableState } from './lib/use-controllable-state';

type RadioGroupContextValue = {
  disabled: boolean;
  select: (value: string) => void;
  selected: string;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroup() {
  const context = useContext(RadioGroupContext);

  if (!context) {
    throw new Error('GlassRadioGroupItem must be used within GlassRadioGroup');
  }

  return context;
}

export type GlassRadioGroupProps = ViewProps & {
  defaultValue?: string;
  /** Turns every option off. */
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
};

/** A group of options where exactly one is chosen. */
export const GlassRadioGroup = forwardRef<View, GlassRadioGroupProps>(
  ({ defaultValue, disabled = false, onValueChange, value, ...rest }, ref) => {
    const [selected, select] = useControllableState(value, defaultValue ?? '', onValueChange);
    const context = useMemo(() => ({ disabled, select, selected }), [disabled, select, selected]);

    return (
      <RadioGroupContext.Provider value={context}>
        <View
          ref={ref}
          accessibilityRole="radiogroup"
          accessibilityState={{ disabled }}
          {...rest}
        />
      </RadioGroupContext.Provider>
    );
  },
);

GlassRadioGroup.displayName = 'GlassRadioGroup';

export type GlassRadioGroupItemProps = Omit<PressableProps, 'children' | 'onPress' | 'style'> & {
  /** A line of muted text under the label. */
  description?: string;
  /** Marks the choice as wrong: the edge turns the invalid colour. */
  invalid?: boolean;
  /** Text beside the button; the whole row then chooses it. Without one, set accessibilityLabel. */
  label?: string;
  style?: StyleProp<ViewStyle>;
  value: string;
};

const SIZE = 20;

// A lone button still answers a 44-point touch.
const HIT_SLOP = (44 - SIZE) / 2;

/** One option in a GlassRadioGroup. Its white dot springs in when chosen and shrinks straight out. */
export const GlassRadioGroupItem = forwardRef<View, GlassRadioGroupItemProps>(
  (
    { description, disabled, invalid = false, label, onPressIn, onPressOut, style, value, ...rest },
    ref,
  ) => {
    const { colors, preferences } = useGlassTheme();
    const { disabled: groupDisabled, select, selected } = useRadioGroup();
    const checked = selected === value;
    const off = groupDisabled || Boolean(disabled);
    const dot = useDrawIn(checked, preferences.reduceMotion);
    const press = usePressDown(preferences.reduceMotion, onPressIn, onPressOut);

    const choose = useCallback(() => {
      if (!checked) select(value);
    }, [checked, select, value]);

    return (
      <Pressable
        ref={ref}
        accessibilityHint={description}
        accessibilityLabel={label}
        accessibilityRole="radio"
        accessibilityState={{ checked, disabled: off }}
        disabled={off}
        hitSlop={label === undefined ? HIT_SLOP : undefined}
        onPress={choose}
        onPressIn={press.handlePressIn}
        onPressOut={press.handlePressOut}
        style={[
          label === undefined ? checkFieldStyles.alone : checkFieldStyles.field,
          off && checkFieldStyles.disabled,
          style,
        ]}
        {...rest}
      >
        <CheckWell
          chosen={checked}
          invalid={invalid}
          press={press.press}
          radius={GLASS_RADIUS.capsule}
          size={SIZE}
        >
          <Animated.View
            style={[
              styles.dot,
              {
                backgroundColor: colors.accentForeground,
                opacity: dot.interpolate({
                  extrapolate: 'clamp',
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                transform: [{ scale: dot }],
              },
            ]}
          />
        </CheckWell>
        {label === undefined ? null : (
          <CheckText description={description} label={label} size="md" />
        )}
      </Pressable>
    );
  },
);

GlassRadioGroupItem.displayName = 'GlassRadioGroupItem';

const styles = StyleSheet.create({
  dot: {
    borderRadius: GLASS_RADIUS.capsule,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)',
    height: SIZE * 0.42,
    width: SIZE * 0.42,
  },
});
