/*
  The sound scenes' artwork. Each is drawn 1:1 in CSS pixels from the top, so its brightest line
  crosses the pane's rim, where the lens bends it. The parts that move carry still-scene-move or
  still-scene-grass and run only while their scene plays.
*/

// The corrugated tin roof: one ridge every 14 px across the scene.
const ROOF = `M0 152 ${'q7 -10 14 0 '.repeat(65)}`;

/** A shed roof in steady rain, falling in two layers. */
export function RainArt() {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 900 520" preserveAspectRatio="xMidYMin slice">
      <defs>
        <linearGradient id="still-rn-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1838" />
          <stop offset=".3" stopColor="#3b3170" />
          <stop offset="1" stopColor="#231c45" />
        </linearGradient>
        <radialGradient id="still-rn-glow" gradientUnits="userSpaceOnUse" cx="560" cy="24" r="250">
          <stop offset="0" stopColor="#c9b8ff" stopOpacity=".5" />
          <stop offset="1" stopColor="#c9b8ff" stopOpacity="0" />
        </radialGradient>
        <pattern id="still-rn-far" width="30" height="165" patternUnits="userSpaceOnUse">
          <path
            d="M24 10l-4 22M9 70l-3 16.5M18 118l-4 22"
            stroke="#d6ccff"
            strokeOpacity=".28"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </pattern>
        <pattern id="still-rn-near" width="40" height="220" patternUnits="userSpaceOnUse">
          <path
            d="M30 20l-6 33M12 110l-5 27.5M36 160l-6 33"
            stroke="#efe9ff"
            strokeOpacity=".5"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </pattern>
        <linearGradient id="still-rn-tin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8276bd" />
          <stop offset=".07" stopColor="#4c4184" />
          <stop offset=".42" stopColor="#2d2558" />
          <stop offset="1" stopColor="#1b1633" />
        </linearGradient>
        <pattern id="still-rn-ridge" width="14" height="12" patternUnits="userSpaceOnUse">
          <rect x="1.5" width="4.5" height="12" fill="#fff" fillOpacity=".16" />
          <rect x="8.5" width="4" height="12" fill="#0b0720" fillOpacity=".3" />
        </pattern>
        <linearGradient id="still-rn-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="still-rn-mask">
          <rect y="148" width="900" height="300" fill="url(#still-rn-fade)" />
        </mask>
      </defs>
      <rect width="900" height="520" fill="url(#still-rn-bg)" />
      <rect width="900" height="520" fill="url(#still-rn-glow)" />
      <g className="still-scene-move still-scene-move--rain-far">
        <rect x="-60" y="-165" width="1020" height="700" fill="url(#still-rn-far)" />
      </g>
      <path fill="url(#still-rn-tin)" d={`${ROOF}V520 H0Z`} />
      <rect
        y="146"
        width="900"
        height="300"
        fill="url(#still-rn-ridge)"
        mask="url(#still-rn-mask)"
      />
      <path fill="none" stroke="#cfc4ff" strokeOpacity=".5" strokeWidth="1.2" d={ROOF} />
      <g fill="#efe9ff" fillOpacity=".65">
        <ellipse cx="301" cy="145.6" rx="3.5" ry="1" />
        <ellipse cx="371" cy="145.6" rx="2.5" ry=".8" />
        <ellipse cx="455" cy="145.6" rx="3" ry="1" />
        <ellipse cx="525" cy="145.6" rx="2.5" ry=".8" />
        <ellipse cx="595" cy="145.6" rx="3.5" ry="1" />
        <ellipse cx="231" cy="145.6" rx="3" ry="1" />
        <ellipse cx="665" cy="145.6" rx="2.5" ry=".8" />
      </g>
      <g className="still-scene-move still-scene-move--rain-near">
        <rect x="-80" y="-220" width="1060" height="800" fill="url(#still-rn-near)" />
      </g>
    </svg>
  );
}

/** A sleeper train passing under the moon, its windows lit. */
export function TrainArt() {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 900 520" preserveAspectRatio="xMidYMin slice">
      <defs>
        <linearGradient
          id="still-tr-bg"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2="520"
        >
          <stop offset="0" stopColor="#16132e" />
          <stop offset=".2" stopColor="#2f2350" />
          <stop offset=".3" stopColor="#4c2d5c" />
          <stop offset=".5" stopColor="#1e1634" />
        </linearGradient>
        <radialGradient id="still-tr-moon">
          <stop offset="0" stopColor="#f3e8ff" stopOpacity=".55" />
          <stop offset="1" stopColor="#f3e8ff" stopOpacity="0" />
        </radialGradient>
        <pattern
          id="still-tr-win"
          x="0"
          y="170"
          width="46"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <rect x="9" y="2" width="26" height="22" rx="5" fill="#ffd6a3" />
          <rect x="9" y="2" width="26" height="7" rx="3.5" fill="#fff3df" fillOpacity=".6" />
        </pattern>
        <pattern
          id="still-tr-sleep"
          x="0"
          y="215"
          width="23"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="11" height="3" rx="1" fill="#3e2f5c" />
        </pattern>
        <linearGradient id="still-tr-pool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc98f" stopOpacity=".34" />
          <stop offset="1" stopColor="#ffc98f" stopOpacity="0" />
        </linearGradient>
        <pattern
          id="still-tr-refl"
          x="0"
          y="222"
          width="46"
          height="70"
          patternUnits="userSpaceOnUse"
        >
          <rect x="11" width="22" height="58" rx="8" fill="url(#still-tr-pool)" />
        </pattern>
        <linearGradient id="still-tr-spill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc98f" stopOpacity=".2" />
          <stop offset="1" stopColor="#ffc98f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="900" height="520" fill="url(#still-tr-bg)" />
      <circle cx="556" cy="60" r="58" fill="url(#still-tr-moon)" />
      <circle cx="556" cy="60" r="15" fill="#f7f0ff" />
      <g fill="#efe9ff">
        <circle cx="296" cy="34" r="1.1" opacity=".7" />
        <circle cx="352" cy="74" r=".8" opacity=".6" />
        <circle cx="424" cy="26" r="1.2" opacity=".8" />
        <circle cx="482" cy="98" r=".8" opacity=".5" />
        <circle cx="626" cy="116" r="1" opacity=".6" />
        <circle cx="386" cy="108" r=".9" opacity=".5" />
        <circle cx="270" cy="102" r=".8" opacity=".5" />
        <circle cx="666" cy="40" r=".9" opacity=".6" />
        <circle cx="160" cy="60" r="1" opacity=".5" />
        <circle cx="760" cy="84" r="1" opacity=".5" />
      </g>
      <path
        d="M0 140C80 124 150 132 230 122S350 112 420 126S520 112 600 122S720 136 790 120S870 124 900 130V520H0Z"
        fill="#2a1c40"
      />
      <rect x="-20" y="162" width="940" height="48" rx="12" fill="#110d20" />
      <g className="still-scene-move still-scene-move--train">
        <rect x="-46" y="170" width="992" height="30" fill="url(#still-tr-win)" />
      </g>
      <rect y="210" width="900" height="310" fill="#19132b" />
      <rect y="210" width="900" height="90" fill="url(#still-tr-spill)" />
      <path d="M0 213.5H900" stroke="#5c4c7e" strokeWidth="1.2" />
      <g className="still-scene-move still-scene-move--train">
        <rect x="-46" y="215" width="992" height="4" fill="url(#still-tr-sleep)" />
        <rect x="-46" y="222" width="992" height="70" fill="url(#still-tr-refl)" />
      </g>
    </svg>
  );
}

/** Dune grass above a far sea at dusk, with the wind going through it. */
export function WindArt() {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 900 520" preserveAspectRatio="xMidYMin slice">
      <defs>
        <linearGradient
          id="still-wd-bg"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2="520"
        >
          <stop offset="0" stopColor="#19163a" />
          <stop offset=".17" stopColor="#2d2452" />
          <stop offset=".265" stopColor="#7a4868" />
          <stop offset=".298" stopColor="#cd889c" />
          <stop offset=".303" stopColor="#43305e" />
          <stop offset=".42" stopColor="#271d42" />
          <stop offset="1" stopColor="#1a1530" />
        </linearGradient>
        <linearGradient id="still-wd-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e79ab0" stopOpacity=".42" />
          <stop offset="1" stopColor="#e79ab0" stopOpacity="0" />
        </linearGradient>
        <pattern id="still-wd-streak" width="190" height="150" patternUnits="userSpaceOnUse">
          <path
            d="M10 30q40-6 90 0M70 74q50-8 110-2M0 118q30-4 70 0"
            fill="none"
            stroke="#f4ecff"
            strokeOpacity=".34"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="900" height="520" fill="url(#still-wd-bg)" />
      <rect y="158" width="900" height="34" fill="url(#still-wd-sea)" />
      <g fill="#efe9ff">
        <circle cx="314" cy="30" r="1" opacity=".6" />
        <circle cx="406" cy="54" r=".8" opacity=".5" />
        <circle cx="502" cy="22" r="1.2" opacity=".7" />
        <circle cx="586" cy="70" r=".9" opacity=".5" />
        <circle cx="210" cy="64" r="1" opacity=".5" />
        <circle cx="700" cy="40" r=".9" opacity=".6" />
      </g>
      <g className="still-scene-move still-scene-move--wind">
        <rect width="1090" height="140" fill="url(#still-wd-streak)" />
      </g>
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#c3b2ec"
        strokeOpacity=".62"
        strokeWidth="1.1"
        strokeLinecap="round"
      >
        <path d="M205.8 192q-4.9 -8.0 -13.6 -14.6M206.6 192q-3.5 -12.7 -10.1 -23.1M207.3 192q-2.6 -11.3 -9.4 -20.6M208.0 192q-1.1 -18.1 -5.5 -32.9M208.7 192q0.4 -13.6 -1.6 -24.7M209.4 192q1.5 -8.4 0.1 -15.2M210.2 192q3.0 -10.5 4.1 -19.0" />
      </g>
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#c3b2ec"
        strokeOpacity=".62"
        strokeWidth="1.1"
        strokeLinecap="round"
      >
        <path d="M297.5 187q-5.1 -13.6 -13.0 -24.8M298.2 187q-3.7 -11.3 -9.4 -20.6M298.9 187q-3.4 -19.6 -11.4 -35.7M299.6 187q-2.0 -20.7 -8.2 -37.7M300.4 187q-0.4 -12.4 -4.0 -22.6M301.1 187q1.0 -15.2 -0.3 -27.6M301.8 187q1.9 -17.0 0.5 -30.8M302.5 187q2.5 -9.3 0.1 -16.9" />
      </g>
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#c3b2ec"
        strokeOpacity=".62"
        strokeWidth="1.1"
        strokeLinecap="round"
      >
        <path d="M395.7 184q-5.4 -8.2 -15.7 -15.0M396.5 184q-3.7 -12.1 -11.1 -22.0M397.2 184q-2.4 -13.0 -8.1 -23.6M398.0 184q-0.6 -13.3 -3.1 -24.1M398.8 184q0.4 -17.3 -1.7 -31.5M399.5 184q1.7 -14.4 1.0 -26.3M400.3 184q2.2 -13.4 -0.3 -24.4" />
      </g>
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#c3b2ec"
        strokeOpacity=".62"
        strokeWidth="1.1"
        strokeLinecap="round"
      >
        <path d="M549.4 189q-6.1 -14.0 -17.1 -25.4M550.1 189q-4.8 -14.7 -14.4 -26.8M550.9 189q-3.2 -12.4 -10.2 -22.6M551.6 189q-1.6 -21.2 -5.9 -38.5M552.4 189q-1.2 -22.2 -7.9 -40.4M553.1 189q0.7 -15.1 -1.9 -27.5M553.9 189q2.0 -13.7 0.4 -24.9M554.6 189q3.2 -15.7 2.9 -28.5" />
      </g>
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#c3b2ec"
        strokeOpacity=".62"
        strokeWidth="1.1"
        strokeLinecap="round"
      >
        <path d="M643.8 193q-4.2 -7.2 -10.4 -13.2M644.6 193q-4.0 -13.3 -12.9 -24.1M645.3 193q-2.3 -13.5 -7.8 -24.6M646.0 193q-1.3 -15.8 -6.7 -28.7M646.7 193q0.0 -11.4 -3.6 -20.7M647.4 193q1.2 -12.2 -1.3 -22.1M648.2 193q2.9 -8.1 3.6 -14.8" />
      </g>
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#c3b2ec"
        strokeOpacity=".62"
        strokeWidth="1.1"
        strokeLinecap="round"
      >
        <path d="M739.6 189q-5.7 -10.1 -16.6 -18.4M740.4 189q-4.0 -11.9 -11.9 -21.6M741.2 189q-2.1 -13.4 -6.3 -24.3M742.0 189q-1.6 -12.7 -7.9 -23.2M742.8 189q0.3 -17.5 -2.6 -31.8M743.6 189q1.3 -14.5 -1.7 -26.3M744.4 189q2.3 -13.6 -0.7 -24.8" />
      </g>
      <path
        d="M0 196C90 178 170 176 260 190S380 178 470 186S600 200 690 192S820 178 900 186V520H0Z"
        fill="#24193d"
      />
      <path
        d="M0 196C90 178 170 176 260 190S380 178 470 186S600 200 690 192S820 178 900 186"
        fill="none"
        stroke="#8a72b8"
        strokeOpacity=".55"
        strokeWidth="1.2"
      />
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#a593d2"
        strokeOpacity=".42"
        strokeWidth="1.3"
        strokeLinecap="round"
      >
        <path d="M258.6 250q-8.1 -14.7 -23.7 -26.7M259.6 250q-5.8 -22.7 -17.2 -41.3M260.6 250q-4.1 -24.8 -13.1 -45.1M261.5 250q-2.1 -21.0 -7.9 -38.3M262.5 250q-0.3 -27.6 -4.0 -50.2M263.4 250q0.2 -15.2 -6.2 -27.7M264.4 250q2.3 -20.7 -0.3 -37.7M265.4 250q4.7 -18.6 6.6 -33.7" />
      </g>
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#a593d2"
        strokeOpacity=".42"
        strokeWidth="1.3"
        strokeLinecap="round"
      >
        <path d="M471.0 254q-6.2 -11.9 -15.9 -21.6M471.9 254q-4.6 -15.2 -12.2 -27.7M472.7 254q-3.4 -13.6 -10.6 -24.7M473.6 254q-2.9 -24.9 -12.6 -45.3M474.4 254q-0.8 -23.1 -5.9 -42.1M475.3 254q-0.0 -15.5 -6.7 -28.2M476.1 254q1.7 -16.2 -2.1 -29.5M477.0 254q3.9 -10.1 4.7 -18.3" />
      </g>
      <g
        className="still-scene-grass"
        fill="none"
        stroke="#a593d2"
        strokeOpacity=".42"
        strokeWidth="1.3"
        strokeLinecap="round"
      >
        <path d="M614.5 246q-8.1 -19.2 -22.9 -35.0M615.4 246q-6.3 -22.3 -18.3 -40.5M616.3 246q-4.8 -19.5 -15.2 -35.5M617.1 246q-2.9 -27.1 -9.9 -49.3M618.0 246q-1.4 -25.2 -6.8 -45.8M618.9 246q0.6 -26.1 -1.5 -47.4M619.7 246q0.4 -22.6 -6.8 -41.1M620.6 246q2.4 -13.2 -0.8 -24.0M621.5 246q3.4 -17.4 -0.2 -31.7" />
      </g>
      <path
        d="M0 262C110 238 210 244 300 256S470 252 560 246S760 262 900 250V520H0Z"
        fill="#1d1532"
      />
      <path
        d="M0 262C110 238 210 244 300 256S470 252 560 246S760 262 900 250"
        fill="none"
        stroke="#6f5a9a"
        strokeOpacity=".4"
        strokeWidth="1.2"
      />
    </svg>
  );
}
