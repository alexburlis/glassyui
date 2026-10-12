import { useState } from 'react';
import { GlassAlert } from '@/components/glassyui/glass-alert';

export default function AlertExample() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <GlassAlert onDismiss={() => setVisible(false)} title="Payment failed" tone="danger">
      Update your card to keep your plan.
    </GlassAlert>
  );
}
