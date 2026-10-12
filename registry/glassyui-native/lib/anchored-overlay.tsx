import {
  cloneElement,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import {
  Animated,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityState,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { initialWindowMetrics, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useGlassTheme } from '../glass-provider';
import { GlassSurface } from '../glass-surface';
import { LAYER_EASING, ModalLayerHost, useLayerPresence } from './modal-layer';
import { wrapPlainText } from './plain-text';
import { GLASS_MOTION } from './tokens';

export type OverlaySide = 'top' | 'bottom';

export type OverlayAlign = 'start' | 'center' | 'end';

export type OverlayPlacementProps = {
  /** The trigger edge the layer lines up with. Start and end follow the reading direction. */
  align?: OverlayAlign;
  /** The side of the trigger the layer opens on. It flips when the other side has more room. */
  side?: OverlaySide;
  /** The gap between the trigger and the layer, in points. Defaults to 6. */
  sideOffset?: number;
};

type Rect = { height: number; width: number; x: number; y: number };

type Size = { height: number; width: number };

type Bounds = { bottom: number; left: number; right: number; top: number };

type Placement = {
  /** The tallest the layer may be on its side; beyond that it scrolls. */
  maxHeight: number;
  /** Where the trigger's centre falls across the layer, the point it grows from. */
  originX: number;
  side: OverlaySide;
  /** The layer's left edge and top edge in window coordinates. */
  x: number;
  y: number;
};

// Layers keep this far inside the window and its safe areas.
const EDGE_MARGIN = 8;

const DEFAULT_SIDE_OFFSET = 6;

// A layer grows out of its trigger from 94% and drifts its last few points away from it.
const ENTER_SCALE = 0.94;

const DRIFT = 4;

// The web's lg-pop-in and lg-pop-out: arrivals ease out, exits ease in and run shorter.
const ENTER = { duration: 240, easing: LAYER_EASING.out };

const EXIT = { duration: 160, easing: LAYER_EASING.in };

const MIRRORED_ALIGN = { center: 'center', end: 'start', start: 'end' } as const satisfies Record<
  OverlayAlign,
  OverlayAlign
>;

const NO_INSETS = { bottom: 0, left: 0, right: 0, top: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Where a layer of `size` sits beside `anchor`, kept inside `bounds`. All in window points. */
function placeLayer(
  anchor: Rect,
  size: Size,
  bounds: Bounds,
  preferred: OverlaySide,
  align: OverlayAlign,
  sideOffset: number,
): Placement {
  const below = anchor.y + anchor.height + sideOffset;
  const above = anchor.y - sideOffset;
  const room = { bottom: bounds.bottom - below, top: above - bounds.top };
  const other = preferred === 'bottom' ? 'top' : 'bottom';
  const side = size.height > room[preferred] && room[other] > room[preferred] ? other : preferred;
  const maxHeight = Math.max(room[side], 0);
  const height = Math.min(size.height, maxHeight);
  const y = clamp(side === 'bottom' ? below : above - height, bounds.top, bounds.bottom - height);
  const edge = I18nManager.isRTL ? MIRRORED_ALIGN[align] : align;

  const offset = {
    center: (anchor.width - size.width) / 2,
    end: anchor.width - size.width,
    start: 0,
  };

  const x = clamp(anchor.x + offset[edge], bounds.left, bounds.right - size.width);

  return {
    maxHeight,
    originX: clamp(anchor.x + anchor.width / 2 - x, 0, size.width),
    side,
    x,
    y,
  };
}

/**
 * Puts a placed layer in position and grows it out of its trigger as `progress` runs from 0 to 1.
 * Yoga reads start and end by reading direction, so in right-to-left layouts end is the left edge.
 */
function layerMotion(placement: Placement, progress: Animated.Value) {
  const drift = placement.side === 'top' ? DRIFT : -DRIFT;
  const originY = placement.side === 'top' ? '100%' : '0px';

  return [
    I18nManager.isRTL ? { end: placement.x } : { start: placement.x },
    {
      top: placement.y,
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [drift, 0] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_SCALE, 1] }) },
      ],
      // React Native reads whole points here, so the origin is rounded.
      transformOrigin: `${Math.round(placement.originX)}px ${originY}`,
    },
  ];
}

/** Points `ref` at `node`, whether it is a callback or an object ref. */
export function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (ref instanceof Function) {
    ref(node);

    return;
  }

  if (ref) ref.current = node;
}

export type OverlayTriggerChildProps = {
  accessibilityState?: AccessibilityState;
  onPress?: ((event: GestureResponderEvent) => void) | null;
  ref?: Ref<View>;
};

type OverlayTriggerProps = {
  children: ReactElement<OverlayTriggerChildProps>;
  /** Receives the child's view, which the layer measures to know where to open. */
  onAnchor: (node: View | null) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * Renders its one child with a press that toggles the layer and an expanded state. The child's
 * own press and ref keep working; the child must pass its ref to a view, which the layer measures.
 */
export function OverlayTrigger({ children, onAnchor, onOpenChange, open }: OverlayTriggerProps) {
  const { accessibilityState, onPress, ref: forwarded } = children.props;

  const ref = useCallback(
    (node: View | null) => {
      onAnchor(node);
      assignRef(forwarded, node);
    },
    [forwarded, onAnchor],
  );

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      onPress?.(event);

      if (!event.isDefaultPrevented()) onOpenChange(!open);
    },
    [onOpenChange, onPress, open],
  );

  return cloneElement(children, {
    accessibilityState: { ...accessibilityState, expanded: open },
    onPress: handlePress,
    ref,
  });
}

export type AnchoredContentProps = Omit<ViewProps, 'children' | 'style'> &
  OverlayPlacementProps & {
    /** The view the layer opens beside, usually its trigger. */
    anchor: View | null;
    children?: ReactNode;
    /** Keeps the children mounted in a hidden, inert view while the layer is closed. */
    keepMounted?: boolean;
    /** The layer's narrowest width in points, or 'trigger' for at least the trigger's width. */
    minWidth?: number | 'trigger';
    onClose: () => void;
    open: boolean;
    /** Space between the glass edge and the content that scrolls inside it. */
    padding: number;
    radius: number;
    /** Applies to the glass. */
    style?: StyleProp<ViewStyle>;
  };

type AnchoredLayerProps = Omit<AnchoredContentProps, 'keepMounted'> & {
  onExited: () => void;
};

const AnchoredLayer = forwardRef<View, AnchoredLayerProps>(
  (
    {
      align = 'center',
      anchor,
      children,
      minWidth = 0,
      onClose,
      onExited,
      open,
      padding,
      radius,
      side = 'bottom',
      sideOffset = DEFAULT_SIDE_OFFSET,
      style,
      ...rest
    },
    ref,
  ) => {
    const { preferences } = useGlassTheme();
    const viewport = useWindowDimensions();
    const insets = useContext(SafeAreaInsetsContext) ?? initialWindowMetrics?.insets ?? NO_INSETS;
    const [progress] = useState(() => new Animated.Value(0));
    const [frame, setFrame] = useState<Rect | null>(null);
    const [size, setSize] = useState<Size | null>(null);

    const bounds = {
      bottom: viewport.height - insets.bottom - EDGE_MARGIN,
      left: insets.left + EDGE_MARGIN,
      right: viewport.width - insets.right - EDGE_MARGIN,
      top: insets.top + EDGE_MARGIN,
    };

    const widest = bounds.right - bounds.left;
    const narrowest = Math.min(minWidth === 'trigger' ? (frame?.width ?? 0) : minWidth, widest);

    // Find the trigger when the layer opens, and again when the window turns or resizes.
    useLayoutEffect(() => {
      anchor?.measureInWindow((x, y, width, height) => setFrame({ height, width, x, y }));
    }, [anchor, viewport.height, viewport.width]);

    // A layer that opens with its trigger gets the trigger's view a render later, so only an
    // anchor still missing on the next frame is a mistake.
    useEffect(() => {
      if (anchor) return;

      const frameId = requestAnimationFrame(() =>
        console.error(
          'Glassy UI: a menu, select or popover opened without a trigger to anchor to. Its trigger child must pass its ref to a view.',
        ),
      );

      return () => cancelAnimationFrame(frameId);
    }, [anchor]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;

      setSize((previous) =>
        previous?.height === height && previous.width === width ? previous : { height, width },
      );
    }, []);

    // A size measured before the trigger's width applied is stale; the next layout replaces it.
    const placement =
      frame && size && size.width >= narrowest - 0.5
        ? placeLayer(frame, size, bounds, side, align, sideOffset)
        : null;

    const placed = placement !== null;

    useEffect(() => {
      if (!placed) {
        if (!open) onExited();

        return;
      }

      if (preferences.reduceMotion) {
        progress.setValue(open ? 1 : 0);

        if (!open) onExited();

        return;
      }

      const motion = open ? ENTER : EXIT;

      const animation = Animated.timing(progress, {
        duration: motion.duration,
        easing: motion.easing,
        toValue: open ? 1 : 0,
        useNativeDriver: GLASS_MOTION.nativeDriver,
      });

      animation.start(({ finished }) => {
        if (finished && !open) onExited();
      });

      return () => animation.stop();
    }, [onExited, open, placed, preferences.reduceMotion, progress]);

    return (
      <>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          onLayout={handleLayout}
          pointerEvents={placed ? 'auto' : 'none'}
          style={[styles.layer, placement ? layerMotion(placement, progress) : styles.measuring]}
        >
          <GlassSurface
            ref={ref}
            elevation="raised"
            preset="overlay"
            style={[
              {
                borderRadius: radius,
                maxHeight: placement?.maxHeight ?? bounds.bottom - bounds.top,
                maxWidth: widest,
                minWidth: narrowest,
              },
              style,
            ]}
            {...rest}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
          >
            <ScrollView
              alwaysBounceVertical={false}
              contentContainerStyle={{ padding }}
              keyboardShouldPersistTaps="handled"
              style={{
                borderCurve: 'continuous',
                borderRadius: StyleSheet.flatten(style)?.borderRadius ?? radius,
              }}
            >
              {children}
            </ScrollView>
          </GlassSurface>
        </Animated.View>
      </>
    );
  },
);

AnchoredLayer.displayName = 'AnchoredLayer';

/**
 * A glass layer anchored to a trigger. It opens in a transparent modal, measures itself before it
 * shows, grows out of the trigger and closes on an outside tap or the Android back button. Glass
 * never fades: it scales and drifts, and Reduce Motion shows and hides it at once.
 */
export const AnchoredContent = forwardRef<View, AnchoredContentProps>(
  ({ children, keepMounted = false, onClose, open, ...rest }, ref) => {
    const { preferences } = useGlassTheme();
    const [present, hide] = useLayerPresence(open, preferences.reduceMotion);

    return (
      <>
        <ModalLayerHost onRequestClose={onClose} present={present}>
          <AnchoredLayer ref={ref} onClose={onClose} onExited={hide} open={open} {...rest}>
            {children}
          </AnchoredLayer>
        </ModalLayerHost>
        {keepMounted && !present ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[{ pointerEvents: 'none' }, styles.hidden]}
          >
            {children}
          </View>
        ) : null}
      </>
    );
  },
);

AnchoredContent.displayName = 'AnchoredContent';

export type OverlayItemProps = Omit<PressableProps, 'children' | 'style'> & {
  children?: ReactNode;
  /** A check or dot drawn in the inset at the row's start. */
  indicator?: ReactNode;
  /** Leaves room for an indicator at the start, so labels line up. */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tone?: 'default' | 'destructive';
};

// A pressed row lightens dark glass and darkens light glass, as .lg-menu-item[data-highlighted].
const PRESSED_ROW = { dark: 'rgba(255, 255, 255, 0.14)', light: 'rgba(0, 0, 0, 0.06)' } as const;

/** A 44-point row in a menu or a select list; a press tints the row under it. */
export const OverlayItem = forwardRef<View, OverlayItemProps>(
  (
    {
      children,
      disabled = false,
      indicator,
      inset = false,
      style,
      textStyle,
      tone = 'default',
      ...rest
    },
    ref,
  ) => {
    const { colors, preferences } = useGlassTheme();
    const ink = tone === 'destructive' ? colors.invalid : colors.foreground;

    return (
      <Pressable
        ref={ref}
        accessibilityRole="menuitem"
        disabled={disabled}
        style={({ pressed }) => [
          styles.item,
          inset && styles.inset,
          pressed && { backgroundColor: PRESSED_ROW[preferences.theme] },
          disabled && styles.disabled,
          style,
        ]}
        {...rest}
      >
        {indicator ? <View style={styles.indicator}>{indicator}</View> : null}
        {wrapPlainText(children, (text) => (
          <Text style={[styles.itemText, { color: ink }, textStyle]}>{text}</Text>
        ))}
      </Pressable>
    );
  },
);

OverlayItem.displayName = 'OverlayItem';

/** A small muted heading over a group of rows. */
export const OverlayLabel = forwardRef<Text, TextProps>(({ style, ...rest }, ref) => {
  const { colors } = useGlassTheme();

  return (
    <Text
      ref={ref}
      accessibilityRole="header"
      style={[styles.label, { color: colors.mutedForeground }, style]}
      {...rest}
    />
  );
});

OverlayLabel.displayName = 'OverlayLabel';

/** A hairline between groups of rows. Screen readers skip it. */
export const OverlaySeparator = forwardRef<View, ViewProps>(({ style, ...rest }, ref) => {
  const { colors } = useGlassTheme();

  return (
    <View
      ref={ref}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.separator, { backgroundColor: colors.border }, style]}
      {...rest}
    />
  );
});

OverlaySeparator.displayName = 'OverlaySeparator';

// Rows, labels and separators copy the web's lg-menu-item, lg-menu-label and lg-menu-separator.
// Rows grow from the web's 36 pixels to a 44-point touch target.
const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  hidden: { display: 'none' },
  indicator: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    start: 8,
    top: 0,
    width: 16,
  },
  inset: { paddingStart: 32 },
  item: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  itemText: { flexShrink: 1, fontSize: 14, lineHeight: 20 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    paddingBottom: 4,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  layer: { position: 'absolute' },
  // Until it is measured, a layer waits off screen so it never shows in the wrong place.
  measuring: { start: 0, top: -10000 },
  separator: { height: 1, marginHorizontal: 10, marginVertical: 6 },
});
