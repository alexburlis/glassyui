/* The sleep stories' covers, each drawn on a 300 by 400 canvas that fills its card. */

export function LighthouseArt() {
  return (
    <svg
      focusable="false"
      className="still-story-art"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="still-s1a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151f3e" />
          <stop offset=".6" stopColor="#3b3a74" />
          <stop offset=".6" stopColor="#1a2244" />
          <stop offset="1" stopColor="#111932" />
        </linearGradient>
        <linearGradient id="still-s1b" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#fff1d6" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff1d6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#still-s1a)" />
      <g fill="#e6dcff">
        <circle cx="40" cy="40" r="1.2" />
        <circle cx="92" cy="24" r=".9" />
        <circle cx="150" cy="58" r="1.1" />
        <circle cx="262" cy="40" r="1.3" />
        <circle cx="118" cy="140" r=".8" />
        <circle cx="56" cy="190" r="1" />
      </g>
      <path d="M212 116 0 64v108Z" fill="url(#still-s1b)" />
      <path d="M200 240 207 122h14l7 118Z" fill="#dcd4f0" />
      <path d="M206.2 150h15.6M204.6 180h18.8M203 210h22" stroke="#3b3a74" strokeWidth="8" />
      <rect x="205" y="104" width="18" height="16" rx="3" fill="#fff1d6" />
      <path d="M200 106h28l-14-13Z" fill="#dcd4f0" />
      <path d="M140 244q30-16 64-8t96-2v14H140Z" fill="#121a36" />
      <g stroke="#e6dcff" strokeOpacity=".28" strokeWidth="1.4" strokeLinecap="round">
        <path d="M30 276h40M112 288h62M206 272h52M56 312h72M174 330h84M24 352h50" />
      </g>
    </svg>
  );
}

export function RiverArt() {
  return (
    <svg
      focusable="false"
      className="still-story-art"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="still-s2a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f2638" />
          <stop offset=".55" stopColor="#2b3a66" />
          <stop offset="1" stopColor="#1a2a48" />
        </linearGradient>
        <radialGradient id="still-s2b">
          <stop offset="0" stopColor="#f4eefe" stopOpacity=".45" />
          <stop offset="1" stopColor="#f4eefe" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="still-s2c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a4c6e" />
          <stop offset="1" stopColor="#0d1828" />
        </linearGradient>
        <radialGradient id="still-s2d" cx=".5" cy="0" r=".5" fx=".5" fy="0">
          <stop offset="0" stopColor="#f4eefe" stopOpacity=".24" />
          <stop offset=".55" stopColor="#f4eefe" stopOpacity=".07" />
          <stop offset="1" stopColor="#f4eefe" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="300" height="400" fill="url(#still-s2a)" />
      <circle cx="84" cy="92" r="64" fill="url(#still-s2b)" />
      <circle cx="84" cy="92" r="20" fill="#f4eefe" />
      <path d="M0 206C60 192 120 212 180 202S260 192 300 204V230H0Z" fill="#0f1f30" />
      <rect y="228" width="300" height="172" fill="url(#still-s2c)" />
      <rect x="34" y="228" width="100" height="172" fill="url(#still-s2d)" />
      <g stroke="#f4eefe" strokeLinecap="round" strokeWidth="1.3">
        <path d="M82.8 232.9h2.8M84.8 232.9h3.3" opacity="0.49" />
        <path d="M82.2 236.4h2.2M81.2 236.4h4.3" opacity="0.48" />
        <path d="M81.2 240.9h5.3M84.5 240.9h3.8" opacity="0.46" />
        <path d="M84.0 246.3h4.9M78.3 246.3h3.3" opacity="0.45" />
        <path d="M74.5 252.3h5.2M73.2 252.3h6.0M80.1 252.3h6.0" opacity="0.42" />
        <path d="M78.9 259.1h6.2M79.8 259.1h7.3M82.7 259.1h5.7" opacity="0.4" />
        <path d="M77.2 266.4h7.6M64.6 266.4h8.6M70.2 266.4h6.3" opacity="0.37" />
        <path d="M88.8 274.2h9.7M84.2 274.2h5.4M78.3 274.2h5.8" opacity="0.34" />
        <path d="M90.1 282.5h9.0M78.1 282.5h7.0M70.3 282.5h7.3" opacity="0.31" />
        <path d="M78.6 291.4h9.7M57.1 291.4h10.4M65.3 291.4h12.1" opacity="0.28" />
        <path d="M103.3 300.6h11.4M48.5 300.6h7.6M99.2 300.6h13.1" opacity="0.25" />
        <path d="M48.9 310.4h11.7M74.8 310.4h13.9M68.2 310.4h11.7" opacity="0.21" />
        <path d="M75.0 320.5h15.4M81.5 320.5h16.6M103.3 320.5h11.4" opacity="0.18" />
        <path d="M96.3 331.0h9.9M67.1 331.0h17.0M109.5 331.0h8.8" opacity="0.14" />
      </g>
      <path d="M150 300h74l-12 13h-52Z" fill="#081120" />
      <path d="M186 300v-30" stroke="#081120" strokeWidth="2" />
      <circle cx="206" cy="292" r="14" fill="#ffd9a8" opacity=".2" />
      <circle cx="206" cy="292" r="3.4" fill="#ffd9a8" />
      <path
        d="M196 322h22M200 334h14"
        stroke="#ffd9a8"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".35"
      />
    </svg>
  );
}

export function LibraryArt() {
  return (
    <svg
      focusable="false"
      className="still-story-art"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="still-s3a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#28132e" />
          <stop offset="1" stopColor="#4a2341" />
        </linearGradient>
        <linearGradient id="still-s3b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd9a8" />
          <stop offset="1" stopColor="#f29a7c" stopOpacity=".75" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#still-s3a)" />
      <g fill="url(#still-s3b)">
        <path d="M36 240V132a28 28 0 0 1 56 0v108Z" />
        <path d="M122 240V116a28 28 0 0 1 56 0v124Z" />
        <path d="M208 240V132a28 28 0 0 1 56 0v108Z" />
      </g>
      <g stroke="#4a2341" strokeWidth="3">
        <path d="M64 104V240M36 176h56M150 88V240M122 168h56M236 104V240M208 176h56" />
      </g>
      <rect y="240" width="300" height="160" fill="#1f0f24" />
      <g fill="#ffd9a8" opacity=".12">
        <rect x="36" y="244" width="56" height="70" />
        <rect x="122" y="244" width="56" height="90" />
        <rect x="208" y="244" width="56" height="70" />
      </g>
      <g fill="#5e2f52">
        <rect x="20" y="300" width="8" height="40" rx="1" />
        <rect x="30" y="306" width="10" height="34" rx="1" />
        <rect x="42" y="296" width="7" height="44" rx="1" />
        <rect x="250" y="304" width="9" height="36" rx="1" />
        <rect x="261" y="298" width="7" height="42" rx="1" />
        <rect x="270" y="308" width="11" height="32" rx="1" />
      </g>
    </svg>
  );
}

export function MarketArt() {
  return (
    <svg
      focusable="false"
      className="still-story-art"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="still-s4a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1233" />
          <stop offset=".62" stopColor="#5a2a4a" />
          <stop offset="1" stopColor="#220f28" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#still-s4a)" />
      <path
        d="M-10 88Q150 160 310 88"
        fill="none"
        stroke="#f0d7e8"
        strokeOpacity=".45"
        strokeWidth="1.2"
      />
      <g opacity=".2">
        <circle cx="30" cy="102" r="22" fill="#ffb38a" />
        <circle cx="90" cy="120" r="22" fill="#ffd9a8" />
        <circle cx="150" cy="124" r="22" fill="#f7a6b8" />
        <circle cx="210" cy="120" r="22" fill="#ffd9a8" />
        <circle cx="270" cy="102" r="22" fill="#ffb38a" />
      </g>
      <circle cx="30" cy="102" r="10" fill="#ffb38a" />
      <circle cx="90" cy="120" r="10" fill="#ffd9a8" />
      <circle cx="150" cy="124" r="10" fill="#f7a6b8" />
      <circle cx="210" cy="120" r="10" fill="#ffd9a8" />
      <circle cx="270" cy="102" r="10" fill="#ffb38a" />
      <path d="M0 250h70l20-22h50l20 22h140v150H0Z" fill="#1c0b22" />
      <path d="M20 250h44M168 250h112" stroke="#ffd9a8" strokeOpacity=".35" strokeWidth="2" />
      <g opacity=".22">
        <rect x="27" y="286" width="6" height="70" rx="3" fill="#ffb38a" />
        <rect x="87" y="292" width="6" height="80" rx="3" fill="#ffd9a8" />
        <rect x="147" y="290" width="6" height="90" rx="3" fill="#f7a6b8" />
        <rect x="207" y="292" width="6" height="76" rx="3" fill="#ffd9a8" />
        <rect x="267" y="286" width="6" height="66" rx="3" fill="#ffb38a" />
      </g>
    </svg>
  );
}

export function OrchardArt() {
  return (
    <svg
      focusable="false"
      className="still-story-art"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="still-s5a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12233a" />
          <stop offset="1" stopColor="#2c3a5c" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#still-s5a)" />
      <circle cx="196" cy="108" r="74" fill="#f6efe2" opacity=".08" />
      <circle cx="196" cy="108" r="44" fill="#f6efe2" opacity=".92" />
      <path d="M0 210C70 180 150 196 300 176V400H0Z" fill="#1c3046" />
      <path d="M0 250C90 226 190 240 300 222V400H0Z" fill="#162739" />
      <g fill="#25444c">
        <circle cx="40" cy="196" r="16" />
        <circle cx="92" cy="190" r="17" />
        <circle cx="146" cy="190" r="16" />
        <circle cx="200" cy="184" r="17" />
        <circle cx="254" cy="180" r="16" />
      </g>
      <g fill="#1d3640">
        <circle cx="20" cy="242" r="20" />
        <circle cx="82" cy="236" r="21" />
        <circle cx="146" cy="232" r="20" />
        <circle cx="210" cy="228" r="21" />
        <circle cx="274" cy="224" r="20" />
      </g>
      <g fill="#f2b98a">
        <circle cx="86" cy="230" r="2.4" />
        <circle cx="214" cy="222" r="2.4" />
        <circle cx="150" cy="186" r="2" />
      </g>
    </svg>
  );
}

export function HutArt() {
  return (
    <svg
      focusable="false"
      className="still-story-art"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="still-s6a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1c3e" />
          <stop offset="1" stopColor="#3e3b6e" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#still-s6a)" />
      <g fill="#e6dcff">
        <circle cx="38" cy="44" r="1.2" />
        <circle cx="120" cy="30" r="1" />
        <circle cx="240" cy="54" r="1.3" />
        <circle cx="276" cy="20" r=".9" />
        <circle cx="178" cy="76" r=".8" />
      </g>
      <path d="M0 250 80 146l50 52 70-94 100 124V400H0Z" fill="#2b2c58" />
      <path d="M200 104l-17 22 10-3 9 8 12-8Z" fill="#ebe6f8" opacity=".85" />
      <path d="M80 146l-12 16 8-2 6 5 8-6Z" fill="#ebe6f8" opacity=".7" />
      <path d="M0 300 64 236l56 54 72-74 108 88V400H0Z" fill="#1f2048" />
      <path d="M136 300h34v24h-34Z" fill="#110f27" />
      <path d="M132 302l21-16 21 16Z" fill="#110f27" />
      <circle cx="153" cy="312" r="12" fill="#ffd9a8" opacity=".18" />
      <rect x="149" y="308" width="8" height="8" rx="1.5" fill="#ffd9a8" />
    </svg>
  );
}

export function MapArt() {
  return (
    <svg
      focusable="false"
      className="still-story-art"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="still-s7a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2140" />
          <stop offset="1" stopColor="#40325a" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#still-s7a)" />
      <g fill="none" stroke="#e6dcff" strokeLinecap="round">
        <path
          d="M150 74c62-6 118 40 116 104s-54 116-122 112S30 238 34 172 88 80 150 74Z"
          strokeOpacity=".16"
        />
        <path
          d="M152 100c46-4 88 30 86 78s-42 88-92 84-86-40-82-88 42-70 88-74Z"
          strokeOpacity=".24"
        />
        <path
          d="M150 126c32-2 60 22 58 54s-30 58-64 56-56-28-54-60 28-48 60-50Z"
          strokeOpacity=".34"
        />
        <path
          d="M152 150c18-2 34 12 32 30s-18 32-36 30-30-16-28-34 16-24 32-26Z"
          strokeOpacity=".5"
        />
      </g>
      <path
        d="M40 340C70 320 80 290 112 268s34-60 38-84"
        fill="none"
        stroke="#ffd9a8"
        strokeOpacity=".7"
        strokeWidth="2"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />
      <circle cx="150" cy="182" r="5" fill="#ffd9a8" />
      <path
        d="M252 40l4 12 12 4-12 4-4 12-4-12-12-4 12-4Z"
        fill="none"
        stroke="#e6dcff"
        strokeOpacity=".7"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ObservatoryArt() {
  return (
    <svg
      focusable="false"
      className="still-story-art"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="still-s8a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1834" />
          <stop offset="1" stopColor="#2c2b5e" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#still-s8a)" />
      <g fill="none" stroke="#e6dcff" strokeLinecap="round" strokeWidth="1.2">
        <circle cx="150" cy="70" r="40" strokeOpacity=".3" strokeDasharray="26 18" />
        <circle cx="150" cy="70" r="70" strokeOpacity=".26" strokeDasharray="40 26" />
        <circle cx="150" cy="70" r="100" strokeOpacity=".22" strokeDasharray="58 30" />
        <circle cx="150" cy="70" r="132" strokeOpacity=".18" strokeDasharray="70 40" />
        <circle cx="150" cy="70" r="166" strokeOpacity=".14" strokeDasharray="90 44" />
        <circle cx="150" cy="70" r="202" strokeOpacity=".1" strokeDasharray="110 50" />
      </g>
      <circle cx="150" cy="70" r="2" fill="#fff" />
      <path d="M0 300c60-10 110-6 150-12s100-8 150 0V400H0Z" fill="#141c3c" />
      <path d="M96 300a54 54 0 0 1 108 0Z" fill="#0b1128" />
      <path d="M144 248h12v52h-12Z" fill="#1d2a54" />
      <path d="M80 300h140v100H80Z" fill="#090e22" />
      <g fill="#e6dcff" opacity=".7">
        <circle cx="40" cy="250" r=".9" />
        <circle cx="262" cy="232" r="1.1" />
        <circle cx="230" cy="266" r=".8" />
      </g>
    </svg>
  );
}
