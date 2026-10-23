import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { BlurProofScene } from './showcase/blur-proof';

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

type Capture = {
  theme: 'light' | 'dark';
  mode: 'clear' | 'tinted';
  opaque: boolean;
  motion: boolean;
  screen: string;
  offset: number;
};

// The fixture accepts reproducible launch states; the installed components have no test API.
function captureFromUrl(url: string | null): Capture | null {
  if (!url?.startsWith('glassyui-proof://capture')) return null;
  const params = new URL(url).searchParams;

  return {
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
    mode: params.get('mode') === 'tinted' ? 'tinted' : 'clear',
    opaque: params.get('opaque') === '1',
    motion: params.get('motion') === '1',
    screen: params.get('screen') ?? 'gallery',
    offset: Math.max(0, Number(params.get('offset')) || 0),
  };
}

function Gallery({ capture }: { capture: Capture | null }) {
  const { colors, preferences } = useGlassTheme();
  const { setPreferences } = usePreferences();
  const [showApp, setShowApp] = useState(capture?.screen === 'today');
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (capture) {
      setPreferences({
        theme: capture.theme,
        mode: capture.mode,
        reduceTransparency: capture.opaque,
        reduceMotion: !capture.motion,
      });
    }
  }, [capture, setPreferences]);

  if (capture?.screen === 'boundary') return <BlurProofScene />;

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
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          onContentSizeChange={() => {
            if (capture) scroll.current?.scrollTo({ y: capture.offset, animated: false });
          }}
          testID="gallery"
        >
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
  const [launch, setLaunch] = useState<{ capture: Capture | null } | null>(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => setLaunch({ capture: captureFromUrl(url) }));
  }, []);

  if (!launch) return null;

  return (
    <GestureHandlerRootView style={styles.screen}>
      <GlassProvider>
        <GlassToastProvider>
          <Gallery capture={launch.capture} />
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
