import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCheckbox } from '../components/glassyui/glass-checkbox';
import { GlassInput } from '../components/glassyui/glass-input';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import { GlassRadioGroup, GlassRadioGroupItem } from '../components/glassyui/glass-radio-group';
import {
  GlassSegmentedControl,
  GlassSegmentedControlItem,
} from '../components/glassyui/glass-segmented-control';
import { GlassSlider } from '../components/glassyui/glass-slider';
import {
  GlassTabs,
  GlassTabsContent,
  GlassTabsList,
  GlassTabsTrigger,
} from '../components/glassyui/glass-tabs';
import { GlassTextarea } from '../components/glassyui/glass-textarea';

const PERIOD_CAPTION = { day: 'Today', week: 'This week', month: 'This month' } as const;

/** Every form control in its main states, in cards sized for a phone screenshot. */
export function ControlsShowcase() {
  const { colors } = useGlassTheme();
  const [alerts, setAlerts] = useState({ email: true, push: false });
  const [period, setPeriod] = useState<keyof typeof PERIOD_CAPTION>('week');
  const [volume, setVolume] = useState([40]);
  const [price, setPrice] = useState([20, 80]);
  const heading = [styles.heading, { color: colors.foreground }];
  const caption = [styles.caption, { color: colors.mutedForeground }];
  const bothAlerts = alerts.email && alerts.push;
  const allAlerts = bothAlerts || (!alerts.email && !alerts.push) ? bothAlerts : 'indeterminate';

  return (
    <View style={styles.stack}>
      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Text fields</Text>
        <GlassInput
          autoCapitalize="none"
          hint="We only use it to reply."
          keyboardType="email-address"
          label="Email"
          placeholder="you@example.com"
          testID="controls-input"
        />
        <GlassInput
          defaultValue="glassy ui"
          hint="Use letters and numbers only."
          invalid
          label="Username"
          testID="controls-input-invalid"
        />
        <GlassInput
          defaultValue="Free"
          editable={false}
          label="Plan"
          testID="controls-input-disabled"
        />
        <GlassTextarea
          autoResize
          label="Notes"
          maxRows={5}
          placeholder="Add a note"
          rows={2}
          testID="controls-textarea"
        />
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Checkboxes</Text>
        <View>
          <GlassCheckbox
            checked={allAlerts}
            label="All alerts"
            onCheckedChange={(next) => setAlerts({ email: next, push: next })}
            testID="controls-checkbox-all"
          />
          <GlassCheckbox
            checked={alerts.email}
            label="Email"
            onCheckedChange={(email) => setAlerts((previous) => ({ ...previous, email }))}
            style={styles.nested}
            testID="controls-checkbox-email"
          />
          <GlassCheckbox
            checked={alerts.push}
            description="On this phone only."
            label="Push"
            onCheckedChange={(push) => setAlerts((previous) => ({ ...previous, push }))}
            style={styles.nested}
            testID="controls-checkbox-push"
          />
          <GlassCheckbox defaultChecked label="Small" size="sm" testID="controls-checkbox-small" />
          <GlassCheckbox invalid label="Accept the terms" testID="controls-checkbox-invalid" />
          <GlassCheckbox
            defaultChecked
            disabled
            label="Managed by your team"
            testID="controls-checkbox-disabled"
          />
        </View>
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Radio group</Text>
        <GlassRadioGroup defaultValue="standard" testID="controls-radio-group">
          <GlassRadioGroupItem
            description="Three to five days."
            label="Standard"
            testID="controls-radio-standard"
            value="standard"
          />
          <GlassRadioGroupItem
            description="Next working day."
            label="Express"
            testID="controls-radio-express"
            value="express"
          />
          <GlassRadioGroupItem
            disabled
            label="Pickup"
            testID="controls-radio-pickup"
            value="pickup"
          />
        </GlassRadioGroup>
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Segmented control</Text>
        <GlassSegmentedControl
          onValueChange={(next) => setPeriod(next === 'day' || next === 'month' ? next : 'week')}
          testID="controls-segmented"
          value={period}
        >
          <GlassSegmentedControlItem testID="controls-segment-day" value="day">
            Day
          </GlassSegmentedControlItem>
          <GlassSegmentedControlItem testID="controls-segment-week" value="week">
            Week
          </GlassSegmentedControlItem>
          <GlassSegmentedControlItem testID="controls-segment-month" value="month">
            Month
          </GlassSegmentedControlItem>
        </GlassSegmentedControl>
        <Text style={caption} testID="controls-segmented-value">
          {PERIOD_CAPTION[period]}
        </Text>
        <GlassSegmentedControl defaultValue="list" disabled testID="controls-segmented-disabled">
          <GlassSegmentedControlItem value="list">List</GlassSegmentedControlItem>
          <GlassSegmentedControlItem value="grid">Grid</GlassSegmentedControlItem>
        </GlassSegmentedControl>
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Tabs</Text>
        <GlassTabs defaultValue="overview" testID="controls-tabs">
          <GlassTabsList>
            <GlassTabsTrigger testID="controls-tab-overview" value="overview">
              Overview
            </GlassTabsTrigger>
            <GlassTabsTrigger testID="controls-tab-activity" value="activity">
              Activity
            </GlassTabsTrigger>
            <GlassTabsTrigger disabled testID="controls-tab-billing" value="billing">
              Billing
            </GlassTabsTrigger>
          </GlassTabsList>
          <GlassTabsContent testID="controls-tab-panel-overview" value="overview">
            Three projects, all up to date.
          </GlassTabsContent>
          <GlassTabsContent testID="controls-tab-panel-activity" value="activity">
            No activity this week.
          </GlassTabsContent>
        </GlassTabs>
      </GlassPanel>

      <GlassPanel variant="card" style={styles.card}>
        <Text style={heading}>Sliders</Text>
        <Text style={caption} testID="controls-slider-volume-value">
          Volume {volume[0]}
        </Text>
        <GlassSlider
          accessibilityLabel="Volume"
          onValueChange={setVolume}
          testID="controls-slider-volume"
          value={volume}
        />
        <Text style={caption} testID="controls-slider-price-value">
          Price {price[0]} to {price[1]}
        </Text>
        <GlassSlider
          accessibilityLabel="Price"
          onValueChange={setPrice}
          step={5}
          testID="controls-slider-price"
          value={price}
        />
        <Text style={caption}>Disabled</Text>
        <GlassSlider
          accessibilityLabel="Brightness"
          defaultValue={[60]}
          disabled
          testID="controls-slider-disabled"
        />
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, lineHeight: 18 },
  card: { gap: 12 },
  heading: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  nested: { marginStart: 32 },
  stack: { gap: 20 },
});
