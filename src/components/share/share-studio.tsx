'use client';

import clsx from 'clsx';
import { ComponentDemo, ReleaseFeedbackProvider } from '@/components/docs/component-demos';
import { BrandMark } from '@/components/site/app-icons';
import { CopyChip } from '@/components/site/copy-chip';
import { HomePhone } from '@/components/site/home-phone';
import { INSTALL_COMMAND } from '@/components/site/install-command';

/** A live demo in a card, magnified by `zoom`. */
type StageSpec = { id: string; zoom: number };

export type ShareCardProps = {
  /** A small line in the link colour above the title. */
  eyebrow?: string;
  title: string;
  /** A second line that steps back to the tertiary colour, as the site's headlines do. */
  second?: string;
  /** A short line under the title: the platforms a component ships for. */
  detail?: string;
  stage?: StageSpec;
  mosaic?: StageSpec[];
};

// The stage's place in the card, in card pixels. It bleeds off the right edge.
const STAGE = { width: 640, height: 550 };

const MOSAIC_GAP = 12;

/** The title's size from its longest line, so every title fits the copy column. */
function titleSize(lines: string[]) {
  const longest = Math.max(...lines.map((line) => line.length));

  if (longest <= 12) return 76;

  if (longest <= 14) return 68;

  if (longest <= 17) return 60;

  return 54;
}

/**
 * A live demo drawn in its own frame, so its overlays open inside the stage, magnified by the
 * frame's zoom: the page inside lays out at the stage size divided by the zoom.
 */
function Stage({
  spec,
  width,
  height,
  className,
}: {
  spec: StageSpec;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <div className={clsx('share-stage', className)} style={{ height, width }}>
      <iframe
        data-share-stage={spec.id}
        src={`/share-studio/stage/${spec.id}`}
        style={{ height: height / spec.zoom, width: width / spec.zoom, zoom: spec.zoom }}
        title={spec.id}
      />
    </div>
  );
}

/** A share card at link-preview size: the lockup, the copy on clean ivory and the product. */
export function ShareCard({ eyebrow, title, second, detail, stage, mosaic }: ShareCardProps) {
  const size = titleSize(second ? [title, second] : [title]);
  const tileWidth = (STAGE.width - MOSAIC_GAP) / 2;
  const tileHeight = (STAGE.height - MOSAIC_GAP) / 2;

  return (
    <main className="share-card" data-share-card id="main-content">
      <div className="share-lockup">
        <BrandMark className="share-mark" />
        <span>Glassy UI</span>
      </div>
      <div className="share-copy">
        {eyebrow ? <p className="share-eyebrow">{eyebrow}</p> : null}
        <h1 className="share-title" style={{ fontSize: size }}>
          {title}
          {second ? <span className="share-second">{second}</span> : null}
        </h1>
        {detail ? <p className="share-detail">{detail}</p> : null}
      </div>
      {stage ? <Stage height={STAGE.height} spec={stage} width={STAGE.width} /> : null}
      {mosaic ? (
        <div
          className="share-mosaic"
          style={{ gap: MOSAIC_GAP, height: STAGE.height, width: STAGE.width }}
        >
          {mosaic.map((tile) => (
            <Stage
              key={tile.id}
              className="share-stage--tile"
              height={tileHeight}
              spec={tile}
              width={tileWidth}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}

/** One demo on the docs' wallpaper stage, filling the frame a card draws it in. */
export function ShareStage({ id }: { id: string }) {
  return (
    <main className="share-stage-page" data-share-stage-page={id} id="main-content">
      <div className="docs-preview share-stage-fill">
        {id === 'install' ? <CopyChip command={INSTALL_COMMAND} /> : null}
        {id === 'phone' ? <HomePhone /> : null}
        {id !== 'install' && id !== 'phone' ? (
          <ReleaseFeedbackProvider>
            <ComponentDemo id={id} />
          </ReleaseFeedbackProvider>
        ) : null}
      </div>
    </main>
  );
}
