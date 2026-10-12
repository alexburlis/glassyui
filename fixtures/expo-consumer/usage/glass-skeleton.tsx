import { View } from 'react-native';
import { GlassSkeleton } from '@/components/glassyui/glass-skeleton';

export default function SkeletonExample() {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <GlassSkeleton variant="circle" />
      <View style={{ flex: 1, gap: 8 }}>
        <GlassSkeleton style={{ height: 16, width: '60%' }} />
        <GlassSkeleton lines={2} variant="text" />
      </View>
    </View>
  );
}
