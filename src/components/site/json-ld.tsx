type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Structured data for search engines. `<` is escaped, so the JSON can never close the script tag. */
export function JsonLd({ data }: { data: { [key: string]: JsonValue } }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
      type="application/ld+json"
    />
  );
}
