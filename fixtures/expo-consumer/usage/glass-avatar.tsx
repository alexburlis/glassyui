import { View } from 'react-native';
import { GlassAvatar, GlassAvatarGroup } from '@/components/glassyui/glass-avatar';

const TEAM = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson'];

export default function AvatarExample() {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 16 }}>
      {/* Pass src or source for a photo; the initials show until it loads. */}
      <GlassAvatar name="Morgan Lee" size="lg" status="online" />
      <GlassAvatarGroup accessibilityLabel="Team" max={3}>
        {TEAM.map((name) => (
          <GlassAvatar key={name} name={name} />
        ))}
      </GlassAvatarGroup>
    </View>
  );
}
