// What the phone at the end of the turn shows off. Each feature points at the part of the Today
// screen it describes, in the screen's own points, and arrives from its own side.
type Feature = {
  body: string;
  side: 'left' | 'right';
  target: readonly [number, number];
  title: string;
};

/** The phone's live screen, laid out at an iPhone's size in points. */
export const SCREEN = { height: 874, width: 402 } as const;

export const turnFeatures = (nativeCount: number): Feature[] => [
  {
    body: 'Its glass springs between the options.',
    side: 'left',
    target: [30, 167],
    title: 'A bubble that springs.',
  },
  {
    body: 'iOS 26 draws every surface itself.',
    side: 'right',
    target: [384, 267],
    title: 'The system’s own glass.',
  },
  {
    body: 'Each mark draws itself as you tap.',
    side: 'left',
    target: [27, 509],
    title: 'Checks that draw in.',
  },
  {
    body: 'Under your finger, as the switch slides.',
    side: 'right',
    target: [373, 384],
    title: 'A knob that turns to glass.',
  },
  {
    body: 'Android and the web blur what sits behind.',
    side: 'left',
    target: [76, 815],
    title: 'A blur everywhere else.',
  },
  {
    body: `${nativeCount} components. Every file is yours.`,
    side: 'right',
    target: [340, 682],
    title: 'Install with shadcn.',
  },
];

export const TURN_TITLE = ['Same components.', 'In React Native.'] as const;
