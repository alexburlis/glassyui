'use client';

import { useSyncExternalStore } from 'react';
import type { PackageManager } from './install-command';

const STORAGE_KEY = 'glassy-ui-docs-package-manager';

const listeners = new Set<() => void>();

let chosen: PackageManager | null = null;

export const PACKAGE_MANAGERS: readonly PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

function readManager(): PackageManager {
  if (chosen) return chosen;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    chosen = PACKAGE_MANAGERS.find((manager) => manager === stored) ?? 'npm';
  } catch (error) {
    console.warn('Glassy UI could not read the package manager choice', error);
    chosen = 'npm';
  }

  return chosen;
}

function serverManager(): PackageManager {
  return 'npm';
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function chooseDocsPackageManager(manager: PackageManager) {
  chosen = manager;

  try {
    window.localStorage.setItem(STORAGE_KEY, manager);
  } catch (error) {
    console.warn('Glassy UI could not remember the package manager choice', error);
  }

  listeners.forEach((listener) => listener());
}

export function useDocsPackageManager() {
  return useSyncExternalStore(subscribe, readManager, serverManager);
}
