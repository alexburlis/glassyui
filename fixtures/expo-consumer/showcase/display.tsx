import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GlassAccordion,
  GlassAccordionContent,
  GlassAccordionItem,
  GlassAccordionTrigger,
} from '../components/glassyui/glass-accordion';
import { GlassAlert } from '../components/glassyui/glass-alert';
import { GlassAvatar, GlassAvatarGroup } from '../components/glassyui/glass-avatar';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassDock, GlassDockItem, GlassDockSeparator } from '../components/glassyui/glass-dock';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { GlassProgress } from '../components/glassyui/glass-progress';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import { GlassSkeleton } from '../components/glassyui/glass-skeleton';
import { GlassSpinner } from '../components/glassyui/glass-spinner';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro bundles images through require.
const PHOTO = require('../assets/wallpapers/vermilion-dark.jpg');

const TEAM = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson', 'Linus Torvalds'];

// App tiles in the colours of the web dock example.
const APPS = [
  { from: '#407fe7', label: 'Inbox', to: '#205ac4' },
  { from: '#318e68', label: 'Chat', to: '#1d654c' },
  { from: '#c9892f', label: 'Gallery', to: '#a76518' },
  { from: '#8e8e97', label: 'Docs', to: '#686870' },
] as const;

type App = (typeof APPS)[number];

function AppTile({ app }: { app: App }) {
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: app.from,
          experimental_backgroundImage: `linear-gradient(160deg, ${app.from}, ${app.to})`,
        },
      ]}
    >
      <Text style={styles.tileText}>{app.label[0]}</Text>
    </View>
  );
}

/** Progress, spinners, skeletons, alerts, avatars, an accordion and a dock in their main states. */
export function DisplayShowcase() {
  const { colors } = useGlassTheme();
  const [progress, setProgress] = useState(35);
  const [paymentAlert, setPaymentAlert] = useState(true);
  const [running, setRunning] = useState<readonly string[]>(['Chat']);
  const heading = [styles.heading, { color: colors.foreground }];
  const caption = [styles.caption, { color: colors.mutedForeground }];

  const renderApp = (app: App) => (
    <GlassDockItem
      active={running.includes(app.label)}
      key={app.label}
      label={app.label}
      onPress={() =>
        setRunning((current) => (current.includes(app.label) ? current : [...current, app.label]))
      }
      testID={`display-dock-${app.label.toLowerCase()}`}
    >
      <AppTile app={app} />
    </GlassDockItem>
  );

  return (
    <View style={styles.stack} testID="section-display">
      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Progress</Text>
        <GlassProgress label="Uploading" showValue testID="display-progress" value={progress} />
        <GlassProgress
          accessibilityLabel="Working"
          size="sm"
          testID="display-progress-indeterminate"
          value={null}
        />
        <GlassProgress accessibilityLabel="Storage" size="lg" value={80} />
        <GlassButton
          onPress={() => setProgress(progress >= 100 ? 0 : Math.min(100, progress + 25))}
          size="sm"
          testID="display-progress-advance"
          variant="soft"
        >
          {progress >= 100 ? 'Restart' : 'Advance'}
        </GlassButton>
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Spinners and skeletons</Text>
        <View style={styles.row}>
          <GlassSpinner label="Loading small" size="sm" testID="display-spinner-sm" />
          <GlassSpinner testID="display-spinner-md" />
          <GlassSpinner label="Loading large" size="lg" testID="display-spinner-lg" />
        </View>
        <View accessibilityState={{ busy: true }} style={styles.profile} testID="display-skeleton">
          <GlassSkeleton variant="circle" />
          <View style={styles.profileText}>
            <GlassSkeleton style={styles.skeletonTitle} />
            <GlassSkeleton lines={2} variant="text" />
          </View>
        </View>
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Alerts</Text>
        <GlassAlert testID="display-alert-info" title="Heads up">
          Your trial ends in three days.
        </GlassAlert>
        <GlassAlert testID="display-alert-success" title="Saved" tone="success">
          Every change is in.
        </GlassAlert>
        <GlassAlert testID="display-alert-warning" title="Almost full" tone="warning">
          You have used 92% of your storage.
        </GlassAlert>
        {paymentAlert ? (
          <GlassAlert
            onDismiss={() => setPaymentAlert(false)}
            testID="display-alert-danger"
            title="Payment failed"
            tone="danger"
          >
            Update your card to keep your plan.
          </GlassAlert>
        ) : (
          <GlassButton
            onPress={() => setPaymentAlert(true)}
            size="sm"
            testID="display-alert-restore"
            variant="soft"
          >
            Show the alert again
          </GlassButton>
        )}
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Avatars</Text>
        <View style={styles.row}>
          <GlassAvatar
            name="Vermilion Studio"
            size="xs"
            source={PHOTO}
            testID="display-avatar-xs"
          />
          <GlassAvatar name="Ada Lovelace" size="sm" status="offline" />
          <GlassAvatar
            name="Grace Hopper"
            source={PHOTO}
            status="online"
            testID="display-avatar-image"
          />
          <GlassAvatar name="Alan Turing" size="lg" status="away" />
          <GlassAvatar name="Katherine Johnson" size="xl" status="busy" />
        </View>
        <View style={styles.row}>
          {/* Without an image, the initials stand in. */}
          <GlassAvatar name="Linus Torvalds" testID="display-avatar-fallback" />
          <GlassAvatarGroup accessibilityLabel="Team" max={3} testID="display-avatar-group">
            {TEAM.map((person) => (
              <GlassAvatar key={person} name={person} />
            ))}
          </GlassAvatarGroup>
        </View>
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Accordion</Text>
        <GlassAccordion
          collapsible
          defaultValue="glass"
          style={styles.accordion}
          testID="display-accordion"
        >
          <GlassAccordionItem value="glass">
            <GlassAccordionTrigger testID="display-accordion-glass">
              What makes it glass?
            </GlassAccordionTrigger>
            <GlassAccordionContent testID="display-accordion-glass-content">
              Frost, a lit rim and, where the system offers it, glass that bends the light behind
              it.
            </GlassAccordionContent>
          </GlassAccordionItem>
          <GlassAccordionItem value="motion">
            <GlassAccordionTrigger testID="display-accordion-motion">
              Does it follow Reduce Motion?
            </GlassAccordionTrigger>
            <GlassAccordionContent testID="display-accordion-motion-content">
              Yes. Every change keeps its end state and drops the movement.
            </GlassAccordionContent>
          </GlassAccordionItem>
          <GlassAccordionItem disabled value="later">
            <GlassAccordionTrigger testID="display-accordion-disabled">
              Coming later
            </GlassAccordionTrigger>
            <GlassAccordionContent>Not ready yet.</GlassAccordionContent>
          </GlassAccordionItem>
        </GlassAccordion>
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Dock</Text>
        <GlassDock style={styles.dock} testID="display-dock">
          {APPS.slice(0, 3).map(renderApp)}
          <GlassDockSeparator />
          {APPS.slice(3).map(renderApp)}
        </GlassDock>
        <Text style={caption}>Hold an icon to see its name.</Text>
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  accordion: { gap: 8 },
  caption: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  card: { gap: 12 },
  // Room above the dock for the label a held icon shows.
  dock: { alignSelf: 'center', marginTop: 36 },
  heading: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  profile: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  profileText: { flex: 1, gap: 10 },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  skeletonTitle: { height: 14, width: '55%' },
  stack: { gap: 20 },
  tile: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10.8,
    boxShadow: 'inset 0px 0px 0px 1px rgba(255, 255, 255, 0.2)',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  tileText: { color: '#ffffff', fontSize: 20, fontWeight: '600' },
});
