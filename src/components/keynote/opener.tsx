import { useId, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { GlassPhoneDuo } from '@/components/liquid/phone-duo';
import { OPENER, STAGE_COLORS, stageBackground } from './frames';
import type { PhoneTheme } from './frames';
import { GlassLens } from './glass-lens';
import type { LensScene } from './glass-lens';
import { RIBBON_BAND, RIBBON_FOLD, VERMILION } from './ribbon';
import { RibbonMark } from './ribbon-mark';
import { EASE_IN, EASE_IN_OUT, EASE_OUT, tween } from './timeline';

const DISPLAY_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', Roboto, Inter, system-ui, sans-serif";

const LINES = [{ text: 'Bends light.' }, { text: 'In any browser.' }] as const;

const PHONE_DISPLAY_ASPECT = 2670 / 1878;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The ribbon's size while the page waits for the first scroll, as CSS reads it in the poster. */
const restRibbonSize = (width: number, height: number) =>
  clamp(0.22 * Math.min(width, height), 120, 200);

function layout(width: number, height: number) {
  const font = clamp(Math.min(width * 0.125, height * 0.16), 32, 168);
  const ribbon = clamp(font * 0.5, 48, 84);
  const gap = font * 0.34;
  const line = font * 1.05;
  const top = (height - (ribbon + gap + 2 * line)) / 2;
  const lensHeight = Math.round(font * 1.24);
  const lensWidth = Math.round(lensHeight * 2.3);

  return {
    font,
    lens: { height: lensHeight, width: lensWidth, y: top + ribbon + gap + line * 0.53 },
    // Each line's centre, where SVG's central baseline sits.
    lines: [top + ribbon + gap + font * 0.53, top + ribbon + gap + line + font * 0.53],
    ribbon: { rest: restRibbonSize(width, height), title: ribbon, y: top + ribbon / 2 },
  };
}

type Layout = ReturnType<typeof layout>;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The slide's lines as SVG sets them: the font, weight and tracking of every line. */
const lineStyle = (font: number) => ({
  fontFamily: DISPLAY_FONT,
  fontSize: `${font}px`,
  fontWeight: '600',
  letterSpacing: '-0.015em',
});

/**
 * Where this browser's SVG starts each glyph of the slide's lines. Engines set SVG text a little
 * differently from canvas text (WebKit's runs about a hundredth wider), so the slide's canvas copy
 * takes its glyphs' places from the SVG it copies.
 */
function glyphStarts(geometry: Layout, width: number) {
  const svg = document.createElementNS(SVG_NS, 'svg');

  svg.style.cssText = 'position: fixed; top: 0; left: 0; visibility: hidden; pointer-events: none';

  const nodes = LINES.map((line, index) => {
    const node = document.createElementNS(SVG_NS, 'text');

    node.setAttribute('text-anchor', 'middle');
    node.setAttribute('x', String(width / 2));
    node.setAttribute('y', String(geometry.lines[index]));
    Object.assign(node.style, lineStyle(geometry.font));
    node.textContent = line.text;
    svg.append(node);

    return node;
  });

  document.body.append(svg);

  const starts = nodes.map((node) =>
    Array.from({ length: node.getNumberOfChars() }, (_, at) => node.getStartPositionOfChar(at).x),
  );

  svg.remove();

  return starts;
}

/**
 * The title slide at rest, drawn once at device resolution with the slide's own gradient,
 * ribbon construction, font and colours: what the glass bends, and what the fold frosts over.
 */
function paintSlideScene(
  geometry: Layout,
  width: number,
  height: number,
  theme: PhoneTheme,
): LensScene {
  const palette = STAGE_COLORS[theme];
  const ratio = Math.min(window.devicePixelRatio || 1, 2, 4096 / width, 4096 / height);
  const canvas = document.createElement('canvas');

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);

  const context = canvas.getContext('2d');

  if (!context) throw new Error('The keynote could not draw its slide.');

  context.scale(ratio, ratio);

  // CSS's radial-gradient(120% 85% at 50% 42%), an ellipse, as a circle squashed vertically.
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, width * 1.2);

  gradient.addColorStop(0, palette.glow);
  gradient.addColorStop(0.52, palette.middle);
  gradient.addColorStop(1, palette.edge);
  context.save();
  context.translate(width / 2, height * 0.42);
  context.scale(1, (height * 0.85) / (width * 1.2));
  context.fillStyle = gradient;
  context.fillRect(-width * 2, -height * 4, width * 4, height * 8);
  context.restore();

  const mark = geometry.ribbon.title;

  context.save();
  context.translate(width / 2 - mark / 2, geometry.ribbon.y - mark / 2);
  context.scale(mark / 64, mark / 64);
  context.fillStyle = palette.mark;
  context.fill(new Path2D(RIBBON_BAND));
  context.fillStyle = VERMILION;
  context.fill(new Path2D(RIBBON_FOLD));
  context.restore();

  const starts = glyphStarts(geometry, width);

  context.font = `600 ${geometry.font}px ${DISPLAY_FONT}`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';

  // SVG's central baseline lies halfway between the font's ascent and descent, a few pixels below
  // canvas's middle one, so each line is set on its alphabetic baseline.
  LINES.forEach((line, index) => {
    const metrics = context.measureText(line.text);

    const baseline =
      geometry.lines[index] + (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;

    context.fillStyle = index === 0 ? palette.ink : palette.quiet;
    [...line.text].forEach((glyph, at) => context.fillText(glyph, starts[index][at], baseline));
  });

  return { canvas, height, width, x: 0, y: 0 };
}

type SlideState = {
  layout: Layout;
  lines: Array<{ blur: number; opacity: number; rise: number }>;
  ribbon: { size: number; y: number };
};

/** The title slide without its glass: the background, the ribbon and the two lines. */
function SlideContent({
  height,
  state,
  theme,
  width,
}: {
  height: number;
  state: SlideState;
  theme: PhoneTheme;
  width: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const { layout: geometry, lines, ribbon } = state;
  const palette = STAGE_COLORS[theme];

  return (
    <AbsoluteFill style={{ background: stageBackground(theme) }}>
      <RibbonMark
        style={{
          color: palette.mark,
          position: 'absolute',
          left: 0,
          top: 0,
          width: ribbon.size,
          height: ribbon.size,
          transform: `translate3d(${width / 2 - ribbon.size / 2}px, ${ribbon.y - ribbon.size / 2}px, 0)`,
        }}
      />
      <svg
        aria-hidden
        height={height}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <defs>
          {lines.map((line, index) => (
            <filter
              height="200%"
              id={`keynote-focus-${id}-${index}`}
              key={index}
              width="140%"
              x="-20%"
              y="-50%"
            >
              <feGaussianBlur stdDeviation={line.blur} />
            </filter>
          ))}
        </defs>
        {LINES.map((line, index) => (
          <text
            dominantBaseline="central"
            fill={index === 0 ? palette.ink : palette.quiet}
            filter={lines[index].blur > 0.05 ? `url(#keynote-focus-${id}-${index})` : undefined}
            key={line.text}
            opacity={lines[index].opacity}
            style={lineStyle(geometry.font)}
            textAnchor="middle"
            transform={`translate(0 ${lines[index].rise})`}
            x={width / 2}
            y={geometry.lines[index]}
          >
            {line.text}
          </text>
        ))}
      </svg>
    </AbsoluteFill>
  );
}

// The slab crosses the title in one continuous curve: quick from the edge, slow over the middle,
// quick away again, its speed never jumping. Cubic about the middle, so the drift there is a
// fifth of the average speed.
const lensPath = (progress: number) => {
  const u = progress - 0.5;

  return 0.5 + 0.2 * u + 3.2 * u * u * u;
};

// The phone accelerates and settles gently, with zero velocity and acceleration at both ends.
const easePhone = (progress: number) => progress ** 3 * (10 - 15 * progress + 6 * progress ** 2);

/**
 * The home page's opening, played once as the page loads: a stage where the ribbon lays
 * itself down, rises into a title slide whose lines come into focus, a slab of glass bends the
 * title as it passes, and the slide shrinks into GlassPhoneDuo over the page. The component
 * folds shut, its swinging half frosting the flat title, and turns away to the right. The page
 * is the real one; this composition draws only the stage.
 */
export function Opener({ theme }: { theme: PhoneTheme }) {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const geometry = layout(width, height);

  const scenes = useMemo(() => {
    if (typeof document === 'undefined') return null;

    const slide = layout(width, height);
    // Extend the slide to the component's display shape. The oversized display initially fills
    // the stage, then scales down without stretching the title or changing the phone's model.
    const screenWidth = Math.max(width, height * PHONE_DISPLAY_ASPECT) * 1.08;
    const screenHeight = screenWidth / PHONE_DISPLAY_ASPECT;
    const offsetY = (screenHeight - height) / 2;

    const phoneSlide = {
      ...slide,
      lines: slide.lines.map((y) => y + offsetY),
      ribbon: { ...slide.ribbon, y: slide.ribbon.y + offsetY },
    };

    return {
      lens: paintSlideScene(slide, width, height, theme),
      phoneSrc: paintSlideScene(phoneSlide, screenWidth, screenHeight, theme).canvas.toDataURL(),
      screenWidth,
    };
  }, [height, theme, width]);

  const title = tween(frame, OPENER.title, [0, 1], EASE_IN_OUT);

  const state: SlideState = {
    layout: geometry,
    lines: [OPENER.firstLine, OPENER.secondLine].map((range) => {
      const shown = tween(frame, range, [0, 1], EASE_OUT);

      return {
        blur: (1 - shown) * geometry.font * 0.07,
        opacity: shown,
        rise: (1 - shown) * geometry.font * 0.22,
      };
    }),
    ribbon: {
      size: geometry.ribbon.rest + (geometry.ribbon.title - geometry.ribbon.rest) * title,
      y: height / 2 + (geometry.ribbon.y - height / 2) * title,
    },
  };

  const [enter, leave] = OPENER.lens;
  const across = tween(frame, [enter, leave], [0, 1], (value) => value);
  const lensShown = frame > enter && frame < leave;
  const travel = width + geometry.lens.width + 96;

  const lensCentre = {
    x: -geometry.lens.width / 2 - 48 + lensPath(across) * travel,
    y: geometry.lens.y,
  };

  const motion = {
    away: tween(frame, OPENER.away, [0, 1], EASE_IN),
    fold: tween(frame, OPENER.fold, [0, 1], easePhone),
    pull: tween(frame, OPENER.pull, [0, 1], easePhone),
  };

  // From the first frame of the pull the phone draws the slide; the page shows around it.
  const folding = frame > OPENER.pull[0];
  const screenWidth = Math.min(width * 0.86, height * 0.6 * PHONE_DISPLAY_ASPECT);

  const phoneStyle: CSSProperties & Record<'--lg-phone-duo-turn', string> = {
    '--lg-phone-duo-turn': `${motion.away * 40}deg`,
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: scenes ? (scenes.screenWidth * 220) / 157.5 : 0,
    transform: `translate(-50%, -50%) translateX(${motion.away * (width / 2 + screenWidth / 2 + 48)}px) scale(${scenes ? 1 + (screenWidth / scenes.screenWidth - 1) * motion.pull : 1})`,
    transition: 'none',
    visibility: folding ? 'visible' : 'hidden',
    pointerEvents: 'none',
  };

  return (
    <AbsoluteFill>
      {folding ? null : <SlideContent height={height} state={state} theme={theme} width={width} />}
      {scenes ? (
        <GlassPhoneDuo
          angle={180 * (1 - motion.fold)}
          aria-hidden
          coverSrc={`/previews/phone-duo-cover${theme === 'dark' ? '-dark' : ''}.webp`}
          finish={theme === 'dark' ? 'night-sky' : 'star-white'}
          screenSrc={scenes.phoneSrc}
          style={phoneStyle}
        />
      ) : null}
      <GlassLens
        centre={lensCentre}
        height={geometry.lens.height}
        scene={scenes?.lens ?? null}
        visible={lensShown && !folding}
        width={geometry.lens.width}
      />
    </AbsoluteFill>
  );
}
