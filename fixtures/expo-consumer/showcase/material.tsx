import { StyleSheet, Text, View } from 'react-native';
import { GlassBadge } from '../components/glassyui/glass-badge';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import { GlassSurface } from '../components/glassyui/glass-surface';
import { GlassSwitch } from '../components/glassyui/glass-switch';

export function MaterialShowcase() {
  const { colors } = useGlassTheme();

  return (
    <View style={styles.stack} testID="section-material">
      <GlassPanel>
        <Text style={[styles.heading, { color: colors.foreground }]}>Glassy UI</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Glass that bends what sits behind it, on iOS, Android and the web.
        </Text>
        <View style={styles.row}>
          <GlassButton testID="button-prominent" variant="prominent">
            Continue
          </GlassButton>
          <GlassButton testID="button-primary">Not now</GlassButton>
        </View>
      </GlassPanel>
      <View style={styles.row}>
        <GlassButton size="sm">Small</GlassButton>
        <GlassButton variant="soft">Soft</GlassButton>
        <GlassButton variant="ghost">Ghost</GlassButton>
        <GlassButton disabled size="lg">
          Disabled
        </GlassButton>
      </View>
      <View style={styles.row}>
        <GlassSurface preset="subtle" style={styles.tile}>
          Subtle
        </GlassSurface>
        <GlassSurface style={styles.tile}>Standard</GlassSurface>
        <GlassSurface preset="prominent" style={styles.tile}>
          Prominent
        </GlassSurface>
      </View>
      <GlassPanel variant="card" elevation="raised" style={styles.card}>
        <View style={styles.between}>
          <Text style={[styles.label, { color: colors.foreground }]}>Notifications</Text>
          <GlassSwitch accessibilityLabel="Notifications" defaultChecked testID="switch" />
        </View>
        <View style={styles.between}>
          <Text style={[styles.label, { color: colors.foreground }]}>Compact switch</Text>
          <GlassSwitch accessibilityLabel="Compact switch" size="sm" />
        </View>
        <View style={styles.row}>
          <GlassBadge>Neutral</GlassBadge>
          <GlassBadge tone="blue">Blue</GlassBadge>
          <GlassBadge dot tone="green">
            Online
          </GlassBadge>
          <GlassBadge tone="orange">Away</GlassBadge>
          <GlassBadge tone="red">3 new</GlassBadge>
          <GlassBadge tone="purple">Beta</GlassBadge>
        </View>
      </GlassPanel>
      <GlassPanel variant="pill">A pill of glass</GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  body: { fontSize: 15, lineHeight: 21, marginBottom: 16 },
  card: { gap: 14 },
  heading: { fontSize: 20, fontWeight: '600', marginBottom: 6 },
  label: { fontSize: 15 },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stack: { gap: 16 },
  tile: { alignItems: 'center', height: 72, justifyContent: 'center', width: 104 },
});
