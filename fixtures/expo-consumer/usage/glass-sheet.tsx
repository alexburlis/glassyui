import { View } from 'react-native';
import { GlassButton } from '@/components/glassyui/glass-button';
import {
  GlassSheet,
  GlassSheetClose,
  GlassSheetContent,
  GlassSheetDescription,
  GlassSheetTitle,
  GlassSheetTrigger,
} from '@/components/glassyui/glass-sheet';

// Bottom sheets drag down to close. Pass side="top", "left" or "right" for the other edges.
export default function SheetExample() {
  return (
    <GlassSheet>
      <GlassSheetTrigger>
        <GlassButton>Share</GlassButton>
      </GlassSheetTrigger>
      <GlassSheetContent>
        <GlassSheetTitle>Share photo</GlassSheetTitle>
        <GlassSheetDescription>Send it to a nearby device.</GlassSheetDescription>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <GlassSheetClose>
            <GlassButton>Copy link</GlassButton>
          </GlassSheetClose>
          <GlassSheetClose>
            <GlassButton variant="prominent">Send</GlassButton>
          </GlassSheetClose>
        </View>
      </GlassSheetContent>
    </GlassSheet>
  );
}
