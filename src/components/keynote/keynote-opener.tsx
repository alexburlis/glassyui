'use client';

import type { PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { usePreferences } from '@/components/liquid';
import { OPENER, stageBackground } from './frames';
import { PosterRibbon } from './poster-ribbon';
import { motionReduced } from './scrubber';
import '@/styles/keynote.css';

type StageModule = typeof import('./opener-stage');

// Remember the first arrival as it starts, so even a reload mid-intro opens on the page.
// Replay intro plays it again on request.
const SEEN = { key: 'glassy-ui-intro', value: 'seen' };

const SKIP_EVENT = 'glassy:skip-intro';

const POSTER_STYLE: CSSProperties & Record<`--keynote-stage-${'dark' | 'light'}`, string> = {
  '--keynote-stage-dark': stageBackground('dark'),
  '--keynote-stage-light': stageBackground('light'),
};

// Runs while the page is parsed, before the header and hero paint. With JavaScript and motion
// allowed the keynote runs (data-keynote, which the turn needs); a first view of the top of the
// page also plays the opener (data-keynote-intro), so the page opens at its top. The opener's
// poster draws in a worker, so it needs a browser that can hand a canvas to one.
// Save the visit before showing it; without storage, automatic playback stays off.
const BOOTSTRAP = `(function(){var r=document.documentElement;if(r.getAttribute('data-lg-reduce-motion')==='1'||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;r.setAttribute('data-keynote','');if(location.hash||!window.Worker||!('transferControlToOffscreen' in HTMLCanvasElement.prototype))return;try{if(localStorage.getItem('${SEEN.key}')==='${SEEN.value}')return;localStorage.setItem('${SEEN.key}','${SEEN.value}');}catch(e){return;}r.setAttribute('data-keynote-intro','');if('scrollRestoration' in history)history.scrollRestoration='manual';})();`;

// Like the poster, skipping works as soon as its HTML arrives, before React or Remotion. A first
// click or tap shows how to skip; the second fades the current frame, or hurries an ongoing
// fold. Safari needs the stage's own click listener for taps. Keyboard activation, Tab and
// Escape skip without pointer confirmation.
const SKIP = `(function(){
  var root=document.documentElement;
  var button=document.currentScript.previousElementSibling;
  var stage=button.previousElementSibling;
  var pointer='mouse';
  var land=function(){
    root.removeAttribute('data-keynote-skip');
    root.removeAttribute('data-keynote-exiting');
    root.removeAttribute('data-keynote-intro');
    var nav=document.querySelector('.site-nav');
    if(nav)nav.style.removeProperty('translate');
  };
  var skip=function(){
    if(!root.hasAttribute('data-keynote-intro')||root.hasAttribute('data-keynote-exiting'))return;
    root.setAttribute('data-keynote-exiting','');
    root.removeAttribute('data-keynote-skip');
    if(!window.dispatchEvent(new Event('${SKIP_EVENT}',{cancelable:true})))return;
    var nav=document.querySelector('.site-nav');
    if(nav)nav.animate([{translate:'0 -150%'},{translate:'none'}],{duration:200,easing:'ease-out'});
    var exit=stage.animate([{opacity:1},{opacity:0}],{duration:200,easing:'ease-out'});
    exit.addEventListener('finish',land,{once:true});
  };
  var press=function(){
    if(!root.hasAttribute('data-keynote-intro')||root.hasAttribute('data-keynote-exiting'))return;
    if(root.hasAttribute('data-keynote-skip')){skip();return;}
    root.setAttribute('data-keynote-skip',pointer);
  };
  var identify=function(event){pointer=event.pointerType==='touch'?'touch':'mouse';};
  stage.addEventListener('pointerdown',identify);
  button.addEventListener('pointerdown',identify);
  stage.addEventListener('click',press);
  button.addEventListener('click',function(event){if(event.detail===0)skip();else press();});
})();`;

/** Asks the opener to play again from its first frame. */
const REPLAY_EVENT = 'glassy:replay-intro';

/** Put this before the header, so neither it nor the hero paints before the stage does. */
export function KeynoteBootstrap() {
  return <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP }} />;
}

/**
 * Plays the opener again from its first frame. It shows only where the opener can run: with
 * JavaScript and motion allowed.
 */
export function KeynoteReplay() {
  return (
    <button
      className="keynote-replay"
      onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}
      type="button"
    >
      <svg aria-hidden fill="none" height="14" viewBox="0 0 16 16" width="14">
        <path
          d="M2.75 8a5.25 5.25 0 1 0 1.6-3.78M2.75 2.5v3.25H6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
      Replay intro
    </button>
  );
}

type Size = { height: number; width: number };

// Keys that would scroll the page while the opener holds it.
const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End']);

/**
 * The home page's opening. It plays on its own as the page loads, a Remotion composition over
 * the real page, and lands on the ordinary home page in about five seconds. Two clicks or taps
 * skip it smoothly; Tab or Escape skips without confirmation. A visitor sees it once, and
 * Replay intro plays it again from the top of the page.
 */
export function KeynoteOpener({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef | null>(null);
  const startRef = useRef<() => void>(() => {});
  const [intro, setIntro] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [size, setSize] = useState<Size | null>(null);
  const [stageModule, setStageModule] = useState<StageModule | null>(null);
  const [ribbonDown, setRibbonDown] = useState(false);
  // The frame the player starts on: where the poster's mark rests as the page loads, and the
  // composition's own first frame on a replay, which has no poster to take over from.
  const [from, setFrom] = useState<number>(OPENER.rest);
  const { preferences } = usePreferences();
  // Whether the opener was running when this effect last cleaned up.
  const interrupted = useRef(false);

  useLayoutEffect(() => {
    const root = document.documentElement;

    // React runs the effect again without unmounting (twice on mount in development). The
    // bootstrap already remembers the visit, so an opener cut off by the cleanup would never
    // return; it carries on instead.
    if (interrupted.current) root.setAttribute('data-keynote-intro', '');

    // The keynote follows the reduced-motion setting and the site's preference as they change.
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    let firstRead = true;

    const apply = () => {
      const allowed = !motionReduced();
      const turn = document.querySelector('.turn');
      const before = turn?.getBoundingClientRect();
      const anchor = firstRead ? document.querySelector(':target') : null;

      firstRead = false;

      root.toggleAttribute('data-keynote', allowed);

      // A visitor who scrolled before the page could hold still has moved on; the opener only
      // plays over the top of the page.
      if (!allowed || window.scrollY > 0) root.removeAttribute('data-keynote-intro');

      if (!root.hasAttribute('data-keynote-intro')) {
        root.removeAttribute('data-keynote-skip');
        root.removeAttribute('data-keynote-exiting');
      }

      setIntro(root.hasAttribute('data-keynote-intro'));

      // The turn takes screens of scroll only while the keynote runs. A visitor below it keeps
      // their place as it grows or shrinks.
      const after = turn?.getBoundingClientRect();

      if (before && after && before.bottom <= 0 && after.height !== before.height) {
        // React's development cleanup can shrink the page and clamp its scroll position. On
        // arrival the address owns that position; later preference changes keep the viewport.
        if (anchor) anchor.scrollIntoView({ behavior: 'instant' });
        else window.scrollBy({ behavior: 'instant', top: after.height - before.height });
      }
    };

    // Turning motion back on rebuilds the turn and reflows the page, so it waits for the control
    // that asked for it to finish moving; turning it off applies at once.
    let waiting = 0;

    const evaluate = () => {
      window.clearTimeout(waiting);

      if (!motionReduced() && !root.hasAttribute('data-keynote'))
        waiting = window.setTimeout(apply, 500);
      else apply();
    };

    apply();

    const observer = new MutationObserver(evaluate);

    // The poster calls the opener off in a browser that cannot draw it; a replay calls it back.
    observer.observe(root, {
      attributeFilter: ['data-keynote-intro', 'data-lg-reduce-motion'],
      attributes: true,
    });
    query.addEventListener('change', evaluate);

    return () => {
      window.clearTimeout(waiting);
      observer.disconnect();
      query.removeEventListener('change', evaluate);
      interrupted.current = root.hasAttribute('data-keynote-intro');
      root.removeAttribute('data-keynote');
      root.removeAttribute('data-keynote-intro');
      root.removeAttribute('data-keynote-skip');
      root.removeAttribute('data-keynote-exiting');
    };
  }, []);

  // The composition lays out for the stage it fills, measured as the opener starts: the stage
  // only has a size while it shows, and a replay may come after the window has changed.
  useLayoutEffect(() => {
    const stage = stageRef.current;

    if (!intro || !stage) return;

    setSize({ height: Math.round(stage.clientHeight), width: Math.round(stage.clientWidth) });
  }, [intro]);

  // Mounting the player sets up its WebGL and paints the slide. It waits until the poster's
  // worker has brought the mark into focus, where the composition rests a beat, so its first
  // frame matches the poster's last.
  useEffect(() => {
    const canvas = posterRef.current?.querySelector('canvas');

    if (!intro || !canvas) return;

    if (canvas.hasAttribute('data-down')) {
      setRibbonDown(true);

      return;
    }

    const observer = new MutationObserver(() => {
      if (canvas.hasAttribute('data-down')) setRibbonDown(true);
    });

    observer.observe(canvas, { attributeFilter: ['data-down'], attributes: true });

    return () => observer.disconnect();
  }, [intro]);

  // Remotion arrives after the first paint; the poster brings the mark into focus until it has.
  useEffect(() => {
    if (!intro || stageModule) return;

    let current = true;

    import('./opener-stage').then((module) => {
      if (current) setStageModule(module);
    });

    return () => {
      current = false;
    };
  }, [intro, stageModule]);

  const land = useCallback(() => {
    const root = document.documentElement;

    root.removeAttribute('data-keynote-intro');
    root.removeAttribute('data-keynote-skip');
    root.removeAttribute('data-keynote-exiting');
    document.querySelector<HTMLElement>('.site-nav')?.style.removeProperty('translate');
    setIntro(false);
  }, []);

  // A replay starts over from the top of the page, at the composition's first frame.
  useEffect(() => {
    const replay = () => {
      const root = document.documentElement;

      if (!root.hasAttribute('data-keynote') || root.hasAttribute('data-keynote-intro')) return;

      try {
        localStorage.setItem(SEEN.key, SEEN.value);
      } catch {
        // An explicit replay can run without storage; automatic playback stays disabled.
      }

      window.scrollTo({ behavior: 'instant', top: 0 });
      setFrom(0);
      setPlaying(false);
      setRate(1);
      setRibbonDown(true);
      root.setAttribute('data-keynote-intro', '');
    };

    window.addEventListener(REPLAY_EVENT, replay);

    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, []);

  // While the opener plays the page holds still, and scrolling waits for it to land; a first
  // click or tap lets it play on while the skip control says how to skip. The inline handlers
  // finish an ongoing fold faster; before it begins, they fade the current frame to the page.
  useEffect(() => {
    if (!intro) return;

    const hold = (event: Event) => event.preventDefault();

    const onSkip = (event: Event) => {
      const player = playerRef.current;

      if (
        !player ||
        player.getCurrentFrame() < OPENER.fold[0] ||
        !stageRef.current?.querySelector('.keynote-player[data-playing]')
      )
        return;

      event.preventDefault();
      setRate(1.7);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Escape')
        document.querySelector<HTMLButtonElement>('.keynote-skip')?.click();
      else if (
        SCROLL_KEYS.has(event.key) &&
        event.target !== document.querySelector('.keynote-skip')
      )
        event.preventDefault();
    };

    window.addEventListener('wheel', hold, { passive: false });
    window.addEventListener('touchmove', hold, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener(SKIP_EVENT, onSkip);

    return () => {
      window.removeEventListener('wheel', hold);
      window.removeEventListener('touchmove', hold);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(SKIP_EVENT, onSkip);
    };
  }, [intro]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!intro || !stageModule || !stage) return;

    const { openerHeader } = stageModule;
    const nav = document.querySelector<HTMLElement>('.site-nav');
    let finished = false;
    let started = false;

    const finish = () => {
      if (finished) return;

      finished = true;
      land();
    };

    const paint = (frame: number) => {
      stage.dataset.frame = frame.toFixed(2);
      // Set on the header alone: a custom property on the root would restyle every element on
      // the page each frame.
      nav?.style.setProperty('translate', `0 ${((openerHeader(frame) - 1) * 150).toFixed(3)}%`);

      if (frame >= OPENER.end) finish();
    };

    // The poster has brought the mark into focus with the composition's own timing; the player
    // picks up from the beat where the finished mark rests, or from the start on a replay.
    // It plays once the composition has mounted and drawn a frame, so setting up its WebGL never
    // costs a played frame.
    let waiting = 0;

    const start = () => {
      const player = playerRef.current;

      if (started || !player) return;

      if (!stage.querySelector('.keynote-player canvas')) {
        cancelAnimationFrame(waiting);
        waiting = requestAnimationFrame(start);

        return;
      }

      started = true;
      player.addEventListener('frameupdate', ({ detail }) => paint(detail.frame));
      player.addEventListener('ended', finish);
      player.seekTo(from);
      paint(from);
      waiting = requestAnimationFrame(() => {
        waiting = requestAnimationFrame(() => {
          player.play();
          setPlaying(true);
        });
      });
    };

    startRef.current = start;
    start();

    return () => {
      startRef.current = () => {};

      cancelAnimationFrame(waiting);
      nav?.style.removeProperty('translate');
      delete stage.dataset.frame;
    };
  }, [from, intro, land, stageModule]);

  // The player's handle arrives once it has mounted; it may be what the start waited for.
  const attachPlayer = useCallback((player: PlayerRef | null) => {
    playerRef.current = player;

    if (player) startRef.current();
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="keynote-stage"
        data-replay={from === OPENER.rest ? undefined : ''}
        ref={stageRef}
        style={POSTER_STYLE}
      >
        <div className="keynote-poster" ref={posterRef}>
          <PosterRibbon />
        </div>
        {intro && size && stageModule && ribbonDown ? (
          <div className="keynote-player" data-playing={playing || undefined}>
            <stageModule.default
              from={from}
              height={size.height}
              onPlayer={attachPlayer}
              rate={rate}
              theme={preferences.theme}
              width={size.width}
            />
          </div>
        ) : null}
      </div>
      <button aria-label="Skip intro" className="keynote-skip" type="button">
        <span className="keynote-skip-key">Skip intro</span>
        <span className="keynote-skip-mouse">Click again to skip</span>
        <span className="keynote-skip-touch">Tap again to skip</span>
        <span aria-hidden> ›</span>
      </button>
      <script dangerouslySetInnerHTML={{ __html: SKIP }} />
      <div className="keynote">{children}</div>
    </>
  );
}
