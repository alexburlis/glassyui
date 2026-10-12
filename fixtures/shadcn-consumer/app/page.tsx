'use client';

import { useRef, useState } from 'react';
import { SceneExample } from '@/components/examples/scene-example';
import { LensExample } from '@/components/examples/lens-example';
import { DockExample } from '@/components/examples/dock-example';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogTitle,
  GlassDialogTrigger,
} from '@/components/glassyui/glass-dialog';
import {
  GlassMenu,
  GlassMenuContent,
  GlassMenuItem,
  GlassMenuTrigger,
} from '@/components/glassyui/glass-menu';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { GlassHeader } from '@/components/glassyui/glass-header';
import { GlassPhoneDuo } from '@/components/glassyui/glass-phone-duo';
import { GlassSheet, GlassSheetContent, GlassSheetTitle } from '@/components/glassyui/glass-sheet';

const duoScreen = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="890" height="626"><defs><linearGradient id="g"><stop stop-color="#11223a"/><stop offset="1" stop-color="#447eb0"/></linearGradient></defs><path fill="url(#g)" d="M0 0h890v626H0z"/><path fill="#00ff00" d="M0 180h890v18H0z"/><text x="80" y="380" fill="white" font-size="60">One continuous screen</text></svg>')}`;

const duoCover = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="466" height="678"><path fill="#183c61" d="M0 0h466v678H0z"/><text x="35" y="330" fill="white" font-size="48">Cover screen</text></svg>')}`;

export default function InstalledRegistryFixture() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [duoOpen, setDuoOpen] = useState(true);
  const [duoAngle, setDuoAngle] = useState<number>();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <main className="grid min-h-screen place-items-center p-8">
      <GlassHeader
        brand={<a href="#installed-home">Installed header</a>}
        data-installed-example="header"
        position="static"
      >
        <a href="#installed-components">Installed components</a>
      </GlassHeader>
      <section id="installed-components">Installed components target</section>
      <GlassPanel data-testid="consumer-override" className="rounded-none p-4 before:bg-sky-500/30">
        Consumer utilities override library defaults
      </GlassPanel>
      <GlassDialog>
        <GlassDialogTrigger asChild>
          <button type="button">Open installed dialog</button>
        </GlassDialogTrigger>
        <GlassDialogContent className="bg-sky-500/30">
          <GlassDialogTitle>Installed Glassy UI dialog</GlassDialogTitle>
        </GlassDialogContent>
      </GlassDialog>
      <GlassMenu>
        <GlassMenuTrigger asChild>
          <button ref={menuTriggerRef} type="button">
            Open installed menu
          </button>
        </GlassMenuTrigger>
        <GlassMenuContent>
          <GlassMenuItem onSelect={() => setSheetOpen(true)}>Open installed sheet</GlassMenuItem>
        </GlassMenuContent>
      </GlassMenu>
      <GlassSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* The menu item that opened the sheet is gone, so focus returns to its menu button. */}
        <GlassSheetContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            menuTriggerRef.current?.focus();
          }}
        >
          <GlassSheetTitle>Installed Glassy UI sheet</GlassSheetTitle>
        </GlassSheetContent>
      </GlassSheet>
      <section className="w-full max-w-xl" data-installed-example="scene">
        <SceneExample />
      </section>
      <section className="w-full max-w-xl" data-installed-example="lens">
        <LensExample />
      </section>
      <section className="w-full max-w-xl" data-installed-example="dock">
        <DockExample />
      </section>
      <section className="grid w-full max-w-xl gap-4" data-installed-example="phone-duo">
        <GlassPhoneDuo
          angle={duoAngle}
          className="bg-white"
          coverAlt="Outer app screenshot"
          coverSrc={duoCover}
          open={duoOpen}
          screenAlt="Inner app screenshot"
          screenSrc={duoScreen}
        />
        <button
          onClick={() => {
            setDuoOpen(!duoOpen);
            setDuoAngle(undefined);
          }}
          type="button"
        >
          {duoOpen ? 'Close phone' : 'Open phone'}
        </button>
        <button onClick={() => setDuoAngle(120)} type="button">
          Pose hinge
        </button>
      </section>
    </main>
  );
}
