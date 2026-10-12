import { StyleSheet, Text, View } from 'react-native';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import ProviderExample from '../usage/glass-provider';
import SurfaceExample from '../usage/glass-surface';
import ButtonExample from '../usage/glass-button';
import PanelExample from '../usage/glass-panel';
import InputExample from '../usage/glass-input';
import TextareaExample from '../usage/glass-textarea';
import CheckboxExample from '../usage/glass-checkbox';
import RadioGroupExample from '../usage/glass-radio-group';
import SwitchExample from '../usage/glass-switch';
import SliderExample from '../usage/glass-slider';
import SegmentedControlExample from '../usage/glass-segmented-control';
import TabsExample from '../usage/glass-tabs';
import BadgeExample from '../usage/glass-badge';
import ProgressExample from '../usage/glass-progress';
import SpinnerExample from '../usage/glass-spinner';
import SkeletonExample from '../usage/glass-skeleton';
import AlertExample from '../usage/glass-alert';
import AvatarExample from '../usage/glass-avatar';
import AccordionExample from '../usage/glass-accordion';
import DockExample from '../usage/glass-dock';
import DialogExample from '../usage/glass-dialog';
import SheetExample from '../usage/glass-sheet';
import ToastExample from '../usage/glass-toast';
import MenuExample from '../usage/glass-menu';
import SelectExample from '../usage/glass-select';
import PopoverExample from '../usage/glass-popover';

// The same files the component pages show as React Native usage, rendered so they are known to run.
const EXAMPLES = [
  { name: 'glass-provider', title: 'Glass Provider', Example: ProviderExample },
  { name: 'glass-surface', title: 'Glass Surface', Example: SurfaceExample },
  { name: 'glass-button', title: 'Glass Button', Example: ButtonExample },
  { name: 'glass-panel', title: 'Glass Panel', Example: PanelExample },
  { name: 'glass-input', title: 'Glass Input', Example: InputExample },
  { name: 'glass-textarea', title: 'Glass Textarea', Example: TextareaExample },
  { name: 'glass-checkbox', title: 'Glass Checkbox', Example: CheckboxExample },
  { name: 'glass-radio-group', title: 'Glass Radio Group', Example: RadioGroupExample },
  { name: 'glass-switch', title: 'Glass Switch', Example: SwitchExample },
  { name: 'glass-slider', title: 'Glass Slider', Example: SliderExample },
  {
    name: 'glass-segmented-control',
    title: 'Glass Segmented Control',
    Example: SegmentedControlExample,
  },
  { name: 'glass-tabs', title: 'Glass Tabs', Example: TabsExample },
  { name: 'glass-badge', title: 'Glass Badge', Example: BadgeExample },
  { name: 'glass-progress', title: 'Glass Progress', Example: ProgressExample },
  { name: 'glass-spinner', title: 'Glass Spinner', Example: SpinnerExample },
  { name: 'glass-skeleton', title: 'Glass Skeleton', Example: SkeletonExample },
  { name: 'glass-alert', title: 'Glass Alert', Example: AlertExample },
  { name: 'glass-avatar', title: 'Glass Avatar', Example: AvatarExample },
  { name: 'glass-accordion', title: 'Glass Accordion', Example: AccordionExample },
  { name: 'glass-dock', title: 'Glass Dock', Example: DockExample },
  { name: 'glass-dialog', title: 'Glass Dialog', Example: DialogExample },
  { name: 'glass-sheet', title: 'Glass Sheet', Example: SheetExample },
  { name: 'glass-toast', title: 'Glass Toast', Example: ToastExample },
  { name: 'glass-menu', title: 'Glass Menu', Example: MenuExample },
  { name: 'glass-select', title: 'Glass Select', Example: SelectExample },
  { name: 'glass-popover', title: 'Glass Popover', Example: PopoverExample },
];

export function UsageShowcase() {
  const { colors } = useGlassTheme();

  return (
    <View style={styles.stack} testID="section-usage">
      <Text style={[styles.heading, { color: colors.foreground }]}>Usage examples</Text>
      {EXAMPLES.map(({ Example, name, title }) => (
        <GlassPanel key={name} style={styles.card} testID={`usage-${name}`} variant="card">
          <Text style={[styles.title, { color: colors.mutedForeground }]}>{title}</Text>
          <Example />
        </GlassPanel>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  heading: { fontSize: 24, fontWeight: '600', marginTop: 12 },
  stack: { gap: 16 },
  title: { fontSize: 13, fontWeight: '600' },
});
