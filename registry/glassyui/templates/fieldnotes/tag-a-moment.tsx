'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GlassBadge } from '../../glass-badge';
import { GlassButton } from '../../glass-button';
import { GlassKbd } from '../../glass-kbd';
import { GlassPanel } from '../../glass-panel';
import { GlassScrollArea } from '../../glass-scroll-area';
import { motionReduced } from '../../lib/liquid-motion';
import { Icon } from './icons';
import { Folio } from './parts';

type Tag = 'pain' | 'work' | 'quote';

type Theme = 'rekey' | 'shadow' | 'trust' | 'handoff';

const TAGS: readonly Tag[] = ['pain', 'work', 'quote'];

const TAG_NAMES: Record<Tag, string> = { pain: 'Pain point', work: 'Workaround', quote: 'Quote' };

const BOARD_NAMES: Record<Tag, string> = {
  pain: 'Pain points',
  work: 'Workarounds',
  quote: 'Quotes',
};

const DOCK_NAMES: Record<Tag, string> = { pain: 'Pain', work: 'Workaround', quote: 'Quote' };

type Sentence = { text: string; time: string; theme: Theme; suggest: Tag };

/** Interview seven: what Dana said, sentence by sentence, with the tag each one suggests. */
const SENTENCES: readonly Sentence[] = [
  {
    text: 'So the first thing I do is export everything from the billing system.',
    time: '04:06',
    theme: 'rekey',
    suggest: 'work',
  },
  {
    text: 'Then I paste it into my own spreadsheet, the one nobody else knows about.',
    time: '04:12',
    theme: 'shadow',
    suggest: 'work',
  },
  {
    text: 'Honestly, that spreadsheet is the real system.',
    time: '04:19',
    theme: 'shadow',
    suggest: 'quote',
  },
  {
    text: 'The official dashboard is what I show my manager.',
    time: '04:23',
    theme: 'trust',
    suggest: 'pain',
  },
  {
    text: 'Because I don’t trust it after the fifth of the month.',
    time: '04:35',
    theme: 'trust',
    suggest: 'pain',
  },
  { text: 'Numbers move and nobody tells me why.', time: '04:39', theme: 'trust', suggest: 'pain' },
  {
    text: 'So I screenshot it on the first, just so I have something to point at.',
    time: '04:44',
    theme: 'trust',
    suggest: 'work',
  },
  { text: 'I message three people and wait.', time: '05:06', theme: 'handoff', suggest: 'pain' },
  {
    text: 'Usually it’s a refund someone processed by hand.',
    time: '05:10',
    theme: 'handoff',
    suggest: 'pain',
  },
  {
    text: 'It takes about a day, every month, and I’ve stopped mentioning it because it sounds like complaining.',
    time: '05:15',
    theme: 'handoff',
    suggest: 'quote',
  },
];

/** The conversation: the interviewer's questions, and Dana's answers as runs of sentences. */
const TURNS = [
  { time: '03:58', question: 'Walk me through the last time you closed the month.' },
  { time: '04:06', answer: [0, 1, 2, 3] },
  { time: '04:31', question: 'Why not run the close from the dashboard?' },
  { time: '04:35', answer: [4, 5, 6] },
  { time: '05:02', question: 'And when the numbers don’t match?' },
  { time: '05:06', answer: [7, 8, 9] },
];

/** Patterns from the study's earlier interviews, which a tag on the same theme brings up. */
const PATTERNS: readonly { theme: Theme; title: string; count: number; seen: string[] }[] = [
  {
    theme: 'rekey',
    title: 'Data is re-keyed between tools',
    count: 4,
    seen: ['P02', 'P03', 'P06'],
  },
  { theme: 'shadow', title: 'Shadow spreadsheets carry the close', count: 3, seen: ['P02', 'P05'] },
  { theme: 'trust', title: 'The dashboard isn’t trusted after day five', count: 2, seen: ['P03'] },
  {
    theme: 'handoff',
    title: 'A mismatch takes three people and a day',
    count: 3,
    seen: ['P01', 'P04'],
  },
];

const PARTICIPANTS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07'];

const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';

const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0)';

/** A sentence's current tag, and the colour its marker keeps while it wipes away. */
type Mark = { tag?: Tag; hue?: Tag };

/** A card on the board for a tagged sentence. A leaving card plays its exit, then goes. */
type Moment = { key: number; sentence: number; tag: Tag; leaving?: boolean };

/** Where the menu grows from: a point on a line of text, with the line's top and bottom. */
type Anchor = { x: number; top: number; bottom: number };

/** A tagged sentence's copy flying from the transcript to its new card. */
type Flight = { key: number; tag: Tag; from: DOMRect; delay: number; text: string };

const shorten = (text: string) => (text.length > 42 ? `${text.slice(0, 40).trim()}…` : text);

/** Where the arrow keys, Home and End take focus from a sentence, if anywhere. */
function moveFrom(index: number, key: string) {
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return Math.min(SENTENCES.length - 1, index + 1);
    case 'ArrowUp':
    case 'ArrowLeft':
      return Math.max(0, index - 1);
    case 'Home':
      return 0;
    case 'End':
      return SENTENCES.length - 1;
    default:
      return undefined;
  }
}

const onScreen = (box: DOMRect) =>
  box.width > 0 && box.top >= 64 && box.bottom <= window.innerHeight - 8;

/**
 * Try it: a real interview excerpt to tag. Select sentences or click one, pick a tag from the
 * menu that grows from the text, and the moment flies onto the insights board, where it can
 * bring up a pattern from the study's other interviews.
 */
export function TagAMoment() {
  const highlighterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const momentRefs = useRef(new Map<number, HTMLLIElement>());
  const dockRefs = useRef(new Map<Tag, HTMLSpanElement>());
  const positions = useRef(new Map<number, number>());
  const leaving = useRef(new Set<number>());
  const flights = useRef<Flight[]>([]);
  const anchorRef = useRef<Anchor | null>(null);
  const targetsRef = useRef<number[]>([]);
  const nextKey = useRef(0);
  const [marks, setMarks] = useState<Mark[]>(() => SENTENCES.map(() => ({})));
  const [moments, setMoments] = useState<Moment[]>([]);
  const [rove, setRove] = useState(0);
  const [targets, setTargets] = useState<number[]>([]);
  const [opened, setOpened] = useState(0);
  const [confirmed, setConfirmed] = useState<Theme[]>([]);
  const [announcement, setAnnouncement] = useState('');

  const tagged = marks.flatMap((mark) => (mark.tag ? [mark.tag] : []));

  const themes = new Set(
    marks.flatMap((mark, index) => (mark.tag ? [SENTENCES[index].theme] : [])),
  );

  const countOf = (tag: Tag) => tagged.filter((entry) => entry === tag).length;

  const announce = (message: string, next: Mark[]) => {
    const count = next.filter((mark) => mark.tag).length;

    setAnnouncement(`${message} ${count} ${count === 1 ? 'moment' : 'moments'} on the board.`);
  };

  const openMenu = (group: number[], anchor: Anchor) => {
    targetsRef.current = group;
    anchorRef.current = anchor;
    setTargets(group);
    setOpened((count) => count + 1);
  };

  const closeMenu = (returnFocus: boolean) => {
    const menu = menuRef.current;

    if (!menu || menu.dataset.state !== 'open') return;
    menu.dataset.state = 'closed';
    const last = targetsRef.current.at(-1);

    targetsRef.current = [];
    setTargets([]);

    if (returnFocus && last !== undefined)
      sentenceRefs.current[last]?.focus({ preventScroll: true });
  };

  // Grows the menu from its anchor, above the line where there is room and below it where not.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const highlighter = highlighterRef.current;
    const anchor = anchorRef.current;

    if (!opened || !menu || !highlighter || !anchor) return;
    anchorRef.current = null;

    const box = highlighter.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const gap = 10;
    const above = anchor.top - height - gap > 84;
    const left = Math.max(-6, Math.min(anchor.x - box.left - width / 2, box.width - width + 6));
    const top = above ? anchor.top - box.top - height - gap : anchor.bottom - box.top + gap;

    menu.style.transition = 'none';
    menu.dataset.state = 'closed';
    menu.dataset.side = above ? 'top' : 'bottom';
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.setProperty('--origin-x', `${Math.round(anchor.x - box.left - left)}px`);
    menu.style.setProperty('--origin-y', `${above ? height + gap : -gap}px`);
    // Reading the size applies the new place before the opening transition starts from it.
    void menu.offsetWidth;
    menu.style.transition = '';
    menu.dataset.state = 'open';

    const items = itemRefs.current.slice(0, TAGS.length);

    const first =
      items.find((item) => item?.getAttribute('aria-checked') === 'true') ??
      items.find((item) => item?.dataset.suggested !== undefined) ??
      items[0];

    first?.focus({ preventScroll: true });
  }, [opened]);

  // A click anywhere else closes the menu, and so does a new width, which moves the text.
  useEffect(() => {
    let width = window.innerWidth;

    const onPointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;

      if (
        menu?.dataset.state === 'open' &&
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !(event.target instanceof Element && event.target.closest('[data-sentence]'))
      ) {
        closeMenu(false);
      }
    };

    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      closeMenu(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Cards slide to their new places, leaving cards play their exit, and new ones fly in.
  useLayoutEffect(() => {
    const cards = momentRefs.current;
    const still = motionReduced();
    const root = highlighterRef.current?.closest<HTMLElement>('.fieldnotes') ?? document.body;
    const spring = getComputedStyle(root).getPropertyValue('--lg-spring').trim() || 'ease-out';

    for (const [key, card] of cards) {
      const before = positions.current.get(key);
      const shift = before === undefined ? 0 : before - card.offsetTop;

      if (!still && Math.abs(shift) > 0.5) {
        card.animate([{ transform: `translateY(${shift}px)` }, { transform: 'none' }], {
          duration: 460,
          easing: spring,
        });
      }
    }

    positions.current = new Map(Array.from(cards, ([key, card]) => [key, card.offsetTop]));

    for (const moment of moments) {
      if (!moment.leaving || leaving.current.has(moment.key)) continue;
      leaving.current.add(moment.key);
      const card = cards.get(moment.key);

      const remove = () => {
        leaving.current.delete(moment.key);
        setMoments((current) => current.filter((entry) => entry.key !== moment.key));
      };

      if (still || !card) {
        remove();
        continue;
      }

      card
        .animate(
          [
            { transform: 'none', opacity: 1 },
            { transform: 'translateX(18px)', opacity: 0 },
          ],
          { duration: 170, easing: EASE_IN, fill: 'forwards' },
        )
        .finished.then(remove, remove);
    }

    const launches = flights.current.splice(0);

    if (launches.length && listRef.current) listRef.current.scrollTop = 0;

    for (const flight of launches) {
      const card = cards.get(flight.key);

      if (!card) continue;
      fly(root, flight, card, dockRefs.current.get(flight.tag), spring);
    }
  }, [moments]);

  const applyTag = (tag: Tag, group: number[]) => {
    if (!group.length) return;
    closeMenu(true);
    window.getSelection()?.removeAllRanges();

    const next = marks.slice();
    let board = moments;
    let delay = 0;

    for (const sentence of group) {
      if (next[sentence].tag === tag) continue;

      // A retagged sentence swaps its card at once for one at the top of the board.
      if (next[sentence].tag) {
        board = board.filter((moment) => moment.sentence !== sentence || moment.leaving);
      }

      next[sentence] = { tag, hue: tag };
      const key = nextKey.current++;
      const from = sentenceRefs.current[sentence]?.getBoundingClientRect();

      board = [{ key, sentence, tag }, ...board];

      if (from && !motionReduced()) {
        flights.current.push({ key, tag, from, delay, text: SENTENCES[sentence].text });
      }

      delay += 120;
    }

    setMarks(next);
    setMoments(board);
    announce(
      group.length > 1
        ? `${group.length} sentences tagged as ${TAG_NAMES[tag].toLowerCase()}.`
        : `Tagged as ${TAG_NAMES[tag].toLowerCase()}.`,
      next,
    );
  };

  const untag = (sentences: number[], message: string) => {
    const next = marks.slice();
    const removing = new Set(sentences.filter((sentence) => next[sentence].tag));

    if (!removing.size) return;

    for (const sentence of removing) next[sentence] = { hue: next[sentence].hue };

    // Focus on a card that is going moves back to its sentence.
    const focused = document.activeElement;

    for (const moment of moments) {
      if (!removing.has(moment.sentence) || moment.leaving) continue;

      if (focused && momentRefs.current.get(moment.key)?.contains(focused)) {
        sentenceRefs.current[moment.sentence]?.focus({ preventScroll: true });
        setRove(moment.sentence);
      }
    }

    setMarks(next);
    setMoments((current) =>
      current.map((moment) =>
        removing.has(moment.sentence) && !moment.leaving ? { ...moment, leaving: true } : moment,
      ),
    );
    announce(message, next);
  };

  const selectionTargets = () => {
    const selection = window.getSelection();
    const highlighter = highlighterRef.current;

    if (!highlighter || !selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);

    if (!highlighter.contains(range.commonAncestorContainer)) return null;

    // A sentence counts when the selection takes some of its text, not just touches its edge.
    const hit = sentenceRefs.current.flatMap((span, index) => {
      if (!span || !selection.containsNode(span, true)) return [];
      const text = span.firstChild;

      if (range.startContainer === text && range.startOffset >= (text.textContent?.length ?? 0)) {
        return [];
      }

      if (range.endContainer === text && range.endOffset === 0) return [];

      return [index];
    });

    if (!hit.length) return null;
    const lines = Array.from(range.getClientRects()).filter((line) => line.width > 1);
    const first = lines[0] ?? range.getBoundingClientRect();
    const last = lines.at(-1) ?? first;

    return {
      hit,
      anchor: {
        x: first.left + Math.min(first.width / 2, 160),
        top: first.top,
        bottom: last.bottom,
      },
    };
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const { clientX, clientY, target } = event;

    if (target instanceof Node && menuRef.current?.contains(target)) return;

    // The selection settles after pointerup.
    window.setTimeout(() => {
      const picked = selectionTargets();

      if (picked) {
        setRove(picked.hit[picked.hit.length - 1]);
        openMenu(picked.hit, picked.anchor);

        return;
      }

      const sentence =
        target instanceof Element ? target.closest<HTMLElement>('[data-sentence]') : null;

      if (!sentence) {
        closeMenu(false);

        return;
      }

      const index = Number(sentence.dataset.sentence);
      const lines = Array.from(sentence.getClientRects());

      const line =
        lines.find((box) => clientY >= box.top - 2 && clientY <= box.bottom + 2) ?? lines[0];

      setRove(index);
      openMenu([index], { x: clientX, top: line.top, bottom: line.bottom });
    }, 0);
  };

  const onSentenceKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>, index: number) => {
    const move = moveFrom(index, event.key);

    if (move !== undefined) {
      event.preventDefault();
      setRove(move);
      sentenceRefs.current[move]?.focus();

      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const line = event.currentTarget.getClientRects()[0];

      openMenu([index], {
        x: line.left + Math.min(line.width / 2, 140),
        top: line.top,
        bottom: line.bottom,
      });
    } else if (event.key === '1' || event.key === '2' || event.key === '3') {
      event.preventDefault();
      applyTag(TAGS[Number(event.key) - 1], [index]);
    } else if ((event.key === 'Backspace' || event.key === 'Delete') && marks[index].tag) {
      event.preventDefault();
      untag([index], 'Tag removed.');
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.flatMap((item) => (item && !item.hidden ? [item] : []));
    const index = items.findIndex((item) => item === document.activeElement);
    const focus = (next: number) => items[(next + items.length) % items.length]?.focus();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focus(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focus(items.length - 1);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === '1' || event.key === '2' || event.key === '3') {
      event.preventDefault();
      applyTag(TAGS[Number(event.key) - 1], targetsRef.current);
    }
  };

  const removeFromMenu = () => {
    const group = targetsRef.current;

    closeMenu(true);
    untag(group, 'Tag removed.');
  };

  const clearBoard = () => {
    untag(
      SENTENCES.map((_, index) => index),
      'Board cleared.',
    );
    setRove(0);
    sentenceRefs.current[0]?.focus({ preventScroll: true });
  };

  // The menu's state, for the sentences it is open on.
  const current =
    targets.length && targets.every((index) => marks[index].tag === marks[targets[0]].tag)
      ? marks[targets[0]].tag
      : undefined;

  const suggested = targets.length && !current ? SENTENCES[targets[0]].suggest : undefined;
  const anyTagged = targets.some((index) => marks[index].tag);

  return (
    <section
      aria-labelledby="fieldnotes-try-title"
      className="fieldnotes-section fieldnotes-try"
      id="try"
    >
      <div className="fieldnotes-wrap">
        <Folio name="Try it" page="05" />
        <div className="fieldnotes-grid fieldnotes-try-head">
          <h2 className="fieldnotes-h2" data-reveal="focus" id="fieldnotes-try-title">
            Tag a <em>moment</em>.
          </h2>
          <div className="fieldnotes-try-intro">
            <p>
              Interview seven from our own month-end close study. Select any sentence, or click one,
              then choose a tag. Watch what the board does with it.
            </p>
            <p className="fieldnotes-try-keys" id="fieldnotes-tag-help">
              <span>Keyboard:</span> <GlassKbd>Tab</GlassKbd> into the transcript,{' '}
              <GlassKbd>↑</GlassKbd>
              <GlassKbd>↓</GlassKbd> to move, <GlassKbd>Enter</GlassKbd> to open tags, or press{' '}
              <span className="fieldnotes-try-numbers">
                <GlassKbd>1</GlassKbd>
                <GlassKbd>2</GlassKbd>
                <GlassKbd>3</GlassKbd>.
              </span>
            </p>
            {TAGS.map((tag) => (
              <span key={tag} hidden id={`fieldnotes-tagged-${tag}`}>
                Tagged as {TAG_NAMES[tag].toLowerCase()}.
              </span>
            ))}
          </div>
        </div>
        <div className="fieldnotes-try-grid">
          <div className="fieldnotes-try-main">
            <div className="fieldnotes-transcript">
              <div className="fieldnotes-transcript-head">
                <p>Interview 07 · Month-end close</p>
                <p>14 March 2026 · 41 min · Dana R., finance operations</p>
              </div>
              <div
                ref={highlighterRef}
                aria-label="Interview transcript"
                className="fieldnotes-highlighter"
                role="group"
                onPointerUp={onPointerUp}
              >
                {TURNS.map((turn) => (
                  <div
                    key={turn.time}
                    className="fieldnotes-turn"
                    data-question={turn.question ? '' : undefined}
                  >
                    <span className="fieldnotes-turn-time">{turn.time}</span>
                    <span className="fieldnotes-turn-who">
                      {turn.question ? 'Interviewer' : 'Dana'}
                    </span>
                    <p>
                      {turn.question ??
                        turn.answer?.map((index, position) => (
                          <Fragment key={index}>
                            {position ? ' ' : null}
                            <span
                              ref={(element) => {
                                sentenceRefs.current[index] = element;
                              }}
                              aria-controls="fieldnotes-tag-menu"
                              aria-describedby={
                                marks[index].tag
                                  ? `fieldnotes-tagged-${marks[index].tag} fieldnotes-tag-help`
                                  : 'fieldnotes-tag-help'
                              }
                              aria-expanded={targets.includes(index)}
                              aria-haspopup="menu"
                              className="fieldnotes-sentence"
                              data-hue={marks[index].hue}
                              data-sentence={index}
                              data-tag={marks[index].tag}
                              role="button"
                              tabIndex={rove === index ? 0 : -1}
                              onFocus={() => setRove(index)}
                              onKeyDown={(event) => onSentenceKeyDown(event, index)}
                            >
                              {SENTENCES[index].text}
                            </span>
                          </Fragment>
                        ))}
                    </p>
                  </div>
                ))}
                <GlassPanel
                  ref={menuRef}
                  aria-label="Tag this sentence"
                  className="fieldnotes-float fieldnotes-selection-menu"
                  data-state="closed"
                  id="fieldnotes-tag-menu"
                  role="menu"
                  variant="card"
                  onKeyDown={onMenuKeyDown}
                >
                  <p aria-hidden className="fieldnotes-selection-label">
                    {targets.length > 1 ? `Tag ${targets.length} sentences as` : 'Tag as'}
                  </p>
                  {TAGS.map((tag, index) => (
                    <button
                      key={tag}
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      aria-checked={current === tag}
                      className="fieldnotes-selection-item"
                      data-suggested={suggested === tag ? '' : undefined}
                      data-tag={tag}
                      role="menuitemradio"
                      tabIndex={-1}
                      type="button"
                      onClick={() => applyTag(tag, targetsRef.current)}
                    >
                      <span aria-hidden className="fieldnotes-tag-dot" />
                      <span className="fieldnotes-selection-name">{TAG_NAMES[tag]}</span>
                      <span className="fieldnotes-selection-hint">Suggested</span>
                      <kbd aria-hidden>{index + 1}</kbd>
                      <Icon className="fieldnotes-selection-check" name="check" />
                    </button>
                  ))}
                  <div className="fieldnotes-selection-rule" hidden={!anyTagged} role="separator" />
                  <button
                    ref={(element) => {
                      itemRefs.current[TAGS.length] = element;
                    }}
                    className="fieldnotes-selection-item fieldnotes-selection-quiet"
                    hidden={!anyTagged}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                    onClick={removeFromMenu}
                  >
                    <Icon name="close" />
                    <span>Remove tag</span>
                  </button>
                </GlassPanel>
              </div>
            </div>
            <div className="fieldnotes-dock">
              <GlassPanel
                aria-hidden
                className="fieldnotes-float fieldnotes-dock-tally"
                lens={false}
                variant="pill"
              >
                {TAGS.map((tag) => (
                  <GlassBadge
                    key={tag}
                    ref={(element) => {
                      if (element) dockRefs.current.set(tag, element);
                      else dockRefs.current.delete(tag);
                    }}
                    className="fieldnotes-badge"
                    data-tag={tag}
                    dot
                  >
                    {DOCK_NAMES[tag]} <b>{countOf(tag)}</b>
                  </GlassBadge>
                ))}
              </GlassPanel>
            </div>
          </div>
          <div className="fieldnotes-board-wrap" id="board">
            <div aria-hidden className="fieldnotes-piece fieldnotes-board-note">
              <span className="fieldnotes-hand fieldnotes-hand-small">
                confirm with P02 before Thursday
              </span>
            </div>
            <div aria-hidden className="fieldnotes-piece fieldnotes-scrap fieldnotes-board-card" />
            <GlassPanel
              aria-labelledby="fieldnotes-board-title"
              className="fieldnotes-pane fieldnotes-board"
              lens
              role="region"
              variant="card"
            >
              <div className="fieldnotes-board-head">
                <div>
                  <h3 className="fieldnotes-board-title" id="fieldnotes-board-title">
                    Insights board
                  </h3>
                  <p className="fieldnotes-board-sub">Month-end close · 7 interviews</p>
                </div>
                {tagged.length ? (
                  <GlassButton className="fieldnotes-button-sm" size="sm" onClick={clearBoard}>
                    Clear
                  </GlassButton>
                ) : null}
              </div>
              <div aria-hidden className="fieldnotes-tally">
                {TAGS.map((tag) => (
                  <GlassBadge key={tag} className="fieldnotes-badge" data-tag={tag} dot>
                    {BOARD_NAMES[tag]} <b>{countOf(tag)}</b>
                  </GlassBadge>
                ))}
              </div>
              {moments.length ? (
                <GlassScrollArea className="fieldnotes-moments" viewportProps={{ ref: listRef }}>
                  <ul aria-label="Tagged moments" className="fieldnotes-moments-list">
                    {moments.map((moment) => {
                      const sentence = SENTENCES[moment.sentence];

                      return (
                        <li
                          key={moment.key}
                          ref={(element) => {
                            if (element) momentRefs.current.set(moment.key, element);
                            else momentRefs.current.delete(moment.key);
                          }}
                          className="fieldnotes-moment"
                          data-leaving={moment.leaving ? '' : undefined}
                          data-tag={moment.tag}
                        >
                          <p className="fieldnotes-moment-quote">“{sentence.text}”</p>
                          <p className="fieldnotes-moment-meta">
                            <i aria-hidden />
                            {TAG_NAMES[moment.tag]} · P07 · {sentence.time}
                          </p>
                          <button
                            aria-label={`Remove tag from “${shorten(sentence.text)}”`}
                            className="fieldnotes-moment-remove"
                            type="button"
                            onClick={() => untag([moment.sentence], 'Tag removed.')}
                          >
                            <Icon name="close" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </GlassScrollArea>
              ) : (
                <p className="fieldnotes-board-empty">
                  Nothing on the board yet. Tag a sentence and it lands here, with who said it and
                  when.
                </p>
              )}
              <div className="fieldnotes-patterns">
                <div className="fieldnotes-patterns-head">
                  <h4>Patterns</h4>
                  <span>across this study</span>
                </div>
                {themes.size ? (
                  <ul className="fieldnotes-pattern-list">
                    {PATTERNS.flatMap((pattern) => {
                      if (!themes.has(pattern.theme)) return [];
                      const isConfirmed = confirmed.includes(pattern.theme);

                      return [
                        <li key={pattern.theme} className="fieldnotes-pattern">
                          <div className="fieldnotes-pattern-top">
                            <p className="fieldnotes-pattern-title">{pattern.title}</p>
                            <span className="fieldnotes-pattern-count">
                              <b>{pattern.count}</b> of 7
                            </span>
                          </div>
                          <div className="fieldnotes-pattern-foot">
                            <span aria-hidden className="fieldnotes-pattern-dots">
                              {PARTICIPANTS.map((participant) => (
                                <i
                                  key={participant}
                                  data-new={participant === 'P07' ? '' : undefined}
                                  data-on={pattern.seen.includes(participant) ? '' : undefined}
                                  title={participant}
                                />
                              ))}
                            </span>
                            <button
                              aria-pressed={isConfirmed}
                              className="fieldnotes-pattern-confirm"
                              type="button"
                              onClick={() =>
                                setConfirmed((current) =>
                                  isConfirmed
                                    ? current.filter((theme) => theme !== pattern.theme)
                                    : [...current, pattern.theme],
                                )
                              }
                            >
                              {isConfirmed ? 'Confirmed' : 'Confirm'}
                            </button>
                          </div>
                        </li>,
                      ];
                    })}
                  </ul>
                ) : (
                  <p className="fieldnotes-patterns-empty">
                    When a moment you tag matches ones from earlier interviews, a pattern appears
                    here.
                  </p>
                )}
              </div>
              <p aria-live="polite" className="fieldnotes-sr-only">
                {announcement}
              </p>
            </GlassPanel>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Flies a copy of a tagged sentence from the transcript to its card, or to the docked tally when
 * the card is off screen, as long as both ends are in view.
 */
function fly(
  root: HTMLElement,
  flight: Flight,
  card: HTMLLIElement,
  chip: HTMLElement | undefined,
  spring: string,
) {
  const { from } = flight;

  if (from.bottom < 0 || from.top > window.innerHeight) return;
  let to = card.getBoundingClientRect();
  let landing: HTMLElement = card;

  if (!onScreen(to)) {
    const box = chip?.getBoundingClientRect();

    if (!chip || !box || !onScreen(box)) return;
    to = box;
    landing = chip;
  }

  const ghost = document.createElement('div');

  ghost.className = 'fieldnotes-ghost';
  ghost.dataset.tag = flight.tag;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = flight.text;
  ghost.style.left = `${from.left}px`;
  ghost.style.top = `${from.top}px`;
  ghost.style.width = `${Math.max(Math.min(from.width, 520), 140)}px`;
  root.append(ghost);

  const scale = to.width / ghost.offsetWidth;
  const dx = to.left - from.left;
  const dy = to.top - from.top;

  if (landing === card) card.dataset.incoming = '';

  ghost
    .animate(
      [
        { transform: 'none' },
        {
          transform: `translate(${dx * 0.42}px, ${dy * 0.42 - 56}px) rotate(-2.5deg) scale(${(1 + scale) / 2})`,
          offset: 0.48,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      ],
      { duration: 720, delay: flight.delay, easing: EASE_OUT, fill: 'both' },
    )
    .finished.then(
      () => {
        ghost.remove();
        delete card.dataset.incoming;
        landing.animate([{ transform: 'translateY(-4px)' }, { transform: 'none' }], {
          duration: 420,
          easing: spring,
        });
      },
      () => ghost.remove(),
    );
}
