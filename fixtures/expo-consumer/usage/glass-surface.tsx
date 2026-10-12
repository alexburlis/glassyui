import { Image } from 'react-native';
import { GlassBackdrop } from '@/components/glassyui/glass-backdrop';
import { GlassSurface } from '@/components/glassyui/glass-surface';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const wallpaper = require('@/assets/wallpaper.jpg');

// Android blurs only what sits in a GlassBackdrop; iOS and the web blur whatever is behind.
export default function SurfaceExample() {
  return (
    <GlassBackdrop
      backdrop={<Image alt="" source={wallpaper} style={{ height: '100%', width: '100%' }} />}
      style={{ alignItems: 'center', height: 220, justifyContent: 'center' }}
    >
      <GlassSurface preset="prominent" style={{ borderRadius: 24, padding: 24 }}>
        Glass over a wallpaper
      </GlassSurface>
    </GlassBackdrop>
  );
}
