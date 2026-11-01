import type { RefObject } from 'react';

/*
  The hero's dusk: a sky over still water, with a moon path and the horizon the breathing orb
  rests on. Its stars and glints are fixed, so the server and the browser draw the same sky.
*/

type Star = [
  x: number,
  y: number,
  r: number,
  opacity: number,
  wideOnly: 0 | 1,
  twinkle: number | null,
];

type Glint = [
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
  twinkle: number | null,
];

// Positions in percent of the sky. Stars marked wideOnly leave phones' smaller sky uncluttered;
// the ones with a twinkle delay shimmer, the page's one quiet loop.
const STARS: Star[] = [
  [0, 81.3, 0.57, 0.47, 0, null],
  [72.9, 35.8, 0.6, 0.76, 1, null],
  [75.5, 36.8, 0.98, 0.7, 0, -13.1],
  [24.2, 21.1, 1.01, 0.73, 1, null],
  [5.4, 52, 0.71, 0.86, 0, null],
  [80.7, 4, 0.75, 0.86, 1, null],
  [68.9, 47.5, 0.83, 0.85, 0, -14.5],
  [37.2, 17.9, 1.24, 0.53, 1, null],
  [15.3, 14.9, 0.67, 0.51, 0, null],
  [93.7, 38.3, 1.05, 0.83, 1, -0.9],
  [27.3, 38.6, 0.75, 0.58, 0, null],
  [19.3, 79.7, 0.5, 0.55, 1, null],
  [34.4, 49.8, 1.43, 0.63, 0, -2.6],
  [40.6, 13.9, 0.62, 0.58, 1, null],
  [33.3, 35.7, 0.88, 0.48, 0, -14.5],
  [45.8, 73.8, 0.91, 0.7, 1, null],
  [51.6, 33, 0.98, 0.87, 0, null],
  [39.7, 54.8, 0.55, 0.67, 1, null],
  [35.1, 17.5, 0.64, 0.79, 0, null],
  [87.8, 3.4, 1.21, 0.39, 1, -6.5],
  [15.4, 2, 1.59, 0.47, 0, -10.1],
  [14.4, 28.4, 0.85, 0.43, 1, -14.7],
  [88.5, 77.3, 1.34, 0.85, 0, -12.2],
  [27.5, 0.1, 0.55, 0.39, 1, null],
  [0.2, 44.6, 0.54, 0.76, 0, null],
  [48.9, 52.4, 0.55, 0.84, 1, null],
  [23.5, 21, 1.36, 0.42, 0, null],
  [48.9, 0, 1.4, 0.7, 1, null],
  [92.2, 0.3, 1.37, 0.45, 0, -15.5],
  [56.5, 51.5, 0.56, 0.47, 1, null],
  [20.9, 39, 0.5, 0.77, 0, null],
  [70.1, 55.5, 0.74, 0.37, 1, null],
  [11, 81.1, 0.51, 0.73, 0, null],
  [89.3, 0.7, 1.34, 0.82, 1, -15.9],
  [95.4, 61.5, 0.66, 0.49, 0, null],
  [72.8, 76.2, 0.65, 0.48, 1, null],
  [40.5, 76.9, 0.81, 0.54, 0, null],
  [62.2, 58, 0.6, 0.75, 1, null],
  [42.3, 8.1, 0.58, 0.89, 0, null],
  [99.4, 46.3, 1.31, 0.86, 1, null],
  [20, 47.7, 0.51, 0.62, 0, null],
  [55.7, 62.3, 1.47, 0.62, 1, null],
  [18.7, 27.5, 0.52, 0.71, 0, null],
  [52.2, 38.7, 0.75, 0.77, 1, null],
  [36.2, 59.9, 0.5, 0.51, 0, null],
  [54.2, 8.4, 1.04, 0.51, 1, null],
  [23.6, 49.3, 0.67, 0.39, 0, null],
  [77.3, 68.7, 1.41, 0.85, 1, null],
  [68.1, 86.4, 0.5, 0.77, 0, null],
  [60.1, 56.7, 1.37, 0.37, 1, null],
  [13.6, 2.1, 0.51, 0.4, 0, null],
  [0.9, 43.3, 1.47, 0.46, 1, null],
  [13.4, 8.4, 0.96, 0.48, 0, null],
  [45.6, 91.2, 0.67, 0.72, 1, null],
  [77.4, 23, 0.66, 0.38, 0, null],
  [23, 66.8, 1.54, 0.43, 1, null],
  [92.6, 33.4, 0.51, 0.47, 0, null],
  [60.3, 6.5, 0.5, 0.5, 1, null],
  [64.7, 38.2, 0.72, 0.9, 0, null],
  [7.5, 24.5, 0.59, 0.35, 1, null],
  [0.6, 24.5, 0.51, 0.48, 0, null],
  [92.4, 63.1, 1.11, 0.59, 1, null],
  [85.5, 86.9, 1.18, 0.71, 0, null],
  [57.2, 18.9, 0.65, 0.62, 1, null],
  [49.5, 39.3, 1.04, 0.72, 0, null],
  [63.3, 57.3, 1.34, 0.81, 1, null],
  [98.8, 26.7, 0.73, 0.88, 0, null],
  [97.5, 19.7, 0.5, 0.54, 1, null],
  [88.3, 54.9, 1.06, 0.88, 0, null],
  [78.7, 8.7, 0.55, 0.79, 1, null],
  [10.4, 80.6, 1.17, 0.7, 0, null],
  [71.1, 36.1, 0.68, 0.83, 1, null],
  [56.3, 75.1, 0.56, 0.73, 0, null],
  [43.4, 22.8, 0.53, 0.67, 1, null],
];

// The moon path's glints on the water, in perspective, on a 300 by 240 canvas.
const GLINTS: Glint[] = [
  [148, 4.3, 1.9, 0.8, 0.49, -1.5],
  [153.3, 4.3, 2.6, 0.8, 0.57, -3.6],
  [150.4, 7.5, 3.2, 0.8, 0.48, null],
  [140.8, 7.5, 2.1, 0.8, 0.57, -2.3],
  [137.6, 12.2, 4.3, 0.8, 0.42, null],
  [151.8, 12.2, 3.9, 0.8, 0.46, null],
  [152.2, 18.2, 4, 0.8, 0.44, null],
  [158.5, 18.2, 4, 0.8, 0.44, null],
  [145.8, 25.4, 4.2, 0.8, 0.56, -6.7],
  [137.4, 25.4, 5.8, 0.8, 0.4, null],
  [158.5, 25.4, 3.3, 0.8, 0.5, null],
  [133.9, 33.9, 7.6, 0.8, 0.45, null],
  [163.3, 33.9, 4, 0.8, 0.49, null],
  [151.7, 33.9, 7.8, 0.8, 0.51, -6.2],
  [144.4, 43.4, 8.5, 1, 0.49, null],
  [160, 43.4, 5.7, 1, 0.42, null],
  [130.2, 43.4, 8.5, 1, 0.52, null],
  [153.5, 54.1, 5.1, 1, 0.4, null],
  [163.5, 54.1, 8.2, 1, 0.5, null],
  [135.9, 54.1, 7.9, 1, 0.44, null],
  [137.2, 65.7, 10.8, 1, 0.46, null],
  [182.1, 65.7, 8.3, 1, 0.38, null],
  [157.9, 65.7, 9.9, 1, 0.32, null],
  [148.5, 78.5, 9.3, 1, 0.31, null],
  [185.4, 78.5, 12.8, 1, 0.45, null],
  [164.2, 78.5, 10, 1, 0.37, null],
  [153.5, 92.1, 12, 1, 0.39, null],
  [134.6, 92.1, 10.3, 1, 0.31, null],
  [115, 92.1, 14.2, 1, 0.42, null],
  [178.3, 92.1, 14.6, 1, 0.4, null],
  [159.9, 106.8, 17.4, 1, 0.32, null],
  [100.8, 106.8, 17.2, 1, 0.39, null],
  [137.2, 106.8, 17.4, 1, 0.31, null],
  [186.4, 106.8, 10.6, 1, 0.29, null],
  [147, 122.4, 19.7, 1, 0.28, null],
  [96.2, 122.4, 13.7, 1, 0.35, null],
  [180.3, 122.4, 17.1, 1, 0.26, null],
  [117.2, 122.4, 10.9, 1, 0.25, null],
  [193.6, 139, 20.2, 1, 0.23, null],
  [108.1, 139, 13.6, 1, 0.24, null],
  [137.1, 139, 13.5, 1, 0.28, null],
  [79.4, 139, 13.7, 1, 0.26, null],
  [172.8, 156.4, 17.2, 1, 0.28, null],
  [198.1, 156.4, 18.2, 1, 0.24, null],
  [115, 156.4, 18.5, 1, 0.19, null],
  [69.3, 156.4, 17.5, 1, 0.21, null],
  [92.4, 174.7, 23.3, 1, 0.21, null],
  [217.3, 174.7, 17.6, 1, 0.21, null],
  [141.4, 174.7, 20.9, 1, 0.23, null],
  [185.2, 174.7, 14.5, 1, 0.21, null],
  [135.9, 194, 28.9, 1, 0.15, null],
  [176.2, 194, 23, 1, 0.2, null],
  [81.2, 194, 27.3, 1, 0.14, null],
  [51, 194, 16.2, 1, 0.17, null],
  [168.9, 214.1, 30.6, 1, 0.16, null],
  [208.8, 214.1, 19.3, 1, 0.16, null],
  [31.9, 214.1, 22.4, 1, 0.14, null],
  [118.6, 214.1, 32.4, 1, 0.15, null],
  [107.6, 235, 32.1, 1, 0.09, null],
  [171.6, 235, 19.8, 1, 0.12, null],
  [200.1, 235, 27.5, 1, 0.11, null],
  [31.7, 235, 18.7, 1, 0.08, null],
];

function twinkle(delay: number | null) {
  return delay === null ? undefined : { animationDelay: `${delay}s` };
}

export function HeroSky({ glowRef }: { glowRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div aria-hidden className="still-sky">
      <div className="still-sky-gradient" />
      <svg className="still-sky-stars" focusable="false" height="100%" width="100%">
        {STARS.map(([x, y, r, opacity, wideOnly, delay]) => (
          <circle
            key={`${x}-${y}`}
            className={
              [wideOnly ? 'still-sky-wide' : '', delay === null ? '' : 'still-twinkle']
                .filter(Boolean)
                .join(' ') || undefined
            }
            cx={`${x}%`}
            cy={`${y}%`}
            opacity={opacity}
            r={r}
            style={twinkle(delay)}
          />
        ))}
      </svg>
      <div className="still-sky-water" />
      <div ref={glowRef} className="still-sky-glow" />
      <span className="still-sky-venus" />
      <div className="still-sky-path" />
      <svg
        className="still-sky-glints"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 300 240"
      >
        {GLINTS.map(([x, y, width, height, opacity, delay]) => (
          <rect
            key={`${x}-${y}`}
            className={delay === null ? undefined : 'still-twinkle'}
            height={height}
            opacity={opacity}
            rx={height / 2}
            style={twinkle(delay)}
            width={width}
            x={x}
            y={y}
          />
        ))}
      </svg>
      <svg
        className="still-sky-land still-sky-land--west"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 600 14"
      >
        <path d="M0 6.2C40 5 80 1.6 128 1.2S196 3.4 252 5.6S380 9.6 470 11.6S560 13.4 600 14H0Z" />
      </svg>
      <svg
        className="still-sky-land still-sky-land--east"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 300 7"
      >
        <path d="M0 7C22 5.4 40 3 74 2.4S132 2.8 168 4.2S250 6.2 300 7Z" />
      </svg>
      <div className="still-sky-horizon" />
    </div>
  );
}
