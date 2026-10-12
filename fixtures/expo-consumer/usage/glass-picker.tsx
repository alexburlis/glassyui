import { useState } from 'react';
import { Text, View } from 'react-native';
import { GlassPicker } from '@/components/glassyui/glass-picker';
import { useGlassTheme } from '@/components/glassyui/glass-provider';

const OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

export default function PickerExample() {
  const { colors } = useGlassTheme();
  const [value, setValue] = useState('morning');

  return (
    <View style={{ gap: 12 }}>
      <GlassPicker
        label="Reminder"
        options={OPTIONS}
        value={value}
        onValueChange={setValue}
        testID="native-picker"
      />
      <Text style={{ color: colors.foreground }} testID="native-picker-value">
        {OPTIONS.find((option) => option.value === value)?.label}
      </Text>
    </View>
  );
}
