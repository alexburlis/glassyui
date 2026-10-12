import { useState } from 'react';
import { GlassCheckbox } from '@/components/glassyui/glass-checkbox';

export default function CheckboxExample() {
  const [weekly, setWeekly] = useState(true);

  return (
    <GlassCheckbox
      checked={weekly}
      description="One email every Monday."
      label="Weekly summary"
      onCheckedChange={setWeekly}
    />
  );
}
