// The keynote's frame numbers, shared by the compositions and the page that plays them. Nothing
// here imports Remotion, so the page can read them before the player has loaded.

/** Both compositions run at 60 frames a second: the opener plays on its own, the turn by scroll. */
export const FPS = 60;

/** The opener's palette, shared by the poster, slide and glass textures. */
export const STAGE_COLORS = {
  dark: {
    glow: '#18181b',
    middle: '#0b0b0d',
    edge: '#050506',
    ink: '#f5f5f7',
    quiet: '#a8a8af',
    mark: '#fff',
  },
  light: {
    glow: '#faf9f7',
    middle: '#f0f0f3',
    edge: '#e2e4e8',
    ink: '#222224',
    quiet: '#66666a',
    mark: '#000',
  },
} as const;

export type PhoneTheme = keyof typeof STAGE_COLORS;

/** The poster and composition paint the same background in the page's appearance. */
export const stageBackground = (theme: keyof typeof STAGE_COLORS) => {
  const colors = STAGE_COLORS[theme];

  return `radial-gradient(120% 85% at 50% 42%, ${colors.glow} 0%, ${colors.middle} 52%, ${colors.edge} 100%)`;
};

// The opener plays on its own as the page loads, about five seconds: the mark, a beat to read it,
// the title coming into focus, the glass crossing it, and the fold.
export const OPENER = {
  durationInFrames: 307,
  /** The poster brings the mark into focus before the player loads. */
  ribbon: [6, 65],
  /** Where the player takes over from the poster if it loads after the ribbon is down. */
  rest: 70,
  /** The ribbon rises into a title slide; each line focuses once the ribbon has cleared it. */
  title: [74, 118],
  firstLine: [96, 134],
  secondLine: [106, 145],
  /** After a beat to read the title, a slab of glass crosses its first line, slowest mid-way. */
  lens: [150, 204],
  /** The slide shrinks into the open display of the folding phone. */
  pull: [207, 242],
  /** The left half folds shut over the right. */
  fold: [233, 280],
  /** The closed phone turns away as the header arrives. */
  away: [272, 306],
  header: [283, 306],
  end: 306,
} as const;

export const TURN = {
  durationInFrames: 720,
  /** The picture of the desk takes over as the stage pins, then lifts and shrinks a little. */
  lift: [0, 60],
  caption: [0, 36],
  glint: [16, 96],
  spin: [60, 260],
  title: [236, 296],
  /** Each feature's first frame, alternating left and right. */
  features: [300, 356, 412, 468, 524, 580],
  featureLength: 40,
  end: 719,
} as const;
