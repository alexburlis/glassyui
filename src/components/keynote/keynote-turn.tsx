'use client';

import type { PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePreferences } from '@/components/liquid';
import { HomePhone } from '@/components/site/home-phone';
import { TURN_TITLE, turnFeatures } from './features';
import { TURN } from './frames';
import { createScrubber, motionReduced } from './scrubber';
import type { DeskBox, DeskFace } from './turn';

type StageModule = typeof import('./turn-stage');

type Size = { height: number; width: number };

// The box of the desk's screen in the stage, ignoring any transform on the way.
function measureDesk(stage: HTMLElement, screen: HTMLElement): DeskBox {
  let x = 0;
  let y = 0;

  for (
    let node: Element | null = screen;
    node instanceof HTMLElement && node !== stage;
    node = node.offsetParent
  ) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }

  return {
    height: screen.offsetHeight,
    radius: parseFloat(getComputedStyle(screen).borderTopLeftRadius) || 0,
    width: screen.offsetWidth,
    x,
    y,
  };
}

type KeynoteTurnProps = {
  caption: ReactNode;
  children: ReactNode;
  nativeCount: number;
};

/**
 * Pins the live desk and projects it with the Remotion composition as it turns into a phone
 * running the same components, then brings in their features. Under
 * reduced motion the desk stays put and the phone and features follow it, still.
 */
export function KeynoteTurn({ caption, children, nativeCount }: KeynoteTurnProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const [deskFace, setDeskFace] = useState<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const playerRef = useRef<PlayerRef | null>(null);
  const [moving, setMoving] = useState(false);
  const [onscreen, setOnscreen] = useState(true);
  const [size, setSize] = useState<Size | null>(null);
  const [desk, setDesk] = useState<DeskBox | null>(null);
  const [stageModule, setStageModule] = useState<StageModule | null>(null);
  const { preferences } = usePreferences();
  const theme = preferences.theme;
  const features = useMemo(() => turnFeatures(nativeCount), [nativeCount]);

  const bindDeskFace = useCallback((face: HTMLDivElement | null) => {
    faceRef.current = face;
    setDeskFace(face);
  }, []);

  const restoreDesk = useCallback(() => {
    stageRef.current?.style.removeProperty('perspective');
    deskRef.current?.style.removeProperty('transform-style');

    if (faceRef.current) {
      faceRef.current.style.cssText = '';
      faceRef.current.inert = false;
    }

    if (contentRef.current) contentRef.current.style.cssText = '';
  }, []);

  const onDeskFrame = useCallback(
    (pose: DeskFace) => {
      const face = faceRef.current;
      const content = contentRef.current;
      const slot = deskRef.current;
      const stage = stageRef.current;

      if (!moving || !desk || !face || !content || !slot || !stage) return;

      if (pose.frame <= 0) {
        restoreDesk();

        return;
      }

      // Read before writing the face's dimensions, avoiding a forced layout between writes.
      const slotTop = pose.visible ? slot.offsetTop : 0;

      face.inert = !pose.visible;
      face.style.visibility = pose.visible ? 'visible' : 'hidden';

      if (!pose.visible) return;

      // A parent camera keeps WebKit's rounded clipping in the projected face's plane.
      stage.style.perspective = `${pose.perspective}px`;
      slot.style.transformStyle = 'preserve-3d';
      face.style.position = 'absolute';
      face.style.left = '0';
      face.style.top = '0';
      face.style.width = `${pose.width}px`;
      face.style.height = `${pose.height}px`;
      face.style.borderRadius = `${pose.radius}px`;
      face.style.overflow = 'hidden';
      face.style.transformOrigin = '0 0';
      face.style.transform = `translateY(${-slotTop}px) ${pose.transform}`;
      content.style.width = `${desk.width}px`;
      content.style.transformOrigin = '0 0';
      content.style.transform = `translate(${(pose.width - desk.width * pose.scale) / 2}px, ${(pose.height - desk.height * pose.scale) / 2}px) scale(${pose.scale})`;
    },
    [desk, moving, restoreDesk],
  );

  // The opener owns data-keynote: the keynote moves only while it is set.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const read = () => setMoving(root.hasAttribute('data-keynote') && !motionReduced());
    const observer = new MutationObserver(read);

    read();
    observer.observe(root, {
      attributeFilter: ['data-keynote', 'data-lg-reduce-motion'],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  // Keep both screens mounted, but stop pointer tilt and live phone timers offscreen.
  useEffect(() => {
    const track = trackRef.current;

    if (!moving || !track) return;

    const observer = new IntersectionObserver((entries) => {
      setOnscreen(entries[entries.length - 1].isIntersecting);
    });

    observer.observe(track);

    return () => observer.disconnect();
  }, [moving]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const screen = deskRef.current?.querySelector<HTMLElement>('.desk-screen');

    if (!moving || !track || !stage || !screen) return;

    // The stylesheet centres the desk by its height, which only the page knows for certain: a
    // narrow desk stacks its widgets and grows past its minimum.
    const measure = () => {
      restoreDesk();
      track.style.setProperty('--desk-height', `${screen.offsetHeight}px`);
      setSize({ height: Math.round(stage.clientHeight), width: Math.round(stage.clientWidth) });
      setDesk(measureDesk(stage, screen));
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(stage);
    observer.observe(screen);

    return () => {
      observer.disconnect();
      restoreDesk();
      track.style.removeProperty('--desk-height');
    };
  }, [moving, restoreDesk]);

  const wallpaper = `/keynote/phone-wallpaper-${theme}.webp`;

  // Remotion and the phone's wallpaper arrive before the desk reaches them.
  useEffect(() => {
    if (!moving || stageModule) return;

    let current = true;

    import('./turn-stage').then((module) => {
      if (current) setStageModule(module);
    });

    return () => {
      current = false;
    };
  }, [moving, stageModule]);

  useEffect(() => {
    if (moving) new Image().src = wallpaper;
  }, [moving, wallpaper]);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const deskSlot = deskRef.current;
    const caption = captionRef.current;

    if (!moving || !stageModule || !track || !stage || !deskSlot || !caption || !desk || !size)
      return;

    const { turnCaption } = stageModule;

    const paint = (frame: number) => {
      playerRef.current?.seekTo(frame);
      stage.dataset.frame = frame.toFixed(3);

      caption.style.opacity = turnCaption(frame).toFixed(3);
      stage.toggleAttribute('data-turning', frame > 0);
    };

    const scrubber = createScrubber(paint);

    const target = () => {
      const box = track.getBoundingClientRect();
      const range = box.height - stage.offsetHeight;
      const progress = range > 0 ? Math.min(Math.max(-box.top / range, 0), 1) : 0;

      return progress * TURN.end;
    };

    const onScroll = () => scrubber.set(target());

    scrubber.set(target(), true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      scrubber.stop();
      caption.style.removeProperty('opacity');
      stage.removeAttribute('data-turning');
      delete stage.dataset.frame;
    };
  }, [desk, moving, restoreDesk, size, stageModule]);

  return (
    <div className="turn" data-moving={moving || undefined} ref={trackRef}>
      <div className="turn-stage" ref={stageRef}>
        <div className="turn-desk" ref={deskRef}>
          <div className="turn-desk-face" ref={bindDeskFace}>
            <div className="turn-desk-content" ref={contentRef}>
              {children}
            </div>
          </div>
        </div>
        <p className="home-desk-caption" ref={captionRef}>
          {caption}
        </p>
        {/* The composition hides its pictures, title and features from assistive technology,
            which reads them in the still section below; the phone's live screen stays reachable. */}
        {/* Keep an initialized stage while motion is off, preserving edits and avoiding a
            shader/control rebuild in the preference switch's own animation. */}
        {size && desk && stageModule ? (
          <div className="turn-player" style={{ display: moving ? undefined : 'none' }}>
            <stageModule.default
              active={moving && onscreen}
              desk={desk}
              deskFace={deskFace}
              onDeskFrame={onDeskFrame}
              height={size.height}
              nativeCount={nativeCount}
              onPlayer={(player) => {
                playerRef.current = player;
              }}
              theme={theme}
              width={size.width}
            />
          </div>
        ) : null}
      </div>
      <section aria-labelledby="turn-title" className="turn-still">
        <h2 className="home-section-title" id="turn-title">
          {TURN_TITLE[0]} <span className="turn-still-echo">{TURN_TITLE[1]}</span>
        </h2>
        <div className="turn-still-body">
          <div aria-hidden className="turn-still-phone">
            <HomePhone />
          </div>
          <ul className="turn-still-features">
            {features.map((feature) => (
              <li key={feature.title}>
                <strong>{feature.title}</strong>
                <span>{feature.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
