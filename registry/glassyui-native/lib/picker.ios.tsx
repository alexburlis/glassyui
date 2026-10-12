import { Host } from '@expo/ui';
import { Picker, Text } from '@expo/ui/swift-ui';
import { disabled as nativeDisabled, pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { Text as NativeText, View } from 'react-native';
import type { GlassPickerProps } from '../glass-picker';
import { useGlassTheme } from '../glass-provider';

export function NativePicker<T extends string>({
  label,
  options,
  value,
  onValueChange,
  appearance = 'menu',
  disabled = false,
  testID,
}: GlassPickerProps<T>) {
  const { colors, preferences } = useGlassTheme();
  const wheel = appearance === 'wheel';

  return (
    <View
      style={{
        alignItems: wheel ? 'stretch' : 'center',
        flexDirection: wheel ? 'column' : 'row',
        gap: 12,
        justifyContent: 'space-between',
        minHeight: 44,
      }}
    >
      <NativeText style={{ color: colors.foreground, fontSize: 16 }}>{label}</NativeText>
      <Host
        colorScheme={preferences.theme}
        matchContents={wheel ? { vertical: true } : { horizontal: true }}
        style={wheel ? { width: '100%' } : { height: 44 }}
      >
        <Picker
          label={label}
          selection={value}
          onSelectionChange={onValueChange}
          modifiers={[pickerStyle(appearance), nativeDisabled(disabled), tint(colors.accent)]}
          testID={testID}
        >
          {options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}
