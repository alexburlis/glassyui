import { useState } from 'react';
import { GlassButton } from '@/components/glassyui/glass-button';
import {
  GlassToast,
  GlassToastAction,
  GlassToastDescription,
  GlassToastProvider,
  GlassToastTitle,
  GlassToastViewport,
} from '@/components/glassyui/glass-toast';

// Mount the provider and the viewport once, near the root of your app; toasts declared
// anywhere under the provider appear in the viewport.
export default function ToastExample() {
  const [open, setOpen] = useState(false);

  return (
    <GlassToastProvider>
      <GlassButton onPress={() => setOpen(true)}>Archive</GlassButton>
      <GlassToast onOpenChange={setOpen} open={open}>
        <GlassToastTitle>Message archived</GlassToastTitle>
        <GlassToastDescription>You can find it in Archive.</GlassToastDescription>
        <GlassToastAction altText="Restore the message" onPress={() => setOpen(false)}>
          Undo
        </GlassToastAction>
      </GlassToast>
      <GlassToastViewport />
    </GlassToastProvider>
  );
}
