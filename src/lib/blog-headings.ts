/** The parts of a Markdown syntax tree node that headings need. */
type MarkdownNode = {
  type: string;
  depth?: number;
  value?: string;
  children?: MarkdownNode[];
  /** What the node becomes in HTML; remark keeps any properties other plugins set. */
  data?: { hProperties?: { id?: string } };
};

export type BlogHeading = { href: string; title: string };

/** A heading's words, with inline code as its plain text and links as their label. */
function headingText(node: MarkdownNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';

  return (node.children ?? []).map(headingText).join('');
}

/**
 * Lowercase letters and digits joined by hyphens: "Draw `GlassView`" becomes "draw-glassview". An
 * id starts with a letter, so "2026 browser support" becomes "section-2026-browser-support" and
 * still works as a CSS selector.
 */
function slugify(text: string) {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) return 'section';

  return /^[0-9]/.test(slug) ? `section-${slug}` : slug;
}

/**
 * A remark plugin that gives every h2 and h3 an id and adds each h2 to `toc` in order, so the table
 * of contents and the headings it points at come from the same pass. Ids never repeat, within the
 * article or against `reserved`, the ids the page already uses.
 */
export function remarkHeadingIds(toc: BlogHeading[], reserved: readonly string[]) {
  return () => (tree: MarkdownNode) => {
    const used = new Set(reserved);

    const visit = (node: MarkdownNode) => {
      if (node.type === 'heading' && (node.depth === 2 || node.depth === 3)) {
        const title = headingText(node).replace(/\s+/g, ' ').trim();
        const base = slugify(title);
        let id = base;

        for (let count = 2; used.has(id); count += 1) id = `${base}-${count}`;
        used.add(id);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };

        if (node.depth === 2) toc.push({ href: `#${id}`, title });

        return;
      }

      node.children?.forEach(visit);
    };

    visit(tree);
  };
}
