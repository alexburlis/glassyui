'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GlassAvatar } from '../../glass-avatar';
import { GlassButton } from '../../glass-button';
import { GlassPanel } from '../../glass-panel';
import { GlassSegmentedControl, GlassSegmentedControlItem } from '../../glass-segmented-control';
import { GlassSwitch } from '../../glass-switch';
import { motionReduced } from '../../lib/liquid-motion';
import { CalendarPlusIcon, CheckIcon, LockIcon, MovesIcon, ShieldIcon } from './icons';
import { useCountTo } from './use-count-to';

/** Places a block on a schedule grid: column, start and duration, in grid steps. */
function at(column: number, start: number, duration: number) {
  // SAFETY: CSSProperties has no custom-property index; these are three number-valued properties.
  return { '--c': column, '--s': start, '--d': duration } as CSSProperties;
}

/** A status line that comes into focus whenever its text changes, and is announced politely. */
function Status({ text, className }: { text: string; className?: string }) {
  const [initial] = useState(text);

  return (
    <p aria-live="polite" className={className ? `halcyon-status ${className}` : 'halcyon-status'}>
      <span key={text} data-new={text === initial ? undefined : ''}>
        {text}
      </span>
    </p>
  );
}

// The free windows Halcyon can offer, as a day and minutes after midnight.
const WINDOWS = [
  ['Tue 12 Jan', 660, 705],
  ['Wed 13 Jan', 870, 900],
  ['Thu 14 Jan', 570, 660],
  ['Thu 14 Jan', 900, 960],
  ['Fri 15 Jan', 600, 630],
] as const;

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Books: the offered times follow the meeting length, and picking one books it. */
function BooksTile() {
  const [length, setLength] = useState(30);
  const [picked, setPicked] = useState<number | null>(null);
  const offers = WINDOWS.filter((window) => window[2] - window[1] >= length).slice(0, 3);
  const pick = picked === null ? null : offers[picked];

  return (
    <GlassPanel
      aria-labelledby="halcyon-books"
      className="halcyon-pane halcyon-tile"
      lens
      variant="card"
    >
      <div className="halcyon-tile-body">
        <p className="halcyon-tile-kicker">
          <CalendarPlusIcon />
          Books
        </p>
        <h3 id="halcyon-books">Finds a time without the back-and-forth</h3>
        <p>
          Share your link or copy Halcyon into a thread. It offers times that suit everyone, then
          books the one they pick.
        </p>
      </div>
      <div className="halcyon-tile-screen">
        <div className="halcyon-mini-head halcyon-books-who">
          <GlassAvatar aria-hidden className="halcyon-books-avatar" fallback="MO" size="sm" />
          <p>
            <strong>Maya Okafor</strong> asked for time in launch week
          </p>
        </div>
        <GlassSegmentedControl
          aria-label="Meeting length"
          className="halcyon-books-length"
          value={String(length)}
          onValueChange={(value) => {
            setLength(Number(value));
            setPicked(null);
          }}
        >
          {[15, 30, 45].map((minutes) => (
            <GlassSegmentedControlItem key={minutes} value={String(minutes)}>
              {minutes} min
            </GlassSegmentedControlItem>
          ))}
        </GlassSegmentedControl>
        <ul aria-label="Times Halcyon is offering" className="halcyon-books-slots">
          {offers.map(([day, start], index) => (
            <li key={`${day}-${start}`}>
              <GlassButton
                aria-pressed={picked === index}
                className="halcyon-books-slot"
                lens={false}
                onClick={() => setPicked(picked === index ? null : index)}
              >
                <CheckIcon className="halcyon-books-tick" />
                <span className="halcyon-books-day">{day}</span>
                <span className="halcyon-books-time">
                  {clock(start)}–{clock(start + length)}
                </span>
              </GlassButton>
            </li>
          ))}
        </ul>
        <Status
          className="halcyon-mini-status"
          text={
            pick
              ? `Booked ${pick[0]}, ${clock(pick[1])}–${clock(pick[1] + length)}. Maya has the invite.`
              : `Holding three ${length}-minute times until Maya picks one.`
          }
        />
      </div>
    </GlassPanel>
  );
}

type Meeting = 'resting' | 'conflict' | 'moved';

type Week = { flight: boolean; sam: Meeting; budget: Meeting; told: boolean; still: boolean };

const ON_TIME: Week = {
  flight: false,
  sam: 'resting',
  budget: 'resting',
  told: false,
  still: true,
};

const DELAYED: Week = { flight: true, sam: 'moved', budget: 'moved', told: true, still: true };

/** Moves: the flight slips and the afternoon rearranges itself around it. */
function MovesTile() {
  const calendarRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const touched = useRef(false);
  const [week, setWeek] = useState<Week>(ON_TIME);

  const clear = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  const later = (ms: number, change: Partial<Week>) => {
    timers.current.push(window.setTimeout(() => setWeek((now) => ({ ...now, ...change })), ms));
  };

  const delay = (animate: boolean) => {
    clear();

    if (!animate) {
      setWeek(DELAYED);

      return;
    }

    setWeek({ ...ON_TIME, flight: true, still: false });
    later(420, { sam: 'conflict', budget: 'conflict' });
    later(1000, { sam: 'moved' });
    later(1190, { budget: 'moved' });
    later(1650, { told: true });
  };

  // The flight slips once the calendar is in view. With motion reduced the week is rearranged
  // at once: the end state, without the movement.
  useEffect(() => {
    const calendar = calendarRef.current;

    if (!calendar) return clear;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        observer.disconnect();

        if (motionReduced()) {
          if (!touched.current) delay(false);

          return;
        }

        timers.current.push(
          window.setTimeout(() => {
            if (!touched.current) delay(true);
          }, 500),
        );
      },
      { threshold: 0.6 },
    );

    observer.observe(calendar);

    return () => {
      observer.disconnect();
      clear();
    };
    // delay only reads refs and setters; the walk-through starts once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moved = (meeting: Meeting) =>
    meeting === 'moved' ? 'is-moved' : meeting === 'conflict' ? 'is-conflict' : undefined;

  return (
    <GlassPanel
      aria-labelledby="halcyon-moves"
      className="halcyon-pane halcyon-tile"
      lens
      variant="card"
    >
      <div className="halcyon-tile-body">
        <p className="halcyon-tile-kicker">
          <MovesIcon />
          Moves
        </p>
        <h3 id="halcyon-moves">Rearranges the day when plans change</h3>
        <p>
          A flight slips or a call runs long. Halcyon moves what it can, tells everyone affected and
          leaves your focus time alone.
        </p>
      </div>
      <div className="halcyon-tile-screen">
        <div className="halcyon-mini-head">
          <p className="halcyon-mini-title">Launch week</p>
          <GlassButton
            lens={false}
            size="sm"
            onClick={() => {
              touched.current = true;

              if (week.flight) {
                clear();
                setWeek(ON_TIME);
              } else {
                delay(!motionReduced());
              }
            }}
          >
            {week.flight ? 'Reset the week' : 'Delay the flight'}
          </GlassButton>
        </div>
        <div
          ref={calendarRef}
          aria-hidden
          className="halcyon-calendar"
          data-state={week.flight ? 'moved' : undefined}
          data-still={week.still ? '' : undefined}
        >
          <div className="halcyon-calendar-days">
            <span />
            <span>Tue 12</span>
            <span>Wed 13</span>
            <span>Thu 14</span>
          </div>
          <div className="halcyon-calendar-body">
            <div className="halcyon-calendar-hours">
              {['09', '11', '13', '15'].map((hour, index) => (
                <span key={hour} style={at(0, index * 2, 0)}>
                  {hour}
                </span>
              ))}
            </div>
            <div className="halcyon-calendar-grid">
              <span className="halcyon-event halcyon-event-flight" style={at(0, 3.5, 4)}>
                Flight to Lisbon, now 12:30
              </span>
              <span className="halcyon-event" style={at(0, 0.5, 1)}>
                Design review
              </span>
              <span
                className={`halcyon-event ${moved(week.sam) ?? ''}`}
                style={week.sam === 'moved' ? at(1, 5, 1) : at(0, 4.5, 1)}
              >
                1:1 with Sam
              </span>
              <span
                className={`halcyon-event ${moved(week.budget) ?? ''}`}
                style={week.budget === 'moved' ? at(2, 2.5, 1) : at(0, 6, 1)}
              >
                Budget check
              </span>
              <span className="halcyon-event halcyon-event-focus" style={at(1, 0, 2)}>
                <LockIcon />
                Focus
              </span>
              <span className="halcyon-event" style={at(1, 3, 1)}>
                Hiring sync
              </span>
              <span className="halcyon-event" style={at(2, 1, 1)}>
                Vendor call
              </span>
              <span className="halcyon-event" style={at(2, 4, 1.5)}>
                Workshop
              </span>
            </div>
          </div>
        </div>
        <Status
          className="halcyon-mini-status"
          text={
            week.told
              ? 'Moved 2 meetings, told 3 people, kept your focus.'
              : 'Tuesday’s flight is on time.'
          }
        />
      </div>
    </GlassPanel>
  );
}

const RULES = [
  { key: 'am', label: 'Mornings until 11:00' },
  { key: 'pm', label: 'Nothing after 16:00' },
  { key: 'fri', label: 'Fridays clear' },
] as const;

type Rule = (typeof RULES)[number]['key'];

// Each day's meetings, as a start and length in hours after 08:00.
const DAYS = [
  { day: 'Mon', meetings: [at(0, 2.5, 1), at(0, 5, 1)] },
  { day: 'Tue', meetings: [at(0, 4, 1.5)] },
  { day: 'Wed', meetings: [at(0, 2, 1), at(0, 6, 1)] },
  { day: 'Thu', meetings: [at(0, 3, 1), at(0, 5.5, 1)] },
  { day: 'Fri', meetings: [] },
];

/** Protects: switching a rule shades the week and the protected total follows. */
function ProtectsTile() {
  const [rules, setRules] = useState<Record<Rule, boolean>>({ am: true, pm: false, fri: true });
  let hours = 0;

  for (let day = 0; day < 5; day++) {
    hours += day === 4 && rules.fri ? 9 : (rules.am ? 2 : 0) + (rules.pm ? 2 : 0);
  }

  const shown = useCountTo(hours, 420);

  return (
    <GlassPanel
      aria-labelledby="halcyon-protects"
      className="halcyon-pane halcyon-tile"
      lens
      variant="card"
    >
      <div className="halcyon-tile-body">
        <p className="halcyon-tile-kicker">
          <ShieldIcon />
          Protects
        </p>
        <h3 id="halcyon-protects">Keeps the hours you do your best work</h3>
        <p>
          Set your rules once. Halcyon books around them and politely declines anything that would
          break them.
        </p>
      </div>
      <div
        className="halcyon-tile-screen halcyon-week"
        data-am={rules.am ? '' : undefined}
        data-fri={rules.fri ? '' : undefined}
        data-pm={rules.pm ? '' : undefined}
      >
        <div className="halcyon-mini-head">
          <p className="halcyon-mini-title">Your week</p>
          <p className="halcyon-week-sum">
            <strong>{shown}</strong> h protected
          </p>
        </div>
        <div aria-hidden className="halcyon-week-bars">
          {DAYS.map(({ day, meetings }) => (
            <div key={day} className="halcyon-week-day">
              <div className="halcyon-week-bar">
                <span className="halcyon-week-zone halcyon-week-am" />
                <span className="halcyon-week-zone halcyon-week-pm" />
                {day === 'Fri' ? <span className="halcyon-week-zone halcyon-week-fri" /> : null}
                {meetings.map((meeting, index) => (
                  <span key={index} className="halcyon-week-meeting" style={meeting} />
                ))}
              </div>
              {day}
            </div>
          ))}
        </div>
        <ul className="halcyon-week-rules">
          {RULES.map((rule) => (
            <li key={rule.key}>
              <span aria-hidden>{rule.label}</span>
              <GlassSwitch
                aria-label={rule.label}
                checked={rules[rule.key]}
                size="sm"
                onCheckedChange={(checked) => setRules((now) => ({ ...now, [rule.key]: checked }))}
              />
            </li>
          ))}
        </ul>
        <p className="halcyon-sr-only" role="status">
          {hours} hours protected this week.
        </p>
      </div>
    </GlassPanel>
  );
}

/**
 * A dawn line runs behind the tiles where the first tile's screen meets its copy, so every lens
 * rim has a horizon to bend.
 */
export function FeatureTiles() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    const tile = grid?.firstElementChild;
    const screen = tile?.querySelector<HTMLElement>('.halcyon-tile-screen');

    if (!section || !grid || !(tile instanceof HTMLElement) || !screen) return;

    let frame = 0;

    // Offsets ignore the tiles' rise transform, so the line stays put while they move.
    const layout = () => {
      const line = grid.offsetTop + tile.offsetTop + screen.offsetTop + screen.offsetHeight + 12;

      section.style.setProperty('--halcyon-what-line', `${line}px`);
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    });

    observer.observe(section);
    layout();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="halcyon-what-title"
      className="halcyon-what"
      id="what"
    >
      <div aria-hidden className="halcyon-what-art">
        <div className="halcyon-what-horizon" />
      </div>
      <div className="halcyon-wrap">
        <header className="halcyon-section-head">
          <p className="halcyon-eyebrow">In your calendar from January</p>
          <h2 className="halcyon-section-title halcyon-reveal-text" id="halcyon-what-title">
            Three jobs, done <em>quietly</em>.
          </h2>
          <p className="halcyon-section-lede">
            Halcyon works inside the calendar you already use. It takes care of the logistics and
            leaves the decisions to you.
          </p>
        </header>
        <div ref={gridRef} className="halcyon-what-grid">
          <BooksTile />
          <MovesTile />
          <ProtectsTile />
        </div>
      </div>
    </section>
  );
}
