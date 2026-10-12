import { useState } from 'react';
import { GlassRadioGroup, GlassRadioGroupItem } from '@/components/glassyui/glass-radio-group';

export default function RadioGroupExample() {
  const [delivery, setDelivery] = useState('standard');

  return (
    <GlassRadioGroup accessibilityLabel="Delivery" onValueChange={setDelivery} value={delivery}>
      <GlassRadioGroupItem description="Three to five days." label="Standard" value="standard" />
      <GlassRadioGroupItem description="Next working day." label="Express" value="express" />
    </GlassRadioGroup>
  );
}
