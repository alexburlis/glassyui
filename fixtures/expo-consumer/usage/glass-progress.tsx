import { View } from 'react-native';
import { GlassProgress } from '@/components/glassyui/glass-progress';

export default function ProgressExample() {
  return (
    <View style={{ gap: 16 }}>
      <GlassProgress label="Uploading" showValue value={35} />
      {/* Without a value, the fill sweeps until the length is known. */}
      <GlassProgress accessibilityLabel="Syncing" value={null} />
    </View>
  );
}
