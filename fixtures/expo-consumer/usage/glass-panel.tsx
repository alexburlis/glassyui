import { Text } from 'react-native';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { useGlassTheme } from '@/components/glassyui/glass-provider';

export default function PanelExample() {
  const { colors } = useGlassTheme();

  return (
    <GlassPanel variant="card" style={{ gap: 4 }}>
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '600' }}>Morning run</Text>
      <Text style={{ color: colors.mutedForeground }}>5.2 km in 28 minutes</Text>
    </GlassPanel>
  );
}
