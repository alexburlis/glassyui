import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GlassBackdrop } from './components/glassyui/glass-backdrop';
import { GlassButton } from './components/glassyui/glass-button';
import { GlassProvider, useGlassTheme, usePreferences } from './components/glassyui/glass-provider';
import { GlassToastProvider, GlassToastViewport } from './components/glassyui/glass-toast';
import { ControlsShowcase } from './showcase/controls';
import { DisplayShowcase } from './showcase/display';
import { MaterialShowcase } from './showcase/material';
import { MenusShowcase } from './showcase/menus';
import { NativeInteractionsShowcase } from './showcase/native-interactions';
import { OverlaysShowcase } from './showcase/overlays';
import { TodayScreen } from './showcase/today';
import { UsageShowcase } from './showcase/usage';

// Metro bundles images through require.
const WALLPAPERS = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  dark: require('./assets/wallpapers/vermilion-dark.jpg'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  light: require('./assets/wallpapers/vermilion-light.jpg'),
};

// Toggles the preferences every component follows, so one run can cover each look.
function PreferenceBar({ onShowApp }: { onShowApp: () => void }) {
  const { preferences, setPreferences } = usePreferences();

  return (
    <View style={styles.row}>
      <GlassButton onPress={onShowApp} size="sm" testID="toggle-demo" variant="prominent">
        App
      </GlassButton>
      <GlassButton
        size="sm"
        testID="toggle-theme"
        onPress={() => setPreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })}
      >
        {preferences.theme === 'dark' ? 'Light' : 'Dark'}
      </GlassButton>
      <GlassButton
        size="sm"
        testID="toggle-mode"
        onPress={() => setPreferences({ mode: preferences.mode === 'clear' ? 'tinted' : 'clear' })}
      >
        {preferences.mode === 'clear' ? 'Tinted' : 'Clear'}
      </GlassButton>
      <GlassButton
        size="sm"
        testID="toggle-transparency"
        onPress={() => setPreferences({ reduceTransparency: !preferences.reduceTransparency })}
      >
        {preferences.reduceTransparency ? 'Glass' : 'Opaque'}
      </GlassButton>
      <GlassButton
        size="sm"
        testID="toggle-motion"
        onPress={() => setPreferences({ reduceMotion: !preferences.reduceMotion })}
      >
        {preferences.reduceMotion ? 'Motion' : 'Still'}
      </GlassButton>
    </View>
  );
}

function Gallery() {
  const { colors, preferences } = useGlassTheme();
  const [showApp, setShowApp] = useState(false);

  return (
    <GlassBackdrop
      style={[
        styles.screen,
        { backgroundColor: preferences.theme === 'light' ? '#faf9f7' : '#1c1c1e' },
      ]}
      backdrop={
        <Image
          alt=""
          source={WALLPAPERS[preferences.theme]}
          style={styles.wallpaper}
          resizeMode="cover"
        />
      }
    >
      <StatusBar style={preferences.theme === 'dark' ? 'light' : 'dark'} />
      {showApp ? (
        <TodayScreen onExit={() => setShowApp(false)} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} testID="gallery">
          <Text style={[styles.title, { color: colors.foreground }]}>Glassy UI for Expo</Text>
          <PreferenceBar onShowApp={() => setShowApp(true)} />
          <MaterialShowcase />
          <NativeInteractionsShowcase />
          <View testID="section-controls">
            <ControlsShowcase />
          </View>
          <DisplayShowcase />
          <OverlaysShowcase />
          <MenusShowcase />
          <UsageShowcase />
        </ScrollView>
      )}
      <GlassToastViewport />
    </GlassBackdrop>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.screen}>
      <GlassProvider>
        <GlassToastProvider>
          <Gallery />
        </GlassToastProvider>
      </GlassProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20, padding: 20, paddingBottom: 96, paddingTop: 72 },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  screen: { flex: 1 },
  title: { fontSize: 32, fontWeight: '600', letterSpacing: -0.5 },
  wallpaper: { height: '100%', width: '100%' },
});
