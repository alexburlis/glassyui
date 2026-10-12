import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { GlassButton } from './glass-button';
import { useGlassTheme } from './glass-provider';
import { GlassSurface } from './glass-surface';
import { selectionHaptic } from './lib/selection-haptic';
import { GLASS_MOTION } from './lib/tokens';

export type GlassCardStackProps<T extends { id: string }> = {
  items: readonly T[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  renderCard: (item: T, index: number) => ReactNode;
  label: string;
  height?: number;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function StackCard({
  children,
  cardIndex,
  count,
  position,
  width,
  active,
}: {
  children: ReactNode;
  cardIndex: number;
  count: number;
  position: SharedValue<number>;
  width: SharedValue<number>;
  active: boolean;
}) {
  const { preferences } = useGlassTheme();

  const animated = useAnimatedStyle(() => {
    const distance = cardIndex - position.get();
    const depth = Math.min(Math.max(distance, 0), 3);

    return {
      transform: [
        { translateX: distance < 0 ? distance * (width.get() + 32) : 0 },
        { translateY: depth * 12 },
        { scale: preferences.reduceMotion ? 1 : 1 - depth * 0.04 },
        { rotate: `${preferences.reduceMotion ? 0 : Math.min(distance, 0) * 7}deg` },
      ],
    };
  });

  return (
    <Animated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      pointerEvents={active ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { zIndex: count - cardIndex }, animated]}
    >
      <GlassSurface style={styles.card}>{children}</GlassSurface>
    </Animated.View>
  );
}

/** A controlled card deck: direct drag, velocity-aware spring release, and ordinary navigation. */
export function GlassCardStack<T extends { id: string }>({
  items,
  activeIndex,
  onIndexChange,
  renderCard,
  label,
  height = 220,
  haptics = true,
  style,
  testID,
}: GlassCardStackProps<T>) {
  const { colors, preferences } = useGlassTheme();
  const index = Math.max(0, Math.min(activeIndex, items.length - 1));
  const position = useSharedValue(index);
  const target = useSharedValue(index);
  const origin = useSharedValue(index);
  const width = useSharedValue(1);
  const reduceMotion = preferences.reduceMotion;

  const spring = {
    ...GLASS_MOTION.spring,
    reduceMotion: reduceMotion ? ReduceMotion.Always : ReduceMotion.System,
  };

  useEffect(() => {
    if (reduceMotion) position.set(index);
    else if (target.get() !== index) position.set(withSpring(index, GLASS_MOTION.spring));
    target.set(index);
  }, [index, position, reduceMotion, target]);

  function select(next: number) {
    if (next === index) return;
    selectionHaptic(haptics);
    onIndexChange(next);
  }

  function navigate(next: number) {
    target.set(next);
    position.set(reduceMotion ? next : withSpring(next, spring));
    select(next);
  }

  const pan = Gesture.Pan()
    .enabled(items.length > 1)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      origin.set(position.get());
    })
    .onUpdate((event) => {
      if (reduceMotion) return;
      const next = origin.get() - event.translationX / width.get();
      // Edge travel resists the finger instead of implying another card exists.
      position.set(
        next < 0
          ? next * 0.18
          : next > items.length - 1
            ? items.length - 1 + (next - items.length + 1) * 0.18
            : next,
      );
    })
    .onEnd((event) => {
      const displacement = -event.translationX / width.get();
      const velocity = -event.velocityX / width.get();

      const direction =
        Math.abs(displacement) > 0.22 || Math.abs(event.velocityX) > 600
          ? displacement + velocity * 0.1 > 0
            ? 1
            : -1
          : 0;

      const next = Math.max(0, Math.min(index + direction, items.length - 1));
      target.set(next);
      position.set(reduceMotion ? next : withSpring(next, { ...spring, velocity }));

      if (next !== index) scheduleOnRN(select, next);
    })
    .onFinalize((_event, success) => {
      if (!success) position.set(reduceMotion ? index : withSpring(index, spring));
    });

  const first = Math.max(0, index - 1);

  return (
    <View style={[styles.stack, style]}>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <View
          testID={testID}
          onLayout={(event) => {
            width.set(Math.max(1, event.nativeEvent.layout.width));
          }}
          style={[styles.deck, { height: height + 24 }]}
        >
          <View style={{ height }}>
            {items.slice(first, index + 3).map((item, offset) => (
              <StackCard
                key={item.id}
                cardIndex={first + offset}
                count={items.length}
                position={position}
                width={width}
                active={first + offset === index}
              >
                {renderCard(item, first + offset)}
              </StackCard>
            ))}
          </View>
        </View>
      </GestureDetector>
      <View style={styles.navigation}>
        <GlassButton
          accessibilityLabel={`Previous card in ${label}`}
          disabled={index === 0 || items.length === 0}
          onPress={() => navigate(index - 1)}
          size="sm"
        >
          ‹
        </GlassButton>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.mutedForeground }}>
          {items.length ? index + 1 : 0} / {items.length}
        </Text>
        <GlassButton
          accessibilityLabel={`Next card in ${label}`}
          disabled={index >= items.length - 1}
          onPress={() => navigate(index + 1)}
          size="sm"
        >
          ›
        </GlassButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 20 },
  deck: { overflow: 'hidden' },
  navigation: { alignItems: 'center', flexDirection: 'row', gap: 16, justifyContent: 'center' },
  stack: { gap: 12 },
});
