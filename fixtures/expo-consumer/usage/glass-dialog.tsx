import { View } from 'react-native';
import { GlassButton } from '@/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogClose,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
  GlassDialogTrigger,
} from '@/components/glassyui/glass-dialog';

export default function DialogExample() {
  return (
    <GlassDialog>
      <GlassDialogTrigger>
        <GlassButton>Delete draft</GlassButton>
      </GlassDialogTrigger>
      <GlassDialogContent>
        <GlassDialogTitle>Delete this draft?</GlassDialogTitle>
        <GlassDialogDescription>It will be removed from all your devices.</GlassDialogDescription>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <GlassDialogClose>
            <GlassButton>Cancel</GlassButton>
          </GlassDialogClose>
          <GlassDialogClose>
            <GlassButton variant="prominent">Delete</GlassButton>
          </GlassDialogClose>
        </View>
      </GlassDialogContent>
    </GlassDialog>
  );
}
