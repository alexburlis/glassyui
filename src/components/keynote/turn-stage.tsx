'use client';

import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import { FPS, TURN } from './frames';
import { Turn } from './turn';
import type { TurnProps } from './turn';

export { turnCaption } from './timeline';

type TurnStageProps = TurnProps & {
  height: number;
  onPlayer: (player: PlayerRef | null) => void;
  width: number;
};

/**
 * The turn's Remotion player, at the stage's own size. The page loads this module once the
 * keynote runs and scrubs the player by scroll; it never plays on its own.
 */
export default function TurnStage({ height, onPlayer, width, ...props }: TurnStageProps) {
  return (
    <Player
      acknowledgeRemotionLicense
      clickToPlay={false}
      component={Turn}
      compositionHeight={height}
      compositionWidth={width}
      controls={false}
      doubleClickToFullscreen={false}
      durationInFrames={TURN.durationInFrames}
      fps={FPS}
      inputProps={props}
      // It has no sound. Unmuted, the player starts an AudioContext on play and waits for it,
      // which a browser holds until the visitor has clicked or pressed a key.
      initiallyMuted
      numberOfSharedAudioTags={0}
      ref={onPlayer}
      spaceKeyToPlayOrPause={false}
      style={{ height: '100%', width: '100%' }}
    />
  );
}
