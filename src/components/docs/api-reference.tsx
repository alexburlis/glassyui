import type { ComponentApiPart } from './component-docs-data';

type ApiReferenceProps = {
  parts: ComponentApiPart[];
  types?: string[];
  accessibility?: string;
};

const LITERAL = /^(?:'[^']*'|-?\d+(?:\.\d+)?|true|false|null|undefined|\[.*\]|\{.*\})$/;

/** A default that is a value reads as code; one described in words, such as a preference, does not. */
function isLiteral(value: string) {
  return value.split(' / ').every((part) => LITERAL.test(part));
}

function anchor(name: string) {
  return `api-${name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

/**
 * A component's API as one props table per exported part: what Glassy UI adds or changes, with
 * what else each part accepts underneath. Below 640px each row stacks into a small card.
 */
export function ApiReference({ accessibility, parts, types }: ApiReferenceProps) {
  return (
    <div className="docs-api">
      {parts.map((part) => (
        <div className="docs-api-part" key={part.name}>
          <h3 id={anchor(part.name)}>
            <code>{part.name}</code>
          </h3>
          {part.description ? <p>{part.description}</p> : null}
          {part.props.length > 0 ? (
            <div className="docs-props">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Prop</th>
                    <th scope="col">Type</th>
                    <th scope="col">Default</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {part.props.map((prop) => (
                    <tr key={prop.name}>
                      <th scope="row">
                        <code>{prop.name}</code>
                        {prop.required ? (
                          <span className="docs-prop-required">Required</span>
                        ) : null}
                      </th>
                      <td data-label="Type">
                        <code>{prop.type}</code>
                      </td>
                      <td data-label="Default">
                        {prop.default === '—' ? (
                          <>
                            <span aria-hidden="true" className="docs-prop-none">
                              —
                            </span>
                            <span className="sr-only">None</span>
                          </>
                        ) : isLiteral(prop.default) ? (
                          <code>{prop.default}</code>
                        ) : (
                          prop.default
                        )}
                      </td>
                      <td>{prop.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {part.extends ? <p className="docs-api-extends">Also accepts {part.extends}.</p> : null}
        </div>
      ))}
      {types?.length || accessibility ? (
        <dl className="docs-api-facts">
          {types?.length ? (
            <div>
              <dt>Types</dt>
              <dd>
                {types.map((type) => (
                  <code key={type}>{type}</code>
                ))}
              </dd>
            </div>
          ) : null}
          {accessibility ? (
            <div>
              <dt>Accessibility</dt>
              <dd>{accessibility}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
