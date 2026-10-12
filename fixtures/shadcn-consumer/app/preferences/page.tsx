'use client';

import { useState } from 'react';
import { GlassButton } from '@/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogTitle,
  GlassDialogTrigger,
} from '@/components/glassyui/glass-dialog';
import { GlassInput } from '@/components/glassyui/glass-input';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { PreferencesProvider, usePreferences } from '@/components/glassyui/glass-provider';
import { GlassDrop, GlassScene } from '@/components/glassyui/glass-scene';

const backdrop = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240"><path fill="#183c61" d="M0 0h640v240H0z"/><path fill="#ffdd66" d="M0 30h640v30H0zM0 90h640v30H0zM0 150h640v30H0z"/></svg>')}`;

function TransparencyChoices() {
  const { setPreferences } = usePreferences();

  return (
    <div>
      <button onClick={() => setPreferences({ reduceTransparency: false })} type="button">
        Use glass
      </button>
      <button onClick={() => setPreferences({ reduceTransparency: true })} type="button">
        Use opaque surfaces
      </button>
    </div>
  );
}

function MaterialSamples() {
  return (
    <>
      <GlassPanel
        data-testid="transparency-panel"
        className="w-full p-8 before:bg-sky-500/30"
        refraction="strong"
        refractionBackground={<div className="h-full w-full bg-sky-500" />}
      >
        Installed material
      </GlassPanel>
      <GlassInput aria-label="Installed input" placeholder="Type here" />
      <GlassButton>Installed glass button</GlassButton>
      <GlassDialog>
        <GlassDialogTrigger asChild>
          <button type="button">Open transparency dialog</button>
        </GlassDialogTrigger>
        <GlassDialogContent className="bg-sky-500/30">
          <GlassDialogTitle>Installed transparency dialog</GlassDialogTitle>
        </GlassDialogContent>
      </GlassDialog>
      <GlassScene backdrop={backdrop} data-testid="transparency-scene" className="h-60 w-full">
        <GlassPanel className="absolute left-8 top-8 p-8">Installed scene panel</GlassPanel>
        <GlassDrop className="absolute right-8 top-8 h-24 w-24" />
      </GlassScene>
    </>
  );
}

export default function InstalledTransparencyFixture() {
  const [provided, setProvided] = useState(false);

  return (
    <main className="mx-auto grid max-w-xl gap-6 p-8">
      <h1>Installed transparency preferences</h1>
      {provided ? (
        <PreferencesProvider>
          <TransparencyChoices />
          <MaterialSamples />
        </PreferencesProvider>
      ) : (
        <>
          <button onClick={() => setProvided(true)} type="button">
            Enable preference controls
          </button>
          <MaterialSamples />
        </>
      )}
    </main>
  );
}
