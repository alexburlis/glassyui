import { Count, Folio, PullQuote } from './parts';

const STATS = [
  { label: 'researchers keep their interviews here', value: 4200 },
  { label: 'moments tagged so far', value: 1.3, decimals: 1, unit: 'million' },
  { label: 'median time to find a quote', value: 38, unit: 'seconds' },
  { label: 'free readers for every researcher', value: 11 },
];

export function Field() {
  return (
    <section
      aria-labelledby="fieldnotes-field-title"
      className="fieldnotes-section fieldnotes-field"
      id="field"
    >
      <div className="fieldnotes-wrap">
        <Folio name="From the field" page="09" />
        <h2 className="fieldnotes-h2" data-reveal="focus" id="fieldnotes-field-title">
          From the <em>field</em>.
        </h2>
        <div className="fieldnotes-field-lead">
          <PullQuote
            initials="PL"
            large
            name="Priya Lindqvist"
            quote="I stopped writing readout decks. Now I send one page, and people actually press play on the quotes."
            role="Research lead, Larkmere"
            tone="sage"
          />
        </div>
        <div className="fieldnotes-field-pair">
          <PullQuote
            initials="TW"
            name="Tomasz Wren"
            quote="Our designers search Fieldnotes before they ask me. That was the whole point."
            role="Senior researcher, Tidelock"
            tone="ochre"
          />
          <PullQuote
            initials="AO"
            name="Adaeze Okafor"
            quote="In our first week we found the same complaint in two studies run nineteen months apart."
            role="Head of research, Fernhaven"
            tone="plum"
          />
        </div>
        <dl className="fieldnotes-stats">
          {STATS.map((stat) => (
            <div key={stat.label} className="fieldnotes-stat">
              <dt>{stat.label}</dt>
              <dd>
                <Count decimals={stat.decimals} to={stat.value} />
                {stat.unit ? <small> {stat.unit}</small> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
