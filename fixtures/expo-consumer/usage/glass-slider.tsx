import { useState } from 'react';
import { GlassSlider } from '@/components/glassyui/glass-slider';

export default function SliderExample() {
  const [price, setPrice] = useState([20, 80]);

  return <GlassSlider accessibilityLabel="Price" onValueChange={setPrice} step={5} value={price} />;
}
