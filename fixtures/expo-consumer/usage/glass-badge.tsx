import { View } from 'react-native';
import { GlassBadge } from '@/components/glassyui/glass-badge';

export default function BadgeExample() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <GlassBadge dot tone="green">
        Online
      </GlassBadge>
      <GlassBadge tone="blue">New</GlassBadge>
      <GlassBadge tone="red">3 unread</GlassBadge>
    </View>
  );
}
