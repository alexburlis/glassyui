'use client';

import { useId, useState } from 'react';
import {
  GlassBadge,
  GlassLens,
  GlassSegmentedControl,
  GlassSegmentedControlItem,
  GlassSwitch,
  usePreferences,
} from '@/components/liquid';

const ENGINES = ['Safari', 'Chrome', 'Firefox', 'Edge'];

const KEYS = [
  { key: 'Tab', label: 'tab' },
  { key: 'ArrowLeft', label: '←' },
  { key: 'ArrowRight', label: '→' },
  { key: 'Escape', label: 'esc' },
];

const RANGES = ['Day', 'Week', 'Month', 'Year'];

// The keycaps light up as keys are pressed inside the tile.
function KeyboardTile() {
  const [pressed, setPressed] = useState<string | null>(null);

  return (
    <div
      className="bento-tile bento-tile--keyboard"
      onBlur={(event) => {
        // Arrow keys move focus between segments; only leaving the tile resets the keycaps.
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        )
          return;

        setPressed(null);
      }}
      onKeyDown={(event) => setPressed(event.key)}
      onKeyUp={() => setPressed(null)}
    >
      <h3>Keyboard first.</h3>
      <p>Built on Radix, so every control works with Tab, the arrow keys and Escape.</p>
      <div className="bento-keyboard-demo">
        <GlassSegmentedControl aria-label="Range" defaultValue="Week">
          {RANGES.map((range) => (
            <GlassSegmentedControlItem key={range} value={range}>
              {range}
            </GlassSegmentedControlItem>
          ))}
        </GlassSegmentedControl>
      </div>
      <div aria-hidden className="bento-keys">
        {KEYS.map(({ key, label }) => (
          <kbd
            className={label.length > 1 ? 'bento-key bento-key--wide' : 'bento-key'}
            data-pressed={pressed === key ? '' : undefined}
            key={key}
          >
            {label}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function SettingsTile() {
  const { preferences, setPreferences } = usePreferences();
  const id = useId();

  return (
    <div className="bento-tile bento-tile--settings">
      <h3>Follows your settings.</h3>
      <p>Reduce Transparency turns the glass solid. Reduce Motion holds it still. Try both.</p>
      <div className="bento-switches">
        <div className="bento-switch">
          <label htmlFor={`${id}transparency`}>Reduce transparency</label>
          <GlassSwitch
            checked={preferences.reduceTransparency}
            id={`${id}transparency`}
            onCheckedChange={(checked) => setPreferences({ reduceTransparency: checked })}
          />
        </div>
        <div className="bento-switch">
          <label htmlFor={`${id}motion`}>Reduce motion</label>
          <GlassSwitch
            checked={preferences.reduceMotion}
            id={`${id}motion`}
            onCheckedChange={(checked) => setPreferences({ reduceMotion: checked })}
          />
        </div>
      </div>
    </div>
  );
}

export function FeatureBento({ files }: { files: string[] }) {
  return (
    <div className="bento">
      <div className="bento-tile bento-tile--lens">
        <div className="bento-copy">
          <h3>Real refraction.</h3>
          <p>
            Drag the lens, or focus it and use the arrow keys. Its rim bends whatever sits beneath.
          </p>
        </div>
        <GlassLens
          className="bento-lens"
          defaultPosition={{ x: 0.66, y: 0.5 }}
          size={168}
          zoom={1.75}
        >
          <div className="bento-lens-scene">
            <p>Look closer.</p>
          </div>
        </GlassLens>
      </div>
      <div className="bento-tile bento-tile--engines">
        <h3>Every browser.</h3>
        <p>
          The same frost, rim and highlights everywhere. Over live content, Chromium adds a
          refracting edge.
        </p>
        <div className="bento-badges">
          {ENGINES.map((engine) => (
            <GlassBadge key={engine} dot tone="green">
              {engine}
            </GlassBadge>
          ))}
        </div>
      </div>
      <SettingsTile />
      <KeyboardTile />
      <div className="bento-tile bento-tile--source">
        <h3>Yours to edit.</h3>
        <p>Components land in your repo as source. No package to update, nothing to eject.</p>
        <ul aria-label="Files added by the dock" className="bento-files">
          {files.map((file) => (
            <li key={file}>
              <code>{file}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
