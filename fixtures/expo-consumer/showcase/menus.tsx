import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassButton } from '../components/glassyui/glass-button';
import {
  GlassMenu,
  GlassMenuCheckboxItem,
  GlassMenuContent,
  GlassMenuItem,
  GlassMenuLabel,
  GlassMenuRadioGroup,
  GlassMenuRadioItem,
  GlassMenuSeparator,
  GlassMenuShortcut,
  GlassMenuTrigger,
} from '../components/glassyui/glass-menu';
import { GlassPanel } from '../components/glassyui/glass-panel';
import {
  GlassPopover,
  GlassPopoverContent,
  GlassPopoverTrigger,
} from '../components/glassyui/glass-popover';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import {
  GlassSelect,
  GlassSelectContent,
  GlassSelectGroup,
  GlassSelectItem,
  GlassSelectLabel,
  GlassSelectSeparator,
  GlassSelectTrigger,
  GlassSelectValue,
} from '../components/glassyui/glass-select';

const SORT_ORDERS = ['Name', 'Date', 'Size'];

/** A menu, a select and a popover, each growing out of its trigger. */
export function MenusShowcase() {
  const { colors } = useGlassTheme();
  const [framework, setFramework] = useState('');
  const [sidebar, setSidebar] = useState(true);
  const [sort, setSort] = useState('Name');
  const [lastAction, setLastAction] = useState('None');
  const status = [styles.status, { color: colors.mutedForeground }];

  return (
    <View style={styles.stack} testID="section-menus">
      <GlassPanel variant="card" style={styles.card}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Menus</Text>
        <View style={styles.row}>
          <GlassMenu>
            <GlassMenuTrigger>
              <GlassButton testID="open-menu">Options</GlassButton>
            </GlassMenuTrigger>
            <GlassMenuContent testID="menu">
              <GlassMenuItem inset onSelect={() => setLastAction('New window')}>
                New window
                <GlassMenuShortcut>⌘N</GlassMenuShortcut>
              </GlassMenuItem>
              <GlassMenuItem inset onSelect={() => setLastAction('Duplicate')}>
                Duplicate
                <GlassMenuShortcut>⌘D</GlassMenuShortcut>
              </GlassMenuItem>
              <GlassMenuSeparator />
              <GlassMenuCheckboxItem checked={sidebar} onCheckedChange={setSidebar}>
                Show sidebar
              </GlassMenuCheckboxItem>
              <GlassMenuSeparator />
              <GlassMenuLabel>Sort by</GlassMenuLabel>
              <GlassMenuRadioGroup onValueChange={setSort} value={sort}>
                {SORT_ORDERS.map((order) => (
                  <GlassMenuRadioItem key={order} value={order}>
                    {order}
                  </GlassMenuRadioItem>
                ))}
              </GlassMenuRadioGroup>
              <GlassMenuSeparator />
              <GlassMenuItem inset onSelect={() => setLastAction('Delete')} tone="destructive">
                Delete
              </GlassMenuItem>
            </GlassMenuContent>
          </GlassMenu>
          <GlassPopover>
            <GlassPopoverTrigger>
              <GlassButton testID="open-popover">Popover</GlassButton>
            </GlassPopoverTrigger>
            <GlassPopoverContent testID="popover">
              Anchored to its trigger. Tap outside to close.
            </GlassPopoverContent>
          </GlassPopover>
        </View>
        <GlassSelect onValueChange={setFramework} value={framework}>
          <GlassSelectTrigger accessibilityLabel="Framework" testID="open-select">
            <GlassSelectValue placeholder="Choose a framework" />
          </GlassSelectTrigger>
          <GlassSelectContent testID="select">
            <GlassSelectGroup>
              <GlassSelectLabel>React</GlassSelectLabel>
              <GlassSelectItem value="Next.js">Next.js</GlassSelectItem>
              <GlassSelectItem value="Remix">Remix</GlassSelectItem>
            </GlassSelectGroup>
            <GlassSelectSeparator />
            <GlassSelectGroup>
              <GlassSelectLabel>Other</GlassSelectLabel>
              <GlassSelectItem value="Astro">Astro</GlassSelectItem>
              <GlassSelectItem value="SvelteKit">SvelteKit</GlassSelectItem>
              <GlassSelectItem disabled value="Nuxt">
                Nuxt
              </GlassSelectItem>
            </GlassSelectGroup>
          </GlassSelectContent>
        </GlassSelect>
        <Text style={status} testID="select-value">
          Framework: {framework || 'none'}
        </Text>
        <Text style={status} testID="menu-state">
          Last action: {lastAction}. Sidebar {sidebar ? 'shown' : 'hidden'}, sorted by{' '}
          {sort.toLowerCase()}.
        </Text>
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  heading: { fontSize: 20, fontWeight: '600' },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stack: { gap: 16 },
  status: { fontSize: 14, lineHeight: 20 },
});
