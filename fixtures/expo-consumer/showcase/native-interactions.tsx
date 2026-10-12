import { StyleSheet, Text, View } from 'react-native';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import PickerExample from '../usage/glass-picker';
import SwipeRowExample from '../usage/glass-swipe-row';
import CardStackExample from '../usage/glass-card-stack';

export function NativeInteractionsShowcase() {
  const { colors } = useGlassTheme();

  return (
    <View style={styles.stack} testID="section-native-interactions">
      <Text style={[styles.heading, { color: colors.foreground }]}>Native interactions</Text>
      {[
        { title: 'System picker', Example: PickerExample },
        { title: 'Swipe actions', Example: SwipeRowExample },
        { title: 'Card stack', Example: CardStackExample },
      ].map(({ title, Example }) => (
        <GlassPanel key={title} style={styles.card} variant="card">
          <Text style={[styles.title, { color: colors.mutedForeground }]}>{title}</Text>
          <Example />
        </GlassPanel>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  heading: { fontSize: 24, fontWeight: '600' },
  stack: { gap: 16 },
  title: { fontSize: 13, fontWeight: '600' },
});
