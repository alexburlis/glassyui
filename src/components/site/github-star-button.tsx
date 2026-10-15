import { GlassButton } from '@/components/liquid';
import { Glyph } from '@/components/site/glyphs';
import { GITHUB } from '@/lib/site-links';

/** The hero's secondary action: one outline star, drawn at the label's stroke weight. */
export function GithubStarButton() {
  return (
    <GlassButton asChild size="lg" variant="primary">
      <a className="github-star-button" href={GITHUB.repository}>
        <Glyph className="github-star-button-glyph">
          <path
            d="M12 3.15L14.59 9.37L21.3 9.91L16.19 14.29L17.75 20.84L12 17.33L6.25 20.84L7.81 14.29L2.7 9.91L9.41 9.37Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.9"
          />
        </Glyph>
        Star on GitHub
      </a>
    </GlassButton>
  );
}
