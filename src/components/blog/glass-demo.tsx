'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { GlassButton } from '@/components/liquid/button';
import { GlassPanel } from '@/components/liquid/panel';
import { usePreferences } from '@/components/liquid/provider';
import { GlassDrop, GlassScene } from '@/components/liquid/scene';
import {
  GlassSegmentedControl,
  GlassSegmentedControlItem,
} from '@/components/liquid/segmented-control';
import { GlassSlider } from '@/components/liquid/slider';
import { GlassSurface } from '@/components/liquid/surface';
import { GlassSwitch } from '@/components/liquid/switch';
import '@/styles/blog-demos.css';

type BlogGlassDemoVariant = 'scene' | 'expo' | 'android';

// The scene's own default slab, before the site's thickness preference scales it.
const SCENE_THICKNESS = 40;

const THICKNESS_RANGE = { min: 8, max: 80, step: 4 } as const;

const TRACK_SECONDS = 204;

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Counts whole seconds while running; a track wraps back to 0:00 at its end.
function useSeconds(running: boolean, length?: number) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(
      () => setSeconds((current) => (length === undefined ? current + 1 : (current + 1) % length)),
      1000,
    );

    return () => window.clearInterval(timer);
  }, [running, length]);

  return seconds;
}

function DemoSwitch({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="blog-demo-control">
      <label htmlFor={id}>{label}</label>
      <GlassSwitch checked={checked} id={id} onCheckedChange={onCheckedChange} size="sm" />
    </div>
  );
}

function DemoFrame({
  caption,
  children,
  controls,
  variant,
}: {
  caption: ReactNode;
  children: ReactNode;
  controls: ReactNode;
  variant: BlogGlassDemoVariant;
}) {
  return (
    <figure className="blog-demo" data-blog-demo={variant}>
      {children}
      <div className="blog-demo-controls">{controls}</div>
      <figcaption className="blog-demo-caption">{caption}</figcaption>
    </figure>
  );
}

const RENDERER = 'data-lg-scene-renderer';

type SceneRendererState = 'css' | 'webgl' | 'off' | 'none';

function readRenderer(scene: HTMLDivElement | null): SceneRendererState {
  const value = scene?.getAttribute(RENDERER);

  return value === 'webgl' || value === 'off' ? value : 'css';
}

// The scene writes css, webgl or off to its root as its renderer changes.
function useSceneRenderer(frost: boolean) {
  const sceneRef = useRef<HTMLDivElement | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const scene = sceneRef.current;

      if (frost || !scene) return () => {};

      const observer = new MutationObserver(onChange);
      observer.observe(scene, { attributes: true, attributeFilter: [RENDERER] });

      return () => observer.disconnect();
    },
    [frost],
  );

  const renderer = useSyncExternalStore<SceneRendererState>(
    subscribe,
    () => (frost ? 'none' : readRenderer(sceneRef.current)),
    () => 'css',
  );

  return { renderer, sceneRef };
}

const RENDERER_HINT = {
  webgl: 'WebGL2 is bending the backdrop.',
  css: 'CSS glass, until the canvas draws or where WebGL2 is missing.',
  off: 'CSS glass, because reduced transparency or more contrast is on.',
  none: 'No scene: the same components as plain CSS frost.',
} satisfies Record<SceneRendererState, string>;

function SceneDemo() {
  const { preferences } = usePreferences();
  const [frost, setFrost] = useState(false);
  const [merged, setMerged] = useState(false);
  const [chosenThickness, setChosenThickness] = useState<number | null>(null);
  const { renderer, sceneRef } = useSceneRenderer(frost);
  const sliderLabel = useId();

  const thickness =
    chosenThickness ??
    Math.min(
      THICKNESS_RANGE.max,
      Math.max(
        THICKNESS_RANGE.min,
        Math.round((SCENE_THICKNESS * preferences.thickness) / THICKNESS_RANGE.step) *
          THICKNESS_RANGE.step,
      ),
    );

  const pieces = (
    <>
      <GlassPanel className="blog-demo-hero-card" lens={frost ? false : undefined} variant="card">
        <p className="blog-demo-eyebrow">Glassy UI</p>
        <p className="blog-demo-headline">Light bends at every edge.</p>
      </GlassPanel>
      <GlassDrop className="blog-demo-drop" />
      <div className="blog-demo-hero-action">
        <GlassButton asChild lens={frost ? false : undefined} size="sm" variant="prominent">
          <Link href="/components/glass-scene">Get started</Link>
        </GlassButton>
      </div>
    </>
  );

  return (
    <DemoFrame
      caption={
        <>
          Live <code className="blog-demo-code">GlassScene</code> from the code below. Frost only
          shows the same components with CSS blur alone.
        </>
      }
      controls={
        <>
          <GlassSegmentedControl
            aria-label="Glass"
            className="blog-demo-segmented"
            onValueChange={(value) => setFrost(value === 'frost')}
            value={frost ? 'frost' : 'refraction'}
          >
            <GlassSegmentedControlItem value="refraction">Refraction</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="frost">Frost only</GlassSegmentedControlItem>
          </GlassSegmentedControl>
          <DemoSwitch checked={merged} label="Move drop to card" onCheckedChange={setMerged} />
          <div className="blog-demo-control blog-demo-control--slider">
            <span id={sliderLabel}>Thickness</span>
            <GlassSlider
              aria-labelledby={sliderLabel}
              disabled={frost}
              max={THICKNESS_RANGE.max}
              min={THICKNESS_RANGE.min}
              onValueChange={([value]) => setChosenThickness(value)}
              step={THICKNESS_RANGE.step}
              value={[thickness]}
            />
          </div>
          <div className="blog-demo-readout">
            <code className="blog-demo-code">{`optics={{ thickness: ${thickness} }}`}</code>
            <output className="blog-demo-renderer">Renderer: {renderer}</output>
            <span className="blog-demo-hint">{RENDERER_HINT[renderer]}</span>
          </div>
        </>
      }
      variant="scene"
    >
      {frost ? (
        <div className="blog-demo-stage blog-demo-stage--scene" data-merged={merged}>
          {pieces}
        </div>
      ) : (
        <GlassScene
          backdrop="var(--site-wallpaper)"
          className="blog-demo-stage blog-demo-stage--scene"
          data-merged={merged}
          optics={{ thickness }}
          ref={sceneRef}
        >
          {pieces}
        </GlassScene>
      )}
    </DemoFrame>
  );
}

const NATIVE_CAPTION = {
  expo: "React browser preview. On iOS 26 the native code draws the system's glass; a browser shows blur or solid.",
  android:
    'React browser approximation of what Android draws. The native code below is what ships.',
} as const;

function ExpoDemo() {
  const { preferences, setPreferences } = usePreferences();
  const [running, setRunning] = useState(false);
  const elapsed = useSeconds(running);
  const material = preferences.reduceTransparency ? 'solid' : 'blur';

  return (
    <DemoFrame
      caption={NATIVE_CAPTION.expo}
      controls={
        <DemoSwitch
          checked={preferences.reduceTransparency}
          label="Reduce Transparency"
          onCheckedChange={(on) => setPreferences({ reduceTransparency: on })}
        />
      }
      variant="expo"
    >
      <div className="blog-demo-stage blog-demo-stage--native">
        <GlassPanel className="blog-demo-native-card" lens={false} variant="card">
          <div className="blog-demo-row">
            <p className="blog-demo-title">Morning run</p>
            <span className="blog-demo-time">{formatTime(elapsed)}</span>
          </div>
          <p className="blog-demo-muted">Material: {material}</p>
          <GlassButton
            aria-pressed={running}
            lens={false}
            onClick={() => setRunning(!running)}
            variant="prominent"
          >
            {running ? 'Pause' : 'Start'}
          </GlassButton>
        </GlassPanel>
      </div>
    </DemoFrame>
  );
}

function AndroidDemo() {
  const { preferences, setPreferences } = usePreferences();
  const [playing, setPlaying] = useState(false);
  const [insideBackdrop, setInsideBackdrop] = useState(true);
  const position = useSeconds(playing, TRACK_SECONDS);
  const solidId = useId();

  return (
    <DemoFrame
      caption={NATIVE_CAPTION.android}
      controls={
        <>
          <DemoSwitch
            checked={insideBackdrop}
            label="Inside GlassBackdrop"
            onCheckedChange={setInsideBackdrop}
          />
          {insideBackdrop ? null : (
            <span className="blog-demo-hint">Tint only: no blur target.</span>
          )}
        </>
      }
      variant="android"
    >
      <div
        className="blog-demo-stage blog-demo-stage--native"
        data-blur-target={insideBackdrop ? 'backdrop' : 'none'}
      >
        <GlassSurface className="blog-demo-native-card" lens={false} preset="prominent">
          <div className="blog-demo-row">
            <p className="blog-demo-title blog-demo-title--large">Evening mix</p>
            <span className="blog-demo-time">
              {formatTime(position)} / {formatTime(TRACK_SECONDS)}
            </span>
          </div>
          <div className="blog-demo-row">
            <label htmlFor={solidId}>Solid glass</label>
            <GlassSwitch
              checked={preferences.reduceTransparency}
              id={solidId}
              onCheckedChange={(on) => setPreferences({ reduceTransparency: on })}
            />
          </div>
          <GlassButton
            aria-pressed={playing}
            lens={false}
            onClick={() => setPlaying((current) => !current)}
            variant="prominent"
          >
            {playing ? 'Pause' : 'Play'}
          </GlassButton>
        </GlassSurface>
      </div>
    </DemoFrame>
  );
}

/**
 * A live example for a blog article, built from the site's own components.
 * The scene variant runs GlassScene; the native variants are React browser
 * previews of the article's React Native code, never the native material.
 */
export function BlogGlassDemo({ variant }: { variant: BlogGlassDemoVariant }) {
  if (variant === 'scene') return <SceneDemo />;

  if (variant === 'expo') return <ExpoDemo />;

  if (variant === 'android') return <AndroidDemo />;

  throw new Error(`Unknown blog demo variant: ${String(variant)}`);
}
