import { GlassButton } from '@/components/glassyui/glass-button';
import {
  GlassPopover,
  GlassPopoverContent,
  GlassPopoverTrigger,
} from '@/components/glassyui/glass-popover';

export default function PopoverExample() {
  return (
    <GlassPopover>
      <GlassPopoverTrigger>
        <GlassButton>Delivery</GlassButton>
      </GlassPopoverTrigger>
      <GlassPopoverContent>Arrives Thursday between 9:00 and 12:00.</GlassPopoverContent>
    </GlassPopover>
  );
}
