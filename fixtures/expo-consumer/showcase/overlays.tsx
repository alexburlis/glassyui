import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassButton } from '../components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogClose,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
  GlassDialogTrigger,
} from '../components/glassyui/glass-dialog';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { useGlassTheme } from '../components/glassyui/glass-provider';
import {
  GlassSheet,
  GlassSheetClose,
  GlassSheetContent,
  GlassSheetDescription,
  GlassSheetTitle,
  GlassSheetTrigger,
} from '../components/glassyui/glass-sheet';
import { GlassSwitch } from '../components/glassyui/glass-switch';
import {
  GlassToast,
  GlassToastAction,
  GlassToastClose,
  GlassToastDescription,
  GlassToastTitle,
} from '../components/glassyui/glass-toast';

// The toast viewport belongs near an app's root. Here it sits in this section so the section
// stands alone, and its toasts appear at the section's top.
export function OverlaysShowcase() {
  const { colors } = useGlassTheme();
  const [archived, setArchived] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <View style={styles.stack} testID="section-overlays">
      <GlassPanel>
        <Text style={[styles.heading, { color: colors.foreground }]}>Overlays</Text>
        <View style={styles.row}>
          <GlassDialog>
            <GlassDialogTrigger>
              <GlassButton testID="open-dialog">Dialog</GlassButton>
            </GlassDialogTrigger>
            <GlassDialogContent testID="dialog">
              <GlassDialogTitle>Delete this draft?</GlassDialogTitle>
              <GlassDialogDescription>
                It will be removed from all your devices.
              </GlassDialogDescription>
              <View style={styles.actions}>
                <GlassDialogClose>
                  <GlassButton testID="dialog-cancel">Cancel</GlassButton>
                </GlassDialogClose>
                <GlassDialogClose>
                  <GlassButton testID="dialog-delete" variant="prominent">
                    Delete
                  </GlassButton>
                </GlassDialogClose>
              </View>
            </GlassDialogContent>
          </GlassDialog>
          <GlassSheet>
            <GlassSheetTrigger>
              <GlassButton testID="open-sheet">Sheet</GlassButton>
            </GlassSheetTrigger>
            <GlassSheetContent testID="sheet">
              <GlassSheetTitle>Share photo</GlassSheetTitle>
              <GlassSheetDescription>Send it to a nearby device.</GlassSheetDescription>
              <View style={styles.actions}>
                <GlassSheetClose>
                  <GlassButton testID="sheet-copy">Copy link</GlassButton>
                </GlassSheetClose>
                <GlassSheetClose>
                  <GlassButton testID="sheet-send" variant="prominent">
                    Send
                  </GlassButton>
                </GlassSheetClose>
              </View>
            </GlassSheetContent>
          </GlassSheet>
          <GlassSheet>
            <GlassSheetTrigger>
              <GlassButton testID="open-side-sheet">Side sheet</GlassButton>
            </GlassSheetTrigger>
            <GlassSheetContent side="right" testID="side-sheet">
              <GlassSheetTitle>Filters</GlassSheetTitle>
              <GlassSheetDescription>Choose what the list shows.</GlassSheetDescription>
              <View style={styles.option}>
                <Text style={[styles.label, { color: colors.foreground }]}>Show archived</Text>
                <GlassSwitch
                  accessibilityLabel="Show archived"
                  checked={archived}
                  onCheckedChange={setArchived}
                  testID="side-sheet-archived"
                />
              </View>
              <GlassSheetClose>
                <GlassButton testID="side-sheet-done" variant="prominent">
                  Done
                </GlassButton>
              </GlassSheetClose>
            </GlassSheetContent>
          </GlassSheet>
          <GlassButton testID="show-toast" onPress={() => setToastOpen(true)}>
            Toast
          </GlassButton>
        </View>
      </GlassPanel>
      <GlassToast open={toastOpen} onOpenChange={setToastOpen} testID="toast">
        <GlassToastTitle>Message archived</GlassToastTitle>
        <GlassToastDescription>You can find it in Archive.</GlassToastDescription>
        <GlassToastAction altText="Open Archive to restore it" testID="toast-undo">
          Undo
        </GlassToastAction>
        <GlassToastClose testID="toast-dismiss" />
      </GlassToast>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  heading: { fontSize: 20, fontWeight: '600', marginBottom: 14 },
  label: { fontSize: 15 },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stack: { gap: 16 },
});
