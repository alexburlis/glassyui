import { useState } from 'react';
import { Text, View } from 'react-native';
import { useGlassTheme } from '@/components/glassyui/glass-provider';
import { GlassSwipeRow } from '@/components/glassyui/glass-swipe-row';

export default function SwipeRowExample() {
  const { colors } = useGlassTheme();
  const [result, setResult] = useState('Ready');

  return (
    <View style={{ gap: 12 }}>
      <GlassSwipeRow
        label="Design review"
        actions={[
          { id: 'pin', label: 'Pin', onPress: () => setResult('Pinned') },
          { id: 'archive', label: 'Archive', onPress: () => setResult('Archived') },
        ]}
        testID="native-swipe-row"
      >
        <Text style={{ color: colors.foreground, fontSize: 17 }}>Design review</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Today, 10:00</Text>
      </GlassSwipeRow>
      <Text style={{ color: colors.foreground }} testID="native-swipe-value">
        {result}
      </Text>
    </View>
  );
}
