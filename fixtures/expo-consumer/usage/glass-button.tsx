import { useState } from 'react';
import { View } from 'react-native';
import { GlassButton } from '@/components/glassyui/glass-button';

export default function ButtonExample() {
  const [saved, setSaved] = useState(false);

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <GlassButton variant="prominent" onPress={() => setSaved(true)}>
        {saved ? 'Saved' : 'Save'}
      </GlassButton>
      <GlassButton disabled={!saved} onPress={() => setSaved(false)}>
        Undo
      </GlassButton>
    </View>
  );
}
