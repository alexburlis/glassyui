import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { GlassDock, GlassDockItem } from '@/components/glassyui/glass-dock';
import { useGlassTheme } from '@/components/glassyui/glass-provider';

const TABS = [
  { icon: 'home', label: 'Home' },
  { icon: 'calendar', label: 'Plans' },
  { icon: 'chatbubble', label: 'Messages' },
  { icon: 'person', label: 'Profile' },
] as const;

export default function DockExample() {
  const { colors } = useGlassTheme();
  const [tab, setTab] = useState<string>('Home');

  return (
    <GlassDock style={{ alignSelf: 'center' }}>
      {TABS.map(({ icon, label }) => (
        <GlassDockItem
          active={tab === label}
          key={label}
          label={label}
          onPress={() => setTab(label)}
        >
          <Ionicons color={colors.foreground} name={icon} size={24} />
        </GlassDockItem>
      ))}
    </GlassDock>
  );
}
