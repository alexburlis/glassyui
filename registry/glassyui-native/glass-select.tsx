import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useGlassTheme } from './glass-provider';
import { GlassSurface } from './glass-surface';
import {
  AnchoredContent,
  OverlayItem,
  OverlayLabel,
  OverlaySeparator,
  assignRef,
  type OverlayItemProps,
  type OverlayPlacementProps,
} from './lib/anchored-overlay';
import { GlassIcon } from './lib/icons';
import { plainTextOf } from './lib/plain-text';
import { GLASS_MOTION, GLASS_RADIUS } from './lib/tokens';
import { useControllableState } from './lib/use-controllable-state';

type SelectItemLabel = {
  node: ReactNode;
  /** The label as plain text, for screen readers; undefined when it holds elements. */
  text: string | undefined;
};

type SelectContextValue = {
  anchor: View | null;
  disabled: boolean;
  labels: ReadonlyMap<string, SelectItemLabel>;
  open: boolean;
  registerItem: (value: string, label: SelectItemLabel) => () => void;
  selectValue: (value: string) => void;
  setAnchor: (node: View | null) => void;
  setOpen: (open: boolean) => void;
  /** An empty string means nothing is chosen, as on the web. */
  value: string;
};

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(component: string) {
  const context = useContext(SelectContext);

  if (!context) throw new Error(`${component} must be used within GlassSelect`);

  return context;
}

// The web's lg-select-content: 1.25rem corners, with options set at 0.9375rem.
const SELECT_RADIUS = 20;

export type GlassSelectProps = {
  children?: ReactNode;
  defaultOpen?: boolean;
  defaultValue?: string;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: string) => void;
  open?: boolean;
  value?: string;
};

/** Holds a select's value and open state for its trigger and list. */
export function GlassSelect({
  children,
  defaultOpen = false,
  defaultValue = '',
  disabled = false,
  onOpenChange,
  onValueChange,
  open: openProp,
  value: valueProp,
}: GlassSelectProps) {
  const [open, setOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);
  const [anchor, setAnchor] = useState<View | null>(null);
  const [labels, setLabels] = useState<ReadonlyMap<string, SelectItemLabel>>(() => new Map());

  // Items report their labels, so the trigger can show the chosen one before the list opens.
  const registerItem = useCallback((itemValue: string, label: SelectItemLabel) => {
    setLabels((previous) => {
      const current = previous.get(itemValue);

      if (current && current.node === label.node && current.text === label.text) return previous;

      return new Map(previous).set(itemValue, label);
    });

    return () =>
      setLabels((previous) => {
        if (!previous.has(itemValue)) return previous;

        const next = new Map(previous);

        next.delete(itemValue);

        return next;
      });
  }, []);

  const selectValue = useCallback(
    (next: string) => {
      if (next !== value) setValue(next);

      setOpen(false);
    },
    [setOpen, setValue, value],
  );

  const context = useMemo(
    () => ({
      anchor,
      disabled,
      labels,
      open,
      registerItem,
      selectValue,
      setAnchor,
      setOpen,
      value,
    }),
    [anchor, disabled, labels, open, registerItem, selectValue, setOpen, value],
  );

  return <SelectContext.Provider value={context}>{children}</SelectContext.Provider>;
}

export type GlassSelectTriggerProps = Omit<PressableProps, 'children' | 'style'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The closed select: a glass capsule with the chosen option and a chevron that turns as it opens. */
export const GlassSelectTrigger = forwardRef<View, GlassSelectTriggerProps>(
  ({ children, disabled: disabledProp, onPress, style, ...rest }, forwardedRef) => {
    const { colors, preferences } = useGlassTheme();
    const select = useSelectContext('GlassSelectTrigger');
    const { open, setAnchor, setOpen } = select;
    const disabled = select.disabled || Boolean(disabledProp);
    const [turn] = useState(() => new Animated.Value(open ? 1 : 0));
    const spoken = select.value === '' ? undefined : select.labels.get(select.value)?.text;

    useEffect(() => {
      if (preferences.reduceMotion) {
        turn.setValue(open ? 1 : 0);

        return;
      }

      Animated.spring(turn, {
        ...GLASS_MOTION.spring,
        toValue: open ? 1 : 0,
        useNativeDriver: GLASS_MOTION.nativeDriver,
      }).start();
    }, [open, preferences.reduceMotion, turn]);

    const ref = useCallback(
      (node: View | null) => {
        setAnchor(node);
        assignRef(forwardedRef, node);
      },
      [forwardedRef, setAnchor],
    );

    const handlePress = useCallback(
      (event: GestureResponderEvent) => {
        onPress?.(event);

        if (!event.isDefaultPrevented()) setOpen(!open);
      },
      [onPress, open, setOpen],
    );

    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityValue={spoken === undefined ? undefined : { text: spoken }}
        disabled={disabled}
        onPress={handlePress}
        style={[disabled && styles.disabled, style]}
        {...rest}
      >
        <GlassSurface elevation="none" preset="control" style={styles.trigger}>
          {children}
          <Animated.View
            style={{
              transform: [
                {
                  rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
                },
              ],
            }}
          >
            <GlassIcon color={colors.mutedForeground} name="chevron-down" size={16} />
          </Animated.View>
        </GlassSurface>
      </Pressable>
    );
  },
);

GlassSelectTrigger.displayName = 'GlassSelectTrigger';

export type GlassSelectValueProps = TextProps & {
  /** Shown in muted ink while nothing is chosen. */
  placeholder?: ReactNode;
};

/** The chosen option's label inside the trigger, or the placeholder while nothing is chosen. */
export const GlassSelectValue = forwardRef<Text, GlassSelectValueProps>(
  ({ children, placeholder, style, ...rest }, ref) => {
    const { colors } = useGlassTheme();
    const select = useSelectContext('GlassSelectValue');
    const empty = select.value === '';

    return (
      <Text
        ref={ref}
        numberOfLines={1}
        style={[styles.value, { color: empty ? colors.mutedForeground : colors.foreground }, style]}
        {...rest}
      >
        {empty ? placeholder : (children ?? select.labels.get(select.value)?.node)}
      </Text>
    );
  },
);

GlassSelectValue.displayName = 'GlassSelectValue';

export type GlassSelectContentProps = Omit<ViewProps, 'children'> &
  OverlayPlacementProps & {
    children?: ReactNode;
  };

/** The open list: a glass slab under the trigger, at least as wide as the trigger. */
export const GlassSelectContent = forwardRef<View, GlassSelectContentProps>(
  ({ align = 'start', children, ...rest }, ref) => {
    const { anchor, open, setOpen } = useSelectContext('GlassSelectContent');
    const close = useCallback(() => setOpen(false), [setOpen]);

    return (
      <AnchoredContent
        ref={ref}
        accessibilityRole="menu"
        align={align}
        anchor={anchor}
        keepMounted
        minWidth="trigger"
        onClose={close}
        open={open}
        padding={6}
        radius={SELECT_RADIUS}
        {...rest}
      >
        {children}
      </AnchoredContent>
    );
  },
);

GlassSelectContent.displayName = 'GlassSelectContent';

export type GlassSelectItemProps = Omit<
  OverlayItemProps,
  'indicator' | 'inset' | 'onPress' | 'textStyle' | 'tone'
> & {
  /** The label as plain text, for screen readers, when the label holds elements. */
  textValue?: string;
  /** Must not be empty: an empty value means nothing is chosen. */
  value: string;
};

/** An option in the list. The chosen one shows a check; choosing one closes the list. */
export const GlassSelectItem = forwardRef<View, GlassSelectItemProps>(
  ({ children, textValue, value, ...rest }, ref) => {
    const { colors } = useGlassTheme();
    const select = useSelectContext('GlassSelectItem');
    const { registerItem, selectValue } = select;
    const selected = select.value === value;
    const text = textValue ?? plainTextOf(children);

    useLayoutEffect(
      () => registerItem(value, { node: children, text }),
      [children, registerItem, text, value],
    );

    const handlePress = useCallback(() => selectValue(value), [selectValue, value]);

    return (
      <OverlayItem
        ref={ref}
        accessibilityState={{ selected }}
        indicator={selected ? <GlassIcon color={colors.foreground} name="check" size={16} /> : null}
        inset
        onPress={handlePress}
        textStyle={styles.itemText}
        {...rest}
      >
        {children}
      </OverlayItem>
    );
  },
);

GlassSelectItem.displayName = 'GlassSelectItem';

/** Groups related options. */
export const GlassSelectGroup = forwardRef<View, ViewProps>((props, ref) => (
  <View ref={ref} {...props} />
));

GlassSelectGroup.displayName = 'GlassSelectGroup';

/** A small muted heading over a group of options. */
export const GlassSelectLabel = forwardRef<Text, TextProps>((props, ref) => (
  <OverlayLabel ref={ref} {...props} />
));

GlassSelectLabel.displayName = 'GlassSelectLabel';

/** A hairline between groups of options. */
export const GlassSelectSeparator = forwardRef<View, ViewProps>((props, ref) => (
  <OverlaySeparator ref={ref} {...props} />
));

GlassSelectSeparator.displayName = 'GlassSelectSeparator';

// The trigger follows the web's lg-input field as a capsule; options follow lg-select-content.
const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  itemText: { fontSize: 15, lineHeight: 21 },
  trigger: {
    alignItems: 'center',
    borderRadius: GLASS_RADIUS.capsule,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  value: { flexShrink: 1, fontSize: 16, lineHeight: 22 },
});
