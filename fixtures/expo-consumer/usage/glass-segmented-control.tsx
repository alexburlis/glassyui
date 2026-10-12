import { useState } from 'react';
import {
  GlassSegmentedControl,
  GlassSegmentedControlItem,
} from '@/components/glassyui/glass-segmented-control';

export default function SegmentedControlExample() {
  const [period, setPeriod] = useState('week');

  return (
    <GlassSegmentedControl accessibilityLabel="Period" onValueChange={setPeriod} value={period}>
      <GlassSegmentedControlItem value="day">Day</GlassSegmentedControlItem>
      <GlassSegmentedControlItem value="week">Week</GlassSegmentedControlItem>
      <GlassSegmentedControlItem value="month">Month</GlassSegmentedControlItem>
    </GlassSegmentedControl>
  );
}
