import { useId } from 'react';

// The wallpaper's ribbon fold, in its 900 x 520 drawing.
const RIBBON_EDGE = 'M-150 365C90 225 190 535 420 340C650 145 610 35 1030 125';

const RIBBON = `${RIBBON_EDGE}L1030 183C610 93 650 203 420 398C190 593 90 283-150 423Z`;

type Form =
  | { kind: 'ribbon'; mirror: boolean; x: number; y: number; width: number }
  | { kind: 'drop'; cx: number; cy: number; r: number };

const rise = { kind: 'ribbon', x: 300, y: 95, width: 400 } as const;

const wave = { kind: 'ribbon', x: -70, y: 230, width: 440 } as const;

const crest = { kind: 'ribbon', x: 560, y: 25, width: 420 } as const;

const topRight = { kind: 'drop', cx: 316, cy: 78, r: 112 } as const;

const bottomLeft = { kind: 'drop', cx: 70, cy: 288, r: 140 } as const;

const bottomRight = { kind: 'drop', cx: 338, cy: 262, r: 118 } as const;

// Keep shapes clear of the card's central panel. Space drops four cards apart
// so they never touch horizontally or vertically in grids of up to three columns.
const FORMS: Form[] = [
  { ...rise, mirror: false },
  topRight,
  { ...wave, mirror: false },
  { ...rise, mirror: true },
  { ...wave, mirror: true },
  bottomLeft,
  { ...crest, mirror: false },
  { ...wave, mirror: false },
  { ...crest, mirror: true },
  bottomRight,
  { ...wave, mirror: true },
  { ...crest, mirror: false },
];

// Neighbours differ across a row and down a column, both columns of a two-column grid mix warm
// and cool, and one card in four is Vermilion, always on a ribbon. A form returns in the same
// material 24 cards later at the earliest.
const MATERIALS = [
  'vermilion',
  'apricot',
  'silver',
  'vermilion',
  'graphite',
  'silver',
  'apricot',
  'graphite',
] as const;

type CardBackdropProps = {
  /** The card's place on the page; neighbouring places never share a form or material. */
  index: number;
};

export function CardBackdrop({ index }: CardBackdropProps) {
  const id = `card-backdrop-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const form = FORMS[index % FORMS.length];
  const material = MATERIALS[index % MATERIALS.length];

  return (
    <svg
      aria-hidden
      className="card-backdrop"
      data-material={material}
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 400 300"
    >
      {form.kind === 'ribbon' ? <Ribbon form={form} id={id} /> : <Drop form={form} id={id} />}
    </svg>
  );
}

function Ribbon({ form, id }: { form: Extract<Form, { kind: 'ribbon' }>; id: string }) {
  const scale = 400 / form.width;
  const mirror = form.mirror ? 'translate(400 0) scale(-1 1) ' : '';

  return (
    <>
      <defs>
        {/* A mirrored ribbon mirrors its gradient back, so the light still comes from the left. */}
        <linearGradient id={`${id}-fill`} x1={form.mirror ? 1 : 0} x2="0.5" y1="0" y2="1">
          <stop className="card-backdrop-0" />
          <stop className="card-backdrop-1" offset="0.36" />
          <stop className="card-backdrop-2" offset="0.7" />
          <stop className="card-backdrop-3" offset="1" />
        </linearGradient>
        <filter height="160%" id={`${id}-shadow`} width="120%" x="-10%" y="-20%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <g transform={`${mirror}scale(${scale}) translate(${-form.x} ${-form.y})`}>
        <path
          className="card-backdrop-shadow"
          d={RIBBON}
          filter={`url(#${id}-shadow)`}
          transform="translate(0 14)"
        />
        <path d={RIBBON} fill={`url(#${id}-fill)`} />
        <path className="card-backdrop-lip" d={RIBBON_EDGE} fill="none" strokeWidth="3" />
      </g>
    </>
  );
}

function Drop({ form, id }: { form: Extract<Form, { kind: 'drop' }>; id: string }) {
  return (
    <>
      <defs>
        {/* Lit from the upper left, with a little light thrown back at the far rim. */}
        <radialGradient cx="0.34" cy="0.28" id={`${id}-fill`} r="0.8">
          <stop className="card-backdrop-highlight" />
          <stop className="card-backdrop-0" offset="0.16" />
          <stop className="card-backdrop-1" offset="0.5" />
          <stop className="card-backdrop-2" offset="0.82" />
          <stop className="card-backdrop-3" offset="0.94" />
          <stop className="card-backdrop-2" offset="1" />
        </radialGradient>
        <filter height="160%" id={`${id}-shadow`} width="160%" x="-30%" y="-30%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <circle
        className="card-backdrop-shadow"
        cx={form.cx + 6}
        cy={form.cy + 16}
        filter={`url(#${id}-shadow)`}
        r={form.r}
      />
      <circle cx={form.cx} cy={form.cy} fill={`url(#${id}-fill)`} r={form.r} />
    </>
  );
}
