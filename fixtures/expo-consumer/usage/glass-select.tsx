import { useState } from 'react';
import {
  GlassSelect,
  GlassSelectContent,
  GlassSelectItem,
  GlassSelectTrigger,
  GlassSelectValue,
} from '@/components/glassyui/glass-select';

export default function SelectExample() {
  const [city, setCity] = useState('');

  return (
    <GlassSelect onValueChange={setCity} value={city}>
      <GlassSelectTrigger accessibilityLabel="City">
        <GlassSelectValue placeholder="Choose a city" />
      </GlassSelectTrigger>
      <GlassSelectContent>
        <GlassSelectItem value="lisbon">Lisbon</GlassSelectItem>
        <GlassSelectItem value="oslo">Oslo</GlassSelectItem>
        <GlassSelectItem value="tokyo">Tokyo</GlassSelectItem>
      </GlassSelectContent>
    </GlassSelect>
  );
}
