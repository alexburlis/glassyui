'use client';

import { useId, useState } from 'react';
import { GlassProgress } from '../../glass-progress';
import { GlassSurface } from '../../glass-surface';
import { GlassSwitch } from '../../glass-switch';
import {
  BookIcon,
  BreathIcon,
  FadeIcon,
  HomeIcon,
  MarkIcon,
  MoonIcon,
  RainIcon,
  RightIcon,
  SunriseIcon,
} from './icons';

type Star = [x: number, y: number, r: number, opacity: number];

type Glint = [x: number, y: number, width: number, height: number, opacity: number];

// The screen's wallpaper: the hero's dusk in miniature, positions in percent.
const WALL_STARS: Star[] = [
  [12, 22, 1, 0.7],
  [30, 12, 0.8, 0.6],
  [46, 30, 1.1, 0.8],
  [62, 8, 0.8, 0.5],
  [88, 42, 1, 0.6],
  [20, 54, 0.7, 0.5],
  [54, 62, 0.9, 0.6],
  [80, 70, 0.7, 0.5],
  [8, 80, 0.8, 0.5],
];

const WALL_GLINTS: Glint[] = [
  [72.1, 18.5, 1.8, 1, 0.2],
  [74.2, 18.6, 1.6, 1, 0.24],
  [72.1, 37.8, 3.1, 1, 0.23],
  [73.1, 3.5, 0.6, 1, 0.26],
  [74.4, 55.7, 3.7, 0.8, 0.14],
  [72.5, 61.1, 2.7, 1, 0.08],
  [74.5, 57.7, 3.1, 0.8, 0.1],
  [71.1, 4.8, 1, 0.8, 0.38],
  [74.6, 58.4, 2.7, 0.8, 0.12],
  [69.5, 66.5, 2.4, 0.8, 0.09],
  [73.1, 58.4, 2.3, 0.8, 0.11],
  [73.5, 21.2, 1.7, 0.8, 0.26],
  [71.1, 15.7, 0.9, 0.8, 0.29],
  [77.8, 63.6, 4.2, 1, 0.07],
  [71.9, 25.3, 1.5, 0.8, 0.3],
  [73.3, 2.6, 0.8, 0.8, 0.4],
  [72, 3.6, 0.9, 1, 0.33],
  [72.8, 45.2, 1.9, 1, 0.15],
  [73.5, 12.4, 1.5, 1, 0.32],
  [76.2, 47.8, 2.5, 0.8, 0.15],
  [73.4, 5.7, 0.7, 1, 0.28],
  [82.6, 46.2, 1.8, 1, 0.18],
  [72.6, 20.9, 1.8, 0.8, 0.25],
  [73, 2, 0.8, 1, 0.33],
  [72.7, 12.7, 1.5, 0.8, 0.25],
  [68.1, 63.6, 4.4, 0.8, 0.08],
];

function StatusGlyphs() {
  return (
    <svg focusable="false" viewBox="0 0 68 18">
      <rect height="6" rx="1" width="3.4" x="0" y="11" />
      <rect height="9" rx="1" width="3.4" x="5" y="8" />
      <rect height="12" rx="1" width="3.4" x="10" y="5" />
      <rect height="15" opacity=".4" rx="1" width="3.4" x="15" y="2" />
      <path d="M31 6.4a10 10 0 0 1 13 0l-1.6 1.7a7.6 7.6 0 0 0-9.8 0Zm3 3.3a5.4 5.4 0 0 1 7 0L37.5 13Z" />
      <rect
        fill="none"
        height="11"
        opacity=".55"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.2"
        width="17"
        x="48.5"
        y="3.5"
      />
      <rect height="7" rx="1.5" width="10" x="50.5" y="5.5" />
      <rect height="4" opacity=".55" rx=".8" width="1.6" x="66.4" y="7" />
    </svg>
  );
}

/**
 * Still's evening screen in an unbranded phone. Its two switches work: one warms and dims the
 * screen they sit on, the other turns the wake window off.
 */
export function EveningPhone() {
  const id = useId();
  const [warm, setWarm] = useState(true);
  const [wake, setWake] = useState(true);

  return (
    <figure aria-labelledby={`${id}-caption`} className="still-phone still-rise">
      <figcaption className="still-sr-only" id={`${id}-caption`}>
        Still’s evening screen at 21:48, with tonight’s plan and two working switches.
      </figcaption>
      <div className="still-phone-body">
        <div className="still-phone-screen" data-warm={warm || undefined}>
          <div aria-hidden className="still-phone-wall">
            <svg focusable="false" height="62%" width="100%">
              {WALL_STARS.map(([x, y, r, opacity]) => (
                <circle key={`${x}-${y}`} cx={`${x}%`} cy={`${y}%`} opacity={opacity} r={r} />
              ))}
            </svg>
            <svg className="still-phone-glints" focusable="false" height="36%" width="100%">
              {WALL_GLINTS.map(([x, y, width, height, opacity]) => (
                <rect
                  key={`${x}-${y}`}
                  height={height}
                  opacity={opacity}
                  rx=".5"
                  width={`${width}%`}
                  x={`${x}%`}
                  y={`${y}%`}
                />
              ))}
            </svg>
          </div>
          <div aria-hidden className="still-phone-warm" />
          <div aria-hidden className="still-phone-island" />
          <div aria-hidden className="still-phone-status">
            <span>21:48</span>
            <StatusGlyphs />
          </div>
          <div className="still-phone-content">
            <p className="still-ev-date">Thursday 30 October</p>
            <p className="still-ev-hello">Good evening, Sam.</p>
            <GlassSurface className="still-ev-card still-pane" lens>
              <div className="still-ev-row">
                <span className="still-ev-tile">
                  <MoonIcon />
                </span>
                <span>
                  <span className="still-ev-title">Wind down at 22:00</span>
                  <span className="still-ev-meta">In 12 minutes</span>
                </span>
              </div>
              <GlassProgress
                aria-label="Time until wind down"
                className="still-ev-progress"
                max={60}
                size="sm"
                value={48}
              />
              <div className="still-ev-split">
                <span id={`${id}-warm`}>Warm and dim the screen</span>
                <GlassSwitch
                  aria-labelledby={`${id}-warm`}
                  checked={warm}
                  size="sm"
                  onCheckedChange={setWarm}
                />
              </div>
            </GlassSurface>
            <p className="still-ev-label">Tonight</p>
            <GlassSurface className="still-ev-list still-pane" lens>
              <ul>
                <li>
                  <span className="still-ev-tile">
                    <MarkIcon />
                  </span>
                  <span>
                    <span className="still-ev-title">Breathe</span>
                    <span className="still-ev-meta">3 min · in 4, hold 2, out 6</span>
                  </span>
                  <RightIcon className="still-ev-chevron" />
                </li>
                <li>
                  <span className="still-ev-tile still-ev-tile--dusk">
                    <RainIcon />
                  </span>
                  <span>
                    <span className="still-ev-title">Rain on tin</span>
                    <span className="still-ev-meta">Fades out after 45 min</span>
                  </span>
                  <RightIcon className="still-ev-chevron" />
                </li>
                <li>
                  <span className="still-ev-tile still-ev-tile--rose">
                    <BookIcon />
                  </span>
                  <span>
                    <span className="still-ev-title">The library after closing</span>
                    <span className="still-ev-meta">31 min · Ruth Okafor</span>
                  </span>
                  <RightIcon className="still-ev-chevron" />
                </li>
              </ul>
            </GlassSurface>
            <GlassSurface className="still-ev-card still-pane" lens>
              <div className="still-ev-row">
                <span className="still-ev-tile still-ev-tile--sun">
                  <SunriseIcon />
                </span>
                <span>
                  <span className="still-ev-title" id={`${id}-wake`}>
                    Wake 6:50 to 7:20
                  </span>
                  <span className="still-ev-meta" id={`${id}-wake-meta`}>
                    {wake ? 'Birdsong rises from 6:50' : 'No alarm, just the window'}
                  </span>
                </span>
                <GlassSwitch
                  aria-describedby={`${id}-wake-meta`}
                  aria-labelledby={`${id}-wake`}
                  checked={wake}
                  size="sm"
                  onCheckedChange={setWake}
                />
              </div>
            </GlassSurface>
            <span aria-hidden className="still-ev-begin">
              <BreathIcon />
              Begin wind down
            </span>
          </div>
          <GlassSurface aria-hidden className="still-phone-tabs still-pane" lens>
            <span className="still-phone-tab" data-active>
              <HomeIcon />
              Tonight
            </span>
            <span className="still-phone-tab">
              <MarkIcon />
              Breathe
            </span>
            <span className="still-phone-tab">
              <FadeIcon />
              Sounds
            </span>
            <span className="still-phone-tab">
              <BookIcon />
              Stories
            </span>
          </GlassSurface>
        </div>
      </div>
    </figure>
  );
}
