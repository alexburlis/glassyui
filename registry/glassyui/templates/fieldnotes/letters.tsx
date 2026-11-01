'use client';

import {
  GlassAccordion,
  GlassAccordionContent,
  GlassAccordionItem,
  GlassAccordionTrigger,
} from '../../glass-accordion';
import { Folio, slotted } from './parts';

const LETTERS = [
  [
    {
      question:
        'Our interviews are full of health details and names. Where does all of this live, and who can read it?',
      from: 'A researcher in Leeds',
      reply:
        'Your workspace lives in the EU or the US, your choice, encrypted at rest and in transit. Names, emails and card numbers are redacted from transcripts before anyone but the interviewer sees them, and recordings can delete themselves after a set number of days.',
    },
    {
      question:
        'We already keep everything in a carefully named shared drive. Why would we move it?',
      from: 'Two researchers in Lisbon',
      reply:
        'You don’t have to. Connect the folder and Fieldnotes reads new sessions as they land. The drive stays your archive. Fieldnotes becomes the place where moments are tagged, found and shared.',
    },
    {
      question: 'Will it tag my interviews for me? I’m not sure I want it to.',
      from: 'A sceptic in Montréal',
      reply:
        'It suggests and you decide. Suggestions are marked as suggestions, and nothing is shared until a researcher confirms it. Most teams treat them as a second pair of ears on long sessions.',
    },
  ],
  [
    {
      question: 'Do our product managers need a paid seat to read what we find?',
      from: 'A team of one in Austin',
      reply:
        'No. Readers are free and unlimited. They can read insight pages, play clips and leave comments. You pay only for the people who tag.',
    },
    {
      question: 'What happens to our work if we leave?',
      from: 'A head of research in Utrecht',
      reply:
        'You take it with you. Export transcripts, tags, patterns and clips at any time as plain text, CSV, JSON and video files. Cancelling is a button, not a call.',
    },
    {
      question: 'Which recordings can it read?',
      from: 'A researcher on a train',
      reply:
        'Audio and video files up to four hours, uploaded directly or from a connected folder, in 31 languages. If your meeting tool can save a recording, Fieldnotes can read it.',
    },
  ],
];

export function Letters() {
  return (
    <section
      aria-labelledby="fieldnotes-letters-title"
      className="fieldnotes-section fieldnotes-letters"
      id="letters"
    >
      <div className="fieldnotes-wrap">
        <Folio name="Correspondence" page="12" />
        <div className="fieldnotes-section-head">
          <h2 className="fieldnotes-h2" data-reveal="focus" id="fieldnotes-letters-title">
            Letters to the <em>editor</em>.
          </h2>
          <p className="fieldnotes-dek">
            Questions readers sent us this month, answered by the founder.
          </p>
        </div>
        <GlassAccordion className="fieldnotes-letters-list" type="multiple">
          {LETTERS.map((column) => (
            <div key={column[0].from} className="fieldnotes-letters-column">
              {column.map((letter) => (
                <GlassAccordionItem key={letter.from} {...slotted} value={letter.from}>
                  <article className="fieldnotes-lte">
                    <p className="fieldnotes-lte-salute">Dear editor,</p>
                    {/* The letter itself is the heading and the button that opens its reply. */}
                    <GlassAccordionTrigger className="fieldnotes-lte-toggle">
                      <span className="fieldnotes-lte-question">{letter.question}</span>
                      <span className="fieldnotes-lte-from">{letter.from}</span>
                      <span className="fieldnotes-lte-replies">The editor replies</span>
                    </GlassAccordionTrigger>
                    <GlassAccordionContent className="fieldnotes-lte-reply">
                      <p>{letter.reply}</p>
                    </GlassAccordionContent>
                  </article>
                </GlassAccordionItem>
              ))}
            </div>
          ))}
        </GlassAccordion>
      </div>
    </section>
  );
}
