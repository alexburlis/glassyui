import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { GlassSurface } from './glass-surface';
import { NativePicker } from './lib/picker';

export type GlassPickerProps<T extends string = string> = {
  label: string;
  options: readonly { label: string; value: T }[];
  value: T;
  onValueChange: (value: T) => void;
  /** iOS supports an inline wheel; Android and web use their native dropdown. */
  appearance?: 'menu' | 'wheel';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A labelled system picker on glass: SwiftUI on iOS, Compose on Android, a select on web. */
export function GlassPicker<T extends string>({ style, ...props }: GlassPickerProps<T>) {
  if (!props.options.some((option) => option.value === props.value)) {
    throw new Error('GlassPicker value must match an option.');
  }

  return (
    <GlassSurface elevation="none" preset="control" style={[styles.surface, style]}>
      <NativePicker {...props} />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({ surface: { padding: 12 } });
