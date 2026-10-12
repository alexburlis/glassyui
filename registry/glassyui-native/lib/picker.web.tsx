import { useId } from 'react';
import type { GlassPickerProps } from '../glass-picker';
import { useGlassTheme } from '../glass-provider';

/** The browser's real select preserves labels, keyboard input, and native option menus. */
export function NativePicker<T extends string>({
  label,
  options,
  value,
  onValueChange,
  disabled = false,
  testID,
}: GlassPickerProps<T>) {
  const id = useId();
  const { colors, preferences } = useGlassTheme();

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <label htmlFor={id} style={{ color: colors.foreground, fontSize: 16 }}>
        {label}
      </label>
      <select
        id={id}
        data-testid={testID}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const option = options.find((item) => item.value === event.target.value);

          if (option) onValueChange(option.value);
        }}
        style={{
          background: colors.opaqueSurface,
          color: colors.foreground,
          colorScheme: preferences.theme,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          font: 'inherit',
          fontSize: 16,
          minHeight: 44,
          maxWidth: '65%',
          padding: '8px 12px',
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
