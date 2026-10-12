'use client';

import { useEffect, useMemo, useState } from 'react';

type Control = {
  id: string;
  label: string;
  cssVar: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  group: string;
  description?: string;
};

type SliderProps = {
  control: Control;
  value: number;
  enabled: boolean;
  onToggle: () => void;
  onChange: (next: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const CONTROLS: Control[] = [
  {
    id: 'micro',
    label: 'Micro Variation',
    cssVar: '--lg-debug-micro-scale',
    min: 0,
    max: 2,
    step: 0.02,
    defaultValue: 1,
    group: 'Rim & Edge Shaping',
    description: 'Low-frequency rim noise amplitude',
  },
  {
    id: 'corner',
    label: 'Corner Compression',
    cssVar: '--lg-debug-corner-scale',
    min: 0,
    max: 1.5,
    step: 0.02,
    defaultValue: 1,
    group: 'Rim & Edge Shaping',
    description: 'Corner attenuation strength',
  },
  {
    id: 'tangent',
    label: 'Tangent Taper',
    cssVar: '--lg-debug-tangent-scale',
    min: 0,
    max: 2,
    step: 0.02,
    defaultValue: 1,
    group: 'Rim & Edge Shaping',
    description: 'How strongly thickness follows tangent falloff',
  },
  {
    id: 'rimThickness',
    label: 'Rim Thickness',
    cssVar: '--lg-debug-rim-thickness',
    min: 0,
    max: 2.5,
    step: 0.05,
    defaultValue: 1,
    group: 'Rim & Edge Shaping',
    description: 'Global rim bevel thickness',
  },
  {
    id: 'rimAlpha',
    label: 'Rim Alpha',
    cssVar: '--lg-debug-rim-alpha-scale',
    min: 0,
    max: 2,
    step: 0.05,
    defaultValue: 1,
    group: 'Rim & Edge Shaping',
    description: 'Overall rim brightness scale',
  },
  {
    id: 'ca',
    label: 'Chromatic Fringe',
    cssVar: '--lg-debug-ca-scale',
    min: 0,
    max: 1,
    step: 0.02,
    defaultValue: 1,
    group: 'Chromatic',
    description: 'Fringe alpha multiplier',
  },
  {
    id: 'caOffset',
    label: 'Fringe Offset',
    cssVar: '--lg-debug-ca-offset-scale',
    min: 0,
    max: 2,
    step: 0.05,
    defaultValue: 1,
    group: 'Chromatic',
    description: 'Fringe pixel offset scale',
  },
  {
    id: 'highlight',
    label: 'Highlight Strength',
    cssVar: '--lg-debug-highlight-scale',
    min: 0,
    max: 2,
    step: 0.05,
    defaultValue: 1,
    group: 'Highlight',
    description: 'Sheen / highlight intensity',
  },
];

const grouped = CONTROLS.reduce<Record<string, Control[]>>((acc, control) => {
  acc[control.group] = acc[control.group] || [];
  acc[control.group].push(control);

  return acc;
}, {});

function setEnabledForGroup(
  group: string,
  enabled: boolean,
  setEnabled: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  setEnabled((prev) => {
    const next = { ...prev };
    const items = grouped[group] ?? [];

    for (const control of items) {
      next[control.id] = enabled;
    }

    return next;
  });
}

function ControlSlider({ control, value, enabled, onToggle, onChange }: SliderProps) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5">
      <div className="flex items-start justify-between gap-1.5 text-[10px] text-white/70 leading-tight">
        <div className="flex flex-col">
          <span className="font-semibold text-white/85 leading-none">{control.label}</span>
          {control.description ? (
            <span className="text-[10px] text-white/50">{control.description}</span>
          ) : null}
        </div>
        <button
          onClick={onToggle}
          className={`relative flex h-6 w-12 shrink-0 items-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
            enabled ? 'border-white/40 bg-white/25' : 'border-white/15 bg-white/8 text-white/50'
          }`}
          aria-pressed={enabled}
        >
          <span
            className={`inline-block h-4.5 w-4.5 rounded-full bg-gradient-to-b from-white to-white/70 shadow-[0_3px_8px_rgba(0,0,0,0.4)] transition-transform duration-150 ${
              enabled ? 'translate-x-[20px]' : 'translate-x-[2px]'
            }`}
          />
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2.5 text-[10px] text-white/60">
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          disabled={!enabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="accent-white/80 flex-1"
        />
        <span className="w-10 text-right tabular-nums">{value.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function DebugPanel() {
  const [open, setOpen] = useState(true);

  const [values, setValues] = useState<Record<string, number>>(() =>
    CONTROLS.reduce<Record<string, number>>((acc, control) => {
      acc[control.id] = control.defaultValue;

      return acc;
    }, {}),
  );

  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    CONTROLS.reduce<Record<string, boolean>>((acc, control) => {
      acc[control.id] = true;

      return acc;
    }, {}),
  );

  const featureList = useMemo(
    () => [
      'Rim & edge shaping (tangent taper, corner compression, micro noise, rim alpha/thickness)',
      'Chromatic fringe (alpha + offset)',
      'Highlight strength',
    ],
    [],
  );

  useEffect(() => {
    const root = document.documentElement;

    for (const control of CONTROLS) {
      const raw = values[control.id] ?? control.defaultValue;
      const clamped = clamp(raw, control.min, control.max);
      const effective = enabled[control.id] ? clamped : 0;
      root.style.setProperty(control.cssVar, effective.toFixed(3));
    }
  }, [values, enabled]);

  const reset = () => {
    const nextValues: Record<string, number> = {};
    const nextEnabled: Record<string, boolean> = {};

    for (const control of CONTROLS) {
      nextValues[control.id] = control.defaultValue;
      nextEnabled[control.id] = true;
    }

    setValues(nextValues);
    setEnabled(nextEnabled);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] w-68 text-white"
      style={{ contain: 'layout paint style' }}
    >
      <button
        className="mb-1.5 w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-[11px] font-semibold tracking-wide uppercase backdrop-blur-md hover:border-white/30"
        onClick={() => setOpen((s) => !s)}
      >
        {open ? 'Hide' : 'Show'} Debug Panel
      </button>
      {open ? (
        <div className="space-y-2.5 rounded-lg border border-white/12 bg-black/80 p-2.5 text-white/80 backdrop-blur-lg max-h-[78vh] overflow-y-auto">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-white/55">
            <span>Feature Sandbox</span>
            <div className="flex gap-1">
              <button
                className="rounded px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
                onClick={() => {
                  const nextEnabled: Record<string, boolean> = {};

                  for (const control of CONTROLS) {
                    nextEnabled[control.id] = false;
                  }

                  setEnabled(nextEnabled);
                }}
              >
                Turn All Off
              </button>
              <button
                className="rounded px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
                onClick={reset}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-white/5 p-2 text-[10px] text-white/55">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/60">
              Features
            </div>
            <ul className="space-y-0.25">
              {featureList.map((item) => (
                <li key={item} className="leading-tight">
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55 pb-0.5">
                <span>{group}</span>
                <div className="flex gap-1">
                  <button
                    className="rounded px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
                    onClick={() => setEnabledForGroup(group, true, setEnabled)}
                  >
                    All On
                  </button>
                  <button
                    className="rounded px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
                    onClick={() => setEnabledForGroup(group, false, setEnabled)}
                  >
                    All Off
                  </button>
                </div>
              </div>
              <div className="space-y-1.25">
                {items.map((control) => (
                  <ControlSlider
                    key={control.id}
                    control={control}
                    value={values[control.id] ?? control.defaultValue}
                    enabled={enabled[control.id]}
                    onToggle={() =>
                      setEnabled((prev) => ({
                        ...prev,
                        [control.id]: !prev[control.id],
                      }))
                    }
                    onChange={(next) =>
                      setValues((prev) => ({
                        ...prev,
                        [control.id]: clamp(next, control.min, control.max),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
