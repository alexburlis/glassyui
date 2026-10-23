import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassAvatar } from '../components/glassyui/glass-avatar';
import { GlassBadge } from '../components/glassyui/glass-badge';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassCheckbox } from '../components/glassyui/glass-checkbox';
import { GlassDock, GlassDockItem } from '../components/glassyui/glass-dock';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { GlassProgress } from '../components/glassyui/glass-progress';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import {
  GlassSegmentedControl,
  GlassSegmentedControlItem,
} from '../components/glassyui/glass-segmented-control';
import { GlassSwitch } from '../components/glassyui/glass-switch';

const TABS = [
  { icon: 'today', label: 'Today' },
  { icon: 'calendar', label: 'Plans' },
  { icon: 'chatbubble', label: 'Messages' },
  { icon: 'grid', label: 'Components' },
] as const;

/** An everyday app screen built only from the library, for showing the components at work. */
export function TodayScreen({ onExit }: { onExit: () => void }) {
  const { colors } = useGlassTheme();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState('day');
  const [focus, setFocus] = useState(true);
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set(['Stretch for ten minutes']));
  const title = [styles.cardTitle, { color: colors.foreground }];
  const muted = [styles.muted, { color: colors.mutedForeground }];

  const toggle = (task: string, checked: boolean) =>
    setDone((current) => {
      const next = new Set(current);

      if (checked) next.add(task);
      else next.delete(task);

      return next;
    });

  return (
    <View style={styles.screen} testID="today">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120, paddingTop: insets.top + 20 },
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={muted}>Thursday 3 October</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Today</Text>
          </View>
          <GlassAvatar name="Morgan Lee" status="online" />
        </View>
        <GlassSegmentedControl accessibilityLabel="Period" onValueChange={setPeriod} value={period}>
          <GlassSegmentedControlItem value="day">Day</GlassSegmentedControlItem>
          <GlassSegmentedControlItem value="week">Week</GlassSegmentedControlItem>
          <GlassSegmentedControlItem value="month">Month</GlassSegmentedControlItem>
        </GlassSegmentedControl>
        <GlassPanel style={styles.card} variant="card">
          <View style={styles.between}>
            <Text style={title}>Morning run</Text>
            <GlassBadge dot tone="green">
              On pace
            </GlassBadge>
          </View>
          <Text style={muted}>5.2 km in 28 minutes</Text>
          <GlassProgress label="Weekly goal" showValue value={72} />
        </GlassPanel>
        <GlassPanel style={styles.between} variant="card">
          <View style={styles.grow}>
            <Text style={title}>Focus</Text>
            <Text style={muted}>Alerts stay quiet until 11:00</Text>
          </View>
          <GlassSwitch accessibilityLabel="Focus" checked={focus} onCheckedChange={setFocus} />
        </GlassPanel>
        <GlassPanel style={styles.card} variant="card">
          <Text style={title}>Up next</Text>
          {['Stretch for ten minutes', 'Review the launch notes', 'Call Sam back'].map((task) => (
            <GlassCheckbox
              checked={done.has(task)}
              key={task}
              label={task}
              onCheckedChange={(checked) => toggle(task, checked)}
            />
          ))}
        </GlassPanel>
        <GlassButton size="lg" style={styles.wide} variant="prominent">
          Start a workout
        </GlassButton>
      </ScrollView>
      <GlassDock style={[styles.dock, { bottom: insets.bottom + 12 }]}>
        {TABS.map(({ icon, label }) => (
          <GlassDockItem
            active={label === 'Today'}
            key={label}
            label={label}
            onPress={label === 'Components' ? onExit : undefined}
            testID={`today-${label.toLowerCase()}`}
          >
            <Ionicons color={colors.foreground} name={icon} size={24} />
          </GlassDockItem>
        ))}
      </GlassDock>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  card: { gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  content: { gap: 16, paddingHorizontal: 20 },
  dock: { alignSelf: 'center', position: 'absolute' },
  grow: { flex: 1, gap: 2 },
  header: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  muted: { fontSize: 15 },
  screen: { flex: 1 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.4 },
  wide: { alignSelf: 'stretch' },
});
