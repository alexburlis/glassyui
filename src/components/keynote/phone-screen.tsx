'use client';

import { memo, useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  GlassAvatar,
  GlassBadge,
  GlassButton,
  GlassCheckbox,
  GlassDock,
  GlassDockItem,
  GlassPanel,
  GlassProgress,
  GlassSegmentedControl,
  GlassSegmentedControlItem,
  GlassSwitch,
} from '@/components/liquid';
import type { GlassBadgeTone } from '@/components/liquid';
import { motionReduced } from './scrubber';
import '@/styles/keynote-phone.css';

type Period = 'day' | 'month' | 'week';

const PERIODS: Record<
  Period,
  {
    badge: string;
    detail: string;
    goal: string;
    title: string;
    tone: GlassBadgeTone;
    value: number;
  }
> = {
  day: {
    badge: 'On pace',
    detail: '5.2 km in 28 minutes',
    goal: 'Weekly goal',
    title: 'Morning run',
    tone: 'green',
    value: 72,
  },
  week: {
    badge: 'Ahead',
    detail: '14.4 km over 3 runs',
    goal: 'Weekly goal',
    title: 'This week',
    tone: 'blue',
    value: 72,
  },
  month: {
    badge: 'Best yet',
    detail: '58 km over 12 runs',
    goal: 'Monthly goal',
    title: 'Last 30 days',
    tone: 'purple',
    value: 86,
  },
};

const TASKS = [
  { at: '7:30', label: 'Stretch for ten minutes' },
  { at: '10:00', label: 'Review the launch notes' },
  { at: '16:30', label: 'Call Sam back' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const today = (date: Date) =>
  `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;

const BOUNCE = [
  { translate: '0 0' },
  { translate: '0 -26%', offset: 0.28 },
  { translate: '0 0', offset: 0.56 },
  { translate: '0 -9%', offset: 0.76 },
  { translate: '0 0' },
];

function Glyph({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg aria-hidden fill="currentColor" height={size} viewBox="0 0 24 24" width={size}>
      {children}
    </svg>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 2,
} as const;

const RunGlyph = () => (
  <Glyph size={18}>
    <circle cx="15.2" cy="4.4" r="2.3" />
    <path
      {...stroke}
      d="M13.6 8.6 11 13.8m2.6-5.2-4.3 1.2-1.9 2.7m6.2-3.9 2.6 2.8 3-.5M11 13.8l3.5 2.6-1 4.6M11 13.8l-1.7 3.7-4.1 1.2"
    />
  </Glyph>
);

const MoonGlyph = () => (
  <Glyph size={18}>
    <path d="M20.4 14.7A8.6 8.6 0 0 1 9.3 3.6a8.6 8.6 0 1 0 11.1 11.1Z" />
  </Glyph>
);

const PlayGlyph = () => (
  <Glyph size={18}>
    <path d="M8 5.7v12.6c0 .8.9 1.3 1.6.8l9.6-6.3a1 1 0 0 0 0-1.6L9.6 4.9A1 1 0 0 0 8 5.7Z" />
  </Glyph>
);

const StopGlyph = () => (
  <Glyph size={18}>
    <rect height="12" rx="2.6" width="12" x="6" y="6" />
  </Glyph>
);

const TodayGlyph = () => (
  <Glyph>
    <rect {...stroke} height="15.5" rx="3.6" width="17" x="3.5" y="5" />
    <path {...stroke} d="M3.5 9.6h17M8 3v3.6M16 3v3.6" />
    <rect height="4.6" rx="1.2" width="4.6" x="7" y="12.4" />
  </Glyph>
);

const PlansGlyph = () => (
  <Glyph>
    <rect {...stroke} height="15.5" rx="3.6" width="17" x="3.5" y="5" />
    <path {...stroke} d="M3.5 9.6h17M8 3v3.6M16 3v3.6" />
    {[8, 12, 16].flatMap((x) =>
      [13.2, 16.8].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.15" />),
    )}
  </Glyph>
);

const MessagesGlyph = () => (
  <Glyph>
    <path d="M12 3.4c-5 0-8.8 3.4-8.8 7.8 0 2.4 1.1 4.5 3 5.9l-.8 3.5c-.1.5.4.9.9.7l4-2c.6.1 1.1.1 1.7.1 5 0 8.8-3.4 8.8-7.8S17 3.4 12 3.4Z" />
  </Glyph>
);

const LibraryGlyph = () => (
  <Glyph>
    <rect height="7.6" rx="2.2" width="7.6" x="3.4" y="3.4" />
    <rect height="7.6" rx="2.2" width="7.6" x="13" y="3.4" />
    <rect height="7.6" rx="2.2" width="7.6" x="3.4" y="13" />
    <rect height="7.6" rx="2.2" width="7.6" x="13" y="13" />
  </Glyph>
);

const TABS = [
  { glyph: <TodayGlyph />, label: 'Today' },
  { glyph: <PlansGlyph />, label: 'Plans' },
  { glyph: <MessagesGlyph />, label: 'Messages' },
  { glyph: <LibraryGlyph />, label: 'Library' },
];

function StatusBar() {
  return (
    <div aria-hidden className="turn-phone-status">
      <span className="turn-phone-time">9:41</span>
      <span className="turn-phone-signals">
        <svg height="12" viewBox="0 0 18 12" width="18">
          {[0, 1, 2, 3].map((bar) => (
            <rect
              key={bar}
              fill="currentColor"
              height={4 + bar * 2.6}
              rx="1"
              width="3.2"
              x={bar * 4.8}
              y={12 - 4 - bar * 2.6}
            />
          ))}
        </svg>
        <svg height="12" viewBox="0 0 17 12" width="17">
          <path
            {...stroke}
            d="M1.7 4.5a9.8 9.8 0 0 1 13.6 0M4.3 7.1a6.1 6.1 0 0 1 8.4 0"
            strokeWidth="2.1"
          />
          <circle cx="8.5" cy="10.1" fill="currentColor" r="1.7" />
        </svg>
        <svg height="13" viewBox="0 0 28 13" width="28">
          <rect
            fill="none"
            height="12"
            rx="3.8"
            stroke="currentColor"
            strokeOpacity="0.4"
            width="24"
            x="0.5"
            y="0.5"
          />
          <rect fill="currentColor" height="8" rx="2.2" width="17" x="2.5" y="2.5" />
          <path d="M26.4 4.4v4.2a2.2 2.2 0 0 0 0-4.2Z" fill="currentColor" fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

function Workout() {
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (started === null) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [started]);

  const seconds = started === null ? 0 : Math.max(0, Math.floor((now - started) / 1000));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <GlassButton
      className="turn-phone-workout"
      data-running={started !== null || undefined}
      lens={false}
      onClick={() => {
        const time = Date.now();

        setNow(time);
        setStarted((current) => (current === null ? time : null));
      }}
      size="lg"
      variant="prominent"
    >
      {started === null ? <PlayGlyph /> : <StopGlyph />}
      {started === null ? 'Start a workout' : `End workout · ${clock}`}
    </GlassButton>
  );
}

type PhoneScreenProps = {
  /** Whether the phone has landed and its screen takes taps, clicks and focus. */
  live: boolean;
  theme: 'dark' | 'light';
};

/**
 * The Today screen the turn's phone lands on, built from the library's components as the Expo
 * fixture's is, so its controls work: the period, the switch, the checks, the workout and the dock.
 * The turn redraws on every frame; this stays as it is until the visitor touches it.
 */
export const PhoneScreen = memo(function PhoneScreen({ live, theme }: PhoneScreenProps) {
  const [date] = useState(() => today(new Date()));
  const [period, setPeriod] = useState<Period>('day');
  const [focus, setFocus] = useState(true);
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set([TASKS[0].label]));
  const [tab, setTab] = useState(TABS[0].label);
  const stats = PERIODS[period];

  const open = (label: string) => (event: MouseEvent<HTMLButtonElement>) => {
    setTab(label);

    if (!motionReduced()) {
      event.currentTarget.firstElementChild?.animate(BOUNCE, { duration: 640, easing: 'ease-out' });
    }
  };

  return (
    <div
      aria-label="A Today screen built from Glassy UI components"
      className="turn-phone"
      data-theme={theme}
      inert={!live}
      role="group"
      style={{ pointerEvents: live ? 'auto' : 'none' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn in the turn's 3D space, which next/image would only wrap */}
      <img
        alt=""
        className="turn-phone-wallpaper"
        decoding="async"
        draggable={false}
        src={`/keynote/phone-wallpaper-${theme}.webp`}
      />
      <StatusBar />
      <div className="turn-phone-content">
        <div className="turn-phone-header">
          <div>
            <p className="turn-phone-date">{date}</p>
            <p className="turn-phone-title">Today</p>
          </div>
          <GlassAvatar className="turn-phone-avatar" name="Morgan Lee" status="online" />
        </div>
        <GlassSegmentedControl
          aria-label="Period"
          className="turn-phone-period"
          onValueChange={(value) => {
            if (value === 'day' || value === 'week' || value === 'month') setPeriod(value);
          }}
          value={period}
        >
          <GlassSegmentedControlItem value="day">Day</GlassSegmentedControlItem>
          <GlassSegmentedControlItem value="week">Week</GlassSegmentedControlItem>
          <GlassSegmentedControlItem value="month">Month</GlassSegmentedControlItem>
        </GlassSegmentedControl>
        <GlassPanel className="turn-phone-card turn-phone-run" variant="card">
          <div className="turn-phone-row">
            <span aria-hidden className="turn-phone-chip" data-tone="orange">
              <RunGlyph />
            </span>
            <div className="turn-phone-grow">
              <p className="turn-phone-card-title">{stats.title}</p>
              <p className="turn-phone-muted">{stats.detail}</p>
            </div>
            <GlassBadge dot tone={stats.tone}>
              {stats.badge}
            </GlassBadge>
          </div>
          <GlassProgress label={stats.goal} showValue value={stats.value} />
        </GlassPanel>
        <GlassPanel className="turn-phone-card turn-phone-row" variant="card">
          <span
            aria-hidden
            className="turn-phone-chip"
            data-off={!focus || undefined}
            data-tone="indigo"
          >
            <MoonGlyph />
          </span>
          <div className="turn-phone-grow">
            <p className="turn-phone-card-title">Focus</p>
            <p className="turn-phone-muted">
              {focus ? 'Alerts stay quiet until 11:00' : 'Alerts come through'}
            </p>
          </div>
          <GlassSwitch aria-label="Focus" checked={focus} onCheckedChange={setFocus} />
        </GlassPanel>
        <GlassPanel className="turn-phone-card turn-phone-tasks" variant="card">
          <div className="turn-phone-row">
            <p className="turn-phone-card-title turn-phone-grow">Up next</p>
            <span className="turn-phone-muted">
              {done.size} of {TASKS.length} done
            </span>
          </div>
          {TASKS.map((task) => (
            <div className="turn-phone-task" key={task.label}>
              <GlassCheckbox
                checked={done.has(task.label)}
                label={task.label}
                onCheckedChange={(checked) =>
                  setDone((current) => {
                    const next = new Set(current);

                    if (checked === true) next.add(task.label);
                    else next.delete(task.label);

                    return next;
                  })
                }
              />
              <span aria-hidden className="turn-phone-muted">
                {task.at}
              </span>
            </div>
          ))}
        </GlassPanel>
        <Workout />
      </div>
      <GlassDock aria-label="Tabs" className="turn-phone-dock" role="group">
        {TABS.map(({ glyph, label }) => (
          <GlassDockItem
            key={label}
            active={tab === label}
            aria-current={tab === label ? 'page' : undefined}
            label={label}
            onClick={open(label)}
          >
            {glyph}
          </GlassDockItem>
        ))}
      </GlassDock>
      <span aria-hidden className="turn-phone-island">
        <span className="turn-phone-lens" />
      </span>
      <span aria-hidden className="turn-phone-home" />
    </div>
  );
});
