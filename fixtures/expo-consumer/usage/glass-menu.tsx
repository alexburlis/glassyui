import { useState } from 'react';
import { GlassButton } from '@/components/glassyui/glass-button';
import {
  GlassMenu,
  GlassMenuCheckboxItem,
  GlassMenuContent,
  GlassMenuItem,
  GlassMenuSeparator,
  GlassMenuTrigger,
} from '@/components/glassyui/glass-menu';

export default function MenuExample() {
  const [pinned, setPinned] = useState(false);

  return (
    <GlassMenu>
      <GlassMenuTrigger>
        <GlassButton>Options</GlassButton>
      </GlassMenuTrigger>
      <GlassMenuContent>
        <GlassMenuItem onSelect={() => setPinned(false)}>Duplicate</GlassMenuItem>
        <GlassMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
          Pin to top
        </GlassMenuCheckboxItem>
        <GlassMenuSeparator />
        <GlassMenuItem tone="destructive">Delete</GlassMenuItem>
      </GlassMenuContent>
    </GlassMenu>
  );
}
