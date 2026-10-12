'use client';

import { GlassButton } from '@/components/liquid';
import { usePreferences } from '@/components/liquid';
import { useEffect, useState } from 'react';

export function PreferenceControls() {
  const [mounted, setMounted] = useState(false);
  const { preferences, setPreferences } = usePreferences();

  useEffect(() => {
    // align first client render with SSR; flip on hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <SegmentedControl
          label="Theme"
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={preferences.theme}
          onChange={(value) => setPreferences({ theme: value })}
        />
        <SegmentedControl
          label="Material"
          options={[
            { value: 'clear', label: 'Clear' },
            { value: 'tinted', label: 'Tinted' },
          ]}
          value={preferences.mode}
          onChange={(value) => setPreferences({ mode: value })}
        />
        <SegmentedControl
          label="Quality"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          value={preferences.quality}
          onChange={(value) => setPreferences({ quality: value })}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <ToggleButton
          label="Reduce Transparency"
          pressed={preferences.reduceTransparency}
          onPressedChange={(pressed) => setPreferences({ reduceTransparency: pressed })}
        />
        <ToggleButton
          label="Reduce Motion"
          pressed={preferences.reduceMotion}
          onPressedChange={(pressed) => setPreferences({ reduceMotion: pressed })}
        />
      </div>
    </div>
  );
}

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--lg-foreground)]/40">
        {label}
      </span>
      <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`relative flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-white/20 text-[var(--lg-foreground)] shadow-sm'
                  : 'text-[var(--lg-foreground)]/40 hover:text-[var(--lg-foreground)]/80 hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ToggleButtonProps {
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

function ToggleButton({ label, pressed, onPressedChange }: ToggleButtonProps) {
  return (
    <GlassButton
      type="button"
      variant={pressed ? 'soft' : 'ghost'}
      onClick={() => onPressedChange(!pressed)}
      className={`flex items-center gap-3 px-4 py-2 ${pressed ? 'bg-white/10' : ''}`}
    >
      <span className="text-sm font-medium">{label}</span>
      <div
        className={`relative h-3 w-8 rounded-full transition-colors duration-300 ${pressed ? 'bg-[var(--lg-foreground)]/40' : 'bg-[var(--lg-foreground)]/10'}`}
      >
        <div
          className={`absolute top-0.5 h-2 w-2 rounded-full bg-white shadow-sm transition-transform duration-300 ${pressed ? 'left-[calc(100%-0.625rem)]' : 'left-0.5'}`}
        />
      </div>
    </GlassButton>
  );
}
