'use client';

import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { GlassButton, GlassDrop, GlassPanel, GlassScene, GlassSlider } from '@/components/liquid';
import type { GlassSceneOptics } from '@/components/liquid';

type LabOptics = Omit<GlassSceneOptics, 'specular'>;

type Point = { x: number; y: number };

type DropStyle = CSSProperties & Record<'--lab-x' | '--lab-y' | '--lab-d', string>;

type Drag = {
  index: number;
  pointerId: number;
  unit: number;
  room: Point;
  grab: Point;
  centre: Point;
};

const SETTINGS: Array<{
  key: keyof LabOptics;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}> = [
  { key: 'ior', label: 'Index', min: 1, max: 2.4, step: 0.01, format: (value) => value.toFixed(2) },
  {
    key: 'thickness',
    label: 'Thickness',
    min: 4,
    max: 80,
    step: 1,
    format: (value) => `${value} px`,
  },
  { key: 'bevel', label: 'Bevel', min: 4, max: 64, step: 1, format: (value) => `${value} px` },
  {
    key: 'dispersion',
    label: 'Dispersion',
    min: 0,
    max: 1.5,
    step: 0.05,
    format: (value) => value.toFixed(2),
  },
  {
    key: 'frost',
    label: 'Frost',
    min: 0,
    max: 6,
    step: 0.1,
    format: (value) => `${value.toFixed(1)}×`,
  },
  { key: 'merge', label: 'Merge', min: 0, max: 96, step: 1, format: (value) => `${value} px` },
];

const OPTICS: LabOptics = {
  ior: 1.5,
  thickness: 36,
  bevel: 28,
  dispersion: 0.25,
  frost: 1,
  merge: 40,
};

/*
 * Drop centres are measured from the middle of the stage in lab units: a CSS
 * pixel on wide screens, less on narrow ones. At home the drops just melt
 * into each other. Scattered, each sits a fraction of the way from the middle
 * to the edge it can reach.
 */
const DROPS: Array<{ diameter: number; home: Point; scattered: Point }> = [
  { diameter: 176, home: { x: -56, y: 12 }, scattered: { x: -0.7, y: -0.35 } },
  { diameter: 128, home: { x: 74, y: -46 }, scattered: { x: 0.72, y: -0.55 } },
  { diameter: 84, home: { x: 62, y: 84 }, scattered: { x: 0.3, y: 0.75 } },
];

const HOME = DROPS.map((drop) => drop.home);

const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit);

/**
 * Three drops of glass over a test pattern, beside the optics that shape them.
 * Dragged together, the drops melt into one body; Gather and Scatter do the
 * same without dragging.
 */
export function LiquidLab() {
  const [optics, setOptics] = useState(OPTICS);
  const [positions, setPositions] = useState(HOME);
  const [dragging, setDragging] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const gathered = positions.every(
    (point, index) => point.x === HOME[index]?.x && point.y === HOME[index]?.y,
  );

  // How far each drop's centre may move from the middle, in lab units.
  const measureRoom = (element: HTMLElement, diameter: number) => {
    const stage = stageRef.current?.getBoundingClientRect();
    const unit = element.getBoundingClientRect().width / diameter;

    if (!stage || unit <= 0) return null;

    return {
      unit,
      centre: { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 },
      room: {
        x: Math.max(stage.width / unit - diameter, 0) / 2,
        y: Math.max(stage.height / unit - diameter, 0) / 2,
      },
    };
  };

  const scatter = () => {
    const stage = stageRef.current;

    if (!stage) return;

    setPositions(
      DROPS.map((drop, index) => {
        const element = stage.children[index];

        const measured =
          element instanceof HTMLElement ? measureRoom(element, drop.diameter) : null;

        return measured
          ? { x: drop.scattered.x * measured.room.x, y: drop.scattered.y * measured.room.y }
          : drop.home;
      }),
    );
  };

  const startDrag = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    const drop = DROPS[index];

    if (event.button !== 0 || !drop || drag.current) return;

    const measured = measureRoom(event.currentTarget, drop.diameter);
    const bounds = event.currentTarget.getBoundingClientRect();

    if (!measured) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      index,
      pointerId: event.pointerId,
      ...measured,
      grab: {
        x: event.clientX - (bounds.left + bounds.width / 2),
        y: event.clientY - (bounds.top + bounds.height / 2),
      },
    };
    setDragging(index);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;

    if (!current || current.pointerId !== event.pointerId) return;

    const x = clamp(
      (event.clientX - current.grab.x - current.centre.x) / current.unit,
      current.room.x,
    );

    const y = clamp(
      (event.clientY - current.grab.y - current.centre.y) / current.unit,
      current.room.y,
    );

    setPositions((previous) =>
      previous.map((point, index) => (index === current.index ? { x, y } : point)),
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;

    drag.current = null;
    setDragging(null);
  };

  return (
    <GlassScene backdrop="var(--lab-wallpaper)" className="lab" optics={optics}>
      <div aria-hidden className="lab-stage" ref={stageRef}>
        {DROPS.map((drop, index) => {
          const point = positions[index] ?? drop.home;

          const style: DropStyle = {
            '--lab-x': String(point.x),
            '--lab-y': String(point.y),
            '--lab-d': String(drop.diameter),
          };

          return (
            <GlassDrop
              className="lab-drop"
              data-dragging={dragging === index ? '' : undefined}
              key={drop.diameter}
              onLostPointerCapture={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={startDrag(index)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              style={style}
            />
          );
        })}
      </div>
      <GlassPanel className="lab-inspector" variant="card">
        {SETTINGS.map((setting) => (
          <div className="lab-setting" key={setting.key}>
            <div className="lab-setting-head">
              <span>{setting.label}</span>
              <span aria-hidden className="lab-setting-value">
                {setting.format(optics[setting.key])}
              </span>
            </div>
            <GlassSlider
              aria-label={setting.label}
              max={setting.max}
              min={setting.min}
              onValueChange={([value]) =>
                setOptics((current) => ({ ...current, [setting.key]: value }))
              }
              step={setting.step}
              value={[optics[setting.key]]}
            />
          </div>
        ))}
        <div className="lab-actions">
          <GlassButton
            onClick={gathered ? scatter : () => setPositions(HOME)}
            size="sm"
            variant="soft"
          >
            {gathered ? 'Scatter' : 'Gather'}
          </GlassButton>
          <GlassButton
            onClick={() => {
              setOptics(OPTICS);
              setPositions(HOME);
            }}
            size="sm"
            variant="ghost"
          >
            Reset
          </GlassButton>
        </div>
      </GlassPanel>
    </GlassScene>
  );
}
