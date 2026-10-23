import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { GlassBackdrop } from '../components/glassyui/glass-backdrop';
import { GlassButton } from '../components/glassyui/glass-button';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import { GlassSurface } from '../components/glassyui/glass-surface';

/** A native boundary scene: real installed surfaces over an independently changing target. */
export function BlurProofScene() {
  const { colors, preferences } = useGlassTheme();
  const [phase, setPhase] = useState(false);
  const [geometry, setGeometry] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [revision, setRevision] = useState(0);
  const [position] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (preferences.reduceMotion) {
      position.stopAnimation();
      position.setValue(0);

      return;
    }

    const animation = Animated.loop(
      Animated.timing(position, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => animation.stop();
  }, [position, preferences.reduceMotion]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: preferences.theme === 'dark' ? '#1c1c1e' : '#faf9f7' },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Backdrop boundary</Text>
      <View style={styles.actions}>
        <GlassButton testID="proof-phase" onPress={() => setPhase(!phase)}>
          Backdrop
        </GlassButton>
        <GlassButton testID="proof-geometry" onPress={() => setGeometry(!geometry)}>
          Geometry
        </GlassButton>
        <GlassButton testID="proof-detach" onPress={() => setMounted(!mounted)}>
          Attach
        </GlassButton>
        <GlassButton testID="proof-remount" onPress={() => setRevision(revision + 1)}>
          Remount
        </GlassButton>
      </View>
      <GlassBackdrop
        key={revision}
        style={[styles.target, { height: geometry ? 420 : 560 }]}
        backdrop={
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: phase ? '#123ce8' : '#e74a22' }]}
          >
            {Array.from({ length: 12 }, (_, index) => (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: index * 32 - 20,
                  top: 0,
                  bottom: 0,
                  width: 16,
                  backgroundColor: phase ? '#ffdc18' : '#ffffff',
                  transform: [{ rotate: '20deg' }],
                }}
              />
            ))}
            <Animated.View
              style={[
                styles.dot,
                {
                  transform: [
                    {
                      translateX: position.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 320],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        }
      >
        {mounted && (
          <View
            style={[
              styles.grid,
              {
                transform: [
                  { translateX: geometry ? 9 : 0 },
                  { scale: geometry ? 0.88 : 1 },
                  { rotate: geometry ? '8deg' : '0deg' },
                ],
              },
            ]}
          >
            {(['subtle', 'control', 'standard', 'prominent'] as const).map((preset) => (
              <GlassSurface key={preset} preset={preset} style={styles.tile}>
                <Text style={{ color: colors.foreground }}>{preset}</Text>
              </GlassSurface>
            ))}
          </View>
        )}
      </GlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 70, paddingHorizontal: 20, gap: 20 },
  title: { fontSize: 24, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  target: { width: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 16 },
  tile: { width: 130, height: 150, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 100, width: 100, height: 300, backgroundColor: '#08d7d3' },
});
