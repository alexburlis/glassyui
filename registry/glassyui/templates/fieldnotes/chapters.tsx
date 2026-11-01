'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GlassBadge } from '../../glass-badge';
import { GlassButton } from '../../glass-button';
import { GlassKbd } from '../../glass-kbd';
import { GlassPanel } from '../../glass-panel';
import { GlassProgress } from '../../glass-progress';
import { GlassSwitch } from '../../glass-switch';
import { Icon, type IconName } from './icons';
import { Folio, Initials, type Tone } from './parts';

function Chapter({
  body,
  figure,
  flip,
  id,
  label,
  list,
  numeral,
  title,
}: {
  body: string;
  figure: ReactNode;
  flip?: boolean;
  id: string;
  label: string;
  list: readonly [IconName, string][];
  numeral: string;
  title: string;
}) {
  return (
    <article aria-labelledby={id} className="fieldnotes-chapter" data-flip={flip ? '' : undefined}>
      <div className="fieldnotes-chapter-text">
        <p className="fieldnotes-chapter-label">
          <span aria-hidden className="fieldnotes-chapter-numeral">
            {numeral}
          </span>
          <span className="fieldnotes-eyebrow">{label}</span>
        </p>
        <h3 className="fieldnotes-chapter-title" id={id}>
          {title}
        </h3>
        <p className="fieldnotes-chapter-body">{body}</p>
        <ul className="fieldnotes-chapter-list">
          {list.map(([icon, text]) => (
            <li key={text}>
              <Icon name={icon} />
              {text}
            </li>
          ))}
        </ul>
      </div>
      {figure}
    </article>
  );
}

/** A figure: a plate of desk things with one pane of the product resting on them. */
function Plate({
  caption,
  children,
  kind,
  number,
}: {
  caption: string;
  children: ReactNode;
  kind: 'capture' | 'tag' | 'pattern' | 'share';
  number: number;
}) {
  return (
    <figure className="fieldnotes-chapter-figure">
      <div className="fieldnotes-plate" data-kind={kind} data-reveal="plate">
        {children}
      </div>
      <figcaption>
        <span className="fieldnotes-figure-number">Fig. {number}</span>
        {caption}
      </figcaption>
    </figure>
  );
}

const SESSIONS: readonly { initials: string; tone: Tone; name: string; detail: string }[] = [
  {
    initials: 'DR',
    tone: 'ochre',
    name: 'Interview 07 · Dana R.',
    detail: '41:12 · 2 names redacted',
  },
  { initials: 'MO', tone: 'sage', name: 'Interview 08 · Malik O.', detail: '' },
  {
    initials: 'IT',
    tone: 'plum',
    name: 'Interview 09 · Ines T.',
    detail: '52:03 · uploaded 4 min ago',
  },
];

function CaptureFigure() {
  return (
    <Plate
      caption="Sessions arrive transcribed and redacted. Interview eight is still being transcribed."
      kind="capture"
      number={1}
    >
      <div aria-hidden className="fieldnotes-piece fieldnotes-scrap fieldnotes-photo" />
      <div aria-hidden className="fieldnotes-piece fieldnotes-scrap fieldnotes-sleeve">
        <span className="fieldnotes-typed">
          <b>Recordings</b>
          <br />
          Week 11 · nine sessions
        </span>
      </div>
      <span aria-hidden className="fieldnotes-piece fieldnotes-tape fieldnotes-capture-tape-a" />
      <span aria-hidden className="fieldnotes-piece fieldnotes-tape fieldnotes-capture-tape-b" />
      <GlassPanel className="fieldnotes-pane fieldnotes-figure-pane" lens variant="card">
        <div className="fieldnotes-figure-bar">
          <p className="fieldnotes-figure-title">Month-end close</p>
          <GlassBadge className="fieldnotes-badge">9 sessions</GlassBadge>
        </div>
        <ul className="fieldnotes-sessions">
          {SESSIONS.map((session, index) => (
            <li key={session.name}>
              <Initials initials={session.initials} small tone={session.tone} />
              <span className="fieldnotes-session-who">
                <b>{session.name}</b>
                {index === 1 ? (
                  <GlassProgress
                    aria-label="Transcribing interview 08"
                    className="fieldnotes-meter"
                    size="sm"
                    value={82}
                  />
                ) : (
                  <span>{session.detail}</span>
                )}
              </span>
              {index === 0 ? (
                <span className="fieldnotes-session-state" data-done="">
                  <Icon name="check" />
                  Ready
                </span>
              ) : (
                <span className="fieldnotes-session-state">{index === 1 ? '82%' : 'Queued'}</span>
              )}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </Plate>
  );
}

const TAXONOMY: readonly { name: string; key: string; count: number; colour: string }[] = [
  { name: 'Pain point', key: '1', count: 214, colour: 'pain' },
  { name: 'Workaround', key: '2', count: 131, colour: 'work' },
  { name: 'Quote', key: '3', count: 96, colour: 'quote' },
  { name: 'Feature request', key: '4', count: 58, colour: 'request' },
  { name: 'Delight', key: '5', count: 37, colour: 'delight' },
];

function TagFigure() {
  return (
    <Plate
      caption="A team taxonomy. Each tag carries a shortcut and a running count."
      kind="tag"
      number={2}
    >
      {(['pain', 'work', 'quote'] as const).map((tag) => (
        <div
          key={tag}
          aria-hidden
          className="fieldnotes-piece fieldnotes-scrap fieldnotes-tag-card"
          data-tag={tag}
        >
          <i className="fieldnotes-tab-sticker" />
          <span className="fieldnotes-hand">{tag === 'work' ? 'workaround' : tag}</span>
        </div>
      ))}
      <svg aria-hidden className="fieldnotes-piece fieldnotes-swash" viewBox="0 0 240 40">
        <path d="M8 26c40-10 90-14 140-12s70 4 84 2" />
      </svg>
      <GlassPanel className="fieldnotes-pane fieldnotes-figure-pane" lens variant="card">
        <div className="fieldnotes-figure-bar">
          <p className="fieldnotes-figure-title">Team taxonomy</p>
          <GlassBadge className="fieldnotes-badge fieldnotes-badge-jade" dot>
            Shared
          </GlassBadge>
        </div>
        <ul className="fieldnotes-taxonomy">
          {TAXONOMY.map((tag) => (
            <li
              key={tag.name}
              data-colour={tag.colour}
              // SAFETY: CSSProperties has no custom-property index; this adds one number-valued property.
              style={{ '--w': tag.count / TAXONOMY[0].count } as CSSProperties}
            >
              <span aria-hidden className="fieldnotes-tag-dot" />
              <span>{tag.name}</span>
              <GlassKbd>{tag.key}</GlassKbd>
              <span className="fieldnotes-taxonomy-count">{tag.count}</span>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </Plate>
  );
}

const STICKIES = [
  { label: 'P02 · Mar', colour: 'yellow', place: 'a' },
  { label: 'P05 · May', colour: 'rose', place: 'b' },
  { label: 'P11 · Jul', colour: 'sage', place: 'c' },
  { label: 'P07 · Sep', colour: 'yellow', place: 'd' },
];

const MOMENTS = [
  [26, 22],
  [42, 22],
  [62, 22],
  [86, 22],
  [176, 50],
  [204, 50],
  [236, 50],
  [304, 78],
  [322, 78],
];

const MONTHS: readonly [string, number][] = [
  ['Mar', 20],
  ['May', 120],
  ['Jul', 220],
  ['Sep', 320],
];

const PEOPLE: readonly [string, Tone][] = [
  ['JK', 'oxblood'],
  ['DR', 'ochre'],
  ['LF', 'sage'],
  ['SN', 'plum'],
  ['BW', 'ink'],
];

function PatternFigure() {
  return (
    <Plate
      caption="One pattern across three studies, nine participants and seven months."
      kind="pattern"
      number={3}
    >
      <div aria-hidden className="fieldnotes-piece fieldnotes-graph" />
      {STICKIES.map((sticky) => (
        <div
          key={sticky.label}
          aria-hidden
          className="fieldnotes-piece fieldnotes-sticky"
          data-colour={sticky.colour}
          data-place={sticky.place}
        >
          <span className="fieldnotes-hand">{sticky.label}</span>
        </div>
      ))}
      <svg
        aria-hidden
        className="fieldnotes-string"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <polyline points="18,10 83,79" />
        <polyline points="82,7 18,82" />
        <polyline points="18,10 82,7" />
      </svg>
      <GlassPanel className="fieldnotes-pane fieldnotes-figure-pane" lens variant="card">
        <div className="fieldnotes-figure-bar">
          <GlassBadge className="fieldnotes-badge">
            <Icon className="fieldnotes-icon-small" name="pattern" />
            Pattern
          </GlassBadge>
          <span className="fieldnotes-figure-meta">
            Confirmed<span className="fieldnotes-wide-only"> by Maren A.</span>
          </span>
        </div>
        <p className="fieldnotes-figure-heading">Data is re-keyed between tools</p>
        <p className="fieldnotes-figure-sub">9 participants · 3 studies · March to September</p>
        <svg
          aria-label="Nine moments across three studies, from March to September"
          className="fieldnotes-timeline"
          role="img"
          viewBox="0 0 340 112"
        >
          <g className="fieldnotes-timeline-grid">
            {[20, 70, 120, 170, 220, 270, 320].map((x) => (
              <line key={x} x1={x} x2={x} y1="6" y2="90" />
            ))}
          </g>
          <path
            className="fieldnotes-timeline-thread"
            d="M26 22H86C128 22 136 50 176 50H236C276 50 282 78 304 78H322"
            pathLength={1}
          />
          {MOMENTS.map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="5" />
          ))}
          <text className="fieldnotes-timeline-row" x="20" y="11">
            Onboarding
          </text>
          <text className="fieldnotes-timeline-row" x="170" y="39">
            Pricing
          </text>
          <text className="fieldnotes-timeline-row" textAnchor="end" x="326" y="67">
            Month-end
          </text>
          {MONTHS.map(([month, x]) => (
            <text key={month} textAnchor="middle" x={x} y="106">
              {month}
            </text>
          ))}
        </svg>
        <div className="fieldnotes-people">
          {PEOPLE.map(([initials, tone]) => (
            <Initials key={initials} initials={initials} small tone={tone} />
          ))}
          <span>and 4 more</span>
        </div>
      </GlassPanel>
    </Plate>
  );
}

const WAVE = [
  0.3, 0.5, 0.42, 0.7, 0.9, 0.62, 0.4, 0.55, 0.8, 1, 0.74, 0.5, 0.36, 0.6, 0.86, 0.66, 0.44, 0.3,
  0.52, 0.78, 0.94, 0.7, 0.48, 0.34, 0.58, 0.82, 0.6, 0.4, 0.28, 0.46, 0.68, 0.5, 0.36, 0.24,
];

const CLIP_SECONDS = 14;

const clock = (seconds: number) => `0:${String(Math.floor(seconds)).padStart(2, '0')}`;

/** A fourteen-second clip that plays through its waveform, in place of a recording. */
function Clip() {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();

    let frame = requestAnimationFrame(function tick(now) {
      positionRef.current += (now - last) / 1000;
      last = now;

      if (positionRef.current >= CLIP_SECONDS) {
        positionRef.current = 0;
        setPosition(0);
        setPlaying(false);

        return;
      }

      setPosition(positionRef.current);
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const played = Math.round((position / CLIP_SECONDS) * WAVE.length);

  return (
    <div className="fieldnotes-clip">
      <GlassButton
        aria-label={playing ? 'Pause clip' : 'Play clip from interview 07'}
        aria-pressed={playing}
        className="fieldnotes-button-sm fieldnotes-clip-play"
        size="sm"
        onClick={() => setPlaying((current) => !current)}
      >
        <Icon name={playing ? 'pause' : 'play'} />
      </GlassButton>
      <div aria-hidden className="fieldnotes-clip-wave">
        {WAVE.map((height, index) => (
          <i
            key={index}
            data-on={index < played ? '' : undefined}
            // SAFETY: CSSProperties has no custom-property index; this adds one number-valued property.
            style={{ '--h': height } as CSSProperties}
          />
        ))}
      </div>
      <span className="fieldnotes-clip-time">
        {clock(position)} / {clock(CLIP_SECONDS)}
      </span>
    </div>
  );
}

function ShareFigure() {
  const [clips, setClips] = useState(true);

  return (
    <Plate
      caption="An insight page. Readers hear the clip and see who said it."
      kind="share"
      number={4}
    >
      <div aria-hidden className="fieldnotes-piece fieldnotes-scrap fieldnotes-readout">
        <span className="fieldnotes-typed">
          <b>Readout · Q3</b>
        </span>
        <span className="fieldnotes-readout-lines">
          {[92, 84, 88, 60, 90, 72].map((width) => (
            <i key={width} style={{ width: `${width}%` }} />
          ))}
        </span>
      </div>
      <div aria-hidden className="fieldnotes-piece fieldnotes-postage">
        <div className="fieldnotes-postage-art">
          Fieldnotes
          <br />
          No. 14
        </div>
      </div>
      <svg aria-hidden className="fieldnotes-piece fieldnotes-postmark" viewBox="0 0 200 80">
        <circle cx="42" cy="40" fill="none" r="30" stroke="currentColor" strokeWidth="2" />
        <text
          className="fieldnotes-postmark-place"
          fill="currentColor"
          textAnchor="middle"
          x="42"
          y="37"
        >
          BRISTOL
        </text>
        <text
          className="fieldnotes-postmark-date"
          fill="currentColor"
          textAnchor="middle"
          x="42"
          y="50"
        >
          30 OCT 26
        </text>
        <path
          d="M80 22c10-6 20 6 30 0s20 6 30 0 20 6 30 0 14 4 20 2M80 36c10-6 20 6 30 0s20 6 30 0 20 6 30 0 14 4 20 2M80 50c10-6 20 6 30 0s20 6 30 0 20 6 30 0 14 4 20 2M80 64c10-6 20 6 30 0s20 6 30 0 20 6 30 0 14 4 20 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <div aria-hidden className="fieldnotes-piece fieldnotes-envelope" />
      <GlassPanel className="fieldnotes-pane fieldnotes-figure-pane" lens variant="card">
        <div className="fieldnotes-figure-bar">
          <p className="fieldnotes-figure-meta">
            Insight<span className="fieldnotes-wide-only"> · published</span>
            <span className="fieldnotes-roomy-only"> · 12 October</span>
          </p>
          <GlassBadge className="fieldnotes-badge">
            <Icon className="fieldnotes-icon-small" name="users" />
            14 readers
          </GlassBadge>
        </div>
        <p className="fieldnotes-figure-heading">
          Finance stops trusting the dashboard after day five
        </p>
        <Clip />
        <blockquote className="fieldnotes-clip-quote">
          “Because I don’t trust it after the fifth of the month.”
          <span>Dana R. · interview 07 · 04:35</span>
        </blockquote>
        <div className="fieldnotes-setting">
          <label htmlFor="fieldnotes-reader-clips">
            Readers can play clips
            <span id="fieldnotes-reader-clips-note">
              {clips
                ? 'Readers hear the recording and see who said it.'
                : 'Readers see the quote, not the recording.'}
            </span>
          </label>
          <GlassSwitch
            aria-describedby="fieldnotes-reader-clips-note"
            aria-label="Readers can play clips"
            checked={clips}
            id="fieldnotes-reader-clips"
            onCheckedChange={setClips}
          />
        </div>
      </GlassPanel>
    </Plate>
  );
}

export function Chapters() {
  return (
    <section
      aria-labelledby="fieldnotes-chapters-title"
      className="fieldnotes-section fieldnotes-chapters"
      id="chapters"
    >
      <div className="fieldnotes-wrap">
        <Folio name="Four chapters" page="06" />
        <div className="fieldnotes-section-head">
          <h2 className="fieldnotes-h2" data-reveal="focus" id="fieldnotes-chapters-title">
            The tool, in <em>four</em> chapters.
          </h2>
          <p className="fieldnotes-dek">
            Capture, tag, find, share. Each is small on its own. Together they are how a team
            remembers what it heard.
          </p>
        </div>
        <Chapter
          body="Drop in recordings from any meeting tool, or connect a folder and let new sessions arrive on their own. Fieldnotes transcribes in 31 languages, labels speakers and keeps every word pinned to its second in the recording."
          figure={<CaptureFigure />}
          id="fieldnotes-chapter-1"
          label="Chapter one · Capture"
          list={[
            ['upload', 'Audio or video up to four hours long'],
            ['speaker', 'Speaker labels you can correct in place'],
            ['lock', 'Names and numbers redacted before anyone else reads them'],
          ]}
          numeral="I"
          title="Bring every conversation into one room."
        />
        <Chapter
          body="Select a sentence and press a number. Tags come from a taxonomy your team agrees on, so a pain point means the same thing to everyone who reads it. Most researchers tag an hour of interview in under fifteen minutes."
          figure={<TagFigure />}
          flip
          id="fieldnotes-chapter-2"
          label="Chapter two · Tag"
          list={[
            ['keys', 'Number keys for your five most used tags'],
            ['list', 'One shared taxonomy, with a definition for every tag'],
            ['clock', 'Every tag keeps the speaker, the date and the second'],
          ]}
          numeral="II"
          title="Mark the moment, not the meeting."
        />
        <Chapter
          body="Search every interview your team has run, by tag, by phrase or by who was speaking. When moments from different studies describe the same thing, Fieldnotes suggests a pattern. A researcher confirms it before anyone else sees it."
          figure={<PatternFigure />}
          id="fieldnotes-chapter-3"
          label="Chapter three · Find"
          list={[
            ['search', 'Search across studies, tags and speakers'],
            ['pattern', 'Suggested patterns, always confirmed by a person'],
            ['growth', 'See when a pattern first appeared and how it grew'],
          ]}
          numeral="III"
          title="Let a March study meet a September one."
        />
        <Chapter
          body="Publish a pattern as a short page your stakeholders can read in two minutes. Every claim sits beside the quotes behind it, and every quote plays from its own second in the recording. Readers are free, so everyone who should listen can."
          figure={<ShareFigure />}
          flip
          id="fieldnotes-chapter-4"
          label="Chapter four · Share"
          list={[
            ['page', 'Insight pages that show the quotes behind each claim'],
            ['wave', 'Clips that play from the exact second'],
            ['users', 'Unlimited free readers, with comments'],
          ]}
          numeral="IV"
          title="Hand over evidence, not opinions."
        />
      </div>
    </section>
  );
}
