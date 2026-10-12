import { GlassButton } from '@/components/glassyui/glass-button';
import { GlassProvider, usePreferences } from '@/components/glassyui/glass-provider';

function ThemeButton() {
  const { preferences, setPreferences } = usePreferences();
  const next = preferences.theme === 'dark' ? 'light' : 'dark';

  return (
    <GlassButton onPress={() => setPreferences({ theme: next })}>
      {next === 'light' ? 'Use light glass' : 'Use dark glass'}
    </GlassButton>
  );
}

// Wrap your app once. It follows the device's appearance, Reduce Motion and Reduce
// Transparency settings until you set your own.
export default function ProviderExample() {
  return (
    <GlassProvider>
      <ThemeButton />
    </GlassProvider>
  );
}
