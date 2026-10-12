'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, RefObject } from 'react';
import {
  GlassButton,
  GlassDock,
  GlassDockItem,
  GlassDockSeparator,
  GlassMenu,
  GlassMenuCheckboxItem,
  GlassMenuContent,
  GlassMenuItem,
  GlassMenuLabel,
  GlassMenuRadioGroup,
  GlassMenuRadioItem,
  GlassMenuSeparator,
  GlassMenuShortcut,
  GlassMenuSub,
  GlassMenuSubContent,
  GlassMenuSubTrigger,
  GlassMenuTrigger,
  GlassPanel,
  GlassScene,
  GlassSegmentedControl,
  GlassSegmentedControlItem,
  GlassSheet,
  GlassSheetContent,
  GlassSheetDescription,
  GlassSheetTitle,
  GlassSheetTrigger,
  GlassSlider,
  GlassSwitch,
  usePreferences,
} from '@/components/liquid';
import { GLASS_THICKNESS } from '@/lib/liquid/preferences';
import { OPEN_SEARCH_EVENT } from './site-search';
import {
  BrandMark,
  CalendarIcon,
  FilesIcon,
  GalleryIcon,
  MailIcon,
  MapsIcon,
  MessagesIcon,
  MusicIcon,
  NotesIcon,
  SettingsIcon,
  WeatherIcon,
} from './app-icons';
import { Glyph, SpeakerGlyph, SunGlyph } from './glyphs';

type DeskStyle = CSSProperties & Record<'--desk-dim', string>;

type Wallpaper = 'vermilion' | 'tide' | 'ember' | 'lagoon';

const WALLPAPERS: Array<{ label: string; value: Wallpaper }> = [
  { label: 'Vermilion', value: 'vermilion' },
  { label: 'Tide', value: 'tide' },
  { label: 'Ember', value: 'ember' },
  { label: 'Lagoon', value: 'lagoon' },
];

const TRACKS = [
  {
    art: 'linear-gradient(140deg, #ffc9a9, #f04a28 58%, #60291f)',
    artist: 'Nuit Blanche',
    duration: 204,
    title: 'Glass Horizon',
  },
  {
    art: 'linear-gradient(140deg, #ffd166, #ff6b3d 55%, #a42714)',
    artist: 'The Rims',
    duration: 178,
    title: 'Specular',
  },
  {
    art: 'linear-gradient(140deg, #b2d6ff, #007aff 55%, #07394f)',
    artist: 'Refraction',
    duration: 252,
    title: 'Frosted Light',
  },
];

// The dock keeps four icons on phone-sized desks.
const DOCK_APPS: Array<{ icon: ReactNode; label: string; phone: boolean }> = [
  { icon: <FilesIcon />, label: 'Files', phone: false },
  { icon: <MailIcon />, label: 'Mail', phone: true },
  { icon: <MessagesIcon />, label: 'Messages', phone: true },
  { icon: <GalleryIcon />, label: 'Photos', phone: false },
  { icon: <NotesIcon />, label: 'Notes', phone: false },
  { icon: <CalendarIcon />, label: 'Calendar', phone: false },
  { icon: <MapsIcon />, label: 'Maps', phone: true },
  { icon: <WeatherIcon />, label: 'Weather', phone: false },
];

const POPULAR_COMPONENTS = [
  { href: '/components/glass-dock', label: 'Dock' },
  { href: '/components/glass-lens', label: 'Lens' },
  { href: '/components/glass-sheet', label: 'Sheet' },
  { href: '/components/glass-menu', label: 'Menu' },
];

const LAUNCH_BOUNCE = [
  { translate: '0 0' },
  { translate: '0 -38%', offset: 0.25 },
  { translate: '0 0', offset: 0.5 },
  { translate: '0 -16%', offset: 0.72 },
  { translate: '0 0' },
];

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const PlayGlyph = () => (
  <Glyph>
    <path d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10-6.4a1 1 0 0 0 0-1.8l-10-6.4A1 1 0 0 0 8 5.6Z" />
  </Glyph>
);

const PauseGlyph = () => (
  <Glyph>
    <rect height="14" rx="1.4" width="4.2" x="6.4" y="5" />
    <rect height="14" rx="1.4" width="4.2" x="13.4" y="5" />
  </Glyph>
);

const PreviousGlyph = () => (
  <Glyph>
    <path d="M11.6 6.3v11.4a.8.8 0 0 1-1.3.6L3.2 12.6a.8.8 0 0 1 0-1.2l7.1-5.7a.8.8 0 0 1 1.3.6Zm9 0v11.4a.8.8 0 0 1-1.3.6l-7.1-5.7a.8.8 0 0 1 0-1.2l7.1-5.7a.8.8 0 0 1 1.3.6Z" />
  </Glyph>
);

const NextGlyph = () => (
  <Glyph>
    <path d="M12.4 6.3v11.4a.8.8 0 0 0 1.3.6l7.1-5.7a.8.8 0 0 0 0-1.2l-7.1-5.7a.8.8 0 0 0-1.3.6Zm-9 0v11.4a.8.8 0 0 0 1.3.6l7.1-5.7a.8.8 0 0 0 0-1.2L4.7 5.7a.8.8 0 0 0-1.3.6Z" />
  </Glyph>
);

const WifiGlyph = () => (
  <Glyph>
    <path
      d="M2.6 9.4a13.4 13.4 0 0 1 18.8 0M5.7 12.6a9 9 0 0 1 12.6 0M8.8 15.8a4.5 4.5 0 0 1 6.4 0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.2"
    />
    <circle cx="12" cy="19.2" r="1.8" />
  </Glyph>
);

const ConnectionsGlyph = () => (
  <Glyph>
    <circle cx="6" cy="12" fill="none" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="12" fill="none" r="3" stroke="currentColor" strokeWidth="2" />
    <path
      d="M9 12h6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </Glyph>
);

const SharingGlyph = () => (
  <Glyph>
    <circle cx="6" cy="12" fill="none" r="2.5" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="5" fill="none" r="2.5" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="19" fill="none" r="2.5" stroke="currentColor" strokeWidth="2" />
    <path
      d="m8.2 10.7 7.6-4.4m-7.6 7 7.6 4.4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </Glyph>
);

const BatteryGlyph = () => (
  <svg aria-hidden className="desk-status-battery" viewBox="0 0 30 14">
    <rect
      fill="none"
      height="12"
      rx="3.6"
      stroke="currentColor"
      strokeOpacity="0.45"
      width="25"
      x="0.5"
      y="1"
    />
    <rect fill="currentColor" height="8" rx="2" width="17" x="2.5" y="3" />
    <path d="M27.5 5v4a2 2 0 0 0 0-4Z" fill="currentColor" fillOpacity="0.45" />
  </svg>
);

type NowPlayingProps = {
  onPlayingChange: (playing: boolean) => void;
  playing: boolean;
};

function NowPlaying({ onPlayingChange, playing }: NowPlayingProps) {
  const [playback, setPlayback] = useState({ index: 0, position: 62 });
  const track = TRACKS[playback.index];

  const changeTrack = (step: number) => {
    setPlayback(({ index }) => ({
      index: (index + step + TRACKS.length) % TRACKS.length,
      position: 0,
    }));
  };

  useEffect(() => {
    if (!playing) return;

    // Past the end of a track, the next one starts from the top.
    const timer = window.setInterval(() => {
      setPlayback(({ index, position }) =>
        position + 1 > TRACKS[index].duration
          ? { index: (index + 1) % TRACKS.length, position: 0 }
          : { index, position: position + 1 },
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <GlassPanel className="desk-widget desk-now-playing" lens variant="card">
      <div className="desk-now-playing-head">
        <span aria-hidden className="desk-art" style={{ backgroundImage: track.art }} />
        <div className="desk-track">
          <p className="desk-track-title">{track.title}</p>
          <p className="desk-track-artist">{track.artist}</p>
        </div>
      </div>
      <GlassSlider
        aria-label="Playback position"
        className="desk-progress"
        max={track.duration}
        onValueChange={([position]) => setPlayback(({ index }) => ({ index, position }))}
        step={1}
        value={[playback.position]}
      />
      <div aria-hidden className="desk-times">
        <span>{formatTime(playback.position)}</span>
        <span>-{formatTime(track.duration - playback.position)}</span>
      </div>
      <div className="desk-transport">
        <GlassButton
          aria-label="Previous track"
          className="desk-transport-button"
          onClick={() => changeTrack(-1)}
          size="sm"
          variant="ghost"
        >
          <PreviousGlyph />
        </GlassButton>
        <GlassButton
          aria-label={playing ? 'Pause' : 'Play'}
          className="desk-transport-button desk-transport-button--main"
          onClick={() => onPlayingChange(!playing)}
          size="sm"
          variant="ghost"
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </GlassButton>
        <GlassButton
          aria-label="Next track"
          className="desk-transport-button"
          onClick={() => changeTrack(1)}
          size="sm"
          variant="ghost"
        >
          <NextGlyph />
        </GlassButton>
      </div>
    </GlassPanel>
  );
}

type ToggleRowProps = {
  checked: boolean;
  detail: string;
  glyph: ReactNode;
  label: string;
  onCheckedChange: (checked: boolean) => void;
};

function ToggleRow({ checked, detail, glyph, label, onCheckedChange }: ToggleRowProps) {
  const id = useId();

  return (
    <div className="desk-toggle">
      <span aria-hidden className="desk-toggle-glyph" data-on={checked}>
        {glyph}
      </span>
      <span className="desk-toggle-text">
        <label htmlFor={id}>{label}</label>
        <span>{checked ? detail : 'Off'}</span>
      </span>
      <GlassSwitch checked={checked} id={id} onCheckedChange={onCheckedChange} size="sm" />
    </div>
  );
}

type AppearanceControlProps = {
  className?: string;
  labelledBy: string;
};

/**
 * Changes the theme immediately while the selection bubble moves on the live page. Waiting
 * for the bubble and then crossfading page snapshots adds latency and freezes the control.
 */
function AppearanceControl({ className, labelledBy }: AppearanceControlProps) {
  const { preferences, setPreferences } = usePreferences();

  return (
    <GlassSegmentedControl
      aria-labelledby={labelledBy}
      className={className}
      onValueChange={(value) => setPreferences({ theme: value === 'light' ? 'light' : 'dark' })}
      value={preferences.theme}
    >
      <GlassSegmentedControlItem value="light">Light</GlassSegmentedControlItem>
      <GlassSegmentedControlItem value="dark">Dark</GlassSegmentedControlItem>
    </GlassSegmentedControl>
  );
}

type ControlCenterProps = {
  brightness: number;
  onBrightnessChange: (brightness: number) => void;
  onWifiChange: (wifi: boolean) => void;
  wifi: boolean;
};

function ControlCenter({ brightness, onBrightnessChange, onWifiChange, wifi }: ControlCenterProps) {
  const [connections, setConnections] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [volume, setVolume] = useState(60);
  const appearanceId = useId();

  return (
    <GlassPanel className="desk-widget desk-control-center" lens variant="card">
      <div className="desk-toggles">
        <ToggleRow
          checked={wifi}
          detail="Home"
          glyph={<WifiGlyph />}
          label="Wireless"
          onCheckedChange={onWifiChange}
        />
        <ToggleRow
          checked={connections}
          detail="On"
          glyph={<ConnectionsGlyph />}
          label="Devices"
          onCheckedChange={setConnections}
        />
        <ToggleRow
          checked={sharing}
          detail="Contacts only"
          glyph={<SharingGlyph />}
          label="Sharing"
          onCheckedChange={setSharing}
        />
      </div>
      <div className="desk-control">
        <span className="desk-control-label" id={appearanceId}>
          Appearance
        </span>
        <AppearanceControl className="desk-segmented" labelledBy={appearanceId} />
      </div>
      <div className="desk-control">
        <span aria-hidden className="desk-control-label">
          Display
        </span>
        <div className="desk-slider-row">
          <SunGlyph className="site-glyph site-glyph--small" />
          <GlassSlider
            aria-label="Display brightness"
            className="desk-slider"
            max={100}
            min={20}
            onValueChange={([value]) => onBrightnessChange(value)}
            value={[brightness]}
          />
          <SunGlyph />
        </div>
      </div>
      <div className="desk-control">
        <span aria-hidden className="desk-control-label">
          Sound
        </span>
        <div className="desk-slider-row">
          <SpeakerGlyph className="site-glyph site-glyph--small" loud={false} />
          <GlassSlider
            aria-label="Volume"
            className="desk-slider"
            max={100}
            onValueChange={([value]) => setVolume(value)}
            value={[volume]}
          />
          <SpeakerGlyph loud />
        </div>
      </div>
    </GlassPanel>
  );
}

type SettingsSheetProps = {
  onCloseAutoFocus: (event: Event) => void;
};

function SettingsSheet({ onCloseAutoFocus }: SettingsSheetProps) {
  const { preferences, setPreferences } = usePreferences();
  const id = useId();

  return (
    <GlassSheetContent
      className="desk-settings"
      closeLabel="Close settings"
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <GlassSheetTitle className="desk-settings-title">Settings</GlassSheetTitle>
      <GlassSheetDescription className="desk-settings-description">
        These apply to the whole site.
      </GlassSheetDescription>
      <div className="desk-settings-rows">
        <div className="desk-settings-row">
          <span id={`${id}appearance`}>Appearance</span>
          <AppearanceControl labelledBy={`${id}appearance`} />
        </div>
        <div className="desk-settings-row">
          <span id={`${id}material`}>Glass</span>
          <GlassSegmentedControl
            aria-labelledby={`${id}material`}
            onValueChange={(value) =>
              setPreferences({ mode: value === 'tinted' ? 'tinted' : 'clear' })
            }
            value={preferences.mode}
          >
            <GlassSegmentedControlItem value="clear">Clear</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="tinted">Tinted</GlassSegmentedControlItem>
          </GlassSegmentedControl>
        </div>
        <div className="desk-settings-row">
          <span id={`${id}thickness`}>Glass thickness</span>
          <div className="desk-settings-slider">
            <GlassSlider
              aria-labelledby={`${id}thickness`}
              max={GLASS_THICKNESS.max}
              min={GLASS_THICKNESS.min}
              onValueChange={([value]) => setPreferences({ thickness: value })}
              step={0.05}
              value={[preferences.thickness]}
            />
            <output aria-hidden className="desk-settings-value">
              {preferences.thickness.toFixed(2)}×
            </output>
          </div>
        </div>
        <div className="desk-settings-row">
          <label htmlFor={`${id}transparency`}>Reduce transparency</label>
          <GlassSwitch
            checked={preferences.reduceTransparency}
            id={`${id}transparency`}
            onCheckedChange={(checked) => setPreferences({ reduceTransparency: checked })}
          />
        </div>
        <div className="desk-settings-row">
          <label htmlFor={`${id}motion`}>Reduce motion</label>
          <GlassSwitch
            checked={preferences.reduceMotion}
            id={`${id}motion`}
            onCheckedChange={(checked) => setPreferences({ reduceMotion: checked })}
          />
        </div>
      </div>
    </GlassSheetContent>
  );
}

type MenuBarProps = {
  appMenuRef: RefObject<HTMLButtonElement | null>;
  onOpenSettings: () => void;
  onShowDockChange: (show: boolean) => void;
  onShowWidgetsChange: (show: boolean) => void;
  onWallpaperChange: (wallpaper: Wallpaper) => void;
  showDock: boolean;
  showWidgets: boolean;
  wallpaper: Wallpaper;
  wifi: boolean;
};

function MenuBar({
  appMenuRef,
  onOpenSettings,
  onShowDockChange,
  onShowWidgetsChange,
  onWallpaperChange,
  showDock,
  showWidgets,
  wallpaper,
  wifi,
}: MenuBarProps) {
  const searchWanted = useRef(false);

  return (
    <div className="desk-menubar">
      <div className="desk-menubar-menus">
        <GlassMenu>
          <GlassMenuTrigger ref={appMenuRef} className="desk-menubar-item desk-menubar-item--app">
            <BrandMark className="desk-menubar-mark" />
            Glassy UI
          </GlassMenuTrigger>
          <GlassMenuContent align="start" sideOffset={6}>
            <GlassMenuItem asChild>
              <Link href="/docs">About Glassy UI</Link>
            </GlassMenuItem>
            <GlassMenuSeparator />
            <GlassMenuItem onSelect={onOpenSettings}>Settings…</GlassMenuItem>
          </GlassMenuContent>
        </GlassMenu>
        <GlassMenu>
          <GlassMenuTrigger className="desk-menubar-item">View</GlassMenuTrigger>
          <GlassMenuContent align="start" sideOffset={6}>
            <GlassMenuCheckboxItem checked={showWidgets} onCheckedChange={onShowWidgetsChange}>
              Show Widgets
            </GlassMenuCheckboxItem>
            <GlassMenuCheckboxItem checked={showDock} onCheckedChange={onShowDockChange}>
              Show Dock
            </GlassMenuCheckboxItem>
            <GlassMenuSeparator />
            <GlassMenuLabel>Wallpaper</GlassMenuLabel>
            <GlassMenuRadioGroup
              onValueChange={(value) => {
                const next = WALLPAPERS.find((item) => item.value === value);

                if (next) onWallpaperChange(next.value);
              }}
              value={wallpaper}
            >
              {WALLPAPERS.map((item) => (
                <GlassMenuRadioItem key={item.value} value={item.value}>
                  {item.label}
                </GlassMenuRadioItem>
              ))}
            </GlassMenuRadioGroup>
          </GlassMenuContent>
        </GlassMenu>
        <GlassMenu>
          <GlassMenuTrigger className="desk-menubar-item">Go</GlassMenuTrigger>
          <GlassMenuContent
            align="start"
            onCloseAutoFocus={() => {
              // The menu has closed and is handing focus back to "Go". The search opens after that,
              // so it remembers "Go" as the place to return to, however slow the frame was.
              if (!searchWanted.current) return;

              searchWanted.current = false;
              window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
            }}
            sideOffset={6}
          >
            <GlassMenuItem
              onSelect={() => {
                searchWanted.current = true;
              }}
            >
              Search…
              <GlassMenuShortcut>⌘K</GlassMenuShortcut>
            </GlassMenuItem>
            <GlassMenuSeparator />
            <GlassMenuItem asChild>
              <Link href="/components">Components</Link>
            </GlassMenuItem>
            <GlassMenuItem asChild>
              <Link href="/docs">Getting Started</Link>
            </GlassMenuItem>
            <GlassMenuSeparator />
            <GlassMenuSub>
              <GlassMenuSubTrigger>Popular</GlassMenuSubTrigger>
              <GlassMenuSubContent>
                {POPULAR_COMPONENTS.map((item) => (
                  <GlassMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </GlassMenuItem>
                ))}
              </GlassMenuSubContent>
            </GlassMenuSub>
          </GlassMenuContent>
        </GlassMenu>
      </div>
      <div aria-hidden className="desk-status">
        <span className="desk-status-wifi" data-on={wifi}>
          <WifiGlyph />
        </span>
        <BatteryGlyph />
        <span className="desk-status-clock">
          <span className="desk-status-day">Tue </span>9:41
        </span>
      </div>
    </div>
  );
}

/**
 * A working desktop made only of library components: menus, widgets, a dock and a
 * settings sheet over a wallpaper. The screen is a GlassScene, so its glass
 * refracts the wallpaper.
 */
export function Desk() {
  const { preferences } = usePreferences();
  const [brightness, setBrightness] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [running, setRunning] = useState<string[]>(['Messages']);
  // The desk settles in once, with the page. Widgets or a dock shown again later appear at once.
  const [settling, setSettling] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showDock, setShowDock] = useState(true);
  const [showWidgets, setShowWidgets] = useState(true);
  const [wallpaper, setWallpaper] = useState<Wallpaper>('vermilion');
  const [wifi, setWifi] = useState(true);
  const appMenuRef = useRef<HTMLButtonElement>(null);
  // The menu item that opened the sheet is gone by the time it closes, so focus returns to its menu.
  const openedFromMenu = useRef(false);

  const deskStyle: DeskStyle = { '--desk-dim': `${((100 - brightness) / 100) * 0.72}` };

  useEffect(() => {
    const timer = window.setTimeout(() => setSettling(false), 2000);

    return () => window.clearTimeout(timer);
  }, []);

  const launch = (label: string) => (event: MouseEvent<HTMLButtonElement>) => {
    if (!preferences.reduceMotion) {
      event.currentTarget.firstElementChild?.animate(LAUNCH_BOUNCE, {
        duration: 820,
        easing: 'ease-out',
      });
    }

    setRunning((current) => (current.includes(label) ? current : [...current, label]));
  };

  return (
    <GlassSheet onOpenChange={setSettingsOpen} open={settingsOpen}>
      <GlassScene
        backdrop="var(--desk-wallpaper)"
        className="desk-screen"
        data-settling={settling || undefined}
        data-wallpaper={wallpaper}
        style={deskStyle}
      >
        <MenuBar
          appMenuRef={appMenuRef}
          onOpenSettings={() => {
            openedFromMenu.current = true;
            setSettingsOpen(true);
          }}
          onShowDockChange={setShowDock}
          onShowWidgetsChange={setShowWidgets}
          onWallpaperChange={setWallpaper}
          showDock={showDock}
          showWidgets={showWidgets}
          wallpaper={wallpaper}
          wifi={wifi}
        />
        {showWidgets ? (
          <div className="desk-widgets">
            <NowPlaying onPlayingChange={setPlaying} playing={playing} />
            <ControlCenter
              brightness={brightness}
              onBrightnessChange={setBrightness}
              onWifiChange={setWifi}
              wifi={wifi}
            />
          </div>
        ) : null}
        {showDock ? (
          <GlassDock aria-label="Dock" className="desk-dock" role="group">
            {DOCK_APPS.map((app) => (
              <GlassDockItem
                key={app.label}
                active={running.includes(app.label)}
                className={app.phone ? undefined : 'desk-dock-extra'}
                label={app.label}
                onClick={launch(app.label)}
              >
                {app.icon}
              </GlassDockItem>
            ))}
            <GlassDockItem active={playing} label="Music" onClick={() => setPlaying(!playing)}>
              <MusicIcon />
            </GlassDockItem>
            <GlassDockSeparator className="desk-dock-extra" />
            <GlassSheetTrigger asChild>
              <GlassDockItem active={settingsOpen} label="Settings">
                <SettingsIcon />
              </GlassDockItem>
            </GlassSheetTrigger>
          </GlassDock>
        ) : null}
      </GlassScene>
      <SettingsSheet
        onCloseAutoFocus={(event) => {
          if (!openedFromMenu.current) return;
          openedFromMenu.current = false;
          event.preventDefault();
          appMenuRef.current?.focus();
        }}
      />
    </GlassSheet>
  );
}
