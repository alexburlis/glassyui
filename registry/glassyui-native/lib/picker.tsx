import { useEffect, useState } from 'react';
import { Host } from '@expo/ui';
import {
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { menuAnchor, semantics, testID as nativeTestID } from '@expo/ui/jetpack-compose/modifiers';
import type { GlassPickerProps } from '../glass-picker';
import { useGlassTheme } from '../glass-provider';

// Metro selects picker.ios and picker.web on those platforms. This is the Android implementation.
export function NativePicker<T extends string>({
  label,
  options,
  value,
  onValueChange,
  disabled = false,
  testID,
}: GlassPickerProps<T>) {
  const { preferences } = useGlassTheme();
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((option) => option.value === value);
  const text = useNativeState(selected?.label ?? value);

  useEffect(() => {
    text.set(selected?.label ?? value);
  }, [selected?.label, text, value]);

  return (
    <Host
      colorScheme={preferences.theme}
      matchContents={{ vertical: true }}
      style={{ width: '100%' }}
    >
      <ExposedDropdownMenuBox
        expanded={expanded && !disabled}
        onExpandedChange={disabled ? undefined : setExpanded}
      >
        <TextField
          value={text}
          enabled={!disabled}
          readOnly
          modifiers={[
            menuAnchor('primaryNotEditable', !disabled),
            semantics({ contentDescription: label }),
            ...(testID ? [nativeTestID(testID)] : []),
          ]}
        >
          <TextField.Label>
            <Text>{label}</Text>
          </TextField.Label>
        </TextField>
        <ExposedDropdownMenu
          expanded={expanded && !disabled}
          onDismissRequest={() => setExpanded(false)}
        >
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                setExpanded(false);
                onValueChange(option.value);
              }}
            >
              <DropdownMenuItem.Text>
                <Text>{option.label}</Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </ExposedDropdownMenu>
      </ExposedDropdownMenuBox>
    </Host>
  );
}
