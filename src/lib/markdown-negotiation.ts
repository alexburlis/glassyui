/** Honour explicit Markdown preferences without treating a browser's wildcard as an opt-in. */
export function prefersMarkdown(accept: string | null) {
  let markdownQuality = 0;
  let htmlQuality = 0;
  let htmlSpecificity = -1;

  for (const range of (accept ?? '').split(',')) {
    const [value, ...parameters] = range.trim().toLowerCase().split(';');
    const mediaType = value.trim();
    const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
    const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;

    if (!Number.isFinite(quality) || quality < 0 || quality > 1) continue;

    if (mediaType === 'text/markdown') markdownQuality = Math.max(markdownQuality, quality);

    const specificity =
      mediaType === 'text/html' ? 2 : mediaType === 'text/*' ? 1 : mediaType === '*/*' ? 0 : -1;

    if (specificity < 0) continue;

    if (specificity > htmlSpecificity) {
      htmlSpecificity = specificity;
      htmlQuality = quality;
    } else if (specificity === htmlSpecificity) {
      htmlQuality = Math.max(htmlQuality, quality);
    }
  }

  return markdownQuality > 0 && markdownQuality >= htmlQuality;
}
