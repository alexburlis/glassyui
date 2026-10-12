import { useState } from 'react';
import { Text, View } from 'react-native';
import { GlassCardStack } from '@/components/glassyui/glass-card-stack';
import { useGlassTheme } from '@/components/glassyui/glass-provider';

const CARDS = [
  { id: 'morning', title: 'Morning', detail: 'Make room for the important work.' },
  { id: 'afternoon', title: 'Afternoon', detail: 'A little time to explore.' },
  { id: 'evening', title: 'Evening', detail: 'Finish the day at your own pace.' },
];

export default function CardStackExample() {
  const { colors } = useGlassTheme();
  const [index, setIndex] = useState(0);

  return (
    <View style={{ gap: 12 }}>
      <GlassCardStack
        items={CARDS}
        activeIndex={index}
        onIndexChange={setIndex}
        label="Daily plan"
        testID="native-card-stack"
        renderCard={(card) => (
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Daily plan</Text>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: '600' }}>
                {card.title}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>{card.detail}</Text>
            </View>
          </View>
        )}
      />
      <Text style={{ color: colors.foreground }} testID="native-stack-value">
        {CARDS[index].title}
      </Text>
    </View>
  );
}
