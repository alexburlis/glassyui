'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { GlassSegmentedControl, GlassSegmentedControlItem } from '@/components/liquid';

type DocsPlatform = 'react' | 'react-native';

const STORAGE_KEY = 'glassy-ui-docs-platform';

const listeners = new Set<() => void>();

let chosen: DocsPlatform | null = null;

let lastRoute: string | null = null;

function parsePlatform(value: string | null) {
  return value === 'react' || value === 'react-native' ? value : null;
}

function remember(platform: DocsPlatform) {
  try {
    window.localStorage.setItem(STORAGE_KEY, platform);
  } catch (error) {
    console.warn('Glassy UI could not remember the platform choice', error);
  }
}

function recalled() {
  try {
    return parsePlatform(window.localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn('Glassy UI could not read the platform choice', error);

    return null;
  }
}

// A ?platform= link wins and is remembered; otherwise the last choice in this browser.
function readPlatform(): DocsPlatform {
  const route = window.location.pathname + window.location.search;

  if (route !== lastRoute) {
    lastRoute = route;
    const linked = parsePlatform(new URLSearchParams(window.location.search).get('platform'));

    if (linked) {
      chosen = linked;
      remember(linked);
    }
  }

  chosen ??= recalled() ?? 'react';

  return chosen;
}

// Pages render the React version first; the browser then shows the remembered choice.
function serverPlatform(): DocsPlatform {
  return 'react';
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) lastRoute = null;
  };
}

function choosePlatform(platform: DocsPlatform) {
  chosen = platform;
  remember(platform);
  listeners.forEach((listener) => listener());
}

export function useDocsPlatform() {
  return useSyncExternalStore(subscribe, readPlatform, serverPlatform);
}

/** Switches a component page between its React and React Native install and usage. */
export function PlatformSwitch() {
  const platform = useDocsPlatform();

  return (
    <GlassSegmentedControl
      aria-label="Platform"
      className="docs-platform-switch"
      onValueChange={(value) => choosePlatform(parsePlatform(value) ?? 'react')}
      value={platform}
    >
      <GlassSegmentedControlItem value="react">React</GlassSegmentedControlItem>
      <GlassSegmentedControlItem value="react-native">React Native</GlassSegmentedControlItem>
    </GlassSegmentedControl>
  );
}

/** Shows its children only while the page is set to `platform`. */
export function PlatformPane({
  children,
  platform,
}: {
  children: ReactNode;
  platform: DocsPlatform;
}) {
  const current = useDocsPlatform();

  return (
    <div className="docs-platform-pane" hidden={current !== platform}>
      {children}
    </div>
  );
}
