'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motionReduced } from '../../lib/liquid-motion';
import { GlassBadge } from '../../glass-badge';
import { GlassButton } from '../../glass-button';
import { GlassPanel } from '../../glass-panel';
import { PauseIcon, PlayIcon } from './icons';
import { RainArt, TrainArt, WindArt } from './scene-art';

type SceneKind = 'rain' | 'train' | 'wind';

type Scene = {
  kind: SceneKind;
  title: string;
  description: string;
  art: ReactNode;
};

const SCENES: Scene[] = [
  {
    kind: 'rain',
    title: 'Rain on tin',
    description: 'A garden shed roof in steady rain. No thunder, no birds, nothing that changes.',
    art: <RainArt />,
  },
  {
    kind: 'train',
    title: 'Night train',
    description:
      'A sleeper carriage after midnight: the rails, the low hum, a door far down the corridor.',
    art: <TrainArt />,
  },
  {
    kind: 'wind',
    title: 'Coastal wind',
    description:
      'Dune grass and a distant sea on a cold, clear night, with the wind coming and going.',
    art: <WindArt />,
  },
];

const LENGTH = 3600;

const BARS = 36;

// Each scene's waveform at rest, a fingerprint of how it sounds.
const REST: Record<SceneKind, (bar: number) => number> = {
  rain: (bar) => 0.22 + 0.2 * Math.abs(Math.sin(bar * 1.9) * Math.cos(bar * 0.7)),
  train: (bar) => 0.14 + 0.36 * Math.abs(Math.sin(bar * 0.55)) ** 4,
  wind: (bar) => 0.12 + 0.4 * Math.sin((bar / (BARS - 1)) * Math.PI) ** 2,
};

type Live = { now: number[]; goal: number[]; at: number[] };

// How each scene moves while it plays: rain patters at random, the train clacks over the rail
// joints, and the wind rolls through in long gusts.
const LIVE: Record<SceneKind, (live: Live, time: number, bar: number) => number> = {
  rain: (live, time, bar) => {
    if (time - live.at[bar] > 60 + (bar % 5) * 14) {
      live.goal[bar] = 0.22 + Math.random() * 0.62;
      live.at[bar] = time;
    }

    live.now[bar] += (live.goal[bar] - live.now[bar]) * 0.32;

    return live.now[bar];
  },
  train: (_live, time, bar) => {
    const seconds = time / 1000;
    const beat = seconds % 1.2;
    const clack = Math.exp(-beat * 10) + (beat > 0.22 ? 0.85 * Math.exp(-(beat - 0.22) * 10) : 0);

    return (
      0.2 +
      0.06 * Math.sin(seconds * 3.1 + bar * 0.45) +
      0.62 * clack * (0.45 + 0.55 * Math.sin(bar * 0.8 + 1.2) ** 2)
    );
  },
  wind: (_live, time, bar) => {
    const seconds = time / 1000;

    return (
      0.12 +
      0.8 *
        (0.5 + 0.5 * Math.sin(seconds * 0.95 - bar * 0.21)) *
        (0.5 + 0.5 * Math.sin(seconds * 0.33 + bar * 0.04))
    );
  },
};

const restHeights = (kind: SceneKind) => Array.from({ length: BARS }, (_, bar) => REST[kind](bar));

const barScale = (value: number) => `scaleY(${Math.min(1, Math.max(0.05, value)).toFixed(3)})`;

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function paint(wave: HTMLElement | null, heights: number[]) {
  wave?.querySelectorAll<HTMLElement>('.still-scene-bar').forEach((bar, index) => {
    bar.style.transform = barScale(heights[index]);
  });
}

function SceneCard({
  scene,
  elapsed,
  playing,
  onToggle,
  waveRef,
}: {
  scene: Scene;
  elapsed: number;
  playing: boolean;
  onToggle: () => void;
  waveRef: (element: HTMLDivElement | null) => void;
}) {
  const titleId = `still-scene-${scene.kind}`;

  return (
    <article aria-labelledby={titleId} className="still-scene still-rise" data-playing={playing}>
      <div className="still-scene-art">{scene.art}</div>
      <GlassPanel className="still-scene-body still-pane" lens variant="card">
        <div className="still-scene-head">
          <h3 className="still-scene-title" id={titleId}>
            {scene.title}
          </h3>
          <GlassBadge>60 min</GlassBadge>
        </div>
        <p className="still-scene-description">{scene.description}</p>
        <div ref={waveRef} aria-hidden className="still-scene-wave">
          {restHeights(scene.kind).map((height, bar) => (
            <span key={bar} className="still-scene-bar" style={{ transform: barScale(height) }} />
          ))}
        </div>
        <div className="still-scene-foot">
          <GlassButton className="still-scene-toggle still-button" lens={false} onClick={onToggle}>
            {playing ? <PauseIcon /> : <PlayIcon />}
            {playing ? 'Pause' : 'Play'}
            <span className="still-sr-only"> {scene.title}</span>
          </GlassButton>
          <span className="still-scene-time">
            <span className="still-sr-only">Elapsed </span>
            <time>{clock(elapsed)}</time> / {clock(LENGTH)}
          </span>
        </div>
      </GlassPanel>
    </article>
  );
}

/**
 * Three sound scenes, one playing at a time. The previews are silent: a scene's artwork moves
 * and its waveform plays while its clock runs.
 */
export function SoundScenes() {
  const sectionRef = useRef<HTMLElement>(null);
  const wavesRef = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(() => SCENES.map(() => 0));
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) return;

    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  // Where the playing scene's clock started, so it knows when its hour is up.
  const startedAtRef = useRef(0);

  // The playing scene's clock, until the hour is up.
  useEffect(() => {
    if (current === null) return;

    let seconds = startedAtRef.current;

    const timer = window.setInterval(() => {
      seconds = Math.min(LENGTH, seconds + 1);
      setElapsed((times) => times.map((time, index) => (index === current ? seconds : time)));

      if (seconds >= LENGTH) setCurrent(null);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [current]);

  // The playing scene's waveform, while it is on screen. With motion reduced it holds one
  // louder shape instead of moving.
  useEffect(() => {
    if (current === null) return;

    const scene = SCENES[current];
    const wave = wavesRef.current[current];
    const rest = restHeights(scene.kind);

    if (motionReduced()) {
      paint(
        wave,
        rest.map((height, bar) => height * 2.3 + 0.14 * Math.abs(Math.sin(bar * 1.3))),
      );

      return () => paint(wave, rest);
    }

    if (!onScreen) return;

    const live: Live = { now: rest.slice(), goal: rest.slice(), at: rest.map(() => 0) };
    const started = performance.now();
    const bars = wave ? [...wave.querySelectorAll<HTMLElement>('.still-scene-bar')] : [];
    let frame = requestAnimationFrame(step);

    function step(time: number) {
      const ramp = 1 - (1 - Math.min(1, (time - started) / 700)) ** 3;

      bars.forEach((bar, index) => {
        const height = LIVE[scene.kind](live, time, index);

        bar.style.transform = barScale(rest[index] + (height - rest[index]) * ramp);
      });

      frame = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(frame);
      paint(wave, rest);
    };
  }, [current, onScreen]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="still-sounds-title"
      className="still-section still-sounds"
      data-away={onScreen ? undefined : ''}
      id="sounds"
    >
      <div className="still-wrap">
        <header className="still-rise">
          <p className="still-eyebrow">Sound scenes</p>
          <h2 className="still-h2" id="still-sounds-title">
            Rooms to fall asleep in.
          </h2>
          <p className="still-lede">
            Each scene is one unbroken hour, recorded where it happened and mixed to sit quietly
            under a bedside phone. Previews here are silent; press play to watch one move.
          </p>
        </header>
        <div className="still-scenes">
          {SCENES.map((scene, index) => (
            <SceneCard
              key={scene.kind}
              elapsed={elapsed[index]}
              playing={current === index}
              scene={scene}
              waveRef={(element) => {
                wavesRef.current[index] = element;
              }}
              onToggle={() => {
                startedAtRef.current = elapsed[index] >= LENGTH ? 0 : elapsed[index];
                setCurrent(current === index ? null : index);
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
