'use client';

import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import type { PhoneTheme } from './frames';
import { FPS, OPENER } from './frames';
import { Opener } from './opener';

export { openerHeader } from './timeline';

type OpenerStageProps = {
  /** The frame it starts on. */
  from: number;
  height: number;
  onPlayer: (player: PlayerRef | null) => void;
  /** Faster once the visitor skips ahead. */
  rate: number;
  /** The page's appearance, which the phone's titanium follows. */
  theme: PhoneTheme;
  width: number;
};

/**
 * The opener's Remotion player, at the stage's own size so the composition lays out for the
 * screen it fills. The page loads this module after its first paint and plays it through once
 * each time the opener runs.
 */
export default function OpenerStage({
  from,
  height,
  onPlayer,
  rate,
  theme,
  width,
}: OpenerStageProps) {
  return (
    <Player
      acknowledgeRemotionLicense
      clickToPlay={false}
      component={Opener}
      compositionHeight={height}
      compositionWidth={width}
      controls={false}
      doubleClickToFullscreen={false}
      durationInFrames={OPENER.durationInFrames}
      fps={FPS}
      initialFrame={from}
      inputProps={{ theme }}
      moveToBeginningWhenEnded={false}
      // It has no sound. Unmuted, the player starts an AudioContext on play and waits for it,
      // which a browser holds until the visitor has clicked or pressed a key.
      initiallyMuted
      numberOfSharedAudioTags={0}
      playbackRate={rate}
      ref={onPlayer}
      spaceKeyToPlayOrPause={false}
      style={{ height: '100%', width: '100%' }}
    />
  );
}
