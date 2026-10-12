import { useState } from 'react';
import { Text, View } from 'react-native';
import { useGlassTheme } from '@/components/glassyui/glass-provider';
import { GlassSwitch } from '@/components/glassyui/glass-switch';

export default function SwitchExample() {
  const { colors } = useGlassTheme();
  const [notifications, setNotifications] = useState(true);

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.foreground, fontSize: 16 }}>Notifications</Text>
      <GlassSwitch
        accessibilityLabel="Notifications"
        checked={notifications}
        onCheckedChange={setNotifications}
      />
    </View>
  );
}
