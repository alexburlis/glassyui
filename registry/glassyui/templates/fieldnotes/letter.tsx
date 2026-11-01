'use client';

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GlassPanel } from '../../glass-panel';
import { motionReduced } from '../../lib/liquid-motion';
import { Icon } from './icons';
import { Folio, Initials } from './parts';

type Lighting = { lit: number | null; light: (note: number | null, hold?: boolean) => void };

const NotesContext = createContext<Lighting>({ lit: null, light: () => {} });

/**
 * The phrase a margin note annotates and its numbered reference. Pointing at either the
 * reference or the note lights both; following the reference brings the note into view.
 */
function NoteAnchor({ children, note }: { children: ReactNode; note: number }) {
  const { lit, light } = use(NotesContext);

  const follow = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(`note-${note}`);

    if (!target) return;
    event.preventDefault();
    const box = target.getBoundingClientRect();

    // Scrolls this page's own window, so a framed preview never moves the page around it.
    if (box.top < 90 || box.bottom > window.innerHeight) {
      window.scrollTo({
        top: window.scrollY + box.top - (window.innerHeight - box.height) / 2,
        behavior: motionReduced() ? 'auto' : 'smooth',
      });
    }

    target.focus({ preventScroll: true });
    light(note, true);
  };

  return (
    <>
      <span className="fieldnotes-note-anchor" data-lit={lit === note ? '' : undefined}>
        {children}
      </span>
      <a
        aria-label={`Note ${note}`}
        className="fieldnotes-note-ref"
        href={`#note-${note}`}
        onBlur={() => light(null)}
        onClick={follow}
        onFocus={() => light(note)}
        onMouseEnter={() => light(note)}
        onMouseLeave={() => light(null)}
      >
        {note}
      </a>
    </>
  );
}

function Sidenote({ children, note }: { children: ReactNode; note: number }) {
  const { lit, light } = use(NotesContext);

  return (
    <GlassPanel
      className="fieldnotes-pane fieldnotes-sidenote"
      data-lit={lit === note ? '' : undefined}
      data-reveal="sidenote"
      id={`note-${note}`}
      lens
      role="note"
      tabIndex={-1}
      variant="card"
      onMouseEnter={() => light(note)}
      onMouseLeave={() => light(null)}
    >
      <span aria-hidden className="fieldnotes-sidenote-number">
        {note}
      </span>
      {children}
    </GlassPanel>
  );
}

/** A paragraph with its margin note, which shares the paragraph's row of the letter's grid. */
function Noted({ children, note }: { children: ReactNode; note: ReactNode }) {
  return (
    <div className="fieldnotes-noted">
      {children}
      {note}
    </div>
  );
}

export function Letter() {
  const [lit, setLit] = useState<number | null>(null);
  const holdTimer = useRef(0);

  const light = useCallback((note: number | null, hold = false) => {
    window.clearTimeout(holdTimer.current);
    setLit(note);

    if (hold) holdTimer.current = window.setTimeout(() => setLit(null), 1800);
  }, []);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const notes = useMemo(() => ({ lit, light }), [lit, light]);

  return (
    <NotesContext value={notes}>
      <section
        aria-labelledby="fieldnotes-letter-title"
        className="fieldnotes-section fieldnotes-letter"
        id="letter"
      >
        <div className="fieldnotes-wrap">
          <Folio name="The letter" page="02" />
          <header className="fieldnotes-grid fieldnotes-letter-head">
            <h2
              className="fieldnotes-h2 fieldnotes-letter-title"
              data-reveal="focus"
              id="fieldnotes-letter-title"
            >
              On listening <em>twice</em>.
            </h2>
            <p className="fieldnotes-dek fieldnotes-letter-dek">
              Why the most useful thing a research team can own is its own past, and what we built
              to keep it.
            </p>
            <div className="fieldnotes-letter-by">
              <Initials initials="MA" />
              <p>
                <b>Maren Ashdown, founder</b>
                <span>Written in Bristol, October 2026</span>
              </p>
            </div>
          </header>
          <div className="fieldnotes-grid fieldnotes-letter-body">
            <Noted
              note={
                <Sidenote note={1}>
                  Spiral bound, eighty pages, coffee on page 31. It still holds more findings than
                  that team’s shared drive ever did.
                </Sidenote>
              }
            >
              <p>
                <span className="fieldnotes-dropcap" data-reveal="dropcap">
                  E
                </span>
                leven years ago I ran my first usability study: six participants, a borrowed meeting
                room and <NoteAnchor note={1}>a notebook I still own</NoteAnchor>. By the end of the
                week I knew exactly why people were abandoning our checkout. By the end of the
                quarter nobody remembered, including me. The findings lived in a slide deck that was
                presented once and opened, according to its history, twice more.
              </p>
            </Noted>
            <p>
              That pattern followed me to every team I joined. We were good at hearing people and
              bad at keeping what they said. Each study started from zero, and the same frustrations
              surfaced interview after interview, recorded faithfully and filed where nobody would
              look.
            </p>
            <Noted
              note={
                <Sidenote note={2}>
                  In our beta, the median team held 412 hours of recorded interviews. Fewer than one
                  session in sixteen was opened again after its first readout.
                </Sidenote>
              }
            >
              <p>
                The problem was never a shortage of research. Most teams I’ve worked with had{' '}
                <NoteAnchor note={2}>hundreds of hours of interviews</NoteAnchor>. The problem is
                that a transcript is a terrible place to keep an insight. It is long, it is linear,
                and it only answers the question you were asking on the day you recorded it.
              </p>
            </Noted>
            <figure className="fieldnotes-pullquote fieldnotes-pullquote-inline">
              <blockquote>
                <p>A transcript is a terrible place to keep an insight.</p>
              </blockquote>
            </figure>
            <h3>
              <span aria-hidden className="fieldnotes-section-mark">
                §
              </span>
              What a repository should do
            </h3>
            <p>
              So we built Fieldnotes around one idea: the unit of research is not the study, it is
              the moment. A sentence where someone describes a workaround. The pause before they
              admit they gave up. Fieldnotes lets you tag that moment in a couple of keystrokes and
              keeps it attached to the person, the date and their exact words.
            </p>
            <Noted
              note={
                <Sidenote note={3}>
                  Patterns are suggestions, never verdicts. Fieldnotes proposes them from your tags,
                  and a researcher confirms each one before anyone else sees it.
                </Sidenote>
              }
            >
              <p>
                Once moments are tagged, they start to find each other. A pain point from a March
                onboarding study sits beside one from a September pricing study, and you can see
                they are the same problem described in two vocabularies.{' '}
                <NoteAnchor note={3}>We call those patterns</NoteAnchor>, and they are what you
                bring to the room instead of a deck.
              </p>
            </Noted>
            <Noted
              note={
                <Sidenote note={4}>
                  Every quote links to its second in the recording, so a stakeholder can hear the
                  hesitation for themselves.
                </Sidenote>
              }
            >
              <p>
                None of this replaces the researcher. Software can’t decide what matters, and I’d
                distrust any that claimed to. What it can do is make sure that when you know
                something, your whole team can find out why you know it, with{' '}
                <NoteAnchor note={4}>the participant’s own words one click away</NoteAnchor>.
              </p>
            </Noted>
            <p>
              Below is the part I’m proudest of. It’s an excerpt from one of our own interviews,
              shared with permission. Pick a sentence that matters to you and tag it. That small
              act, repeated across a few hundred conversations, is how a team starts to remember.
            </p>
            <p>
              <a className="fieldnotes-letter-more" href="#try">
                <span>Try it on the transcript</span>
                <Icon className="fieldnotes-lean fieldnotes-lean-down" name="down" />
              </a>
            </p>
          </div>
        </div>
      </section>
    </NotesContext>
  );
}
