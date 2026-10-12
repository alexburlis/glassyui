import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ReduceMotion } from 'react-native-reanimated';
import { useGlassTheme } from './glass-provider';
import { GlassSurface } from './glass-surface';
import { selectionHaptic } from './lib/selection-haptic';
import { GLASS_MOTION, GLASS_RADIUS } from './lib/tokens';

export type GlassSwipeAction = {
  id: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export type GlassSwipeRowProps = {
  children: ReactNode;
  label: string;
  actions: readonly GlassSwipeAction[];
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Swipe left to reveal actions; the labelled action button also works with a keyboard. */
export function GlassSwipeRow({
  children,
  label,
  actions,
  haptics = true,
  style,
  testID,
}: GlassSwipeRowProps) {
  const { colors, preferences } = useGlassTheme();
  const swipeable = useRef<SwipeableMethods>(null);
  const [open, setOpen] = useState(false);

  function activate(action: GlassSwipeAction) {
    swipeable.current?.close();
    action.onPress();
  }

  return (
    <View style={style} testID={testID}>
      <ReanimatedSwipeable
        ref={swipeable}
        enabled={actions.length > 0}
        friction={1}
        overshootLeft={false}
        overshootRight={false}
        enableTrackpadTwoFingerGesture
        animationOptions={{
          ...GLASS_MOTION.spring,
          reduceMotion: preferences.reduceMotion ? ReduceMotion.Always : ReduceMotion.System,
        }}
        containerStyle={styles.container}
        onSwipeableWillOpen={() => setOpen(true)}
        onSwipeableWillClose={() => setOpen(false)}
        onSwipeableOpen={() => selectionHaptic(haptics)}
        renderRightActions={() => (
          <View
            style={styles.actions}
            accessibilityElementsHidden={!open}
            importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          >
            {actions.map((action) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.label}
                key={action.id}
                onPress={() => activate(action)}
                style={[
                  styles.action,
                  { backgroundColor: action.destructive ? colors.invalid : colors.accent },
                ]}
              >
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      >
        <GlassSurface preset="control" elevation="none" style={styles.row}>
          <View style={styles.content}>{children}</View>
          {actions.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${open ? 'Close actions' : 'Actions'} for ${label}`}
              onPress={() => (open ? swipeable.current?.close() : swipeable.current?.openRight())}
              style={styles.trigger}
            >
              <Text style={[styles.dots, { color: colors.mutedForeground }]}>···</Text>
            </Pressable>
          ) : null}
        </GlassSurface>
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', justifyContent: 'center', minWidth: 80, paddingHorizontal: 16 },
  actionLabel: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row' },
  container: { borderRadius: GLASS_RADIUS.md },
  content: { flex: 1 },
  dots: { fontSize: 28, fontWeight: '600' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 64, paddingLeft: 16 },
  trigger: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
});
